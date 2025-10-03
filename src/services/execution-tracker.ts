// Execution tracking and logging service

import { Logger } from '../utils/logger';
import { ExecutionResult } from '../models';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ExecutionLog {
  id: string;
  timestamp: Date;
  type: 'scheduled' | 'manual';
  result: ExecutionResult;
  metadata: Record<string, any> | undefined;
}

export interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastExecution?: Date;
  lastSuccessfulExecution?: Date;
  mostCommonErrors: Array<{ error: string; count: number }>;
}

export class ExecutionTracker {
  private logger: Logger;
  private logDirectory: string;
  private metricsFile: string;

  constructor(logDirectory: string = './logs/executions') {
    this.logger = new Logger('ExecutionTracker');
    this.logDirectory = logDirectory;
    this.metricsFile = path.join(logDirectory, 'metrics.json');
    this.ensureLogDirectory();
  }

  async logExecution(
    type: 'scheduled' | 'manual',
    result: ExecutionResult,
    metadata?: Record<string, any>
  ): Promise<void> {
    const executionLog: ExecutionLog = {
      id: this.generateExecutionId(),
      timestamp: new Date(),
      type,
      result,
      metadata: metadata || undefined
    };

    try {
      // Write individual execution log
      const logFile = path.join(
        this.logDirectory,
        `execution-${executionLog.id}.json`
      );
      await fs.writeFile(logFile, JSON.stringify(executionLog, null, 2));

      // Update metrics
      await this.updateMetrics(executionLog);

      this.logger.info(`Execution logged: ${executionLog.id}`, {
        success: result.success,
        duration: result.duration,
        type
      });
    } catch (error) {
      this.logger.error('Failed to log execution', error);
    }
  }

  async getExecutionHistory(limit: number = 50): Promise<ExecutionLog[]> {
    try {
      const files = await fs.readdir(this.logDirectory);
      const executionFiles = files
        .filter(file => file.startsWith('execution-') && file.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

      const executions: ExecutionLog[] = [];
      for (const file of executionFiles) {
        try {
          const content = await fs.readFile(path.join(this.logDirectory, file), 'utf-8');
          const execution = JSON.parse(content) as ExecutionLog;
          // Convert date strings back to Date objects
          execution.timestamp = new Date(execution.timestamp);
          execution.result.startTime = new Date(execution.result.startTime);
          execution.result.endTime = new Date(execution.result.endTime);
          executions.push(execution);
        } catch (parseError) {
          this.logger.warn(`Failed to parse execution log: ${file}`, parseError);
        }
      }

      return executions;
    } catch (error) {
      this.logger.error('Failed to get execution history', error);
      return [];
    }
  }

  async getExecutionMetrics(): Promise<ExecutionMetrics> {
    try {
      const content = await fs.readFile(this.metricsFile, 'utf-8');
      const metrics = JSON.parse(content) as ExecutionMetrics;
      
      // Convert date strings back to Date objects
      if (metrics.lastExecution) {
        metrics.lastExecution = new Date(metrics.lastExecution);
      }
      if (metrics.lastSuccessfulExecution) {
        metrics.lastSuccessfulExecution = new Date(metrics.lastSuccessfulExecution);
      }
      
      return metrics;
    } catch (error) {
      // Return default metrics if file doesn't exist
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        mostCommonErrors: []
      };
    }
  }

  async getLastExecution(): Promise<ExecutionLog | null> {
    const history = await this.getExecutionHistory(1);
    const firstExecution = history[0];
    return firstExecution || null;
  }

  async getExecutionById(id: string): Promise<ExecutionLog | null> {
    try {
      const logFile = path.join(this.logDirectory, `execution-${id}.json`);
      const content = await fs.readFile(logFile, 'utf-8');
      const execution = JSON.parse(content) as ExecutionLog;
      
      // Convert date strings back to Date objects
      execution.timestamp = new Date(execution.timestamp);
      execution.result.startTime = new Date(execution.result.startTime);
      execution.result.endTime = new Date(execution.result.endTime);
      
      return execution;
    } catch (error) {
      return null;
    }
  }

  async cleanupOldLogs(retentionDays: number = 30): Promise<void> {
    try {
      const files = await fs.readdir(this.logDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;
      for (const file of files) {
        if (file.startsWith('execution-') && file.endsWith('.json')) {
          const filePath = path.join(this.logDirectory, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        this.logger.info(`Cleaned up ${deletedCount} old execution logs`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old logs', error);
    }
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create log directory', error);
    }
  }

  private generateExecutionId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  private async updateMetrics(executionLog: ExecutionLog): Promise<void> {
    try {
      const currentMetrics = await this.getExecutionMetrics();
      
      // Update counters
      currentMetrics.totalExecutions++;
      if (executionLog.result.success) {
        currentMetrics.successfulExecutions++;
        currentMetrics.lastSuccessfulExecution = executionLog.timestamp;
      } else {
        currentMetrics.failedExecutions++;
      }
      
      // Update last execution
      currentMetrics.lastExecution = executionLog.timestamp;
      
      // Update average duration
      const totalDuration = (currentMetrics.averageDuration * (currentMetrics.totalExecutions - 1)) + 
                           executionLog.result.duration;
      currentMetrics.averageDuration = totalDuration / currentMetrics.totalExecutions;
      
      // Update error tracking
      if (!executionLog.result.success && executionLog.result.errors.length > 0) {
        this.updateErrorCounts(currentMetrics, executionLog.result.errors);
      }
      
      // Write updated metrics
      await fs.writeFile(this.metricsFile, JSON.stringify(currentMetrics, null, 2));
    } catch (error) {
      this.logger.error('Failed to update metrics', error);
    }
  }

  private updateErrorCounts(metrics: ExecutionMetrics, errors: Error[]): void {
    const errorMap = new Map<string, number>();
    
    // Load existing error counts
    for (const errorCount of metrics.mostCommonErrors) {
      errorMap.set(errorCount.error, errorCount.count);
    }
    
    // Add new errors
    for (const error of errors) {
      const errorKey = error.message || error.toString();
      errorMap.set(errorKey, (errorMap.get(errorKey) || 0) + 1);
    }
    
    // Convert back to array and sort by count
    metrics.mostCommonErrors = Array.from(errorMap.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Keep top 10 errors
  }
}