// Orchestrator service implementation

import * as cron from 'node-cron';
import { 
  ExecutionResult, 
  ExecutionStatus, 
  SystemConfig,
  ConfigUtils 
} from '../models';
import {
  DataCollectionAgent,
  ResearchAgent,
  AnalysisAgent,
  WriterAgent,
  PublisherAgent
} from '../agents';
import { PlayerAnalysis } from '../models';
import { Logger } from '../utils/logger';
import { ErrorHandler } from './error-handler';
import { ExecutionTracker } from './execution-tracker';

export interface IOrchestratorService {
  executeWeeklyProcess(): Promise<ExecutionResult>;
  handleAgentFailure(agent: string, error: Error): Promise<void>;
  getExecutionStatus(): ExecutionStatus;
  startManualExecution(): Promise<ExecutionResult>;
  stopExecution(): Promise<void>;
  scheduleWeeklyExecution(): void;
  stopScheduledExecution(): void;
  getExecutionHistory(limit?: number): Promise<any[]>;
  getExecutionMetrics(): Promise<any>;
  isScheduled(): boolean;
  getNextScheduledExecution(): Date | null;
}

export interface AgentExecutionContext {
  agentName: string;
  input: unknown;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface AgentExecutionResult {
  agentName: string;
  success: boolean;
  output?: unknown;
  error?: Error;
  duration: number;
  retryCount: number;
}

export class OrchestratorService implements IOrchestratorService {
  private currentStatus: ExecutionStatus;
  private scheduledTask: cron.ScheduledTask | null = null;
  private isExecuting: boolean = false;
  private shouldStop: boolean = false;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private executionTracker: ExecutionTracker;
  private circuitBreaker: Map<string, { failures: number; lastFailure: Date; isOpen: boolean }> = new Map();

  constructor(
    private config: SystemConfig,
    private dataCollectionAgent: DataCollectionAgent,
    private researchAgent: ResearchAgent,
    private analysisAgent: AnalysisAgent,
    private writerAgent: WriterAgent,
    private publisherAgent: PublisherAgent
  ) {
    this.logger = new Logger('OrchestratorService');
    this.errorHandler = new ErrorHandler();
    this.executionTracker = new ExecutionTracker();
    this.currentStatus = ConfigUtils.createExecutionStatus(false);
  }

