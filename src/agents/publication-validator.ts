// Publication Validation and Confirmation Service

import { BlogPost, PublicationResult } from '../models/blog';
import { BlogPlatformClient } from '../api/blog-platform/types';
import { PublicationStatus } from './publisher-agent';

export interface ValidationResult {
  isValid: boolean;
  postExists: boolean;
  contentMatches: boolean;
  metadataMatches: boolean;
  errors: string[];
  warnings: string[];
  lastChecked: Date;
}

export interface PublicationTracker {
  trackPublication(result: PublicationResult, platform: string): Promise<void>;
  getPublicationStatus(postId: string): Promise<PublicationStatus | null>;
  getAllPublications(): Promise<Map<string, PublicationStatus[]>>;
  updatePublicationStatus(postId: string, platform: string, status: Partial<PublicationStatus>): Promise<void>;
  removePublication(postId: string): Promise<void>;
}

export interface PublicationLogger {
  logSuccess(postId: string, platform: string, url?: string): void;
  logFailure(postId: string, platform: string, error: string): void;
  logValidation(postId: string, platform: string, result: ValidationResult): void;
  logRetry(postId: string, platform: string, attempt: number, error: string): void;
}

export class PublicationValidator {
  private clients: Map<string, BlogPlatformClient>;
  private tracker: PublicationTracker;
  private logger: PublicationLogger;

  constructor(
    clients: Map<string, BlogPlatformClient>,
    tracker: PublicationTracker,
    logger: PublicationLogger
  ) {
    this.clients = clients;
    this.tracker = tracker;
    this.logger = logger;
  }

  public async validatePublication(
    postId: string,
    platform: string,
    originalPost: BlogPost
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: false,
      postExists: false,
      contentMatches: false,
      metadataMatches: false,
      errors: [],
      warnings: [],
      lastChecked: new Date()
    };

