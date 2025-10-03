// Publisher Agent implementation

import { BlogPost, PublicationResult, BlogValidator, BlogTransformer } from '../models/blog';
import { SystemConfig, BlogPlatformConfig } from '../models/config';
import { BlogPlatformClient, BlogAuthConfig } from '../api/blog-platform/types';
import { WordPressClient } from '../api/blog-platform/wordpress-client';
import { MediumClient } from '../api/blog-platform/medium-client';
import { PublisherAgent as IPublisherAgent, BaseAgent } from './interfaces';
import { 
  PublicationValidator, 
  InMemoryPublicationTracker, 
  ConsolePublicationLogger,
  ValidationResult 
} from './publication-validator';

export interface PublisherAgentConfig {
  primaryPlatform: string;
  fallbackPlatforms?: string[];
  retryAttempts: number;
  retryDelay: number;
  validateBeforePublish: boolean;
  trackPublicationStatus: boolean;
}

export interface PublicationStatus {
  postId: string;
  platform: string;
  status: 'published' | 'draft' | 'pending' | 'failed' | 'scheduled';
  url?: string;
  publishedAt?: Date;
  lastChecked: Date;
  error?: string;
}

export class PublisherAgent implements IPublisherAgent, BaseAgent {
  public readonly name = 'PublisherAgent';
  
  private config: PublisherAgentConfig;
  private systemConfig: SystemConfig;
  private clients: Map<string, BlogPlatformClient> = new Map();
  private publicationHistory: Map<string, PublicationStatus[]> = new Map();
  private validator: PublicationValidator;
  private tracker: InMemoryPublicationTracker;
  private logger: ConsolePublicationLogger;

