// Medium API client implementation

import { AxiosRequestConfig } from 'axios';
import { BaseBlogClient } from './base-blog-client';
import { BlogPost } from '../../models/blog';
import { BlogPlatformConfig } from '../../models/config';
import { 
  PublicationResult, 
  BlogAuthConfig, 
  MediumPost, 
  MediumUser, 
  MediumPublication,
  BlogAPIError 
} from './types';

export class MediumClient extends BaseBlogClient {
  private userId?: string;
  private publications: MediumPublication[] = [];

  constructor(config: BlogPlatformConfig, authConfig: BlogAuthConfig = {}) {
    super(config, authConfig);
  }

  protected addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig {
    if (this.authConfig.accessToken) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${this.authConfig.accessToken}`
      };
    }
    return config;
  }

  public async authenticate(): Promise<void> {
    if (!this.authConfig.accessToken) {
      throw new BlogAPIError('Medium requires an access token', this.config.name);
    }

    try {
      // Get user information to verify authentication
      const endpoint = '/v1/me';
      const response = await this.get<{ data: MediumUser }>(endpoint);
      
      this.userId = response.data.data.id;
      this.authenticated = true;
      
      // Load user's publications
      await this.loadPublications();
    } catch (error) {
      this.handleError(error, 'Medium authentication failed');
    }
  }

  public async publishPost(post: BlogPost): Promise<PublicationResult> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const mediumPost = this.transformToMediumPost(post);
      
      // Determine if we should publish to a publication or user's profile
      const publicationId = this.getTargetPublication();
      
      let endpoint: string;
      if (publicationId) {
        endpoint = `/v1/publications/${publicationId}/posts`;
      } else {
        endpoint = `/v1/users/${this.userId}/posts`;
      }
      
      const response = await this.post<{ data: any }>(endpoint, mediumPost);
      
      if (response.data.data && response.data.data.id) {
        return this.createSuccessResult(
          response.data.data.id,
          response.data.data.url
        );
      } else {
        return this.createFailureResult('No post ID returned from Medium');
      }
    } catch (error) {
      this.handleError(error, 'Failed to publish post to Medium');
    }
  }

  public async updatePost(_postId: string, _post: BlogPost): Promise<PublicationResult> {
    // Medium API doesn't support updating posts after publication
    // This is a limitation of the Medium platform
    return this.createFailureResult('Medium does not support updating published posts');
  }

  public async deletePost(_postId: string): Promise<boolean> {
    // Medium API doesn't support deleting posts
    // This is a limitation of the Medium platform
    console.warn('Medium does not support deleting posts via API');
    return false;
  }

  public async getPost(_postId: string): Promise<BlogPost> {
    // Medium API has limited read capabilities
    // This would require web scraping or other methods
    throw new BlogAPIError('Medium API does not support fetching individual posts', this.config.name);
  }

  public async listPosts(_limit: number = 10, _offset: number = 0): Promise<BlogPost[]> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const endpoint = `/v1/users/${this.userId}/posts`;
      const response = await this.get<{ data: any[] }>(endpoint, undefined, true);
      
      // Medium API returns limited post data
      return response.data.data.map(post => this.transformFromMediumPost(post));
    } catch (error) {
      this.handleError(error, 'Failed to list Medium posts');
    }
  }

  private transformToMediumPost(post: BlogPost): MediumPost {
    // Convert HTML content to Markdown if needed
    const content = this.convertToMarkdown(post.content);
    
    return {
      title: post.title,
      contentFormat: 'markdown',
      content,
      tags: post.metadata.tags.slice(0, 5), // Medium allows max 5 tags
      publishStatus: 'public',
      notifyFollowers: true,
      ...(post.metadata.customFields?.canonicalUrl && {
        canonicalUrl: post.metadata.customFields.canonicalUrl as string
      })
    };
  }

  private transformFromMediumPost(mediumPost: any): BlogPost {
    return {
      title: mediumPost.title || '',
      summary: '', // Medium API doesn't provide excerpts
      content: mediumPost.content || '',
      metadata: {
        categories: [],
        tags: mediumPost.tags || [],
        author: 'System', // Default author
        customFields: {
          mediumId: mediumPost.id,
          mediumUrl: mediumPost.url
        }
      },
      publishDate: mediumPost.publishedAt ? new Date(mediumPost.publishedAt) : new Date()
    };
  }

  private async loadPublications(): Promise<void> {
    if (!this.userId) {
      return;
    }

    try {
      const endpoint = `/v1/users/${this.userId}/publications`;
      const response = await this.get<{ data: MediumPublication[] }>(endpoint, undefined, true);
      
      this.publications = response.data.data || [];
    } catch (error) {
      console.warn('Failed to load Medium publications:', error);
      this.publications = [];
    }
  }

  private getTargetPublication(): string | undefined {
    // If a specific publication is configured, use it
    if (this.authConfig.blogId) {
      return this.authConfig.blogId;
    }
    
    // Otherwise, use the first available publication
    if (this.publications.length > 0) {
      return this.publications[0]!.id;
    }
    
    // Fallback to user's profile (no publication)
    return undefined;
  }

  private convertToMarkdown(html: string): string {
    // Basic HTML to Markdown conversion
    // In a real implementation, you'd use a proper HTML-to-Markdown converter
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_match, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_match, content) => {
        let counter = 1;
        return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. $1\n`) + '\n';
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
      .trim();
  }

  public async getPublications(): Promise<MediumPublication[]> {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    return this.publications;
  }

  public async getUserInfo(): Promise<MediumUser | null> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const endpoint = '/v1/me';
      const response = await this.get<{ data: MediumUser }>(endpoint);
      
      return response.data.data;
    } catch (error) {
      console.warn('Failed to get Medium user info:', error);
      return null;
    }
  }

  public async publishToPublication(post: BlogPost, publicationId: string): Promise<PublicationResult> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const mediumPost = this.transformToMediumPost(post);
      const endpoint = `/v1/publications/${publicationId}/posts`;
      
      const response = await this.post<{ data: any }>(endpoint, mediumPost);
      
      if (response.data.data && response.data.data.id) {
        return this.createSuccessResult(
          response.data.data.id,
          response.data.data.url
        );
      } else {
        return this.createFailureResult('No post ID returned from Medium');
      }
    } catch (error) {
      this.handleError(error, `Failed to publish post to Medium publication ${publicationId}`);
    }
  }

  public setTargetPublication(publicationId: string): void {
    this.authConfig.blogId = publicationId;
  }

  public getPostStatus(_postId: string): Promise<string> {
    // Medium doesn't provide detailed post status information
    return Promise.resolve('published');
  }
}