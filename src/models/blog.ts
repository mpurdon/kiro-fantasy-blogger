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