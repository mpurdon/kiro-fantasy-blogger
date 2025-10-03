// Configuration-related data models and interfaces

export interface SystemConfig {
  schedule: {
    dayOfWeek: number; // 0-6, Sunday = 0
    hour: number; // 0-23
    timezone: string;
  };
  apis: {
    fantasyPlatforms: PlatformConfig[];
    newsServices: NewsServiceConfig[];
    sportsData: SportsDataConfig;
  };
  blog: BlogPlatformConfig;
  agents: AgentConfig[];
}

export interface PlatformConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  enabled: boolean;
}

export interface NewsServiceConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  enabled: boolean;
}

export interface SportsDataConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  enabled: boolean;
}

export interface BlogPlatformConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  username?: string;
  blogId?: string;
  defaultTags: string[];
  defaultCategories: string[];
}

export interface AgentConfig {
  name: string;
  enabled: boolean;
  timeout: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

export interface ExecutionResult {
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  agentsExecuted: string[];
  errors: Error[];
  warnings: string[];
  publishedPostId?: string;
}

export interface ExecutionStatus {
  isRunning: boolean;
  currentAgent?: string;
  progress: number; // 0-100
  startTime?: Date;
  estimatedCompletion?: Date;
}