  async executeWeeklyProcess(): Promise<ExecutionResult> {
    if (this.isExecuting) {
      throw new Error('Execution already in progress');
    }

    const startTime = new Date();
    const agentsExecuted: string[] = [];
    const errors: Error[] = [];
    const warnings: string[] = [];
    let publishedPostId: string | undefined;

    this.isExecuting = true;
    this.shouldStop = false;
    this.currentStatus = ConfigUtils.createExecutionStatus(
      true,
      'Starting',
      0,
      startTime,
      new Date(Date.now() + 30 * 60 * 1000) // Estimate 30 minutes
    );

    try {
      this.logger.info('Starting weekly FAAB blog generation process');

      // Step 1: Data Collection Agent
      if (this.shouldStop) throw new Error('Execution stopped by user');
      
      this.updateStatus('DataCollectionAgent', 10);
      const playerData = await this.executeWithCircuitBreaker(
        'DataCollectionAgent',
        async () => {
          const mostAdded = await this.dataCollectionAgent.getMostAddedPlayers();
          return this.dataCollectionAgent.filterToTopTen(mostAdded);
        }
      );
      agentsExecuted.push('DataCollectionAgent');

      // Step 2: Research Agent
      if (this.shouldStop) throw new Error('Execution stopped by user');
      
      this.updateStatus('ResearchAgent', 30);
      const researchData = await this.executeWithCircuitBreaker(
        'ResearchAgent',
        async () => await this.researchAgent.gatherPlayerResearch(playerData)
      );
      agentsExecuted.push('ResearchAgent');

      // Step 3: Analysis Agent
      if (this.shouldStop) throw new Error('Execution stopped by user');
      
      this.updateStatus('AnalysisAgent', 50);
      const analyses: PlayerAnalysis[] = [];
      for (const research of researchData) {
        const analysis = await this.executeWithCircuitBreaker(
          'AnalysisAgent',
          async () => await this.analysisAgent.analyzePlayer(research)
        );
        analyses.push(analysis);
      }
      agentsExecuted.push('AnalysisAgent');

      // Step 4: Writer Agent
      if (this.shouldStop) throw new Error('Execution stopped by user');
      
      this.updateStatus('WriterAgent', 70);
      const blogPost = await this.executeWithCircuitBreaker(
        'WriterAgent',
        async () => await this.writerAgent.createBlogPost(analyses)
      );
      agentsExecuted.push('WriterAgent');

      // Step 5: Publisher Agent
      if (this.shouldStop) throw new Error('Execution stopped by user');
      
      this.updateStatus('PublisherAgent', 90);
      const publicationResult = await this.executeWithCircuitBreaker(
        'PublisherAgent',
        async () => await this.publisherAgent.publishPost(blogPost)
      );
      agentsExecuted.push('PublisherAgent');
      
      if (publicationResult.success && publicationResult.postId) {
        publishedPostId = publicationResult.postId;
      }

      this.updateStatus('Completed', 100);
      this.logger.info('Weekly process completed successfully');

      const result = ConfigUtils.createExecutionResult(
        true,
        startTime,
        new Date(),
        agentsExecuted,
        errors,
        warnings,
        publishedPostId
      );

      // Log successful execution
      await this.executionTracker.logExecution('scheduled', result);
      
      return result;

    } catch (error) {
      this.logger.error('Weekly process failed', error);
      errors.push(error as Error);
      
      const result = ConfigUtils.createExecutionResult(
        false,
        startTime,
        new Date(),
        agentsExecuted,
        errors,
        warnings,
        publishedPostId
      );

      // Log failed execution
      await this.executionTracker.logExecution('scheduled', result);
      
      return result;
    } finally {
      this.isExecuting = false;
      this.currentStatus = ConfigUtils.createExecutionStatus(false);
    }
  }

  async startManualExecution(): Promise<ExecutionResult> {
    this.logger.info('Starting manual execution');
    const result = await this.executeWeeklyProcess();
    
    // Override the execution type for manual executions
    await this.executionTracker.logExecution('manual', result, { 
      triggeredBy: 'manual',
      timestamp: new Date()
    });
    
    return result;
  }

  async stopExecution(): Promise<void> {
    if (!this.isExecuting) {
      return;
    }

    this.logger.info('Stopping execution');
    this.shouldStop = true;
    
    // Wait for current agent to complete
    let attempts = 0;
    while (this.isExecuting && attempts < 30) { // Wait up to 30 seconds
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (this.isExecuting) {
      this.logger.warn('Force stopping execution after timeout');
      this.isExecuting = false;
      this.currentStatus = ConfigUtils.createExecutionStatus(false);
    }
  }

  getExecutionStatus(): ExecutionStatus {
    return { ...this.currentStatus };
  }

  scheduleWeeklyExecution(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
    }

    const { dayOfWeek, hour, timezone } = this.config.schedule;
    
    // Convert day of week to cron format (0 = Sunday in our config, but cron uses 0 = Sunday too)
    const cronExpression = `0 ${hour} * * ${dayOfWeek}`;
    
    this.logger.info(`Scheduling weekly execution: ${cronExpression} (${timezone})`);
    
    this.scheduledTask = cron.schedule(cronExpression, async () => {
      try {
        this.logger.info('Scheduled execution triggered', {
          cronExpression,
          timezone,
          timestamp: new Date().toISOString()
        });
        
        // Check if already executing
        if (this.isExecuting) {
          this.logger.warn('Skipping scheduled execution - already running');
          return;
        }
        
        await this.executeWeeklyProcess();
        
        // Cleanup old logs after successful execution
        await this.executionTracker.cleanupOldLogs(30);
        
      } catch (error) {
        this.logger.error('Scheduled execution failed', error);
      }
    }, {
      scheduled: true,
      timezone: timezone
    });
  }

  stopScheduledExecution(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      this.logger.info('Scheduled execution stopped');
    }
  }

  async getExecutionHistory(limit: number = 50): Promise<any[]> {
    return await this.executionTracker.getExecutionHistory(limit);
  }

