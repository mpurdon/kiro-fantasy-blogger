// Error handling and recovery service

import { Logger } from '../utils/logger';
import { DataQualityIssue } from '../models';

export enum ErrorType {
  API_FAILURE = 'API_FAILURE',
  DATA_QUALITY = 'DATA_QUALITY',
  AGENT_FAILURE = 'AGENT_FAILURE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorContext {
  type: ErrorType;
  severity: ErrorSeverity;
  agent?: string;
  service?: string;
  retryable: boolean;
  fallbackAvailable: boolean;
  metadata?: Record<string, any>;
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  execute: () => Promise<any>;
  conditions: (error: Error, context: ErrorContext) => boolean;
}

export class ErrorHandler {
  private logger: Logger;
  private recoveryStrategies: Map<string, RecoveryStrategy[]> = new Map();

  constructor() {
    this.logger = new Logger('ErrorHandler');
    this.initializeRecoveryStrategies();
  }

  async handleAPIFailure(service: string, error: Error): Promise<void> {
    const context = this.classifyError(error, { service });
    
    this.logger.error(`API failure in ${service}`, error);
    
    // Try recovery strategies
    const strategies = this.recoveryStrategies.get('api') || [];
    for (const strategy of strategies) {
      if (strategy.conditions(error, context)) {
        try {
          this.logger.info(`Attempting recovery strategy: ${strategy.name}`);
          await strategy.execute();
          this.logger.info(`Recovery strategy ${strategy.name} succeeded`);
          return;
        } catch (recoveryError) {
          this.logger.warn(`Recovery strategy ${strategy.name} failed`, recoveryError);
        }
      }
    }

    // If no recovery strategy worked, escalate
    await this.escalateError(error, context);
  }

  async handleDataQualityIssue(issue: DataQualityIssue): Promise<void> {
    const context: ErrorContext = {
      type: ErrorType.DATA_QUALITY,
      severity: this.assessDataQualitySeverity(issue),
      retryable: false,
      fallbackAvailable: true,
      metadata: { issue }
    };

    this.logger.warn('Data quality issue detected', issue);

    // Try data quality recovery strategies
    const strategies = this.recoveryStrategies.get('data_quality') || [];
    for (const strategy of strategies) {
      if (strategy.conditions(new Error(issue.description), context)) {
        try {
          await strategy.execute();
          return;
        } catch (recoveryError) {
          this.logger.warn(`Data quality recovery failed`, recoveryError);
        }
      }
    }
  }

  async handleAgentFailure(agent: string, error: Error): Promise<void> {
    const context = this.classifyError(error, { agent });
    
    this.logger.error(`Agent ${agent} failed`, error);

    // Try agent-specific recovery strategies
    const strategies = this.recoveryStrategies.get(`agent_${agent.toLowerCase()}`) || 
                     this.recoveryStrategies.get('agent_generic') || [];
    
    for (const strategy of strategies) {
      if (strategy.conditions(error, context)) {
        try {
          this.logger.info(`Attempting agent recovery: ${strategy.name}`);
          await strategy.execute();
          this.logger.info(`Agent recovery ${strategy.name} succeeded`);
          return;
        } catch (recoveryError) {
          this.logger.warn(`Agent recovery ${strategy.name} failed`, recoveryError);
        }
      }
    }

    // If no recovery worked, try graceful degradation
    await this.attemptGracefulDegradation(agent, error, context);
  }

