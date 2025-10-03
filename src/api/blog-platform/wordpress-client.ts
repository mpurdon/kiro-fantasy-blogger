// WordPress API client implementation

import { AxiosRequestConfig } from 'axios';
import { BaseBlogClient } from './base-blog-client';
import { BlogPost } from '../../models/blog';
import { BlogPlatformConfig } from '../../models/config';
import { 
  PublicationResult, 
  BlogAuthConfig, 
  WordPressPost, 
  BlogCategory, 
  BlogTag,
  BlogAPIError 
} from './types';

export class WordPressClient extends BaseBlogClient {
  private categories: Map<string, number> = new Map();
  private tags: Map<string, number> = new Map();

  constructor(config: BlogPlatformConfig, authConfig: BlogAuthConfig = {}) {
    super(config, authConfig);
  }

  protected addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig {
    if (this.authConfig.username && this.authConfig.password) {
      // Basic authentication
      const credentials = Buffer.from(`${this.authConfig.username}:${this.authConfig.password}`).toString('base64');
      config.headers = {
        ...config.headers,
        'Authorization': `Basic ${credentials}`
      };
    } else if (this.authConfig.accessToken) {
      // Bearer token authentication
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${this.authConfig.accessToken}`
      };
    } else if (this.authConfig.apiKey) {
      // API key authentication (for some WordPress setups)
      config.headers = {
        ...config.headers,
        'X-API-Key': this.authConfig.apiKey
      };
    }
    return config;
  }

  public async authenticate(): Promise<void> {
    try {
      // Test authentication by fetching user info
      const endpoint = '/wp/v2/users/me';
      await this.get(endpoint);
      this.authenticated = true;
      
      // Load categories and tags for future use
      await this.loadCategoriesAndTags();
    } catch (error) {
      this.handleError(error, 'WordPress authentication failed');
    }
  }

  public async publishPost(post: BlogPost): Promise<PublicationResult> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const wordpressPost = await this.transformToWordPressPost(post);
      const endpoint = '/wp/v2/posts';
      
      const response = await this.post<WordPressPost>(endpoint, wordpressPost);
      
      if (response.data.id) {
        return this.createSuccessResult(
          response.data.id.toString(),
          response.data.link
        );
      } else {
        return this.createFailureResult('No post ID returned from WordPress');
      }
    } catch (error) {
      this.handleError(error, 'Failed to publish post to WordPress');
    }
  }

  public async updatePost(postId: string, post: BlogPost): Promise<PublicationResult> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const wordpressPost = await this.transformToWordPressPost(post);
      const endpoint = `/wp/v2/posts/${postId}`;
      
      const response = await this.put<WordPressPost>(endpoint, wordpressPost);
      
      if (response.data.id) {
        return this.createSuccessResult(
          response.data.id.toString(),
          response.data.link
        );
      } else {
        return this.createFailureResult('Failed to update WordPress post');
      }
    } catch (error) {
      this.handleError(error, `Failed to update WordPress post ${postId}`);
    }
  }

  public async deletePost(postId: string): Promise<boolean> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const endpoint = `/wp/v2/posts/${postId}`;
      const response = await this.delete(endpoint);
      
      return response.status === 200;
    } catch (error) {
      console.warn(`Failed to delete WordPress post ${postId}:`, error);
      return false;
    }
  }

  public async getPost(postId: string): Promise<BlogPost> {
    try {
      const endpoint = `/wp/v2/posts/${postId}`;
      const response = await this.get<WordPressPost>(endpoint, undefined, true);
      
      return this.transformFromWordPressPost(response.data);
    } catch (error) {
      this.handleError(error, `Failed to fetch WordPress post ${postId}`);
    }
  }

  public async listPosts(limit: number = 10, offset: number = 0): Promise<BlogPost[]> {
    try {
      const endpoint = '/wp/v2/posts';
      const params = {
        per_page: limit,
        offset,
        status: 'publish'
      };
      
      const response = await this.get<WordPressPost[]>(endpoint, params, true);
      
      return response.data.map(post => this.transformFromWordPressPost(post));
    } catch (error) {
      this.handleError(error, 'Failed to list WordPress posts');
    }
  }

  private async transformToWordPressPost(post: BlogPost): Promise<WordPressPost> {
    const categoryIds = await this.getCategoryIds(post.metadata.categories);
    const tagIds = await this.getTagIds(post.metadata.tags);

    return {
      title: {
        raw: post.title
      },
      content: {
        raw: post.content
      },
      excerpt: {
        raw: post.summary
      },
      status: 'publish',
      categories: categoryIds,
      tags: tagIds,
      meta: {
        seo_title: post.metadata.seoTitle,
        seo_description: post.metadata.seoDescription,
        ...post.metadata.customFields
      }
    };
  }

  private transformFromWordPressPost(wpPost: WordPressPost): BlogPost {
    return {
      title: wpPost.title.rendered || wpPost.title.raw || '',
      summary: wpPost.excerpt?.rendered || wpPost.excerpt?.raw || '',
      content: wpPost.content.rendered || wpPost.content.raw || '',
      metadata: {
        categories: [], // Would need to resolve category IDs to names
        tags: [], // Would need to resolve tag IDs to names
        author: 'System', // Default author
        seoTitle: wpPost.meta?.seo_title,
        seoDescription: wpPost.meta?.seo_description,
        ...(wpPost.meta && { customFields: wpPost.meta })
      },
      publishDate: wpPost.date ? new Date(wpPost.date) : new Date()
    };
  }

  private async loadCategoriesAndTags(): Promise<void> {
    try {
      // Load categories
      const categoriesResponse = await this.get<BlogCategory[]>('/wp/v2/categories', { per_page: 100 }, true);
      for (const category of categoriesResponse.data) {
        this.categories.set(category.name.toLowerCase(), category.id as number);
      }

      // Load tags
      const tagsResponse = await this.get<BlogTag[]>('/wp/v2/tags', { per_page: 100 }, true);
      for (const tag of tagsResponse.data) {
        this.tags.set(tag.name.toLowerCase(), tag.id as number);
      }
    } catch (error) {
      console.warn('Failed to load WordPress categories and tags:', error);
    }
  }

  private async getCategoryIds(categoryNames: string[]): Promise<number[]> {
    const ids: number[] = [];
    
    for (const name of categoryNames) {
      const nameLower = name.toLowerCase();
      let categoryId = this.categories.get(nameLower);
      
      if (!categoryId) {
        // Create new category if it doesn't exist
        try {
          const newCategory = await this.createCategory(name);
          categoryId = newCategory.id as number;
          this.categories.set(nameLower, categoryId);
        } catch (error) {
          console.warn(`Failed to create category "${name}":`, error);
          continue;
        }
      }
      
      ids.push(categoryId);
    }
    
    return ids;
  }

  private async getTagIds(tagNames: string[]): Promise<number[]> {
    const ids: number[] = [];
    
    for (const name of tagNames) {
      const nameLower = name.toLowerCase();
      let tagId = this.tags.get(nameLower);
      
      if (!tagId) {
        // Create new tag if it doesn't exist
        try {
          const newTag = await this.createTag(name);
          tagId = newTag.id as number;
          this.tags.set(nameLower, tagId);
        } catch (error) {
          console.warn(`Failed to create tag "${name}":`, error);
          continue;
        }
      }
      
      ids.push(tagId);
    }
    
    return ids;
  }

  private async createCategory(name: string): Promise<BlogCategory> {
    try {
      const endpoint = '/wp/v2/categories';
      const categoryData = {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      };
      
      const response = await this.post<BlogCategory>(endpoint, categoryData);
      return response.data;
    } catch (error) {
      throw new BlogAPIError(`Failed to create category "${name}"`, this.config.name);
    }
  }

  private async createTag(name: string): Promise<BlogTag> {
    try {
      const endpoint = '/wp/v2/tags';
      const tagData = {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      };
      
      const response = await this.post<BlogTag>(endpoint, tagData);
      return response.data;
    } catch (error) {
      throw new BlogAPIError(`Failed to create tag "${name}"`, this.config.name);
    }
  }

  public async uploadMedia(file: Buffer, filename: string, mimeType: string): Promise<any> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const endpoint = '/wp/v2/media';
      
      // WordPress expects multipart/form-data for media uploads
      const formData = new FormData();
      const blob = new Blob([file], { type: mimeType });
      formData.append('file', blob, filename);
      
      const response = await this.axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      this.handleError(error, `Failed to upload media file ${filename}`);
    }
  }

  public async setFeaturedImage(postId: string, mediaId: number): Promise<boolean> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const endpoint = `/wp/v2/posts/${postId}`;
      const updateData = {
        featured_media: mediaId
      };
      
      const response = await this.put(endpoint, updateData);
      return response.status === 200;
    } catch (error) {
      console.warn(`Failed to set featured image for post ${postId}:`, error);
      return false;
    }
  }

  public async getPostStatus(postId: string): Promise<string> {
    try {
      await this.getPost(postId);
      return 'published'; // Simplified - would need to check actual status from WordPress
    } catch (error) {
      return 'unknown';
    }
  }
}