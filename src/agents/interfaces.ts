// Agent interface definitions

import { 
  PlayerAdditionData, 
  PlayerSummary, 
  PlayerResearch, 
  PlayerAnalysis, 
  BlogPost, 
  PublicationResult,
  ExecutionResult,
  ExecutionStatus,
  DataQualityIssue
} from '../models';

export interface DataCollectionAgent {
  getMostAddedPlayers(): Promise<PlayerAdditionData[]>;
  filterToTopTen(players: PlayerAdditionData[]): PlayerSummary[];
}

export interface ResearchAgent {
  gatherPlayerResearch(players: PlayerSummary[]): Promise<PlayerResearch[]>;
}

export interface AnalysisAgent {
  analyzePlayer(research: PlayerResearch): Promise<PlayerAnalysis>;
}

export interface WriterAgent {
  createBlogPost(analyses: PlayerAnalysis[]): Promise<BlogPost>;
}

export interface PublisherAgent {
  publishPost(post: BlogPost): Promise<PublicationResult>;
}

export interface OrchestratorService {
  executeWeeklyProcess(): Promise<ExecutionResult>;
  handleAgentFailure(agent: string, error: Error): Promise<void>;
  getExecutionStatus(): ExecutionStatus;
}

export interface ErrorHandler {
  handleAPIFailure(service: string, error: Error): Promise<void>;
  handleDataQualityIssue(issue: DataQualityIssue): Promise<void>;
  handleAgentFailure(agent: string, error: Error): Promise<void>;
}

// Base agent interface that all agents should implement
export interface BaseAgent {
  name: string;
  initialize(): Promise<void>;
  execute(input: unknown): Promise<unknown>;
  cleanup(): Promise<void>;
}