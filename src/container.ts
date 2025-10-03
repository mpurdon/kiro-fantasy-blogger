// Dependency injection container for the Fantasy Football FAAB Blog System

import { join } from 'path';
import { SystemConfig } from './models/config';
import { ConfigManager } from './config/config-manager';
import { CredentialManager } from './config/credential-manager';
import { DataCollectionAgentImpl } from './agents/data-collection-agent';
import { ResearchAgent } from './agents/research-agent';
import { AnalysisAgent } from './agents/analysis-agent';
import { WriterAgent } from './agents/writer-agent';
import { PublisherAgent } from './agents/publisher-agent';
import { PublicationValidator } from './agents/publication-validator';
import { OrchestratorService } from './services/orchestrator';
import { ErrorHandler } from './services/error-handler';
import { ExecutionTracker } from './services/execution-tracker';
import { HealthMonitor } from './services/health-monitor';
import { ESPNClient } from './api/fantasy-platforms/espn-client';
import { YahooClient } from './api/fantasy-platforms/yahoo-client';
import { SleeperClient } from './api/fantasy-platforms/sleeper-client';
import { ESPNNewsClient } from './api/news-services/espn-news-client';
import { SportsDataClient } from './api/news-services/sports-data-client';
import { SentimentAnalyzer } from './api/news-services/sentiment-analyzer';
import { WordPressClient } from './api/blog-platform/wordpress-client';
import { MediumClient } from './api/blog-platform/medium-client';
import { RateLimiter } from './api/rate-limiter';
import { CacheManager } from './api/cache-manager';
import { Logger } from './utils';

export interface ServiceContainer {
  // Configuration
  configManager: ConfigManager;
  credentialManager: CredentialManager;
  systemConfig: SystemConfig;
  
  // Core Services
  orchestrator: OrchestratorService;
  errorHandler: ErrorHandler;
  executionTracker: ExecutionTracker;
  healthMonitor: HealthMonitor;
  
  // Agents
  dataCollectionAgent: DataCollectionAgentImpl;
  researchAgent: ResearchAgent;
  analysisAgent: AnalysisAgent;
  writerAgent: WriterAgent;
  publisherAgent: PublisherAgent;
  publicationValidator: PublicationValidator;
  
  // API Clients
  espnClient: ESPNClient;
  yahooClient: YahooClient;
  sleeperClient: SleeperClient;
  espnNewsClient: ESPNNewsClient;
  sportsDataClient: SportsDataClient;
  sentimentAnalyzer: SentimentAnalyzer;
  wordPressClient: WordPressClient;
  mediumClient: MediumClient;
  
  // Utilities
  rateLimiter: RateLimiter;
  cacheManager: CacheManager;
  logger: Logger;
}

export class Container {
  private services: Partial<ServiceContainer> = {};
  private initialized = false;

  async initialize(): Promise<ServiceContainer> {
    if (this.initialized) {
      return this.services as ServiceContainer;
    }

    const logger = new Logger('Container');
    logger.info('Initializing dependency injection container');

    try {
      // Initialize configuration first
      await this.initializeConfiguration();
      
      // Initialize utilities
      await this.initializeUtilities();
      
      // Initialize API clients
      await this.initializeAPIClients();
      
      // Initialize agents
      await this.initializeAgents();
      
      // Initialize core services
      await this.initializeCoreServices();
      
      this.initialized = true;
      logger.info('Container initialization completed successfully');
      
      return this.services as ServiceContainer;
    } catch (error) {
      logger.error('Container initialization failed', error);
      throw error;
    }
  }

  private async initializeConfiguration(): Promise<void> {
    const logger = new Logger('Container:Config');
    
    // Initialize credential manager
    this.services.credentialManager = new CredentialManager();
    
    // Initialize config manager
    this.services.configManager = new ConfigManager({
      configDir: join(process.cwd(), 'config'),
      environment: process.env.NODE_ENV || 'development',
      validateOnLoad: true,
      createDefaultIfMissing: true
    });
    
    // Load system configuration
    this.services.systemConfig = await this.services.configManager.loadConfig();
    
    logger.info('Configuration services initialized');
  }

  private async initializeUtilities(): Promise<void> {
    const logger = new Logger('Container:Utils');
    
    // Initialize main logger
    this.services.logger = new Logger('Application');
    
    // Initialize rate limiter
    this.services.rateLimiter = new RateLimiter({
      requestsPerMinute: 60,
      requestsPerHour: 1000
    });
    
    // Initialize cache manager
    this.services.cacheManager = new CacheManager({
      defaultTTL: 300000, // 5 minutes
      maxSize: 1000
    });
    
    logger.info('Utility services initialized');
  }

  private async initializeAPIClients(): Promise<void> {
    const logger = new Logger('Container:API');
    const config = this.services.systemConfig!;

    // Initialize fantasy platform clients
    const espnPlatform = config.apis.fantasyPlatforms.find((p: any) => p.name === 'ESPN')!;
    this.services.espnClient = new ESPNClient(espnPlatform);

    const yahooPlatform = config.apis.fantasyPlatforms.find((p: any) => p.name === 'Yahoo')!;
    this.services.yahooClient = new YahooClient(yahooPlatform);

    const sleeperPlatform = config.apis.fantasyPlatforms.find((p: any) => p.name === 'Sleeper')!;
    this.services.sleeperClient = new SleeperClient(sleeperPlatform);

    // Initialize news service clients
    const espnNews = config.apis.newsServices.find((s: any) => s.name === 'ESPN News')!;
    this.services.espnNewsClient = new ESPNNewsClient(espnNews);

    this.services.sportsDataClient = new SportsDataClient(config.apis.sportsData);

    // Initialize sentiment analyzer
    this.services.sentimentAnalyzer = new SentimentAnalyzer();

    // Initialize blog platform clients
    const blogConfig = config.blog;
    if (blogConfig.name.toLowerCase() === 'wordpress') {
      this.services.wordPressClient = new WordPressClient(blogConfig);
    } else if (blogConfig.name.toLowerCase() === 'medium') {
      this.services.mediumClient = new MediumClient(blogConfig);
    }

    logger.info('API clients initialized');
  }