    try {
      const client = this.clients.get(platform);
      
      if (!client) {
        result.errors.push(`Platform ${platform} not available`);
        this.logger.logValidation(postId, platform, result);
        return result;
      }

      // Check if post exists
      try {
        const publishedPost = await client.getPost(postId);
        result.postExists = true;

        // Validate content matches
        result.contentMatches = this.validateContent(originalPost, publishedPost);
        
        // Validate metadata matches
        result.metadataMatches = this.validateMetadata(originalPost, publishedPost);

        // Overall validation
        result.isValid = result.postExists && result.contentMatches && result.metadataMatches;

        if (!result.contentMatches) {
          result.warnings.push('Published content differs from original');
        }

        if (!result.metadataMatches) {
          result.warnings.push('Published metadata differs from original');
        }

      } catch (error) {
        result.postExists = false;
        result.errors.push(`Failed to retrieve post: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    this.logger.logValidation(postId, platform, result);
    return result;
  }

  public async confirmPublication(
    result: PublicationResult,
    platform: string,
    originalPost: BlogPost,
    maxRetries: number = 3,
    retryDelay: number = 5000
  ): Promise<ValidationResult> {
    if (!result.success || !result.postId) {
      return {
        isValid: false,
        postExists: false,
        contentMatches: false,
        metadataMatches: false,
        errors: ['Publication was not successful or missing post ID'],
        warnings: [],
        lastChecked: new Date()
      };
    }

    let lastValidation: ValidationResult | null = null;

    // Retry validation with exponential backoff
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        lastValidation = await this.validatePublication(result.postId, platform, originalPost);

        if (lastValidation.isValid) {
          // Track successful publication
          await this.tracker.trackPublication(result, platform);
          this.logger.logSuccess(result.postId, platform, result.url);
          return lastValidation;
        }

        // If not valid and we have more attempts, wait and retry
        if (attempt < maxRetries) {
          await this.delay(retryDelay * attempt);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.logRetry(result.postId, platform, attempt, errorMessage);
        
        if (attempt === maxRetries) {
          lastValidation = {
            isValid: false,
            postExists: false,
            contentMatches: false,
            metadataMatches: false,
            errors: [`Validation failed after ${maxRetries} attempts: ${errorMessage}`],
            warnings: [],
            lastChecked: new Date()
          };
        } else {
          await this.delay(retryDelay * attempt);
        }
      }
    }

    // Log final failure
    if (lastValidation && !lastValidation.isValid) {
      this.logger.logFailure(
        result.postId,
        platform,
        `Publication validation failed: ${lastValidation.errors.join(', ')}`
      );
    }

    return lastValidation || {
      isValid: false,
      postExists: false,
      contentMatches: false,
      metadataMatches: false,
      errors: ['Validation failed completely'],
      warnings: [],
      lastChecked: new Date()
    };
  }

  public async batchValidatePublications(
    publications: Array<{ postId: string; platform: string; originalPost: BlogPost }>
  ): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();

    // Validate all publications concurrently
    const validationPromises = publications.map(async ({ postId, platform, originalPost }) => {
      try {
        const result = await this.validatePublication(postId, platform, originalPost);
        results.set(`${platform}:${postId}`, result);
      } catch (error) {
        results.set(`${platform}:${postId}`, {
          isValid: false,
          postExists: false,
          contentMatches: false,
          metadataMatches: false,
          errors: [`Batch validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          warnings: [],
          lastChecked: new Date()
        });
      }
    });

    await Promise.all(validationPromises);
    return results;
  }

  private validateContent(original: BlogPost, published: BlogPost): boolean {
    // Basic content validation - can be enhanced based on platform specifics
    const originalTitle = this.normalizeText(original.title);
    const publishedTitle = this.normalizeText(published.title);
    
    const originalContent = this.normalizeText(this.stripHtml(original.content));
    const publishedContent = this.normalizeText(this.stripHtml(published.content));

    // Allow for minor differences due to platform formatting
    const titleMatch = this.fuzzyMatch(originalTitle, publishedTitle, 0.85);
    const contentMatch = this.fuzzyMatch(originalContent, publishedContent, 0.75);

    return titleMatch && contentMatch;
  }

  private validateMetadata(original: BlogPost, published: BlogPost): boolean {
    // Validate key metadata fields
    const originalTags = new Set(original.metadata.tags.map(tag => tag.toLowerCase()));
    const publishedTags = new Set(published.metadata.tags.map(tag => tag.toLowerCase()));
    
    const originalCategories = new Set(original.metadata.categories.map(cat => cat.toLowerCase()));
    const publishedCategories = new Set(published.metadata.categories.map(cat => cat.toLowerCase()));

    // Check if most tags and categories are preserved
    const tagOverlap = this.setOverlap(originalTags, publishedTags);
    const categoryOverlap = this.setOverlap(originalCategories, publishedCategories);

    // Allow for some differences due to platform limitations
    return tagOverlap >= 0.7 && categoryOverlap >= 0.7;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  private fuzzyMatch(str1: string, str2: string, threshold: number): boolean {
    if (str1 === str2) return true;
    if (str1.length === 0 && str2.length === 0) return true;
    if (str1.length === 0 || str2.length === 0) return false;

    const similarity = this.calculateSimilarity(str1, str2);
    return similarity >= threshold;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private setOverlap(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 && set2.size === 0) return 1.0;
    if (set1.size === 0 || set2.size === 0) return 0.0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class InMemoryPublicationTracker implements PublicationTracker {
  private publications: Map<string, PublicationStatus[]> = new Map();

  public async trackPublication(result: PublicationResult, platform: string): Promise<void> {
    if (!result.postId) return;

    const status: PublicationStatus = {
      postId: result.postId,
      platform,
      status: result.status || 'published',
      url: result.url,
      publishedAt: result.publishedAt,
      lastChecked: new Date(),
      error: result.error
    };

    const existingStatuses = this.publications.get(result.postId) || [];
    existingStatuses.push(status);
    this.publications.set(result.postId, existingStatuses);
  }

  public async getPublicationStatus(postId: string): Promise<PublicationStatus | null> {
    const statuses = this.publications.get(postId);
    return statuses && statuses.length > 0 ? statuses[statuses.length - 1] : null;
  }

  public async getAllPublications(): Promise<Map<string, PublicationStatus[]>> {
    return new Map(this.publications);
  }

  public async updatePublicationStatus(
    postId: string,
    platform: string,
    updates: Partial<PublicationStatus>
  ): Promise<void> {
    const statuses = this.publications.get(postId);
    if (!statuses) return;

    const statusIndex = statuses.findIndex(s => s.platform === platform);
    if (statusIndex >= 0) {
      statuses[statusIndex] = { ...statuses[statusIndex], ...updates, lastChecked: new Date() };
      this.publications.set(postId, statuses);
    }
  }

  public async removePublication(postId: string): Promise<void> {
    this.publications.delete(postId);
  }
}

export class ConsolePublicationLogger implements PublicationLogger {
  public logSuccess(postId: string, platform: string, url?: string): void {
    console.log(`✅ Publication successful: ${postId} on ${platform}${url ? ` - ${url}` : ''}`);
  }

  public logFailure(postId: string, platform: string, error: string): void {
    console.error(`❌ Publication failed: ${postId} on ${platform} - ${error}`);
  }

  public logValidation(postId: string, platform: string, result: ValidationResult): void {
    const status = result.isValid ? '✅' : '❌';
    console.log(`${status} Validation ${postId} on ${platform}: valid=${result.isValid}, exists=${result.postExists}`);
    
    if (result.errors.length > 0) {
      console.error(`   Errors: ${result.errors.join(', ')}`);
    }
    
    if (result.warnings.length > 0) {
      console.warn(`   Warnings: ${result.warnings.join(', ')}`);
    }
  }

  public logRetry(postId: string, platform: string, attempt: number, error: string): void {
    console.warn(`🔄 Retry ${attempt} for ${postId} on ${platform}: ${error}`);
  }
}