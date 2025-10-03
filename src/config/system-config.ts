// System configuration management

import { SystemConfig } from '../models';

export interface IConfigManager {
  loadConfig(): Promise<SystemConfig>;
  validateConfig(config: SystemConfig): boolean;
  getConfig(): SystemConfig;
  updateConfig(config: Partial<SystemConfig>): Promise<void>;
}

export const DEFAULT_CONFIG: SystemConfig = {
  schedule: {
    dayOfWeek: 2, // Tuesday
    hour: 10, // 10 AM
    timezone: 'America/New_York'
  },
  apis: {
    fantasyPlatforms: [
      {
        name: 'ESPN',
        apiKey: '',
        baseUrl: 'https://fantasy.espn.com/apis/v3',
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 1000
        },
        enabled: true
      },
      {
        name: 'Yahoo',
        apiKey: '',
        baseUrl: 'https://fantasysports.yahooapis.com',
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 1000
        },
        enabled: true
      },
      {
        name: 'Sleeper',
        apiKey: '',
        baseUrl: 'https://api.sleeper.app/v1',
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 1000
        },
        enabled: true
      }
    ],
    newsServices: [
      {
        name: 'ESPN_News',
        apiKey: '',
        baseUrl: 'https://site.api.espn.com/apis/site/v2',
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 1000
        },
        enabled: true
      }
    ],
    sportsData: {
      name: 'SportsData',
      apiKey: '',
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
    apiKey: '',
    baseUrl: '',
    username: '',
    blogId: '',
    defaultTags: ['fantasy-football', 'faab', 'waiver-wire'],
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
      retryDelay: 5000
    },
    {
      name: 'AnalysisAgent',
      enabled: true,
      timeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 5000
    },
    {
      name: 'WriterAgent',
      enabled: true,
      timeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 5000
    },
    {
      name: 'PublisherAgent',
      enabled: true,
      timeout: 180000, // 3 minutes
      retryAttempts: 3,
      retryDelay: 5000
    }
  ]
};