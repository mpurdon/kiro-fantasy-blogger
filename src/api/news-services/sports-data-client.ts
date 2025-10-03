// Sports Data API client implementation

import { AxiosRequestConfig } from 'axios';
import { BaseNewsClient } from './base-news-client';
import { PlayerStats, InjuryReport } from '../../models/player';
import { NewsServiceConfig } from '../../models/config';
import { 
  SportsDataPlayerStats, 
  SportsDataGameStats, 
  InjuryReportData,
  NewsAPIError 
} from './types';

export class SportsDataClient extends BaseNewsClient {
  constructor(config: NewsServiceConfig) {
    super(config);
    this.authenticated = !!config.apiKey;
  }

  protected addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig {
    if (this.config.apiKey) {
      config.headers = {
        ...config.headers,
        'Ocp-Apim-Subscription-Key': this.config.apiKey
      };
    }
    return config;
  }

  public async getPlayerNews(playerId: string, playerName: string): Promise<any[]> {
    // Sports Data API doesn't provide news, only stats
    // This method is implemented to satisfy the interface
    return [];
  }

  public async getRecentNews(limit?: number): Promise<any[]> {
    // Sports Data API doesn't provide news, only stats
    return [];
  }

  public async searchNews(query: string, limit?: number): Promise<any[]> {
    // Sports Data API doesn't provide news, only stats
    return [];
  }

  public async getPlayerStats(playerId: string, season?: number, week?: number): Promise<PlayerStats> {
    try {
      const currentSeason = season || new Date().getFullYear();
      
      let endpoint: string;
      if (week) {
        endpoint = `/scores/json/PlayerGameStatsByPlayerID/${currentSeason}REG/${week}/${playerId}`;
      } else {
        endpoint = `/scores/json/PlayerSeasonStats/${currentSeason}REG/${playerId}`;
      }

      const response = await this.get<SportsDataGameStats>(endpoint);
      
      return this.transformSportsDataStats(response.data);
    } catch (error) {
      this.handleError(error, `Failed to fetch player stats for ${playerId}`);
    }
  }

  public async getPlayerInfo(playerId: string): Promise<SportsDataPlayerStats> {
    try {
      const endpoint = `/scores/json/Player/${playerId}`;
      
      const response = await this.get<SportsDataPlayerStats>(endpoint);
      
      return response.data;
    } catch (error) {
      this.handleError(error, `Failed to fetch player info for ${playerId}`);
    }
  }

  public async getAllPlayers(): Promise<SportsDataPlayerStats[]> {
    try {
      const endpoint = '/scores/json/Players';
      
      const response = await this.get<SportsDataPlayerStats[]>(
        endpoint, 
        undefined, 
        true, 
        3600000 // Cache for 1 hour
      );
      
      return response.data || [];
    } catch (error) {
      this.handleError(error, 'Failed to fetch all players');
    }
  }

  public async getInjuryReports(): Promise<InjuryReport[]> {
    try {
      const endpoint = '/scores/json/Injuries';
      
      const response = await this.get<InjuryReportData[]>(endpoint);
      
      if (!response.data) {
        return [];
      }

      return this.transformInjuryReports(response.data);
    } catch (error) {
      this.handleError(error, 'Failed to fetch injury reports');
    }
  }

  public async getPlayerInjuryStatus(playerId: string): Promise<InjuryReport | null> {
    try {
      const allInjuries = await this.getInjuryReports();
      
      // Find injury report for specific player
      const playerInjury = allInjuries.find(injury => 
        injury.description?.includes(playerId) // This would need better player matching
      );
      
      return playerInjury || null;
    } catch (error) {
      console.warn(`Failed to fetch injury status for player ${playerId}:`, error);
      return null;
    }
  }

  public async getSchedule(week?: number): Promise<any[]> {
    try {
      const currentSeason = new Date().getFullYear();
      
      let endpoint: string;
      if (week) {
        endpoint = `/scores/json/ScoresByWeek/${currentSeason}REG/${week}`;
      } else {
        endpoint = `/scores/json/Scores/${currentSeason}REG`;
      }

      const response = await this.get<any[]>(endpoint);
      
      return response.data || [];
    } catch (error) {
      this.handleError(error, `Failed to fetch schedule${week ? ` for week ${week}` : ''}`);
    }
  }

