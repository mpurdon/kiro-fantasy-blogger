import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SystemConfig,
  PlatformConfig,
  NewsServiceConfig,
  SportsDataConfig,
  BlogPlatformConfig,
  AgentConfig,
  ExecutionResult,
  ExecutionStatus,
  ConfigValidator,
  ConfigLoader,
  ConfigUtils
} from './config';

describe('ConfigValidator', () => {
  describe('validateSystemConfig', () => {
    it('should validate a complete valid system config', () => {
      const validConfig: SystemConfig = {
        schedule: {
          dayOfWeek: 2,
          hour: 9,
          timezone: 'America/New_York'
        },
        apis: {
          fantasyPlatforms: [
            {
              name: 'ESPN',
              apiKey: 'test-key',
              baseUrl: 'https://fantasy.espn.com',
              rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
              enabled: true
            }
          ],
          newsServices: [
            {
              name: 'ESPN News',
              apiKey: 'test-key',
              baseUrl: 'https://site.api.espn.com',
              rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
              enabled: true
            }
          ],
          sportsData: {
            name: 'Sports Data API',
            apiKey: 'test-key',
            baseUrl: 'https://api.sportsdata.io',
            rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
            enabled: true
          }
        },
        blog: {
          name: 'WordPress',
          apiKey: 'test-key',
          baseUrl: 'https://myblog.com',
          defaultTags: ['fantasy', 'football'],
          defaultCategories: ['Sports']
        },
        agents: [
          {
            name: 'DataCollectionAgent',
            enabled: true,
            timeout: 300000,
            retryAttempts: 3,
            retryDelay: 5000
          }
        ]
      };

      expect(ConfigValidator.validateSystemConfig(validConfig)).toBe(true);
    });

    it('should reject config with invalid schedule', () => {
      const invalidConfig: SystemConfig = {
        schedule: {
          dayOfWeek: 8, // Invalid day
          hour: 9,
          timezone: 'America/New_York'
        },
        apis: {
          fantasyPlatforms: [],
          newsServices: [],
          sportsData: {
            name: 'Sports Data API',
            apiKey: 'test-key',
            baseUrl: 'https://api.sportsdata.io',
            rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
            enabled: true
          }
        },
        blog: {
          name: 'WordPress',
          apiKey: 'test-key',
          baseUrl: 'https://myblog.com',
          defaultTags: [],
          defaultCategories: []
        },
        agents: []
      };

      expect(ConfigValidator.validateSystemConfig(invalidConfig)).toBe(false);
    });

    it('should reject config with empty agents array', () => {
      const invalidConfig: SystemConfig = {
        schedule: {
          dayOfWeek: 2,
          hour: 9,
          timezone: 'America/New_York'
        },
        apis: {
          fantasyPlatforms: [],
          newsServices: [],
          sportsData: {
            name: 'Sports Data API',
            apiKey: 'test-key',
            baseUrl: 'https://api.sportsdata.io',
            rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
            enabled: true
          }
        },
        blog: {
          name: 'WordPress',
          apiKey: 'test-key',
          baseUrl: 'https://myblog.com',
          defaultTags: [],
          defaultCategories: []
        },
        agents: [] // Empty agents array
      };

      expect(ConfigValidator.validateSystemConfig(invalidConfig)).toBe(false);
    });
  });

  describe('validateScheduleConfig', () => {
    it('should validate valid schedule config', () => {
      const validSchedule = {
        dayOfWeek: 2,
        hour: 9,
        timezone: 'America/New_York'
      };

      expect(ConfigValidator.validateScheduleConfig(validSchedule)).toBe(true);
    });

    it('should reject invalid day of week', () => {
      const invalidSchedule = {
        dayOfWeek: -1,
        hour: 9,
        timezone: 'America/New_York'
      };

      expect(ConfigValidator.validateScheduleConfig(invalidSchedule)).toBe(false);
    });

    it('should reject invalid hour', () => {
      const invalidSchedule = {
        dayOfWeek: 2,
        hour: 25,
        timezone: 'America/New_York'
      };

      expect(ConfigValidator.validateScheduleConfig(invalidSchedule)).toBe(false);
    });

    it('should reject empty timezone', () => {
      const invalidSchedule = {
        dayOfWeek: 2,
        hour: 9,
        timezone: ''
      };

      expect(ConfigValidator.validateScheduleConfig(invalidSchedule)).toBe(false);
    });
  });

  describe('validatePlatformConfig', () => {
    it('should validate valid platform config', () => {
      const validPlatform: PlatformConfig = {
        name: 'ESPN',
        apiKey: 'test-key',
        baseUrl: 'https://fantasy.espn.com',
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 1000
        },
        enabled: true
      };

      expect(ConfigValidator.validatePlatformConfig(validPlatform)).toBe(true);
    });

    it('should reject platform with empty name', () => {
      const invalidPlatform: PlatformConfig = {
        name: '',
        apiKey: 'test-key',
        baseUrl: 'https://fantasy.espn.com',
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 1000
        },
        enabled: true
      };

      expect(ConfigValidator.validatePlatformConfig(invalidPlatform)).toBe(false);
    });

    it('should reject platform with invalid URL', () => {
      const invalidPlatform: PlatformConfig = {
        name: 'ESPN',
        apiKey: 'test-key',
        baseUrl: 'not-a-valid-url',
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 1000
        },
        enabled: true
      };

      expect(ConfigValidator.validatePlatformConfig(invalidPlatform)).toBe(false);
    });

    it('should reject platform with invalid rate limit', () => {
      const invalidPlatform: PlatformConfig = {
        name: 'ESPN',
        apiKey: 'test-key',
        baseUrl: 'https://fantasy.espn.com',
        rateLimit: {
          requestsPerMinute: 0, // Invalid
          requestsPerHour: 1000
        },
        enabled: true
      };

      expect(ConfigValidator.validatePlatformConfig(invalidPlatform)).toBe(false);
    });
  });

  describe('validateBlogPlatformConfig', () => {
    it('should validate valid blog platform config', () => {
      const validBlog: BlogPlatformConfig = {
        name: 'WordPress',
        apiKey: 'test-key',
        baseUrl: 'https://myblog.com',
        username: 'testuser',
        blogId: 'blog123',
        defaultTags: ['fantasy', 'football'],
        defaultCategories: ['Sports']
      };

      expect(ConfigValidator.validateBlogPlatformConfig(validBlog)).toBe(true);
    });

    it('should validate blog config without optional fields', () => {
      const validBlog: BlogPlatformConfig = {
        name: 'WordPress',
        apiKey: 'test-key',
        baseUrl: 'https://myblog.com',
        defaultTags: ['fantasy'],
        defaultCategories: ['Sports']
      };

      expect(ConfigValidator.validateBlogPlatformConfig(validBlog)).toBe(true);
    });

    it('should reject blog config with empty tags array', () => {
      const invalidBlog: BlogPlatformConfig = {
        name: 'WordPress',
        apiKey: 'test-key',
        baseUrl: 'https://myblog.com',
        defaultTags: [''], // Empty tag
        defaultCategories: ['Sports']
      };

      expect(ConfigValidator.validateBlogPlatformConfig(invalidBlog)).toBe(false);
    });
  });

  describe('validateAgentConfig', () => {
    it('should validate valid agent config', () => {
      const validAgent: AgentConfig = {
        name: 'DataCollectionAgent',
        enabled: true,
        timeout: 300000,
        retryAttempts: 3,
        retryDelay: 5000
      };

      expect(ConfigValidator.validateAgentConfig(validAgent)).toBe(true);
    });

    it('should reject agent with negative timeout', () => {
      const invalidAgent: AgentConfig = {
        name: 'DataCollectionAgent',
        enabled: true,
        timeout: -1000,
        retryAttempts: 3,
        retryDelay: 5000
      };

      expect(ConfigValidator.validateAgentConfig(invalidAgent)).toBe(false);
    });

    it('should reject agent with negative retry attempts', () => {
      const invalidAgent: AgentConfig = {
        name: 'DataCollectionAgent',
        enabled: true,
        timeout: 300000,
        retryAttempts: -1,
        retryDelay: 5000
      };

      expect(ConfigValidator.validateAgentConfig(invalidAgent)).toBe(false);
    });
  });

  describe('validateExecutionResult', () => {
    it('should validate valid execution result', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:30:00Z');

      const validResult: ExecutionResult = {
        success: true,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        agentsExecuted: ['DataCollectionAgent', 'AnalysisAgent'],
        errors: [],
        warnings: ['Minor warning'],
        publishedPostId: 'post123'
      };

      expect(ConfigValidator.validateExecutionResult(validResult)).toBe(true);
    });

    it('should reject result with invalid dates', () => {
      const invalidResult: ExecutionResult = {
        success: true,
        startTime: new Date('invalid-date'),
        endTime: new Date(),
        duration: 1000,
        agentsExecuted: [],
        errors: [],
        warnings: []
      };

      expect(ConfigValidator.validateExecutionResult(invalidResult)).toBe(false);
    });

    it('should reject result with negative duration', () => {
      const invalidResult: ExecutionResult = {
        success: true,
        startTime: new Date(),
        endTime: new Date(),
        duration: -1000,
        agentsExecuted: [],
        errors: [],
        warnings: []
      };

      expect(ConfigValidator.validateExecutionResult(invalidResult)).toBe(false);
    });
  });
});

