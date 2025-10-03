// Common types for fantasy platform API clients

import { PlayerAdditionData, PlayerSummary } from '../../models/player';

export interface FantasyPlatformClient {
  getMostAddedPlayers(timeframe?: string): Promise<PlayerAdditionData[]>;
  getPlayerInfo(playerId: string): Promise<any>;
  authenticate(): Promise<void>;
  isAuthenticated(): boolean;
}

export interface ESPNPlayerData {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  proTeamId: number;
  defaultPositionId: number;
  eligibleSlots: number[];
  ownership?: {
    percentOwned: number;
    percentChange: number;
    percentStarted: number;
  };
  stats?: any[];
}

export interface YahooPlayerData {
  player_key: string;
  player_id: string;
  name: {
    full: string;
    first: string;
    last: string;
  };
  editorial_team_abbr: string;
  display_position: string;
  position_type: string;
  ownership?: {
    ownership_type: string;
    percent_owned: number;
  };
}

export interface SleeperPlayerData {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  team: string;
  position: string;
  number: number;
  status: string;
  fantasy_positions: string[];
}

export interface SleeperTrendingData {
  player_id: string;
  count: number;
}

export interface PlatformAuthConfig {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface APIResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timestamp: Date;
}

export interface PlatformError extends Error {
  platform: string;
  statusCode?: number;
  response?: any;
}

export class PlatformAPIError extends Error implements PlatformError {
  public platform: string;
  public statusCode?: number;
  public response?: any;

  constructor(message: string, platform: string, statusCode?: number, response?: any) {
    super(message);
    this.name = 'PlatformAPIError';
    this.platform = platform;
    this.statusCode = statusCode;
    this.response = response;
  }
}

// Team ID mappings for different platforms
export const ESPN_TEAM_IDS: Record<string, number> = {
  'ARI': 22, 'ATL': 1, 'BAL': 33, 'BUF': 2, 'CAR': 29, 'CHI': 3,
  'CIN': 4, 'CLE': 5, 'DAL': 6, 'DEN': 7, 'DET': 8, 'GB': 9,
  'HOU': 34, 'IND': 11, 'JAX': 30, 'KC': 12, 'LV': 13, 'LAC': 24,
  'LAR': 14, 'MIA': 15, 'MIN': 16, 'NE': 17, 'NO': 18, 'NYG': 19,
  'NYJ': 20, 'PHI': 21, 'PIT': 23, 'SF': 25, 'SEA': 26, 'TB': 27,
  'TEN': 10, 'WAS': 28
};

export const ESPN_POSITION_IDS: Record<number, string> = {
  1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST'
};

export const YAHOO_POSITION_MAPPING: Record<string, string> = {
  'QB': 'QB', 'RB': 'RB', 'WR': 'WR', 'TE': 'TE', 'K': 'K', 'DEF': 'DST'
};

export const SLEEPER_POSITION_MAPPING: Record<string, string> = {
  'QB': 'QB', 'RB': 'RB', 'WR': 'WR', 'TE': 'TE', 'K': 'K', 'DEF': 'DST'
};