  private async initializeAgents(): Promise<void> {
    const agentLogger = new Logger('Container:Agents');
    const config = this.services.systemConfig!;

    // Initialize data collection agent
    const espnPlatformConfig = config.apis.fantasyPlatforms.find((p: any) => p.name === 'ESPN')!;
    const yahooPlatformConfig = config.apis.fantasyPlatforms.find((p: any) => p.name === 'Yahoo')!;
    const sleeperPlatformConfig = config.apis.fantasyPlatforms.find((p: any) => p.name === 'Sleeper')!;
    
    this.services.dataCollectionAgent = new DataCollectionAgentImpl({
      platforms: {
        espn: { 
          config: espnPlatformConfig,
          enabled: true 
        },
        yahoo: { 
          config: yahooPlatformConfig,
          enabled: true 
        },
        sleeper: { 
          config: sleeperPlatformConfig,
          enabled: true 
        }
      },
      caching: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 1000,
        persistToDisk: false
      },
      fallback: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 5000,
        exponentialBackoff: true,
        fallbackToCache: true,
        minimumSuccessfulPlatforms: 1
      },
      monitoring: {
        enabled: true,
        logLevel: 'info',
        metricsCollection: true
      }
    });

    // Initialize research agent
    const espnNewsConfig = config.apis.newsServices.find((s: any) => s.name === 'ESPN News')!;
    this.services.researchAgent = new ResearchAgent(espnNewsConfig, config.apis.sportsData);

    // Initialize analysis agent
    this.services.analysisAgent = new AnalysisAgent();

    // Initialize writer agent
    this.services.writerAgent = new WriterAgent();

    // Initialize publication validator
    const blogClients = new Map();
    if (this.services.wordPressClient) {
      blogClients.set('wordpress', this.services.wordPressClient);
    }
    if (this.services.mediumClient) {
      blogClients.set('medium', this.services.mediumClient);
    }
    
    // Create simple tracker and logger implementations
    const tracker = {
      async trackPublication() {},
      async getPublicationStatus() { return null; },
      async getAllPublications() { return new Map(); },
      async updatePublicationStatus() {},
      async removePublication() {}
    };
    
    const publicationLogger = {
      logSuccess() {},
      logFailure() {},
      logValidation() {},
      logRetry() {}
    };
    
    this.services.publicationValidator = new PublicationValidator(blogClients, tracker, publicationLogger);

    // Initialize publisher agent
    this.services.publisherAgent = new PublisherAgent(config, {
      primaryPlatform: config.blog.name.toLowerCase() as 'wordpress' | 'medium',
      retryAttempts: 3,
      retryDelay: 5000,
      validateBeforePublish: true,
      trackPublicationStatus: true
    });

    agentLogger.info('Agent services initialized');
  }

  private async initializeCoreServices(): Promise<void> {
    const serviceLogger = new Logger('Container:Services');
    const config = this.services.systemConfig!;

    // Initialize error handler
    this.services.errorHandler = new ErrorHandler();

    // Initialize execution tracker
    this.services.executionTracker = new ExecutionTracker();

    // Initialize health monitor
    this.services.healthMonitor = new HealthMonitor({
      healthCheck: {
        enabled: true,
        port: 3001,
        path: '/health',
        interval: 30000 // 30 seconds
      },
      metrics: {
        enabled: true,
        port: 3002,
        path: '/metrics'
      },
      alerts: {
        enabled: false,
        webhookUrl: '',
        emailRecipients: [],
        thresholds: {
          memoryUsage: 80,
          cpuUsage: 80,
          diskUsage: 90,
          errorRate: 5
        }
      }
    });

    // Initialize orchestrator service
    this.services.orchestrator = new OrchestratorService(
      config,
      this.services.dataCollectionAgent!,
      this.services.researchAgent!,
      this.services.analysisAgent!,
      this.services.writerAgent!,
      this.services.publisherAgent!
    );

    serviceLogger.info('Core services initialized');
  }

  getService<K extends keyof ServiceContainer>(serviceName: K): ServiceContainer[K] {
    if (!this.initialized) {
      throw new Error('Container not initialized. Call initialize() first.');
    }

    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not found in container`);
    }

    return service;
  }

  async shutdown(): Promise<void> {
    const logger = new Logger('Container');
    logger.info('Shutting down container');

    try {
      // Stop orchestrator if running
      if (this.services.orchestrator) {
        await this.services.orchestrator.stopExecution();
        this.services.orchestrator.stopScheduledExecution();
      }

      // Shutdown health monitor
      if (this.services.healthMonitor) {
        await this.services.healthMonitor.stop();
      }

      // Clear cache
      if (this.services.cacheManager) {
        await this.services.cacheManager.clear();
      }

      logger.info('Container shutdown completed');
    } catch (error) {
      logger.error('Error during container shutdown', error);
      throw error;
    }
  }
}

// Singleton container instance
let containerInstance: Container | null = null;

export function getContainer(): Container {
  if (!containerInstance) {
    containerInstance = new Container();
  }
  return containerInstance;
}

export async function initializeContainer(): Promise<ServiceContainer> {
  const container = getContainer();
  return await container.initialize();
}

export async function shutdownContainer(): Promise<void> {
  if (containerInstance) {
    await containerInstance.shutdown();
    containerInstance = null;
  }
}