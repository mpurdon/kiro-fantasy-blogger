// Main application entry point

import { initializeContainer, shutdownContainer, getContainer } from './container';
import { Logger } from './utils';
import { ExecutionResult } from './models';

// Export all modules for library usage
export {
  // Agent interfaces and implementations
  DataCollectionAgent,
  ResearchAgent,
  AnalysisAgent,
  WriterAgent,
  PublisherAgent,
  OrchestratorService as IOrchestratorService,
  ErrorHandler as IErrorHandler,
  BaseAgent,
  DataCollectionAgentImpl,
  ResearchAgentImpl,
  AnalysisAgentImpl,
  WriterAgentImpl,
  PublisherAgentImpl,
  PublicationValidator
} from './agents';

export {
  // Services
  HealthMonitor,
  ExecutionTracker,
  OrchestratorService,
  ErrorHandler
} from './services';

export * from './models';
export * from './config';

export {
  // API clients
  BaseFantasyClient,
  ESPNClient,
  YahooClient,
  SleeperClient,
  BaseNewsClient,
  ESPNNewsClient,
  SportsDataClient,
  SentimentAnalyzer,
  BaseBlogClient,
  WordPressClient,
  MediumClient,
  RateLimiter,
  CacheManager
} from './api';

export * from './utils';
export * from './container';

// Application class for managing the entire system
export class FantasyFootballFAABBlogApp {
  private logger: Logger;
  private isRunning = false;

  constructor() {
    this.logger = new Logger('FantasyFootballFAABBlogApp');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Application is already running');
      return;
    }

    try {
      this.logger.info('Starting Fantasy Football FAAB Blog application');

      // Initialize the dependency injection container
      const services = await initializeContainer();
      
      // Start health monitoring
      await services.healthMonitor.start();
      
      // Schedule weekly execution
      services.orchestrator.scheduleWeeklyExecution();
      
      this.isRunning = true;
      this.logger.info('Application started successfully');
      
      // Log next scheduled execution
      const nextExecution = services.orchestrator.getNextScheduledExecution();
      if (nextExecution) {
        this.logger.info(`Next scheduled execution: ${nextExecution.toISOString()}`);
      }

    } catch (error) {
      this.logger.error('Failed to start application', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Application is not running');
      return;
    }

    try {
      this.logger.info('Stopping Fantasy Football FAAB Blog application');
      
      // Shutdown the container and all services
      await shutdownContainer();
      
      this.isRunning = false;
      this.logger.info('Application stopped successfully');
      
    } catch (error) {
      this.logger.error('Error during application shutdown', error);
      throw error;
    }
  }

  async executeManually(): Promise<ExecutionResult> {
    if (!this.isRunning) {
      throw new Error('Application must be started before manual execution');
    }

    try {
      this.logger.info('Starting manual execution');
      
      const container = getContainer();
      const orchestrator = container.getService('orchestrator');
      
      const result = await orchestrator.startManualExecution();
      
      if (result.success) {
        this.logger.info('Manual execution completed successfully', {
          duration: result.endTime.getTime() - result.startTime.getTime(),
          agentsExecuted: result.agentsExecuted,
          publishedPostId: result.publishedPostId
        });
      } else {
        this.logger.error('Manual execution failed', {
          errors: result.errors,
          warnings: result.warnings
        });
      }
      
      return result;
      
    } catch (error) {
      this.logger.error('Manual execution failed', error);
      throw error;
    }
  }

  getStatus(): { isRunning: boolean; nextExecution?: Date } {
    const status: { isRunning: boolean; nextExecution?: Date } = { isRunning: this.isRunning };
    
    if (this.isRunning) {
      try {
        const container = getContainer();
        const orchestrator = container.getService('orchestrator');
        const nextExecution = orchestrator.getNextScheduledExecution();
        
        if (nextExecution) {
          status.nextExecution = nextExecution;
        }
      } catch (error) {
        this.logger.warn('Could not get next execution time', error);
      }
    }
    
    return status;
  }

  isApplicationRunning(): boolean {
    return this.isRunning;
  }
}

// CLI interface for running the application
export async function runApplication(): Promise<void> {
  const app = new FantasyFootballFAABBlogApp();
  
  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await app.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.start();
    
    // Keep the process running
    console.log('Fantasy Football FAAB Blog application is running...');
    console.log('Press Ctrl+C to stop');
    
    // Keep process alive
    await new Promise(() => {}); // This will run indefinitely until interrupted
    
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// If this file is run directly, start the application
if (require.main === module) {
  runApplication().catch(error => {
    console.error('Application startup failed:', error);
    process.exit(1);
  });
}