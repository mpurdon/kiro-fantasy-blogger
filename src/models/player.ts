// Player-related data models and interfaces

export interface Player {
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
  team: string;
  jerseyNumber?: number;
}

export interface PlayerSummary {
  playerId: string;
  name: string;
  position: string;
  team: string;
  additionCount: number;
  additionPercentage: number;
  platforms: string[];
}

export interface PlayerStats {
  season: number;
  week: number;
  fantasyPoints: number;
  projectedPoints: number;
  usage: {
    snapCount?: number;
    targets?: number;
    carries?: number;
    redZoneTargets?: number;
  };
  efficiency: {
    yardsPerTarget?: number;
    yardsPerCarry?: number;
    touchdownRate?: number;
  };
}

export interface PlayerAdditionData {
  playerId: string;
  name: string;
  position: string;
  team: string;
  additionCount: number;
  platform: string;
  timestamp: Date;
}

export interface NewsArticle {
  title: string;
  source: string;
  publishDate: Date;
  summary: string;
  url: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface InjuryReport {
  status: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir';
  description?: string;
  expectedReturn?: Date;
  impactLevel: 'low' | 'medium' | 'high';
}

export interface Matchup {
  opponent: string;
  isHome: boolean;
  gameDate: Date;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface PerformanceMetrics {
  lastThreeWeeks: PlayerStats[];
  seasonAverage: PlayerStats;
  trend: 'improving' | 'declining' | 'stable';
}

export interface PlayerResearch {
  player: PlayerSummary;
  news: NewsArticle[];
  stats: PlayerStats;
  injuryStatus: InjuryReport;
  upcomingMatchups: Matchup[];
  recentPerformance: PerformanceMetrics;
}

export interface PlayerAnalysis {
  player: PlayerSummary;
  recommendation: 'BUY' | 'PASS';
  confidence: number;
  reasoning: string[];
  suggestedFAABPercentage?: number;
  riskFactors: string[];
  upside: string[];
}