  classifyError(error: Error, metadata: Record<string, any> = {}): ErrorContext {
    let type = ErrorType.UNKNOWN_ERROR;
    let severity = ErrorSeverity.MEDIUM;
    let retryable = false;
    let fallbackAvailable = false;

    const errorMessage = error.message.toLowerCase();

    // Classify by error message patterns
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      type = ErrorType.TIMEOUT_ERROR;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      type = ErrorType.NETWORK_ERROR;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      type = ErrorType.RATE_LIMIT_ERROR;
      severity = ErrorSeverity.LOW;
      retryable = true;
    } else if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
      type = ErrorType.AUTHENTICATION_ERROR;
      severity = ErrorSeverity.HIGH;
      retryable = false;
    } else if (errorMessage.includes('api') || errorMessage.includes('service')) {
      type = ErrorType.API_FAILURE;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
      fallbackAvailable = true;
    }

    // Check if fallback is available based on agent/service
    if (metadata.agent) {
      fallbackAvailable = this.hasFallbackForAgent(metadata.agent);
    }

    return {
      type,
      severity,
      retryable,
      fallbackAvailable,
      metadata,
      ...metadata
    };
  }

  private initializeRecoveryStrategies(): void {
    // API Recovery Strategies
    this.recoveryStrategies.set('api', [
      {
        name: 'exponential_backoff_retry',
        description: 'Retry with exponential backoff',
        execute: async () => {
          // This would be implemented by the calling code
          await new Promise(resolve => setTimeout(resolve, 5000));
        },
        conditions: (_, context) => context.retryable && context.type === ErrorType.RATE_LIMIT_ERROR
      },
      {
        name: 'switch_to_fallback_api',
        description: 'Switch to alternative API endpoint',
        execute: async () => {
          // Implementation would switch API endpoints
          this.logger.info('Switching to fallback API endpoint');
        },
        conditions: (_, context) => context.fallbackAvailable && context.type === ErrorType.API_FAILURE
      }
    ]);

    // Data Quality Recovery Strategies
    this.recoveryStrategies.set('data_quality', [
      {
        name: 'use_cached_data',
        description: 'Fall back to cached data',
        execute: async () => {
          this.logger.info('Using cached data as fallback');
        },
        conditions: (_, context) => context.fallbackAvailable
      },
      {
        name: 'skip_invalid_records',
        description: 'Skip invalid data records and continue',
        execute: async () => {
          this.logger.info('Skipping invalid data records');
        },
        conditions: (_, context) => context.severity !== ErrorSeverity.CRITICAL
      }
    ]);

    // Agent-specific Recovery Strategies
    this.recoveryStrategies.set('agent_datacollectionagent', [
      {
        name: 'use_single_platform',
        description: 'Continue with data from available platforms only',
        execute: async () => {
          this.logger.info('Continuing with partial platform data');
        },
        conditions: () => true
      }
    ]);

    this.recoveryStrategies.set('agent_researchagent', [
      {
        name: 'use_basic_stats_only',
        description: 'Continue with basic statistics only',
        execute: async () => {
          this.logger.info('Using basic statistics without news data');
        },
        conditions: () => true
      }
    ]);

    this.recoveryStrategies.set('agent_analysisagent', [
      {
        name: 'use_simplified_analysis',
        description: 'Use simplified analysis algorithm',
        execute: async () => {
          this.logger.info('Using simplified analysis fallback');
        },
        conditions: () => true
      }
    ]);

    this.recoveryStrategies.set('agent_writeragent', [
      {
        name: 'use_template_content',
        description: 'Generate content using templates',
        execute: async () => {
          this.logger.info('Using template-based content generation');
        },
        conditions: () => true
      }
    ]);

    this.recoveryStrategies.set('agent_publisheragent', [
      {
        name: 'save_for_manual_review',
        description: 'Save content for manual publication',
        execute: async () => {
          this.logger.info('Saving content for manual publication');
        },
        conditions: () => true
      }
    ]);

    // Generic agent recovery
    this.recoveryStrategies.set('agent_generic', [
      {
        name: 'continue_with_partial_data',
        description: 'Continue execution with available data',
        execute: async () => {
          this.logger.info('Continuing with partial data');
        },
        conditions: (_, context) => context.severity !== ErrorSeverity.CRITICAL
      }
    ]);
  }

  private assessDataQualitySeverity(issue: DataQualityIssue): ErrorSeverity {
    switch (issue.severity) {
      case 'low':
        return ErrorSeverity.LOW;
      case 'medium':
        return ErrorSeverity.MEDIUM;
      case 'high':
        return ErrorSeverity.HIGH;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private hasFallbackForAgent(agent: string): boolean {
    const fallbackCapableAgents = [
      'DataCollectionAgent',
      'ResearchAgent', 
      'AnalysisAgent',
      'WriterAgent'
    ];
    return fallbackCapableAgents.includes(agent);
  }

  private async escalateError(error: Error, context: ErrorContext): Promise<void> {
    if (context.severity === ErrorSeverity.CRITICAL) {
      this.logger.error('Critical error - immediate attention required', error);
      // In a real implementation, this might send alerts, notifications, etc.
    } else {
      this.logger.warn('Error escalated for review', error);
    }
  }

  private async attemptGracefulDegradation(agent: string, _error: Error, _context: ErrorContext): Promise<void> {
    this.logger.info(`Attempting graceful degradation for ${agent}`);
    
    switch (agent) {
      case 'DataCollectionAgent':
        // Could use cached player data or reduce the number of platforms
        this.logger.info('Using cached player data for graceful degradation');
        break;
      case 'ResearchAgent':
        // Could skip news gathering and use basic stats only
        this.logger.info('Skipping news data, using basic stats only');
        break;
      case 'AnalysisAgent':
        // Could use simplified analysis or default recommendations
        this.logger.info('Using simplified analysis for graceful degradation');
        break;
      case 'WriterAgent':
        // Could use template-based content
        this.logger.info('Using template-based content generation');
        break;
      case 'PublisherAgent':
        // Could save content locally for manual publication
        this.logger.info('Saving content locally for manual publication');
        break;
      default:
        this.logger.warn(`No graceful degradation strategy for ${agent}`);
    }
  }

  // Utility method to determine if an error is retryable
  isRetryable(error: Error): boolean {
    const context = this.classifyError(error);
    return context.retryable;
  }

  // Utility method to get recommended retry delay
  getRetryDelay(attempt: number, baseDelay: number = 1000): number {
    return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
  }
}