  constructor(
    systemConfig: SystemConfig,
    config: PublisherAgentConfig = {
      primaryPlatform: 'wordpress',
      retryAttempts: 3,
      retryDelay: 5000,
      validateBeforePublish: true,
      trackPublicationStatus: true
    }
  ) {
    this.systemConfig = systemConfig;
    this.config = config;
    
    // Initialize validation components
    this.tracker = new InMemoryPublicationTracker();
    this.logger = new ConsolePublicationLogger();
    this.validator = new PublicationValidator(this.clients, this.tracker, this.logger);
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize blog platform clients
      await this.initializeBlogClients();
      
      console.log(`${this.name} initialized successfully`);
    } catch (error) {
      console.error(`Failed to initialize ${this.name}:`, error);
      throw error;
    }
  }

  public async execute(input: BlogPost): Promise<PublicationResult> {
    return this.publishPost(input);
  }

  public async cleanup(): Promise<void> {
    // Clear any cached data
    this.publicationHistory.clear();
    
    // Clear client caches
    for (const client of this.clients.values()) {
      if ('clearCache' in client && typeof client.clearCache === 'function') {
        client.clearCache();
      }
    }
    
    console.log(`${this.name} cleanup completed`);
  }

  public async publishPost(post: BlogPost): Promise<PublicationResult> {
    try {
      // Validate blog post before publishing
      if (this.config.validateBeforePublish && !this.validatePost(post)) {
        return this.createFailureResult('Blog post validation failed');
      }

      // Optimize post for publication
      const optimizedPost = this.optimizePost(post);

      // Attempt to publish to primary platform
      const primaryResult = await this.publishToPlatform(
        this.config.primaryPlatform,
        optimizedPost
      );

      if (primaryResult.success) {
        // Validate and confirm publication if enabled
        if (this.config.trackPublicationStatus && primaryResult.postId) {
          const validationResult = await this.validator.confirmPublication(
            primaryResult,
            this.config.primaryPlatform,
            optimizedPost
          );
          
          if (!validationResult.isValid) {
            console.warn(`Publication validation failed for ${primaryResult.postId}: ${validationResult.errors.join(', ')}`);
          }
        }

        return primaryResult;
      }

      // If primary platform failed, try fallback platforms
      if (this.config.fallbackPlatforms && this.config.fallbackPlatforms.length > 0) {
        console.warn(`Primary platform ${this.config.primaryPlatform} failed, trying fallback platforms`);
        
        for (const platform of this.config.fallbackPlatforms) {
          try {
            const fallbackResult = await this.publishToPlatform(platform, optimizedPost);
            
            if (fallbackResult.success) {
              console.log(`Successfully published to fallback platform: ${platform}`);
              
              if (this.config.trackPublicationStatus && fallbackResult.postId) {
                const validationResult = await this.validator.confirmPublication(
                  fallbackResult,
                  platform,
                  optimizedPost
                );
                
                if (!validationResult.isValid) {
                  console.warn(`Fallback publication validation failed for ${fallbackResult.postId}: ${validationResult.errors.join(', ')}`);
                }
              }
              
              return fallbackResult;
            }
          } catch (error) {
            console.warn(`Fallback platform ${platform} also failed:`, error);
          }
        }
      }

      return primaryResult; // Return the original failure result
    } catch (error) {
      console.error('Publisher Agent execution failed:', error);
      return this.createFailureResult(
        error instanceof Error ? error.message : 'Unknown publication error'
      );
    }
  }

  private async initializeBlogClients(): Promise<void> {
    if (!this.systemConfig.blog) {
      throw new Error('Blog platform configuration not found');
    }

    // For now, we'll work with a single blog platform from the config
    // In the future, this could be extended to support multiple platforms
    const platformConfig = this.systemConfig.blog;
    
    try {
      const client = await this.createBlogClient(platformConfig);
      await client.authenticate();
      
      this.clients.set(platformConfig.name, client);
      console.log(`Initialized blog client for platform: ${platformConfig.name}`);
    } catch (error) {
      console.error(`Failed to initialize blog client for ${platformConfig.name}:`, error);
      throw new Error(`Failed to initialize primary blog platform: ${platformConfig.name}`);
    }

    // Verify primary platform is available
    if (!this.clients.has(this.config.primaryPlatform)) {
      throw new Error(`Primary blog platform ${this.config.primaryPlatform} is not available`);
    }
  }

  private async createBlogClient(platformConfig: BlogPlatformConfig): Promise<BlogPlatformClient> {
    const authConfig: BlogAuthConfig = {
      apiKey: platformConfig.apiKey,
      ...(platformConfig.username && { username: platformConfig.username }),
      ...(platformConfig.blogId && { blogId: platformConfig.blogId })
    };

    // Determine platform type from name (since type is not in BlogPlatformConfig)
    const platformType = this.determinePlatformType(platformConfig.name);

    switch (platformType.toLowerCase()) {
      case 'wordpress':
        return new WordPressClient(platformConfig, authConfig);
      
      case 'medium':
        return new MediumClient(platformConfig, authConfig);
      
      default:
        throw new Error(`Unsupported blog platform type: ${platformType}`);
    }
  }

  private determinePlatformType(platformName: string): string {
    const name = platformName.toLowerCase();
    if (name.includes('wordpress') || name.includes('wp')) {
      return 'wordpress';
    } else if (name.includes('medium')) {
      return 'medium';
    } else {
      // Default to wordpress for unknown platforms
      return 'wordpress';
    }
  }

  private async publishToPlatform(
    platformName: string,
    post: BlogPost
  ): Promise<PublicationResult> {
    const client = this.clients.get(platformName);
    
    if (!client) {
      return this.createFailureResult(`Blog platform ${platformName} not available`);
    }

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`Publishing to ${platformName} (attempt ${attempt}/${this.config.retryAttempts})`);
        
        const result = await client.publishPost(post);
        
        if (result.success) {
          console.log(`Successfully published to ${platformName}: ${result.postId}`);
          return result;
        } else {
          console.warn(`Publication to ${platformName} failed: ${result.error}`);
          lastError = new Error(result.error || 'Publication failed');
        }
      } catch (error) {
        console.warn(`Attempt ${attempt} failed for ${platformName}:`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Wait before retrying (except on last attempt)
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    return this.createFailureResult(
      `Failed to publish to ${platformName} after ${this.config.retryAttempts} attempts: ${
        lastError?.message || 'Unknown error'
      }`
    );
  }

  private validatePost(post: BlogPost): boolean {
    try {
      return BlogValidator.validateBlogPost(post);
    } catch (error) {
      console.error('Blog post validation error:', error);
      return false;
    }
  }

  private optimizePost(post: BlogPost): BlogPost {
    return {
      ...post,
      title: BlogTransformer.sanitizeTitle(post.title),
      summary: BlogTransformer.truncateSummary(post.summary),
      metadata: {
        ...post.metadata,
        seoTitle: post.metadata.seoTitle || BlogTransformer.optimizeSEOTitle(post.title),
        seoDescription: post.metadata.seoDescription || BlogTransformer.optimizeSEODescription(post.summary),
        tags: BlogTransformer.cleanTags(post.metadata.tags),
        categories: BlogTransformer.cleanCategories(post.metadata.categories)
      }
    };
  }

  private async trackPublicationStatus(
    postId: string,
    platform: string,
    result: PublicationResult
  ): Promise<void> {
    const status: PublicationStatus = {
      postId,
      platform,
      status: 'published', // Default status since PublicationResult doesn't have status
      lastChecked: new Date(),
      ...(result.url && { url: result.url }),
      ...(result.publishedAt && { publishedAt: result.publishedAt }),
      ...(result.error && { error: result.error })
    };

    const existingStatuses = this.publicationHistory.get(postId) || [];
    existingStatuses.push(status);
    this.publicationHistory.set(postId, existingStatuses);

    console.log(`Tracked publication status for post ${postId} on ${platform}: ${status.status}`);
  }

  private createFailureResult(error: string): PublicationResult {
    return BlogTransformer.createPublicationResult(false, undefined, undefined, error);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for publication management

  public async verifyPublication(postId: string, platform: string): Promise<boolean> {
    try {
      const client = this.clients.get(platform);
      
      if (!client) {
        console.warn(`Platform ${platform} not available for verification`);
        return false;
      }

      // Try to fetch the post to verify it exists
      await client.getPost(postId);
      return true;
    } catch (error) {
      console.warn(`Failed to verify publication ${postId} on ${platform}:`, error);
      return false;
    }
  }

  public async updatePost(
    postId: string,
    platform: string,
    updatedPost: BlogPost
  ): Promise<PublicationResult> {
    try {
      const client = this.clients.get(platform);
      
      if (!client) {
        return this.createFailureResult(`Platform ${platform} not available`);
      }

      if (this.config.validateBeforePublish && !this.validatePost(updatedPost)) {
        return this.createFailureResult('Updated blog post validation failed');
      }

      const optimizedPost = this.optimizePost(updatedPost);
      const result = await client.updatePost(postId, optimizedPost);

      if (result.success && this.config.trackPublicationStatus) {
        await this.trackPublicationStatus(postId, platform, result);
      }

      return result;
    } catch (error) {
      console.error(`Failed to update post ${postId} on ${platform}:`, error);
      return this.createFailureResult(
        error instanceof Error ? error.message : 'Unknown update error'
      );
    }
  }

  public async deletePost(postId: string, platform: string): Promise<boolean> {
    try {
      const client = this.clients.get(platform);
      
      if (!client) {
        console.warn(`Platform ${platform} not available for deletion`);
        return false;
      }

      const success = await client.deletePost(postId);
      
      if (success) {
        // Remove from publication history
        this.publicationHistory.delete(postId);
        console.log(`Successfully deleted post ${postId} from ${platform}`);
      }

      return success;
    } catch (error) {
      console.error(`Failed to delete post ${postId} from ${platform}:`, error);
      return false;
    }
  }

  public getPublicationHistory(postId?: string): Map<string, PublicationStatus[]> | PublicationStatus[] {
    if (postId) {
      return this.publicationHistory.get(postId) || [];
    }
    
    return this.publicationHistory;
  }

  public getAvailablePlatforms(): string[] {
    return Array.from(this.clients.keys());
  }

  public async checkPlatformHealth(platform: string): Promise<boolean> {
    try {
      const client = this.clients.get(platform);
      
      if (!client) {
        return false;
      }

      return client.isAuthenticated();
    } catch (error) {
      console.warn(`Health check failed for platform ${platform}:`, error);
      return false;
    }
  }

  public async refreshPlatformAuthentication(platform: string): Promise<boolean> {
    try {
      const client = this.clients.get(platform);
      
      if (!client) {
        return false;
      }

      await client.authenticate();
      return client.isAuthenticated();
    } catch (error) {
      console.error(`Failed to refresh authentication for platform ${platform}:`, error);
      return false;
    }
  }

  // Enhanced validation methods

  public async validatePublication(
    postId: string,
    platform: string,
    originalPost: BlogPost
  ): Promise<ValidationResult> {
    return this.validator.validatePublication(postId, platform, originalPost);
  }

  public async confirmPublicationWithValidation(
    result: PublicationResult,
    platform: string,
    originalPost: BlogPost
  ): Promise<ValidationResult> {
    return this.validator.confirmPublication(result, platform, originalPost);
  }

  public async batchValidatePublications(
    publications: Array<{ postId: string; platform: string; originalPost: BlogPost }>
  ): Promise<Map<string, ValidationResult>> {
    return this.validator.batchValidatePublications(publications);
  }

  public async getPublicationStatusFromTracker(postId: string): Promise<PublicationStatus | null> {
    return this.tracker.getPublicationStatus(postId);
  }

  public async getAllTrackedPublications(): Promise<Map<string, PublicationStatus[]>> {
    return this.tracker.getAllPublications();
  }

  public async updateTrackedPublicationStatus(
    postId: string,
    platform: string,
    updates: Partial<PublicationStatus>
  ): Promise<void> {
    return this.tracker.updatePublicationStatus(postId, platform, updates);
  }

  public async removeTrackedPublication(postId: string): Promise<void> {
    return this.tracker.removePublication(postId);
  }

  public async performHealthCheck(): Promise<Map<string, boolean>> {
    const healthStatus = new Map<string, boolean>();
    
    for (const [platform, client] of this.clients) {
      try {
        const isHealthy = client.isAuthenticated();
        healthStatus.set(platform, isHealthy);
      } catch (error) {
        console.warn(`Health check failed for platform ${platform}:`, error);
        healthStatus.set(platform, false);
      }
    }
    
    return healthStatus;
  }

  public async getPublicationMetrics(): Promise<{
    totalPublications: number;
    successfulPublications: number;
    failedPublications: number;
    platformBreakdown: Map<string, { successful: number; failed: number }>;
  }> {
    const allPublications = await this.tracker.getAllPublications();
    let totalPublications = 0;
    let successfulPublications = 0;
    let failedPublications = 0;
    const platformBreakdown = new Map<string, { successful: number; failed: number }>();

    for (const [, statuses] of allPublications) {
      for (const status of statuses) {
        totalPublications++;
        
        if (status.status === 'published') {
          successfulPublications++;
        } else if (status.status === 'failed') {
          failedPublications++;
        }

        const platformStats = platformBreakdown.get(status.platform) || { successful: 0, failed: 0 };
        if (status.status === 'published') {
          platformStats.successful++;
        } else if (status.status === 'failed') {
          platformStats.failed++;
        }
        platformBreakdown.set(status.platform, platformStats);
      }
    }

    return {
      totalPublications,
      successfulPublications,
      failedPublications,
      platformBreakdown
    };
  }
}