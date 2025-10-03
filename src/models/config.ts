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

// Configuration validation functions
export class ConfigValidator {
  static validateSystemConfig(config: SystemConfig): boolean {
    if (!this.validateScheduleConfig(config.schedule)) {
      return false;
    }
    
    if (!this.validateApisConfig(config.apis)) {
      return false;
    }
    
    if (!this.validateBlogPlatformConfig(config.blog)) {
      return false;
    }
    
    if (!Array.isArray(config.agents) || config.agents.length === 0) {
      return false;
    }
    
    if (!config.agents.every(agent => this.validateAgentConfig(agent))) {
      return false;
    }
    
    return true;
  }

  static validateScheduleConfig(schedule: any): boolean {
    if (typeof schedule.dayOfWeek !== 'number' || 
        schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6) {
      return false;
    }
    
    if (typeof schedule.hour !== 'number' || 
        schedule.hour < 0 || schedule.hour > 23) {
      return false;
    }
    
    if (!schedule.timezone || typeof schedule.timezone !== 'string' || 
        schedule.timezone.trim() === '') {
      return false;
    }
    
    return true;
  }

  static validateApisConfig(apis: any): boolean {
    if (!Array.isArray(apis.fantasyPlatforms)) {
      return false;
    }
    
    if (!apis.fantasyPlatforms.every((platform: any) => this.validatePlatformConfig(platform))) {
      return false;
    }
    
    if (!Array.isArray(apis.newsServices)) {
      return false;
    }
    
    if (!apis.newsServices.every((service: any) => this.validateNewsServiceConfig(service))) {
      return false;
    }
    
    if (!this.validateSportsDataConfig(apis.sportsData)) {
      return false;
    }
    
    return true;
  }

  static validatePlatformConfig(config: PlatformConfig): boolean {
    if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
      return false;
    }
    
    // Allow empty API keys in test environment
    if (typeof config.apiKey !== 'string') {
      return false;
    }
    
    if (config.apiKey.trim() === '' && process.env.NODE_ENV !== 'test') {
      return false;
    }
    
    if (!config.baseUrl || typeof config.baseUrl !== 'string' || !this.isValidUrl(config.baseUrl)) {
      return false;
    }
    
    if (!this.validateRateLimit(config.rateLimit)) {
      return false;
    }
    
    if (typeof config.enabled !== 'boolean') {
      return false;
    }
    
