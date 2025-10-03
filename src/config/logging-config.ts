// Logging configuration and setup for different environments

import { join } from 'path';

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  console: {
    enabled: boolean;
    colorize: boolean;
    timestamp: boolean;
  };
  file: {
    enabled: boolean;
    filename: string;
    maxSize: string;
    maxFiles: number;
    compress: boolean;
  };
  rotation: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    keepFiles: number;
  };
  structured: {
    enabled: boolean;
    format: 'json' | 'logfmt';
  };
  filters: {
    excludePatterns: string[];
    includeOnlyLevels?: string[];
  };
}

export interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  component?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  executionId?: string;
  agentName?: string;
}

export class LoggingConfigManager {
  private static instance: LoggingConfigManager;
  private config: LoggingConfig;

  private constructor() {
    this.config = this.createDefaultConfig();
  }

  static getInstance(): LoggingConfigManager {
    if (!LoggingConfigManager.instance) {
      LoggingConfigManager.instance = new LoggingConfigManager();
    }
    return LoggingConfigManager.instance;
  }

  /**
   * Get current logging configuration
   */
  getConfig(): LoggingConfig {
    return { ...this.config };
  }

  /**
   * Update logging configuration
   */
  updateConfig(updates: Partial<LoggingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Load configuration from environment and config files
   */
  loadFromEnvironment(): void {
    const envConfig: Partial<LoggingConfig> = {};

    // Log level from environment
    if (process.env.LOG_LEVEL) {
      envConfig.level = process.env.LOG_LEVEL as any;
    }

    // File logging configuration
    if (process.env.LOG_FILE) {
      envConfig.file = {
        ...this.config.file,
        filename: process.env.LOG_FILE
      };
    }

    if (process.env.LOG_MAX_SIZE) {
      envConfig.file = {
        ...this.config.file,
        maxSize: process.env.LOG_MAX_SIZE
      };
    }

    if (process.env.LOG_MAX_FILES) {
      envConfig.file = {
        ...this.config.file,
        maxFiles: parseInt(process.env.LOG_MAX_FILES, 10)
      };
    }

    // Console logging
    if (process.env.LOG_CONSOLE !== undefined) {
      envConfig.console = {
        ...this.config.console,
        enabled: process.env.LOG_CONSOLE === 'true'
      };
    }

    // Structured logging
    if (process.env.LOG_FORMAT) {
      envConfig.structured = {
        ...this.config.structured,
        enabled: true,
        format: process.env.LOG_FORMAT as 'json' | 'logfmt'
      };
    }

    this.updateConfig(envConfig);
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig(environment: string): LoggingConfig {
    const baseConfig = this.createDefaultConfig();

    switch (environment) {
      case 'development':
        return {
          ...baseConfig,
          level: 'debug',
          console: {
            enabled: true,
            colorize: true,
            timestamp: true
          },
          file: {
            ...baseConfig.file,
            enabled: false
          },
          structured: {
            enabled: false,
            format: 'json'
          }
        };

      case 'staging':
        return {
          ...baseConfig,
          level: 'info',
          console: {
            enabled: true,
            colorize: false,
            timestamp: true
          },
          file: {
            ...baseConfig.file,
            enabled: true,
            filename: join(process.cwd(), 'logs', 'staging.log')
          },
          structured: {
            enabled: true,
            format: 'json'
          }
        };

      case 'production':
        return {
          ...baseConfig,
          level: 'info',
          console: {
            enabled: false,
            colorize: false,
            timestamp: true
          },
          file: {
            ...baseConfig.file,
            enabled: true,
            filename: join(process.cwd(), 'logs', 'production.log'),
            maxSize: '50MB',
            maxFiles: 10
          },
          structured: {
            enabled: true,
            format: 'json'
          },
          rotation: {
            enabled: true,
            frequency: 'daily',
            keepFiles: 30
          }
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Create log entry with standard format
   */
  createLogEntry(
    level: string,
    message: string,
    component?: string,
    metadata?: Record<string, any>,
    error?: Error,
    executionId?: string,
    agentName?: string
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: level.toUpperCase(),
      message,
      ...(component && { component }),
      ...(metadata && { metadata }),
      ...(executionId && { executionId }),
      ...(agentName && { agentName })
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack })
      };
    }

    return entry;
  }

  /**
   * Format log entry for output
   */
  formatLogEntry(entry: LogEntry, format: 'console' | 'json' | 'logfmt' = 'console'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(entry);

      case 'logfmt':
        return this.formatLogfmt(entry);

      case 'console':
      default:
        return this.formatConsole(entry);
    }
  }

  /**
   * Check if log level should be logged
   */
  shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug', 'trace'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level.toLowerCase());

