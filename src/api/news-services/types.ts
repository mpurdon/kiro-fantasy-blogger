// Common types for news services API clients

import { NewsArticle, PlayerStats } from '../../models/player';

export interface APIResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timestamp: Date;
}

export interface NewsServiceClient {
  getPlayerNews(playerId: string, playerName: string): Promise<NewsArticle[]>;
  getRecentNews(limit?: number): Promise<NewsArticle[]>;
  searchNews(query: string, limit?: number): Promise<NewsArticle[]>;
}

export interface SportsDataClient {
  getPlayerStats(playerId: string, season?: number, week?: number): Promise<PlayerStats>;
  getPlayerInfo(playerId: string): Promise<any>;
  getInjuryReports(): Promise<any[]>;
  getSchedule(week?: number): Promise<any[]>;
}

export interface ESPNNewsResponse {
  articles: ESPNArticle[];
  resultsOffset: number;
  resultsLimit: number;
  resultsCount: number;
}

export interface ESPNArticle {
  dataSourceIdentifier: string;
  headline: string;
  description: string;
  published: string;
  type: string;
  premium: boolean;
  links: {
    api: {
      news: {
        href: string;
      };
    };
    web: {
      href: string;
    };
    mobile: {
      href: string;
    };
  };
  lastModified: string;
  categories: Array<{
    id: number;
    description: string;
    type: string;
    sportId: number;
    leagueId: number;
    league: {
      id: number;
      description: string;
    };
  }>;
  athletes?: Array<{
    id: number;
    description: string;
    links: {
      api: {
        athletes: {
          href: string;
        };
      };
    };
  }>;
}

export interface SportsDataPlayerStats {
  PlayerID: number;
  Team: string;
  Number: number;
  FirstName: string;
  LastName: string;
  Position: string;
  Status: string;
  Height: string;
  Weight: number;
  BirthDate: string;
  College: string;
  Experience: number;
  FantasyPosition: string;
  Active: boolean;
  PositionCategory: string;
  Name: string;
  Age: number;
  ExperienceString: string;
  BirthDateString: string;
  PhotoUrl: string;
  ByeWeek: number;
  UpcomingGameOpponent: string;
  UpcomingGameWeek: number;
  ShortName: string;
  AverageDraftPosition: number;
  DepthDisplayOrder: number;
  CurrentTeam: string;
  HeightFeet: number;
  HeightInches: number;
  UpcomingOpponentRank: number;
  UpcomingOpponentPositionRank: number;
  CurrentStatus: string;
  UpcomingSalary: number;
}

export interface SportsDataGameStats {
  StatID: number;
  TeamID: number;
  PlayerID: number;
  SeasonType: number;
  Season: number;
  Name: string;
  Team: string;
  Position: string;
  Number: number;
  FantasyPoints: number;
  FantasyPointsHalfPPR: number;
  FantasyPointsPPR: number;
  FantasyPosition: string;
  Week: number;
  OpponentRank: number;
  OpponentPositionRank: number;
  GlobalGameID: number;
  Updated: string;
  RushingYards: number;
  RushingTouchdowns: number;
  RushingLong: number;
  RushingAttempts: number;
  ReceivingYards: number;
  ReceivingTouchdowns: number;
  ReceivingTargets: number;
  Receptions: number;
  ReceivingLong: number;
  PassingYards: number;
  PassingTouchdowns: number;
  PassingInterceptions: number;
  PassingCompletions: number;
  PassingAttempts: number;
  PassingRating: number;
  PassingLong: number;
  RushingYardsPerAttempt: number;
  ReceivingYardsPerReception: number;
  ReceivingYardsPerTarget: number;
}

export interface InjuryReportData {
  PlayerID: number;
  Name: string;
  Position: string;
  Team: string;
  Number: number;
  InjuryStatus: string;
  InjuryBodyPart: string;
  InjuryStartDate: string;
  InjuryDetails: string;
  DeclaredInactive: boolean;
  Updated: string;
}

export interface SentimentAnalysisResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  keywords: string[];
  reasoning: string;
}

export interface NewsSearchParams {
  query?: string;
  playerId?: string;
  playerName?: string;
  team?: string;
  position?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface NewsServiceError extends Error {
  service: string;
  statusCode?: number;
  response?: any;
}

export class NewsAPIError extends Error implements NewsServiceError {
  public service: string;
  public statusCode?: number;
  public response?: any;

  constructor(message: string, service: string, statusCode?: number, response?: any) {
    super(message);
    this.name = 'NewsAPIError';
    this.service = service;
    this.statusCode = statusCode;
    this.response = response;
  }
}