  async getExecutionMetrics(): Promise<any> {
    return await this.executionTracker.getExecutionMetrics();
  }

  isScheduled(): boolean {
    return this.scheduledTask !== null;
  }

  getNextScheduledExecution(): Date | null {
    if (!this.scheduledTask) {
      return null;
    }

    // Calculate next execution based on cron schedule
    const { dayOfWeek, hour } = this.config.schedule;
    const now = new Date();
    const nextExecution = new Date();
    
    // Set to the scheduled hour
    nextExecution.setHours(hour, 0, 0, 0);
    
    // Find the next occurrence of the scheduled day
    const currentDay = now.getDay();
    const daysUntilNext = (dayOfWeek - currentDay + 7) % 7;
    
    if (daysUntilNext === 0 && now.getHours() >= hour) {
      // If it's the same day but past the scheduled time, schedule for next week
      nextExecution.setDate(nextExecution.getDate() + 7);
    } else {
      nextExecution.setDate(nextExecution.getDate() + daysUntilNext);
    }
    
    return nextExecution;
  }

  async handleAgentFailure(agent: string, error: Error): Promise<void> {
    await this.errorHandler.handleAgentFailure(agent, error);
  }

  private async executeAgentWithRetry<T>(
    agentName: string,
    agentFunction: () => Promise<T>,
    maxRetries: number = 3,
    baseRetryDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Executing ${agentName}, attempt ${attempt}/${maxRetries}`);
        const result = await agentFunction();
        
        if (attempt > 1) {
          this.logger.info(`${agentName} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`${agentName} failed on attempt ${attempt}`, error);
        
        // Check if error is retryable
        if (attempt < maxRetries && this.errorHandler.isRetryable(lastError)) {
          const retryDelay = this.errorHandler.getRetryDelay(attempt, baseRetryDelay);
          this.logger.info(`Retrying ${agentName} in ${retryDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else if (attempt < maxRetries) {
          this.logger.warn(`Error is not retryable, skipping remaining attempts`);
          break;
        }
      }
    }
    
    await this.handleAgentFailure(agentName, lastError!);
    throw lastError!;
  }

  private updateStatus(currentAgent: string, progress: number): void {
    this.currentStatus = ConfigUtils.createExecutionStatus(
      true,
      currentAgent,
      progress,
      this.currentStatus.startTime,
      this.currentStatus.estimatedCompletion
    );
  }

  private isCircuitBreakerOpen(agentName: string): boolean {
    const breaker = this.circuitBreaker.get(agentName);
    if (!breaker) return false;

    // Circuit breaker opens after 3 failures within 5 minutes
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    if (breaker.failures >= 3 && breaker.lastFailure > fiveMinutesAgo) {
      return true;
    }

    // Reset circuit breaker if enough time has passed
    if (breaker.lastFailure < fiveMinutesAgo) {
      breaker.failures = 0;
      breaker.isOpen = false;
    }

    return false;
  }

  private recordAgentFailure(agentName: string): void {
    const breaker = this.circuitBreaker.get(agentName) || { failures: 0, lastFailure: new Date(), isOpen: false };
    breaker.failures++;
    breaker.lastFailure = new Date();
    breaker.isOpen = breaker.failures >= 3;
    this.circuitBreaker.set(agentName, breaker);
  }

  private recordAgentSuccess(agentName: string): void {
    const breaker = this.circuitBreaker.get(agentName);
    if (breaker) {
      breaker.failures = Math.max(0, breaker.failures - 1);
      breaker.isOpen = false;
      this.circuitBreaker.set(agentName, breaker);
    }
  }

  private async executeWithCircuitBreaker<T>(
    agentName: string,
    agentFunction: () => Promise<T>
  ): Promise<T> {
    if (this.isCircuitBreakerOpen(agentName)) {
      const error = new Error(`Circuit breaker is open for ${agentName}`);
      this.logger.warn(`Circuit breaker open for ${agentName}, skipping execution`);
      throw error;
    }

    try {
      const result = await this.executeAgentWithRetry(agentName, agentFunction);
      this.recordAgentSuccess(agentName);
      return result;
    } catch (error) {
      this.recordAgentFailure(agentName);
      throw error;
    }
  }
}