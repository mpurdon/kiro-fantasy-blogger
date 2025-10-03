// Sleeper API client implementation

import { AxiosRequestConfig } from 'axios';
import { BaseFantasyClient } from './base-client';
import { PlayerAdditionData } from '../../models/player';
import { PlatformConfig } from '../../models/config';
import { 
  SleeperPlayerData, 
  SleeperTrendingData,
  PlatformAuthConfig, 
  SLEEPER_POSITION_MAPPING,
  PlatformAPIError 
} from './types';

export class SleeperClient extends BaseFantasyClient {
  private playersCache: Map<string, SleeperPlayerData> = new Map();
  private playersCacheExpiry?: Date;

  constructor(config: PlatformConfig, authConfig: PlatformAuthConfig = {}) {
    super(config, authConfig);
    // Sleeper API doesn't require authentication for public data
    this.authenticated = true;
  }

  protected addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig {
    // Sleeper API doesn't require authentication headers for public endpoints
    if (this.authConfig.apiKey) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${this.authConfig.apiKey}`
      };
    }
    return config;
  }

  public async authenticate(): Promise<void> {
    // Sleeper API doesn't require authentication for public data
    this.authenticated = true;
  }

  public async getMostAddedPlayers(_timeframe: string = 'week'): Promise<PlayerAdditionData[]> {
    try {
      // Get trending players (most added)
      const trendingData = await this.getTrendingPlayers('add');
      
      // Get all players data if not cached or expired
      await this.ensurePlayersCache();
      
      // Transform trending data to PlayerAdditionData
      return this.transformSleeperTrending(trendingData);
    } catch (error) {
      this.handleError(error, 'Failed to fetch most added players from Sleeper');
    }
  }

  public async getPlayerInfo(playerId: string): Promise<SleeperPlayerData> {
    try {
      await this.ensurePlayersCache();
      
      const player = this.playersCache.get(playerId);
      if (!player) {
        throw new PlatformAPIError(`Player ${playerId} not found`, this.config.name);
      }
      
      return player;
    } catch (error) {
      this.handleError(error, `Failed to fetch player info for ${playerId} from Sleeper`);
    }
  }

  public async getTrendingPlayers(type: 'add' | 'drop' = 'add'): Promise<SleeperTrendingData[]> {
    try {
      const endpoint = `/players/nfl/trending/${type}`;
      
      const response = await this.get<SleeperTrendingData[]>(endpoint, undefined, true, 300000); // 5 min cache
      
      return response.data || [];
    } catch (error) {
      this.handleError(error, `Failed to fetch trending ${type} players from Sleeper`);
    }
  }

  public async getAllPlayers(): Promise<Map<string, SleeperPlayerData>> {
    try {
      const endpoint = '/players/nfl';
      
      const response = await this.get<Record<string, SleeperPlayerData>>(
        endpoint, 
        undefined, 
        true, 
        3600000 // 1 hour cache for all players
      );
      
      const playersMap = new Map<string, SleeperPlayerData>();
      
      for (const [playerId, playerData] of Object.entries(response.data)) {
        playersMap.set(playerId, {
          ...playerData,
          player_id: playerId
        });
      }
      
      return playersMap;
    } catch (error) {
      this.handleError(error, 'Failed to fetch all players from Sleeper');
    }
  }

  private async ensurePlayersCache(): Promise<void> {
    const now = new Date();
    
    // Refresh cache if it's empty or expired (cache for 1 hour)
    if (this.playersCache.size === 0 || 
        !this.playersCacheExpiry || 
        now > this.playersCacheExpiry) {
      
      this.playersCache = await this.getAllPlayers();
      this.playersCacheExpiry = new Date(now.getTime() + 3600000); // 1 hour from now
    }
  }

  private transformSleeperTrending(trendingData: SleeperTrendingData[]): PlayerAdditionData[] {
    const result: PlayerAdditionData[] = [];
    
    for (const trending of trendingData) {
      const player = this.playersCache.get(trending.player_id);
      
      if (player && player.fantasy_positions && player.fantasy_positions.length > 0) {
        const position = SLEEPER_POSITION_MAPPING[player.fantasy_positions[0]!] || player.fantasy_positions[0]!;
        
        result.push({
          playerId: trending.player_id,
          name: player.full_name || `${player.first_name} ${player.last_name}`,
          position,
          team: player.team || 'FA',
          additionCount: trending.count,
          platform: 'Sleeper',
          timestamp: new Date()
        });
      }
    }
    
    return result.sort((a, b) => b.additionCount - a.additionCount);
  }

  public async getPlayerOwnershipTrends(_days: number = 7): Promise<PlayerAdditionData[]> {
    try {
      // Sleeper provides trending data which represents recent additions
      return await this.getMostAddedPlayers();
    } catch (error) {
      console.warn('Failed to fetch ownership trends from Sleeper:', error);
      return [];
    }
  }

  public async getLeagues(userId: string): Promise<any[]> {
    try {
      const currentSeason = new Date().getFullYear();
      const endpoint = `/user/${userId}/leagues/nfl/${currentSeason}`;
      
      const response = await this.get<any[]>(endpoint);
      return response.data || [];
    } catch (error) {
      this.handleError(error, `Failed to fetch leagues for user ${userId} from Sleeper`);
    }
  }

  public async getLeagueInfo(leagueId: string): Promise<any> {
    try {
      const endpoint = `/league/${leagueId}`;
      
      const response = await this.get<any>(endpoint);
      return response.data;
    } catch (error) {
      this.handleError(error, `Failed to fetch league info for ${leagueId} from Sleeper`);
    }
  }

  public async getLeagueRosters(leagueId: string): Promise<any[]> {
    try {
      const endpoint = `/league/${leagueId}/rosters`;
      
      const response = await this.get<any[]>(endpoint);
      return response.data || [];
    } catch (error) {
      this.handleError(error, `Failed to fetch rosters for league ${leagueId} from Sleeper`);
    }
  }

  public async getLeagueUsers(leagueId: string): Promise<any[]> {
    try {
      const endpoint = `/league/${leagueId}/users`;
      
      const response = await this.get<any[]>(endpoint);
      return response.data || [];
    } catch (error) {
      this.handleError(error, `Failed to fetch users for league ${leagueId} from Sleeper`);
    }
  }

  public async getPlayerStats(playerId: string, season?: number): Promise<any> {
    try {
      const currentSeason = season || new Date().getFullYear();
      const endpoint = `/stats/nfl/regular/${currentSeason}/${playerId}`;
      
      const response = await this.get<any>(endpoint);
      return response.data;
    } catch (error) {
      this.handleError(error, `Failed to fetch stats for player ${playerId} from Sleeper`);
    }
  }

  public async getWeeklyStats(week: number, season?: number): Promise<Record<string, any>> {
    try {
      const currentSeason = season || new Date().getFullYear();
      const endpoint = `/stats/nfl/regular/${currentSeason}/${week}`;
      
      const response = await this.get<Record<string, any>>(endpoint);
      return response.data || {};
    } catch (error) {
      this.handleError(error, `Failed to fetch week ${week} stats from Sleeper`);
    }
  }

  public clearPlayersCache(): void {
    this.playersCache.clear();
    this.playersCacheExpiry = undefined as any;
  }

  public getPlayersCacheStats(): { size: number; expiry?: Date } {
    const stats: { size: number; expiry?: Date } = {
      size: this.playersCache.size
    };
    
    if (this.playersCacheExpiry) {
      stats.expiry = this.playersCacheExpiry;
    }
    
    return stats;
  }
}