    return messageLevelIndex <= configLevelIndex;
  }

  /**
   * Check if message should be filtered out
   */
  shouldFilter(message: string, level: string): boolean {
    // Check exclude patterns
    for (const pattern of this.config.filters.excludePatterns) {
      if (message.includes(pattern)) {
        return true;
      }
    }

    // Check include only levels
    if (this.config.filters.includeOnlyLevels) {
      return !this.config.filters.includeOnlyLevels.includes(level.toLowerCase());
    }

    return false;
  }

  private createDefaultConfig(): LoggingConfig {
    return {
      level: 'info',
      console: {
        enabled: true,
        colorize: true,
        timestamp: true
      },
      file: {
        enabled: true,
        filename: join(process.cwd(), 'logs', 'app.log'),
        maxSize: '10MB',
        maxFiles: 5,
        compress: true
      },
      rotation: {
        enabled: false,
        frequency: 'daily',
        keepFiles: 7
      },
      structured: {
        enabled: false,
        format: 'json'
      },
      filters: {
        excludePatterns: [
          'favicon.ico',
          'robots.txt',
          'health check'
        ]
      }
    };
  }

  private formatConsole(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.padEnd(5);
    const component = entry.component ? `[${entry.component}]` : '';
    const agent = entry.agentName ? `{${entry.agentName}}` : '';
    const execution = entry.executionId ? `(${entry.executionId.substring(0, 8)})` : '';

    let message = `${timestamp} ${level} ${component}${agent}${execution} ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += ` | ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      message += `\nError: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n${entry.error.stack}`;
      }
    }

    return message;
  }

  private formatLogfmt(entry: LogEntry): string {
    const parts: string[] = [];

    parts.push(`timestamp="${entry.timestamp.toISOString()}"`);
    parts.push(`level="${entry.level}"`);
    parts.push(`message="${entry.message.replace(/"/g, '\\"')}"`);

    if (entry.component) {
      parts.push(`component="${entry.component}"`);
    }

    if (entry.agentName) {
      parts.push(`agent="${entry.agentName}"`);
    }

    if (entry.executionId) {
      parts.push(`execution_id="${entry.executionId}"`);
    }

    if (entry.metadata) {
      Object.entries(entry.metadata).forEach(([key, value]) => {
        parts.push(`${key}="${String(value).replace(/"/g, '\\"')}"`);
      });
    }

    if (entry.error) {
      parts.push(`error_name="${entry.error.name}"`);
      parts.push(`error_message="${entry.error.message.replace(/"/g, '\\"')}"`);
    }

    return parts.join(' ');
  }
}

// Utility functions for logging setup
export class LoggingSetup {
  /**
   * Setup logging directories
   */
  static async setupLogDirectories(config: LoggingConfig): Promise<void> {
    if (!config.file.enabled) {
      return;
    }

    const { promises: fs } = await import('fs');
    const { dirname } = await import('path');

    const logDir = dirname(config.file.filename);

    try {
      await fs.access(logDir);
    } catch {
      await fs.mkdir(logDir, { recursive: true });
    }
  }

  /**
   * Setup log rotation
   */
  static setupLogRotation(config: LoggingConfig): void {
    if (!config.rotation.enabled) {
      return;
    }

    // This would typically use a library like 'rotating-file-stream'
    // For now, we'll just log that rotation is configured
    console.log(`Log rotation configured: ${config.rotation.frequency}, keeping ${config.rotation.keepFiles} files`);
  }

  /**
   * Create logging configuration for environment
   */
  static createEnvironmentConfig(environment: string): LoggingConfig {
    const manager = LoggingConfigManager.getInstance();
    return manager.getEnvironmentConfig(environment);
  }

  /**
   * Validate logging configuration
   */
  static validateConfig(config: LoggingConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate log level
    const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];
    if (!validLevels.includes(config.level)) {
      errors.push(`Invalid log level: ${config.level}. Must be one of: ${validLevels.join(', ')}`);
    }

    // Validate file configuration
    if (config.file.enabled) {
      if (!config.file.filename) {
        errors.push('File logging enabled but no filename specified');
      }

      if (config.file.maxFiles < 1) {
        errors.push('maxFiles must be at least 1');
      }

      // Validate maxSize format
      const sizePattern = /^\d+[KMGT]?B$/i;
      if (!sizePattern.test(config.file.maxSize)) {
        errors.push(`Invalid maxSize format: ${config.file.maxSize}. Use format like '10MB', '1GB'`);
      }
    }

    // Validate structured logging format
    if (config.structured.enabled) {
      const validFormats = ['json', 'logfmt'];
      if (!validFormats.includes(config.structured.format)) {
        errors.push(`Invalid structured format: ${config.structured.format}. Must be one of: ${validFormats.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const loggingConfig = LoggingConfigManager.getInstance();