// Blog-related data models and interfaces

export interface BlogPost {
  title: string;
  summary: string;
  content: string;
  metadata: BlogMetadata;
  publishDate: Date;
}

export interface BlogMetadata {
  tags: string[];
  categories: string[];
  author: string;
  seoTitle?: string;
  seoDescription?: string;
  featuredImage?: string;
  customFields?: Record<string, any>;
}

export interface PublicationResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  publishedAt?: Date;
}

export interface DataQualityIssue {
  type: 'missing_data' | 'invalid_format' | 'stale_data' | 'api_error';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedPlayer?: string;
}

// Validation functions for blog data integrity
export class BlogValidator {
  static validateBlogPost(post: BlogPost): boolean {
    if (!post.title || typeof post.title !== 'string' || post.title.trim() === '') {
      return false;
    }
    
    if (post.title.length > 200) {
      return false;
    }
    
    if (!post.summary || typeof post.summary !== 'string' || post.summary.trim() === '') {
      return false;
    }
    
    if (post.summary.length > 500) {
      return false;
    }
    
    if (!post.content || typeof post.content !== 'string' || post.content.trim() === '') {
      return false;
    }
    
    if (!this.validateBlogMetadata(post.metadata)) {
      return false;
    }
    
    if (!(post.publishDate instanceof Date) || isNaN(post.publishDate.getTime())) {
      return false;
    }
    
    return true;
  }

  static validateBlogMetadata(metadata: BlogMetadata): boolean {
    if (!Array.isArray(metadata.tags)) {
      return false;
    }
    
    if (!metadata.tags.every(tag => typeof tag === 'string' && tag.trim() !== '')) {
      return false;
    }
    
    if (!Array.isArray(metadata.categories)) {
      return false;
    }
    
    if (!metadata.categories.every(cat => typeof cat === 'string' && cat.trim() !== '')) {
      return false;
    }
    
    if (!metadata.author || typeof metadata.author !== 'string' || metadata.author.trim() === '') {
      return false;
    }
    
    if (metadata.seoTitle !== undefined && 
        (typeof metadata.seoTitle !== 'string' || metadata.seoTitle.trim() === '' || metadata.seoTitle.length > 60)) {
      return false;
    }
    
    if (metadata.seoDescription !== undefined && 
        (typeof metadata.seoDescription !== 'string' || metadata.seoDescription.trim() === '' || metadata.seoDescription.length > 160)) {
      return false;
    }
    
    if (metadata.featuredImage !== undefined && 
        (typeof metadata.featuredImage !== 'string' || !this.isValidUrl(metadata.featuredImage))) {
      return false;
    }
    
    return true;
  }

  static validatePublicationResult(result: PublicationResult): boolean {
    if (typeof result.success !== 'boolean') {
      return false;
    }
    
    if (result.postId !== undefined && 
        (typeof result.postId !== 'string' || result.postId.trim() === '')) {
      return false;
    }
    
    if (result.url !== undefined && 
        (typeof result.url !== 'string' || !this.isValidUrl(result.url))) {
      return false;
    }
    
    if (result.error !== undefined && 
        (typeof result.error !== 'string' || result.error.trim() === '')) {
      return false;
    }
    
    if (result.publishedAt !== undefined && 
        (!(result.publishedAt instanceof Date) || isNaN(result.publishedAt.getTime()))) {
      return false;
    }
    
    // Success results should have postId, failed results should have error
    if (result.success && !result.postId) {
      return false;
    }
    
    if (!result.success && !result.error) {
      return false;
    }
    
    return true;
  }