  public async getTeamStats(team: string, season?: number): Promise<any> {
    try {
      const currentSeason = season || new Date().getFullYear();
      const endpoint = `/scores/json/TeamSeasonStats/${currentSeason}REG`;
      
      const response = await this.get<any[]>(endpoint);
      
      if (!response.data) {
        return null;
      }

      // Find stats for specific team
      const teamStats = response.data.find(stats => 
        stats.Team === team || stats.TeamID === team
      );
      
      return teamStats || null;
    } catch (error) {
      this.handleError(error, `Failed to fetch team stats for ${team}`);
    }
  }

  public async getWeeklyStats(week: number, season?: number): Promise<SportsDataGameStats[]> {
    try {
      const currentSeason = season || new Date().getFullYear();
      const endpoint = `/stats/json/PlayerGameStatsByWeek/${currentSeason}REG/${week}`;
      
      const response = await this.get<SportsDataGameStats[]>(endpoint);
      
      return response.data || [];
    } catch (error) {
      this.handleError(error, `Failed to fetch weekly stats for week ${week}`);
    }
  }

  public async getPlayerProjections(playerId: string, week?: number): Promise<any> {
    try {
      const currentSeason = new Date().getFullYear();
      
      let endpoint: string;
      if (week) {
        endpoint = `/projections/json/PlayerGameProjectionStatsByPlayerID/${currentSeason}REG/${week}/${playerId}`;
      } else {
        endpoint = `/projections/json/PlayerSeasonProjectionStats/${currentSeason}REG/${playerId}`;
      }

      const response = await this.get<any>(endpoint);
      
      return response.data;
    } catch (error) {
      this.handleError(error, `Failed to fetch projections for player ${playerId}`);
    }
  }

  private transformSportsDataStats(stats: SportsDataGameStats): PlayerStats {
    return {
      season: stats.Season,
      week: stats.Week,
      fantasyPoints: stats.FantasyPoints || 0,
      projectedPoints: 0, // Would need separate projection call
      usage: {
        snapCount: undefined, // Not provided by this API
        targets: stats.ReceivingTargets || undefined,
        carries: stats.RushingAttempts || undefined,
        redZoneTargets: undefined // Not provided by this API
      },
      efficiency: {
        yardsPerTarget: stats.ReceivingYardsPerTarget || undefined,
        yardsPerCarry: stats.RushingYardsPerAttempt || undefined,
        touchdownRate: undefined // Would need to calculate
      }
    };
  }

  private transformInjuryReports(reports: InjuryReportData[]): InjuryReport[] {
    return reports.map(report => ({
      status: this.mapInjuryStatus(report.InjuryStatus),
      description: report.InjuryDetails || `${report.InjuryBodyPart} injury`,
      expectedReturn: report.InjuryStartDate ? new Date(report.InjuryStartDate) : undefined,
      impactLevel: this.assessInjuryImpact(report.InjuryStatus, report.InjuryBodyPart)
    }));
  }

  private mapInjuryStatus(status: string): InjuryReport['status'] {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('out') || statusLower.includes('inactive')) {
      return 'out';
    }
    if (statusLower.includes('doubtful')) {
      return 'doubtful';
    }
    if (statusLower.includes('questionable')) {
      return 'questionable';
    }
    if (statusLower.includes('ir') || statusLower.includes('injured reserve')) {
      return 'ir';
    }
    
    return 'healthy';
  }

  private assessInjuryImpact(status: string, bodyPart: string): InjuryReport['impactLevel'] {
    const statusLower = status.toLowerCase();
    const bodyPartLower = bodyPart?.toLowerCase() || '';
    
    // High impact injuries
    if (statusLower.includes('out') || statusLower.includes('ir') || 
        bodyPartLower.includes('knee') || bodyPartLower.includes('ankle') ||
        bodyPartLower.includes('shoulder') || bodyPartLower.includes('concussion')) {
      return 'high';
    }
    
    // Medium impact injuries
    if (statusLower.includes('doubtful') || 
        bodyPartLower.includes('hamstring') || bodyPartLower.includes('groin') ||
        bodyPartLower.includes('back') || bodyPartLower.includes('hip')) {
      return 'medium';
    }
    
    // Low impact injuries
    return 'low';
  }

  public async getDefenseVsPositionStats(position: string): Promise<any[]> {
    try {
      const currentSeason = new Date().getFullYear();
      const endpoint = `/scores/json/FantasyDefenseByGame/${currentSeason}REG`;
      
      const response = await this.get<any[]>(endpoint);
      
      return response.data || [];
    } catch (error) {
      this.handleError(error, `Failed to fetch defense vs ${position} stats`);
    }
  }
}