describe('ConfigLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createDefaultConfig', () => {
    it('should create a valid default configuration structure', () => {
      const defaultConfig = ConfigLoader.createDefaultConfig();

      // The default config will have empty API keys from environment variables
      // So we'll test the structure rather than full validation
      expect(defaultConfig.schedule.dayOfWeek).toBe(2); // Tuesday
      expect(defaultConfig.schedule.hour).toBe(9); // 9 AM
      expect(defaultConfig.agents).toHaveLength(5);
      expect(defaultConfig.apis.fantasyPlatforms).toHaveLength(3);
      expect(defaultConfig.apis.newsServices).toHaveLength(1);
      expect(Array.isArray(defaultConfig.blog.defaultTags)).toBe(true);
      expect(Array.isArray(defaultConfig.blog.defaultCategories)).toBe(true);
    });

    it('should include all required agents', () => {
      const defaultConfig = ConfigLoader.createDefaultConfig();
      const agentNames = defaultConfig.agents.map(agent => agent.name);

      expect(agentNames).toContain('DataCollectionAgent');
      expect(agentNames).toContain('ResearchAgent');
      expect(agentNames).toContain('AnalysisAgent');
      expect(agentNames).toContain('WriterAgent');
      expect(agentNames).toContain('PublisherAgent');
    });

    it('should include fantasy platforms', () => {
      const defaultConfig = ConfigLoader.createDefaultConfig();
      const platformNames = defaultConfig.apis.fantasyPlatforms.map(p => p.name);

      expect(platformNames).toContain('ESPN');
      expect(platformNames).toContain('Yahoo');
      expect(platformNames).toContain('Sleeper');
    });
  });

  describe('validateEnvironmentVariables', () => {
    it('should identify missing environment variables', () => {
      // Mock empty environment
      const originalEnv = process.env;
      process.env = {};

      const result = ConfigLoader.validateEnvironmentVariables();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('ESPN_API_KEY');
      expect(result.missing).toContain('BLOG_API_KEY');

      process.env = originalEnv;
    });

    it('should validate when all required variables are present', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        ESPN_API_KEY: 'test-key',
        YAHOO_API_KEY: 'test-key',
        SLEEPER_API_KEY: 'test-key',
        ESPN_NEWS_API_KEY: 'test-key',
        SPORTS_DATA_API_KEY: 'test-key',
        BLOG_API_KEY: 'test-key',
        BLOG_BASE_URL: 'https://myblog.com'
      };

      const result = ConfigLoader.validateEnvironmentVariables();

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);

      process.env = originalEnv;
    });
  });
});