  static validateDataQualityIssue(issue: DataQualityIssue): boolean {
    const validTypes = ['missing_data', 'invalid_format', 'stale_data', 'api_error'];
    if (!validTypes.includes(issue.type)) {
      return false;
    }
    
    if (!issue.description || typeof issue.description !== 'string' || issue.description.trim() === '') {
      return false;
    }
    
    const validSeverities = ['low', 'medium', 'high'];
    if (!validSeverities.includes(issue.severity)) {
      return false;
    }
    
    if (issue.affectedPlayer !== undefined && 
        (typeof issue.affectedPlayer !== 'string' || issue.affectedPlayer.trim() === '')) {
      return false;
    }
    
    return true;
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Utility functions for blog data transformation
export class BlogTransformer {
  static sanitizeTitle(title: string): string {
    return title.trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-:]/g, '')
      .substring(0, 200);
  }

  static generateSlug(title: string): string {
    return title.toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  static truncateSummary(summary: string, maxLength: number = 500): string {
    if (summary.length <= maxLength) {
      return summary;
    }
    
    const truncated = summary.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  static optimizeSEOTitle(title: string): string {
    const optimized = title.trim();
    
    if (optimized.length <= 60) {
      return optimized;
    }
    
    // Try to truncate at word boundary
    const truncated = optimized.substring(0, 57);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > 40) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  static optimizeSEODescription(description: string): string {
    const optimized = description.trim();
    
    if (optimized.length <= 160) {
      return optimized;
    }
    
    // Try to truncate at word boundary
    const truncated = optimized.substring(0, 157);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > 120) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  static cleanTags(tags: string[]): string[] {
    return tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .filter((tag, index, array) => array.indexOf(tag) === index) // Remove duplicates
      .sort();
  }

  static cleanCategories(categories: string[]): string[] {
    return categories
      .map(cat => cat.trim())
      .filter(cat => cat.length > 0)
      .filter((cat, index, array) => array.indexOf(cat) === index) // Remove duplicates
      .sort();
  }

  static stripHtmlTags(content: string): string {
    return content.replace(/<[^>]*>/g, '').trim();
  }

  static estimateReadingTime(content: string): number {
    const plainText = this.stripHtmlTags(content);
    const wordCount = plainText.split(/\s+/).length;
    const wordsPerMinute = 200; // Average reading speed
    
    return Math.ceil(wordCount / wordsPerMinute);
  }

  static createPublicationResult(
    success: boolean,
    postId?: string,
    url?: string,
    error?: string
  ): PublicationResult {
    const result: PublicationResult = {
      success,
      ...(postId && { postId }),
      ...(url && { url }),
      ...(error && { error }),
      ...(success && { publishedAt: new Date() })
    };
    
    return result;
  }

  static categorizeDataQualityIssues(issues: DataQualityIssue[]): {
    high: DataQualityIssue[];
    medium: DataQualityIssue[];
    low: DataQualityIssue[];
  } {
    return {
      high: issues.filter(issue => issue.severity === 'high'),
      medium: issues.filter(issue => issue.severity === 'medium'),
      low: issues.filter(issue => issue.severity === 'low')
    };
  }

  static summarizeDataQualityIssues(issues: DataQualityIssue[]): string {
    if (issues.length === 0) {
      return 'No data quality issues detected';
    }
    
    const categorized = this.categorizeDataQualityIssues(issues);
    const parts: string[] = [];
    
    if (categorized.high.length > 0) {
      parts.push(`${categorized.high.length} high severity issue${categorized.high.length > 1 ? 's' : ''}`);
    }
    
    if (categorized.medium.length > 0) {
      parts.push(`${categorized.medium.length} medium severity issue${categorized.medium.length > 1 ? 's' : ''}`);
    }
    
    if (categorized.low.length > 0) {
      parts.push(`${categorized.low.length} low severity issue${categorized.low.length > 1 ? 's' : ''}`);
    }
    
    return `Found ${issues.length} data quality issue${issues.length > 1 ? 's' : ''}: ${parts.join(', ')}`;
  }

  static createDataQualityIssue(
    type: DataQualityIssue['type'],
    description: string,
    severity: DataQualityIssue['severity'],
    affectedPlayer?: string
  ): DataQualityIssue {
    return {
      type,
      description,
      severity,
      ...(affectedPlayer && { affectedPlayer })
    };
  }
}