    return true;
  }

  static validateNewsServiceConfig(config: NewsServiceConfig): boolean {
    return this.validatePlatformConfig(config);
  }

  static validateSportsDataConfig(config: SportsDataConfig): boolean {
    return this.validatePlatformConfig(config);
  }

  static validateBlogPlatformConfig(config: BlogPlatformConfig): boolean {
    if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
      return false;
    }
    
    // Allow empty API keys in test environment
    if (typeof config.apiKey !== 'string') {
      return false;
    }
    
    if (config.apiKey.trim() === '' && process.env.NODE_ENV !== 'test') {
      return false;
    }
    
    // Allow empty base URL in test environment
    if (typeof config.baseUrl !== 'string') {
      return false;
    }
    
    if (config.baseUrl.trim() === '' && process.env.NODE_ENV !== 'test') {
      return false;
    }
    
    if (config.baseUrl.trim() !== '' && !this.isValidUrl(config.baseUrl)) {
      return false;
    }
    
    if (config.username !== undefined && 
        (typeof config.username !== 'string' || config.username.trim() === '')) {
      return false;
    }
    
    if (config.blogId !== undefined && 
        (typeof config.blogId !== 'string' || config.blogId.trim() === '')) {
      return false;
    }
    
    if (!Array.isArray(config.defaultTags)) {
      return false;
    }
    
    if (!config.defaultTags.every(tag => typeof tag === 'string' && tag.trim() !== '')) {
      return false;
    }
    
    if (!Array.isArray(config.defaultCategories)) {
      return false;
    }
    
    if (!config.defaultCategories.every(cat => typeof cat === 'string' && cat.trim() !== '')) {
      return false;
    }
    
    return true;
  }

  static validateAgentConfig(config: AgentConfig): boolean {
    if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
      return false;
    }
    
    if (typeof config.enabled !== 'boolean') {
      return false;
    }
    
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      return false;
    }
    
    if (typeof config.retryAttempts !== 'number' || config.retryAttempts < 0) {
      return false;
    }
    
    if (typeof config.retryDelay !== 'number' || config.retryDelay < 0) {
      return false;
    }
    
    return true;
  }

  static validateExecutionResult(result: ExecutionResult): boolean {
    if (typeof result.success !== 'boolean') {
      return false;
    }
    
    if (!(result.startTime instanceof Date) || isNaN(result.startTime.getTime())) {
      return false;
    }
    
    if (!(result.endTime instanceof Date) || isNaN(result.endTime.getTime())) {
      return false;
    }
    
    if (typeof result.duration !== 'number' || result.duration < 0) {
      return false;
    }
    
    if (!Array.isArray(result.agentsExecuted)) {
      return false;
    }
    
    if (!Array.isArray(result.errors)) {
      return false;
    }
    
    if (!Array.isArray(result.warnings)) {
      return false;
    }
    
    if (result.publishedPostId !== undefined && 
        (typeof result.publishedPostId !== 'string' || result.publishedPostId.trim() === '')) {
      return false;
    }
    
    return true;
  }

  private static validateRateLimit(rateLimit: any): boolean {
    if (typeof rateLimit.requestsPerMinute !== 'number' || rateLimit.requestsPerMinute <= 0) {
      return false;
    }
    
    if (typeof rateLimit.requestsPerHour !== 'number' || rateLimit.requestsPerHour <= 0) {
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

// Configuration loading and management utilities
export class ConfigLoader {
  static async loadSystemConfig(configPath: string): Promise<SystemConfig> {
    try {
      const fs = await import('fs/promises');
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData) as SystemConfig;
      
      if (!ConfigValidator.validateSystemConfig(config)) {
        throw new Error('Invalid system configuration');
      }
      
      return this.applyEnvironmentOverrides(config);
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static createDefaultConfig(): SystemConfig {
    return {
      schedule: {
        dayOfWeek: 2, // Tuesday
        hour: 9, // 9 AM
        timezone: 'America/New_York'
      },
      apis: {
        fantasyPlatforms: [
          {
            name: 'ESPN',
            apiKey: process.env.ESPN_API_KEY || '',
            baseUrl: 'https://fantasy.espn.com/apis/v3',
            rateLimit: {
              requestsPerMinute: 60,
              requestsPerHour: 1000
            },
            enabled: true
          },
          {
            name: 'Yahoo',
            apiKey: process.env.YAHOO_API_KEY || '',
            baseUrl: 'https://fantasysports.yahooapis.com',
            rateLimit: {
              requestsPerMinute: 60,
              requestsPerHour: 1000
            },
            enabled: true
          },
          {
            name: 'Sleeper',
            apiKey: process.env.SLEEPER_API_KEY || '',
            baseUrl: 'https://api.sleeper.app/v1',
            rateLimit: {
              requestsPerMinute: 100,
              requestsPerHour: 2000
            },
            enabled: true
          }
        ],
        newsServices: [
          {
            name: 'ESPN News',
            apiKey: process.env.ESPN_NEWS_API_KEY || '',
            baseUrl: 'https://site.api.espn.com/apis/site/v2',
            rateLimit: {
              requestsPerMinute: 60,
              requestsPerHour: 1000
            },
            enabled: true
          }
        ],
        sportsData: {
          name: 'Sports Data API',
          apiKey: process.env.SPORTS_DATA_API_KEY || '',
          baseUrl: 'https://api.sportsdata.io/v3/nfl',
          rateLimit: {
            requestsPerMinute: 60,
            requestsPerHour: 1000
          },
          enabled: true
        }
      },
      blog: {
        name: 'WordPress',
        apiKey: process.env.BLOG_API_KEY || '',
        baseUrl: process.env.BLOG_BASE_URL || '',
        ...(process.env.BLOG_USERNAME && { username: process.env.BLOG_USERNAME }),
        ...(process.env.BLOG_ID && { blogId: process.env.BLOG_ID }),
        defaultTags: ['fantasy football', 'FAAB', 'waiver wire', 'NFL'],
        defaultCategories: ['Fantasy Football', 'Analysis']
      },
      agents: [
        {
          name: 'DataCollectionAgent',
          enabled: true,
          timeout: 300000, // 5 minutes
          retryAttempts: 3,
          retryDelay: 5000 // 5 seconds
        },
        {
          name: 'ResearchAgent',
          enabled: true,
          timeout: 600000, // 10 minutes
          retryAttempts: 3,
          retryDelay: 10000 // 10 seconds
        },
        {
          name: 'AnalysisAgent',
          enabled: true,
          timeout: 300000, // 5 minutes
          retryAttempts: 2,
          retryDelay: 5000 // 5 seconds
        },
        {
          name: 'WriterAgent',
          enabled: true,
          timeout: 180000, // 3 minutes
          retryAttempts: 2,
          retryDelay: 3000 // 3 seconds
        },
        {
          name: 'PublisherAgent',
          enabled: true,
          timeout: 120000, // 2 minutes
          retryAttempts: 3,
          retryDelay: 5000 // 5 seconds
        }
      ]
    };
  }

  static async saveConfig(config: SystemConfig, configPath: string): Promise<void> {
    if (!ConfigValidator.validateSystemConfig(config)) {
      throw new Error('Invalid configuration cannot be saved');
    }
    
    try {
      const fs = await import('fs/promises');
      const configData = JSON.stringify(config, null, 2);
      await fs.writeFile(configPath, configData, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static validateEnvironmentVariables(): { valid: boolean; missing: string[] } {
    const requiredVars = [
      'ESPN_API_KEY',
      'YAHOO_API_KEY',
      'SLEEPER_API_KEY',
      'ESPN_NEWS_API_KEY',
      'SPORTS_DATA_API_KEY',
      'BLOG_API_KEY',
      'BLOG_BASE_URL'
    ];
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  private static applyEnvironmentOverrides(config: SystemConfig): SystemConfig {
    // Apply environment variable overrides
    const overriddenConfig = { ...config };
    
    // Override schedule if environment variables are set
    if (process.env.SCHEDULE_DAY_OF_WEEK) {
      overriddenConfig.schedule.dayOfWeek = parseInt(process.env.SCHEDULE_DAY_OF_WEEK, 10);
    }
    
    if (process.env.SCHEDULE_HOUR) {
      overriddenConfig.schedule.hour = parseInt(process.env.SCHEDULE_HOUR, 10);
    }
    
    if (process.env.SCHEDULE_TIMEZONE) {
      overriddenConfig.schedule.timezone = process.env.SCHEDULE_TIMEZONE;
    }
    
    // Override API keys from environment
    overriddenConfig.apis.fantasyPlatforms.forEach(platform => {
      const envKey = `${platform.name.toUpperCase().replace(/\s+/g, '_')}_API_KEY`;
      if (process.env[envKey]) {
        platform.apiKey = process.env[envKey]!;
      }
    });
    
    overriddenConfig.apis.newsServices.forEach(service => {
      const envKey = `${service.name.toUpperCase().replace(/\s+/g, '_')}_API_KEY`;
      if (process.env[envKey]) {
        service.apiKey = process.env[envKey]!;
      }
    });
    
    if (process.env.SPORTS_DATA_API_KEY) {
      overriddenConfig.apis.sportsData.apiKey = process.env.SPORTS_DATA_API_KEY;
    }
    
    // Override blog configuration
    if (process.env.BLOG_API_KEY) {
      overriddenConfig.blog.apiKey = process.env.BLOG_API_KEY;
    }
    
    if (process.env.BLOG_BASE_URL) {
      overriddenConfig.blog.baseUrl = process.env.BLOG_BASE_URL;
    }
    
    if (process.env.BLOG_USERNAME) {
      overriddenConfig.blog.username = process.env.BLOG_USERNAME;
    }
    
    if (process.env.BLOG_ID) {
      overriddenConfig.blog.blogId = process.env.BLOG_ID;
    }
    
    return overriddenConfig;
  }
}

// Configuration utility functions
export class ConfigUtils {
  static getEnabledPlatforms(config: SystemConfig): PlatformConfig[] {
    return config.apis.fantasyPlatforms.filter(platform => platform.enabled);
  }

  static getEnabledNewsServices(config: SystemConfig): NewsServiceConfig[] {
    return config.apis.newsServices.filter(service => service.enabled);
  }

  static getEnabledAgents(config: SystemConfig): AgentConfig[] {
    return config.agents.filter(agent => agent.enabled);
  }

  static getTotalTimeout(config: SystemConfig): number {
    return config.agents.reduce((total, agent) => {
      return agent.enabled ? total + agent.timeout : total;
    }, 0);
  }

  static getAgentConfig(config: SystemConfig, agentName: string): AgentConfig | undefined {
    return config.agents.find(agent => agent.name === agentName);
  }

  static updateAgentConfig(config: SystemConfig, agentName: string, updates: Partial<AgentConfig>): SystemConfig {
    const updatedConfig = { ...config };
    const agentIndex = updatedConfig.agents.findIndex(agent => agent.name === agentName);
    
    if (agentIndex !== -1) {
      const currentAgent = updatedConfig.agents[agentIndex]!;
      updatedConfig.agents[agentIndex] = {
        ...currentAgent,
        ...updates
      };
    }
    
    return updatedConfig;
  }

  static createExecutionResult(
    success: boolean,
    startTime: Date,
    endTime: Date,
    agentsExecuted: string[],
    errors: Error[] = [],
    warnings: string[] = [],
    publishedPostId?: string
  ): ExecutionResult {
    return {
      success,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      agentsExecuted,
      errors,
      warnings,
      ...(publishedPostId && { publishedPostId })
    };
  }

  static createExecutionStatus(
    isRunning: boolean,
    currentAgent?: string,
    progress: number = 0,
    startTime?: Date,
    estimatedCompletion?: Date
  ): ExecutionStatus {
    return {
      isRunning,
      progress: Math.max(0, Math.min(100, progress)),
      ...(currentAgent && { currentAgent }),
      ...(startTime && { startTime }),
      ...(estimatedCompletion && { estimatedCompletion })
    };
  }
}