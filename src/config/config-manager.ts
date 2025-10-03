// Configuration management system with file loading, validation, and environment support

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { SystemConfig, ConfigValidator, ConfigLoader } from '../models/config';
import { Logger } from '../utils/logger';

export interface ConfigManagerOptions {
  configDir?: string;
  environment?: string;
  validateOnLoad?: boolean;
  createDefaultIfMissing?: boolean;
}

export class ConfigManager {
  private config: SystemConfig | null = null;
  private configDir: string;
  private environment: string;
  private validateOnLoad: boolean;
  private createDefaultIfMissing: boolean;
  private logger: Logger;

  constructor(options: ConfigManagerOptions = {}) {
    this.configDir = options.configDir || join(process.cwd(), 'config');
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.validateOnLoad = options.validateOnLoad ?? true;
    this.createDefaultIfMissing = options.createDefaultIfMissing ?? true;
    this.logger = new Logger('ConfigManager');
  }

  /**
   * Load configuration from files with environment-specific overrides
   */
  async loadConfig(): Promise<SystemConfig> {
    try {
      // Ensure config directory exists
      await this.ensureConfigDirectory();

      // Load base configuration
      const baseConfig = await this.loadBaseConfig();
      
      // Apply environment-specific overrides
      const envConfig = await this.loadEnvironmentConfig();
      const mergedConfig = this.mergeConfigs(baseConfig, envConfig);
      
      // Apply environment variable overrides
      const finalConfig = this.applyEnvironmentVariables(mergedConfig);
      
      // Validate configuration if required
      if (this.validateOnLoad && !ConfigValidator.validateSystemConfig(finalConfig)) {
        throw new Error('Configuration validation failed');
      }
      
      this.config = finalConfig;
      this.logger.info(`Configuration loaded successfully for environment: ${this.environment}`);
      
      return finalConfig;
    } catch (error) {
      this.logger.error('Failed to load configuration', error);
      throw error;
    }
  }

