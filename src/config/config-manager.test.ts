// Tests for configuration management system

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ConfigManager, getConfigManager, resetConfigManager } from './config-manager';
import { SystemConfig, ConfigLoader } from '../models/config';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}));

// Mock Logger
vi.mock('../utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockFs: any;
  const testConfigDir = '/test/config';

  beforeEach(() => {
    mockFs = fs as any;
    configManager = new ConfigManager({
      configDir: testConfigDir,
      environment: 'test',
      validateOnLoad: true,
      createDefaultIfMissing: true
    });
    
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetConfigManager();
  });

  describe('loadConfig', () => {
    it('should load and merge base and environment configurations', async () => {
      const baseConfig: SystemConfig = ConfigLoader.createDefaultConfig();
      const envConfig = {
        schedule: {
          dayOfWeek: 1,
          hour: 8,
          timezone: 'UTC'
        }
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(baseConfig))
        .mockResolvedValueOnce(JSON.stringify(envConfig));
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await configManager.loadConfig();

      expect(result.schedule.dayOfWeek).toBe(1);
      expect(result.schedule.hour).toBe(8);
      expect(result.schedule.timezone).toBe('UTC');
      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });

    it('should create default config if base config is missing', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('Env config not found'));
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await configManager.loadConfig();

      expect(result).toBeDefined();
      expect(result.schedule).toBeDefined();
      expect(result.apis).toBeDefined();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should create config directory if it does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('Env config not found'));
      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.loadConfig();

      expect(mockFs.mkdir).toHaveBeenCalledWith(testConfigDir, { recursive: true });
    });

    it('should apply environment variable overrides', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SCHEDULE_DAY_OF_WEEK: '3',
        SCHEDULE_HOUR: '15',
        ESPN_API_KEY: 'test-espn-key'
      };

      const baseConfig: SystemConfig = ConfigLoader.createDefaultConfig();
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(baseConfig))
        .mockRejectedValueOnce(new Error('Env config not found'));

      const result = await configManager.loadConfig();

      expect(result.schedule.dayOfWeek).toBe(3);
      expect(result.schedule.hour).toBe(15);
      
      const espnPlatform = result.apis.fantasyPlatforms.find(p => p.name === 'ESPN');
      expect(espnPlatform?.apiKey).toBe('test-espn-key');

      process.env = originalEnv;
    });
  });

  describe('updateConfig', () => {
    it('should update configuration and save to file', async () => {
      const baseConfig: SystemConfig = ConfigLoader.createDefaultConfig();
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(baseConfig))
        .mockRejectedValueOnce(new Error('Env config not found'));
      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.loadConfig();

      const updates = {
        schedule: {
          dayOfWeek: 5,
          hour: 14,
          timezone: 'America/Los_Angeles'
        }
      };

      await configManager.updateConfig(updates);

      const updatedConfig = await configManager.getConfig();
      expect(updatedConfig.schedule.dayOfWeek).toBe(5);
      expect(updatedConfig.schedule.hour).toBe(14);
      expect(updatedConfig.schedule.timezone).toBe('America/Los_Angeles');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should reject invalid configuration updates', async () => {
      const baseConfig: SystemConfig = ConfigLoader.createDefaultConfig();
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(baseConfig))
        .mockRejectedValueOnce(new Error('Env config not found'));
      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.loadConfig();

      const invalidUpdates = {
        schedule: {
          dayOfWeek: 10, // Invalid day of week
          hour: 25, // Invalid hour
          timezone: ''
        }
      };

      await expect(configManager.updateConfig(invalidUpdates)).rejects.toThrow('Updated configuration is invalid');
    });
  });

  describe('validateEnvironmentVariables', () => {
    it('should identify missing required environment variables', () => {
      const originalEnv = process.env;
      process.env = {};

      const result = configManager.validateEnvironmentVariables();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('ESPN_API_KEY');
      expect(result.missing).toContain('YAHOO_API_KEY');
      expect(result.missing).toContain('BLOG_API_KEY');

      process.env = originalEnv;
    });

    it('should identify warnings for missing recommended variables', () => {
      const originalEnv = process.env;
      process.env = {
        ESPN_API_KEY: 'test-key',
        YAHOO_API_KEY: 'test-key',
        SLEEPER_API_KEY: 'test-key',
        ESPN_NEWS_API_KEY: 'test-key',
        SPORTS_DATA_API_KEY: 'test-key',
        BLOG_API_KEY: 'test-key',
        BLOG_BASE_URL: 'https://test.com'
      };

      const result = configManager.validateEnvironmentVariables();

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.warnings).toContain('Recommended environment variable BLOG_USERNAME is not set');

      process.env = originalEnv;
    });
  });

  describe('createDefaultConfiguration', () => {
    it('should create all necessary configuration files', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await configManager.createDefaultConfiguration();

      expect(mockFs.mkdir).toHaveBeenCalledWith(testConfigDir, { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledTimes(5); // base + 3 env configs + .env.example
    });
  });

  describe('getConfigPaths', () => {
    it('should return correct configuration file paths', () => {
      const paths = configManager.getConfigPaths();

      expect(paths.base).toBe(join(testConfigDir, 'config.json'));
      expect(paths.environment).toBe(join(testConfigDir, 'config.test.json'));
      expect(paths.secrets).toBe(join(testConfigDir, '.env'));
    });
  });
});

describe('getConfigManager singleton', () => {
  afterEach(() => {
    resetConfigManager();
  });

  it('should return the same instance on multiple calls', () => {
    const manager1 = getConfigManager();
    const manager2 = getConfigManager();

    expect(manager1).toBe(manager2);
  });

  it('should create new instance after reset', () => {
    const manager1 = getConfigManager();
    resetConfigManager();
    const manager2 = getConfigManager();

    expect(manager1).not.toBe(manager2);
  });
});