describe('ConfigUtils', () => {
  const mockConfig: SystemConfig = {
    schedule: {
      dayOfWeek: 2,
      hour: 9,
      timezone: 'America/New_York'
    },
    apis: {
      fantasyPlatforms: [
        {
          name: 'ESPN',
          apiKey: 'test-key',
          baseUrl: 'https://fantasy.espn.com',
          rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
          enabled: true
        },
        {
          name: 'Yahoo',
          apiKey: 'test-key',
          baseUrl: 'https://fantasysports.yahooapis.com',
          rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
          enabled: false
        }
      ],
      newsServices: [
        {
          name: 'ESPN News',
          apiKey: 'test-key',
          baseUrl: 'https://site.api.espn.com',
          rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
          enabled: true
        }
      ],
      sportsData: {
        name: 'Sports Data API',
        apiKey: 'test-key',
        baseUrl: 'https://api.sportsdata.io',
        rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
        enabled: true
      }
    },
    blog: {
      name: 'WordPress',
      apiKey: 'test-key',
      baseUrl: 'https://myblog.com',
      defaultTags: ['fantasy'],
      defaultCategories: ['Sports']
    },
    agents: [
      {
        name: 'DataCollectionAgent',
        enabled: true,
        timeout: 300000,
        retryAttempts: 3,
        retryDelay: 5000
      },
      {
        name: 'AnalysisAgent',
        enabled: false,
        timeout: 180000,
        retryAttempts: 2,
        retryDelay: 3000
      }
    ]
  };

  describe('getEnabledPlatforms', () => {
    it('should return only enabled platforms', () => {
      const enabledPlatforms = ConfigUtils.getEnabledPlatforms(mockConfig);

      expect(enabledPlatforms).toHaveLength(1);
      expect(enabledPlatforms[0]?.name).toBe('ESPN');
    });
  });

  describe('getEnabledNewsServices', () => {
    it('should return only enabled news services', () => {
      const enabledServices = ConfigUtils.getEnabledNewsServices(mockConfig);

      expect(enabledServices).toHaveLength(1);
      expect(enabledServices[0]?.name).toBe('ESPN News');
    });
  });

  describe('getEnabledAgents', () => {
    it('should return only enabled agents', () => {
      const enabledAgents = ConfigUtils.getEnabledAgents(mockConfig);

      expect(enabledAgents).toHaveLength(1);
      expect(enabledAgents[0]?.name).toBe('DataCollectionAgent');
    });
  });

  describe('getTotalTimeout', () => {
    it('should calculate total timeout for enabled agents only', () => {
      const totalTimeout = ConfigUtils.getTotalTimeout(mockConfig);

      expect(totalTimeout).toBe(300000); // Only DataCollectionAgent is enabled
    });
  });

  describe('getAgentConfig', () => {
    it('should return agent config by name', () => {
      const agentConfig = ConfigUtils.getAgentConfig(mockConfig, 'DataCollectionAgent');

      expect(agentConfig).toBeDefined();
      expect(agentConfig?.name).toBe('DataCollectionAgent');
      expect(agentConfig?.timeout).toBe(300000);
    });

    it('should return undefined for non-existent agent', () => {
      const agentConfig = ConfigUtils.getAgentConfig(mockConfig, 'NonExistentAgent');

      expect(agentConfig).toBeUndefined();
    });
  });

  describe('updateAgentConfig', () => {
    it('should update existing agent config', () => {
      const updatedConfig = ConfigUtils.updateAgentConfig(mockConfig, 'DataCollectionAgent', {
        timeout: 600000,
        retryAttempts: 5
      });

      const updatedAgent = ConfigUtils.getAgentConfig(updatedConfig, 'DataCollectionAgent');

      expect(updatedAgent?.timeout).toBe(600000);
      expect(updatedAgent?.retryAttempts).toBe(5);
      expect(updatedAgent?.name).toBe('DataCollectionAgent'); // Should preserve other fields
    });

    it('should not modify config for non-existent agent', () => {
      const updatedConfig = ConfigUtils.updateAgentConfig(mockConfig, 'NonExistentAgent', {
        timeout: 600000
      });

      expect(updatedConfig.agents).toHaveLength(mockConfig.agents.length);
    });
  });

  describe('createExecutionResult', () => {
    it('should create valid execution result', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:30:00Z');
      const agentsExecuted = ['DataCollectionAgent', 'AnalysisAgent'];
      const errors = [new Error('Test error')];
      const warnings = ['Test warning'];

      const result = ConfigUtils.createExecutionResult(
        true,
        startTime,
        endTime,
        agentsExecuted,
        errors,
        warnings,
        'post123'
      );

      expect(result.success).toBe(true);
      expect(result.startTime).toBe(startTime);
      expect(result.endTime).toBe(endTime);
      expect(result.duration).toBe(30 * 60 * 1000); // 30 minutes
      expect(result.agentsExecuted).toEqual(agentsExecuted);
      expect(result.errors).toEqual(errors);
      expect(result.warnings).toEqual(warnings);
      expect(result.publishedPostId).toBe('post123');
    });

    it('should create execution result without optional fields', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:30:00Z');
      const agentsExecuted = ['DataCollectionAgent'];

      const result = ConfigUtils.createExecutionResult(
        false,
        startTime,
        endTime,
        agentsExecuted
      );

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.publishedPostId).toBeUndefined();
    });
  });

  describe('createExecutionStatus', () => {
    it('should create execution status with all fields', () => {
      const startTime = new Date();
      const estimatedCompletion = new Date(Date.now() + 30 * 60 * 1000);

      const status = ConfigUtils.createExecutionStatus(
        true,
        'DataCollectionAgent',
        50,
        startTime,
        estimatedCompletion
      );

      expect(status.isRunning).toBe(true);
      expect(status.currentAgent).toBe('DataCollectionAgent');
      expect(status.progress).toBe(50);
      expect(status.startTime).toBe(startTime);
      expect(status.estimatedCompletion).toBe(estimatedCompletion);
    });

    it('should create execution status with minimal fields', () => {
      const status = ConfigUtils.createExecutionStatus(false);

      expect(status.isRunning).toBe(false);
      expect(status.progress).toBe(0);
      expect(status.currentAgent).toBeUndefined();
      expect(status.startTime).toBeUndefined();
      expect(status.estimatedCompletion).toBeUndefined();
    });

    it('should clamp progress values', () => {
      const statusLow = ConfigUtils.createExecutionStatus(true, undefined, -10);
      const statusHigh = ConfigUtils.createExecutionStatus(true, undefined, 150);

      expect(statusLow.progress).toBe(0);
      expect(statusHigh.progress).toBe(100);
    });
  });

  describe('Edge cases and additional validation tests', () => {
    describe('ConfigValidator edge cases', () => {
      it('should handle boundary values for schedule config', () => {
        const validSunday = {
          dayOfWeek: 0,
          hour: 0,
          timezone: 'UTC'
        };
        expect(ConfigValidator.validateScheduleConfig(validSunday)).toBe(true);

        const validSaturday = {
          dayOfWeek: 6,
          hour: 23,
          timezone: 'America/New_York'
        };
        expect(ConfigValidator.validateScheduleConfig(validSaturday)).toBe(true);
      });

      it('should handle empty arrays in system config', () => {
        const configWithEmptyArrays: SystemConfig = {
          schedule: {
            dayOfWeek: 2,
            hour: 9,
            timezone: 'America/New_York'
          },
          apis: {
            fantasyPlatforms: [], // Empty but valid
            newsServices: [], // Empty but valid
            sportsData: {
              name: 'Sports Data API',
              apiKey: 'test-key',
              baseUrl: 'https://api.sportsdata.io',
              rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
              enabled: true
            }
          },
          blog: {
            name: 'WordPress',
            apiKey: 'test-key',
            baseUrl: 'https://myblog.com',
            defaultTags: [],
            defaultCategories: []
          },
          agents: [
            {
              name: 'TestAgent',
              enabled: true,
              timeout: 300000,
              retryAttempts: 3,
              retryDelay: 5000
            }
          ]
        };

        expect(ConfigValidator.validateSystemConfig(configWithEmptyArrays)).toBe(true);
      });

      it('should handle boundary rate limit values', () => {
        const minRateLimit = {
          requestsPerMinute: 1,
          requestsPerHour: 1
        };
        expect(ConfigValidator['validateRateLimit'](minRateLimit)).toBe(true);

        const zeroRateLimit = {
          requestsPerMinute: 0,
          requestsPerHour: 1
        };
        expect(ConfigValidator['validateRateLimit'](zeroRateLimit)).toBe(false);
      });

      it('should handle agent config with zero values', () => {
        const agentWithZeroRetries: AgentConfig = {
          name: 'TestAgent',
          enabled: true,
          timeout: 1000,
          retryAttempts: 0, // Valid - no retries
          retryDelay: 0 // Valid - no delay
        };

        expect(ConfigValidator.validateAgentConfig(agentWithZeroRetries)).toBe(true);
      });

      it('should handle execution result with empty arrays', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const endTime = new Date('2024-01-01T10:30:00Z');

        const resultWithEmptyArrays: ExecutionResult = {
          success: true,
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          agentsExecuted: [], // Empty but valid
          errors: [], // Empty but valid
          warnings: [] // Empty but valid
        };

        expect(ConfigValidator.validateExecutionResult(resultWithEmptyArrays)).toBe(true);
      });
    });

    describe('ConfigLoader edge cases', () => {
      it('should handle missing optional environment variables', () => {
        const originalEnv = process.env;
        process.env = {
          ...originalEnv,
          ESPN_API_KEY: 'test-key',
          YAHOO_API_KEY: 'test-key',
          SLEEPER_API_KEY: 'test-key',
          ESPN_NEWS_API_KEY: 'test-key',
          SPORTS_DATA_API_KEY: 'test-key',
          BLOG_API_KEY: 'test-key',
          BLOG_BASE_URL: 'https://myblog.com'
          // Missing optional vars like BLOG_USERNAME, BLOG_ID
        };

        const defaultConfig = ConfigLoader.createDefaultConfig();
        expect(defaultConfig.blog.username).toBeUndefined();
        expect(defaultConfig.blog.blogId).toBeUndefined();

        process.env = originalEnv;
      });

      it('should handle partial environment variable validation', () => {
        const originalEnv = process.env;
        process.env = {
          ESPN_API_KEY: 'test-key',
          YAHOO_API_KEY: 'test-key'
          // Missing other required vars
        };

        const result = ConfigLoader.validateEnvironmentVariables();
        expect(result.valid).toBe(false);
        expect(result.missing).toContain('SLEEPER_API_KEY');
        expect(result.missing).toContain('BLOG_API_KEY');

        process.env = originalEnv;
      });
    });

    describe('ConfigUtils edge cases', () => {
      it('should handle config with all agents disabled', () => {
        const configAllDisabled: SystemConfig = {
          ...mockConfig,
          agents: [
            {
              name: 'Agent1',
              enabled: false,
              timeout: 300000,
              retryAttempts: 3,
              retryDelay: 5000
            },
            {
              name: 'Agent2',
              enabled: false,
              timeout: 180000,
              retryAttempts: 2,
              retryDelay: 3000
            }
          ]
        };

        expect(ConfigUtils.getEnabledAgents(configAllDisabled)).toHaveLength(0);
        expect(ConfigUtils.getTotalTimeout(configAllDisabled)).toBe(0);
      });

      it('should handle config with all platforms disabled', () => {
        const configAllDisabled: SystemConfig = {
          ...mockConfig,
          apis: {
            ...mockConfig.apis,
            fantasyPlatforms: mockConfig.apis.fantasyPlatforms.map(p => ({ ...p, enabled: false })),
            newsServices: mockConfig.apis.newsServices.map(s => ({ ...s, enabled: false }))
          }
        };

        expect(ConfigUtils.getEnabledPlatforms(configAllDisabled)).toHaveLength(0);
        expect(ConfigUtils.getEnabledNewsServices(configAllDisabled)).toHaveLength(0);
      });

      it('should handle updateAgentConfig with non-existent agent', () => {
        const originalConfig = { ...mockConfig };
        const updatedConfig = ConfigUtils.updateAgentConfig(mockConfig, 'NonExistentAgent', {
          timeout: 600000
        });

        // Should return unchanged config
        expect(updatedConfig.agents).toEqual(originalConfig.agents);
      });

      it('should handle createExecutionResult with same start and end time', () => {
        const sameTime = new Date('2024-01-01T10:00:00Z');
        const result = ConfigUtils.createExecutionResult(
          true,
          sameTime,
          sameTime,
          ['TestAgent']
        );

        expect(result.duration).toBe(0);
      });

      it('should handle createExecutionStatus with exact boundary progress values', () => {
        const statusZero = ConfigUtils.createExecutionStatus(true, 'Agent', 0);
        const statusHundred = ConfigUtils.createExecutionStatus(true, 'Agent', 100);

        expect(statusZero.progress).toBe(0);
        expect(statusHundred.progress).toBe(100);
      });
    });
  });
});