  /**
   * Get current configuration (load if not already loaded)
   */
  async getConfig(): Promise<SystemConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config!;
  }

  /**
   * Update configuration and save to file
   */
  async updateConfig(updates: Partial<SystemConfig>): Promise<void> {
    try {
      const currentConfig = await this.getConfig();
      const updatedConfig = this.mergeConfigs(currentConfig, updates);
      
      if (this.validateOnLoad && !ConfigValidator.validateSystemConfig(updatedConfig)) {
        throw new Error('Updated configuration is invalid');
      }
      
      await this.saveConfig(updatedConfig);
      this.config = updatedConfig;
      
      this.logger.info('Configuration updated successfully');
    } catch (error) {
      this.logger.error('Failed to update configuration', error);
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config: SystemConfig): Promise<void> {
    try {
      const configPath = this.getConfigPath('base');
      await ConfigLoader.saveConfig(config, configPath);
      this.logger.info(`Configuration saved to ${configPath}`);
    } catch (error) {
      this.logger.error('Failed to save configuration', error);
      throw error;
    }
  }

  /**
   * Validate current configuration
   */
  validateConfig(): boolean {
    if (!this.config) {
      return false;
    }
    return ConfigValidator.validateSystemConfig(this.config);
  }

  /**
   * Get configuration for specific environment
   */
  async getEnvironmentConfig(environment: string): Promise<SystemConfig> {
    const originalEnv = this.environment;
    this.environment = environment;
    
    try {
      const config = await this.loadConfig();
      return config;
    } finally {
      this.environment = originalEnv;
    }
  }

  /**
   * Create default configuration files
   */
  async createDefaultConfiguration(): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      
      // Create base configuration
      const baseConfig = ConfigLoader.createDefaultConfig();
      const baseConfigPath = this.getConfigPath('base');
      await ConfigLoader.saveConfig(baseConfig, baseConfigPath);
      
      // Create environment-specific configurations
      const environments = ['development', 'staging', 'production'];
      
      for (const env of environments) {
        const envConfigPath = this.getConfigPath(env);
        const envConfig = this.createEnvironmentSpecificConfig(env);
        await fs.writeFile(envConfigPath, JSON.stringify(envConfig, null, 2));
      }
      
      // Create .env.example file
      await this.createEnvExample();
      
      this.logger.info('Default configuration files created');
    } catch (error) {
      this.logger.error('Failed to create default configuration', error);
      throw error;
    }
  }

  /**
   * Validate environment variables
   */
  validateEnvironmentVariables(): { valid: boolean; missing: string[]; warnings: string[] } {
    const result = ConfigLoader.validateEnvironmentVariables();
    const warnings: string[] = [];
    
    // Check for optional but recommended variables
    const recommendedVars = [
      'BLOG_USERNAME',
      'BLOG_ID',
      'SCHEDULE_DAY_OF_WEEK',
      'SCHEDULE_HOUR',
      'SCHEDULE_TIMEZONE'
    ];
    
    recommendedVars.forEach(varName => {
      if (!process.env[varName]) {
        warnings.push(`Recommended environment variable ${varName} is not set`);
      }
    });
    
    return {
      ...result,
      warnings
    };
  }

  /**
   * Get configuration file paths
   */
  getConfigPaths(): { base: string; environment: string; secrets: string } {
    return {
      base: this.getConfigPath('base'),
      environment: this.getConfigPath(this.environment),
      secrets: join(this.configDir, '.env')
    };
  }

  private async ensureConfigDirectory(): Promise<void> {
    try {
      await fs.access(this.configDir);
    } catch {
      await fs.mkdir(this.configDir, { recursive: true });
      this.logger.info(`Created config directory: ${this.configDir}`);
    }
  }

  private async loadBaseConfig(): Promise<SystemConfig> {
    const configPath = this.getConfigPath('base');
    
    try {
      return await ConfigLoader.loadSystemConfig(configPath);
    } catch (error) {
      if (this.createDefaultIfMissing) {
        this.logger.warn(`Base config not found, creating default: ${configPath}`);
        const defaultConfig = ConfigLoader.createDefaultConfig();
        await ConfigLoader.saveConfig(defaultConfig, configPath);
        return defaultConfig;
      }
      throw error;
    }
  }

  private async loadEnvironmentConfig(): Promise<Partial<SystemConfig>> {
    const envConfigPath = this.getConfigPath(this.environment);
    
    try {
      const envConfigData = await fs.readFile(envConfigPath, 'utf-8');
      return JSON.parse(envConfigData);
    } catch (error) {
      // Environment config is optional
      this.logger.debug(`No environment config found for ${this.environment}: ${envConfigPath}`);
      return {};
    }
  }

  private getConfigPath(type: string): string {
    const filename = type === 'base' ? 'config.json' : `config.${type}.json`;
    return join(this.configDir, filename);
  }

  private mergeConfigs(base: SystemConfig, override: Partial<SystemConfig>): SystemConfig {
    const merged = { ...base };
    
    if (override.schedule) {
      merged.schedule = { ...merged.schedule, ...override.schedule };
    }
    
    if (override.apis) {
      merged.apis = { ...merged.apis };
      
      if (override.apis.fantasyPlatforms) {
        merged.apis.fantasyPlatforms = this.mergePlatformConfigs(
          merged.apis.fantasyPlatforms,
          override.apis.fantasyPlatforms
        );
      }
      
      if (override.apis.newsServices) {
        merged.apis.newsServices = this.mergePlatformConfigs(
          merged.apis.newsServices,
          override.apis.newsServices
        );
      }
      
      if (override.apis.sportsData) {
        merged.apis.sportsData = { ...merged.apis.sportsData, ...override.apis.sportsData };
      }
    }
    
    if (override.blog) {
      merged.blog = { ...merged.blog, ...override.blog };
    }
    
    if (override.agents) {
      merged.agents = this.mergeAgentConfigs(merged.agents, override.agents);
    }
    
    return merged;
  }

  private mergePlatformConfigs<T extends { name: string }>(base: T[], override: T[]): T[] {
    const merged = [...base];
    
    override.forEach(overrideItem => {
      const existingIndex = merged.findIndex(item => item.name === overrideItem.name);
      if (existingIndex >= 0) {
        merged[existingIndex] = { ...merged[existingIndex], ...overrideItem };
      } else {
        merged.push(overrideItem);
      }
    });
    
    return merged;
  }

  private mergeAgentConfigs(base: any[], override: any[]): any[] {
    const merged = [...base];
    
    override.forEach(overrideAgent => {
      const existingIndex = merged.findIndex(agent => agent.name === overrideAgent.name);
      if (existingIndex >= 0) {
        merged[existingIndex] = { ...merged[existingIndex], ...overrideAgent };
      } else {
        merged.push(overrideAgent);
      }
    });
    
    return merged;
  }

  private applyEnvironmentVariables(config: SystemConfig): SystemConfig {
    return ConfigLoader['applyEnvironmentOverrides'](config);
  }

  private createEnvironmentSpecificConfig(environment: string): Partial<SystemConfig> {
    const baseOverrides: Record<string, Partial<SystemConfig>> = {
      development: {
        schedule: {
          dayOfWeek: 1, // Monday for testing
          hour: 9,
          timezone: 'America/New_York'
        },
        agents: [
          {
            name: 'DataCollectionAgent',
            enabled: true,
            timeout: 60000, // Shorter timeout for dev
            retryAttempts: 1,
            retryDelay: 1000
          }
        ]
      },
      staging: {
        schedule: {
          dayOfWeek: 1, // Monday for staging
          hour: 8,
          timezone: 'America/New_York'
        }
      },
      production: {
        schedule: {
          dayOfWeek: 2, // Tuesday for production
          hour: 9,
          timezone: 'America/New_York'
        },
        agents: [
          {
            name: 'DataCollectionAgent',
            enabled: true,
            timeout: 600000, // Longer timeout for production
            retryAttempts: 5,
            retryDelay: 10000
          }
        ]
      }
    };
    
    return baseOverrides[environment] || {};
  }

  private async createEnvExample(): Promise<void> {
    const envExample = `# Fantasy Football FAAB Blog System Configuration
# Copy this file to .env and fill in your actual values

# Environment
NODE_ENV=development

# Schedule Configuration (optional - overrides config file)
SCHEDULE_DAY_OF_WEEK=2
SCHEDULE_HOUR=9
SCHEDULE_TIMEZONE=America/New_York

# Fantasy Platform API Keys
ESPN_API_KEY=your_espn_api_key_here
YAHOO_API_KEY=your_yahoo_api_key_here
SLEEPER_API_KEY=your_sleeper_api_key_here

# News Service API Keys
ESPN_NEWS_API_KEY=your_espn_news_api_key_here

# Sports Data API
SPORTS_DATA_API_KEY=your_sports_data_api_key_here

# Blog Platform Configuration
BLOG_API_KEY=your_blog_api_key_here
BLOG_BASE_URL=https://your-blog.com
BLOG_USERNAME=your_blog_username
BLOG_ID=your_blog_id

# Optional: Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Optional: Database Configuration (if using database for caching)
DATABASE_URL=sqlite:./data/cache.db

# Optional: Monitoring and Alerting
WEBHOOK_URL=https://hooks.slack.com/your-webhook-url
ALERT_EMAIL=admin@yourdomain.com
`;
    
    const envExamplePath = join(this.configDir, '.env.example');
    await fs.writeFile(envExamplePath, envExample);
  }
}

// Singleton instance for global access
let configManagerInstance: ConfigManager | null = null;

export function getConfigManager(options?: ConfigManagerOptions): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager(options);
  }
  return configManagerInstance;
}

export function resetConfigManager(): void {
  configManagerInstance = null;
}