// Orchestrator service interface and types

import { ExecutionResult, ExecutionStatus } from '../models';

export interface IOrchestratorService {
  executeWeeklyProcess(): Promise<ExecutionResult>;
  handleAgentFailure(agent: string, error: Error): Promise<void>;
  getExecutionStatus(): ExecutionStatus;
  startManualExecution(): Promise<ExecutionResult>;
  stopExecution(): Promise<void>;
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