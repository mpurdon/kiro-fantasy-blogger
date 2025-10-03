// Common types for blog platform API clients

import { BlogPost } from '../../models/blog';

export interface BlogPlatformClient {
  authenticate(): Promise<void>;
  publishPost(post: BlogPost): Promise<PublicationResult>;
  updatePost(postId: string, post: BlogPost): Promise<PublicationResult>;
  deletePost(postId: string): Promise<boolean>;
  getPost(postId: string): Promise<BlogPost>;
  listPosts(limit?: number, offset?: number): Promise<BlogPost[]>;
  isAuthenticated(): boolean;
}

export interface PublicationResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  publishedAt?: Date;
  status: 'published' | 'draft' | 'pending' | 'failed';
}

export interface BlogAuthConfig {
  apiKey?: string;
  username?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  blogId?: string;
  siteUrl?: string;
}

export interface WordPressPost {
  id?: number;
  date?: string;
  date_gmt?: string;
  guid?: {
    rendered: string;
  };
  modified?: string;
  modified_gmt?: string;
  slug?: string;
  status: 'publish' | 'future' | 'draft' | 'pending' | 'private';
  type?: string;
  link?: string;
  title: {
    rendered?: string;
    raw?: string;
  };
  content: {
    rendered?: string;
    raw?: string;
    protected?: boolean;
  };
  excerpt?: {
    rendered?: string;
    raw?: string;
    protected?: boolean;
  };
  author?: number;
  featured_media?: number;
  comment_status?: 'open' | 'closed';
  ping_status?: 'open' | 'closed';
  sticky?: boolean;
  template?: string;
  format?: string;
  meta?: Record<string, any>;
  categories?: number[];
  tags?: number[];
}

export interface MediumPost {
  id?: string;
  title: string;
  contentFormat: 'html' | 'markdown';
  content: string;
  tags?: string[];
  publishStatus: 'public' | 'draft' | 'unlisted';
  license?: string;
  notifyFollowers?: boolean;
  canonicalUrl?: string;
}

export interface MediumUser {
  id: string;
  username: string;
  name: string;
  url: string;
  imageUrl: string;
}

export interface MediumPublication {
  id: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string;
}

export interface BlogCategory {
  id: number | string;
  name: string;
  slug: string;
  description?: string;
  parent?: number | string;
}

export interface BlogTag {
  id: number | string;
  name: string;
  slug: string;
  description?: string;
}

// BlogMetadata is imported from ../../models/blog

export interface BlogPostStatus {
  postId: string;
  status: 'published' | 'draft' | 'pending' | 'failed' | 'scheduled';
  url?: string;
  publishedAt?: Date;
  lastModified?: Date;
  views?: number;
  comments?: number;
}

export interface BlogPlatformError extends Error {
  platform: string;
  statusCode?: number;
  response?: any;
}

export interface APIResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timestamp: Date;
}

export class BlogAPIError extends Error implements BlogPlatformError {
  public platform: string;
  public statusCode?: number;
  public response?: any;

  constructor(message: string, platform: string, statusCode?: number, response?: any) {
    super(message);
    this.name = 'BlogAPIError';
    this.platform = platform;
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
    this.response = response;
  }
}