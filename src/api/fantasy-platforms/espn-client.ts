// ESPN Fantasy API client implementation

import { AxiosRequestConfig } from 'axios';
import { BaseFantasyClient } from './base-client';
import { PlayerAdditionData } from '../../models/player';
import { PlatformConfig } from '../../models/config';
import { 
  ESPNPlayerData, 
  PlatformAuthConfig, 
  ESPN_TEAM_IDS, 
  ESPN_POSITION_IDS,
  PlatformAPIError 
} from './types';

export class ESPNClient extends BaseFantasyClient {
  // private _leagueId?: string;
  private seasonId: number;

  constructor(config: PlatformConfig, authConfig: PlatformAuthConfig = {}) {
    super(config, authConfig);
    this.seasonId = new Date().getFullYear();
    
    // ESPN API doesn't require authentication for public data
    this.authenticated = true;
  }

  protected addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig {
    // ESPN public API doesn't require authentication headers
    // Private league data would require cookies/session
    if (this.authConfig.apiKey) {
      config.headers = {
        ...config.headers,
        'X-API-Key': this.authConfig.apiKey
      };
    }
    return config;
  }

  public async authenticate(): Promise<void> {
    // ESPN public API doesn't require authentication
    // For private leagues, would need to handle cookies/session
    this.authenticated = true;
  }

  public async getMostAddedPlayers(_timeframe: string = 'week'): Promise<PlayerAdditionData[]> {
    try {
      // ESPN's public API endpoint for player ownership changes
      const endpoint = `/games/ffl/seasons/${this.seasonId}/segments/0/leagues/0/players`;
      
      const params = {
        view: ['kona_player_info', 'kona_ownership'],
        scoringPeriodId: this.getCurrentWeek(),
        sortPercOwned: 'desc',
        sortPercOwnedDelta: 'desc',
        limit: 50 // Get top 50 to filter later
      };

      const response = await this.get<{ players: ESPNPlayerData[] }>(endpoint, params);
      
      if (!response.data.players) {
        throw new PlatformAPIError('No players data in ESPN response', this.config.name);
      }

      return this.transformESPNPlayers(response.data.players);
    } catch (error) {
      this.handleError(error, 'Failed to fetch most added players from ESPN');
    }
  }

  public async getPlayerInfo(playerId: string): Promise<ESPNPlayerData> {
    try {
      const endpoint = `/games/ffl/seasons/${this.seasonId}/segments/0/leagues/0/players`;
      
      const params = {
        view: ['kona_player_info'],
        playerId: parseInt(playerId, 10)
      };

      const response = await this.get<{ players: ESPNPlayerData[] }>(endpoint, params);
      
      if (!response.data.players || response.data.players.length === 0) {
        throw new PlatformAPIError(`Player ${playerId} not found`, this.config.name);
      }

      return response.data.players[0]!;
    } catch (error) {
      this.handleError(error, `Failed to fetch player info for ${playerId} from ESPN`);
    }
  }

  public async getPlayerOwnershipTrends(_days: number = 7): Promise<PlayerAdditionData[]> {
    try {
      // Get players with significant ownership changes
      const endpoint = `/games/ffl/seasons/${this.seasonId}/segments/0/leagues/0/players`;
      
      const params = {
        view: ['kona_player_info', 'kona_ownership'],
        scoringPeriodId: this.getCurrentWeek(),
        sortPercOwnedDelta: 'desc',
        limit: 100
      };

      const response = await this.get<{ players: ESPNPlayerData[] }>(endpoint, params);
      
      if (!response.data.players) {
        return [];
      }

      // Filter players with positive ownership change (being added)
      const trendingPlayers = response.data.players.filter(player => 
        player.ownership && player.ownership.percentChange > 0
      );

      return this.transformESPNPlayers(trendingPlayers);
    } catch (error) {
      console.warn('Failed to fetch ownership trends from ESPN:', error);
      return [];
    }
  }

  private transformESPNPlayers(players: ESPNPlayerData[]): PlayerAdditionData[] {
    return players
      .filter(player => player.ownership && player.ownership.percentChange > 0)
      .map(player => {
        const position = ESPN_POSITION_IDS[player.defaultPositionId] || 'UNKNOWN';
        const team = this.getTeamAbbreviation(player.proTeamId);
        
        return {
          playerId: player.id.toString(),
          name: player.fullName,
          position,
          team,
          additionCount: Math.round(player.ownership!.percentChange * 100), // Convert to count approximation
          platform: 'ESPN',
          timestamp: new Date()
        };
      })
      .sort((a, b) => b.additionCount - a.additionCount);
  }

  private getTeamAbbreviation(teamId: number): string {
    // Reverse lookup in ESPN_TEAM_IDS
    for (const [abbr, id] of Object.entries(ESPN_TEAM_IDS)) {
      if (id === teamId) {
        return abbr;
      }
    }
    return 'FA'; // Free Agent
  }

  private getCurrentWeek(): number {
    // Calculate current NFL week based on season start
    const seasonStart = new Date(this.seasonId, 8, 1); // September 1st
    const now = new Date();
    const diffTime = now.getTime() - seasonStart.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    
    // NFL season is typically weeks 1-18
    return Math.max(1, Math.min(18, diffWeeks));
  }

  public async getLeagueInfo(leagueId: string): Promise<any> {
    try {
      // this._leagueId = leagueId;
      const endpoint = `/games/ffl/seasons/${this.seasonId}/segments/0/leagues/${leagueId}`;
      
      const params = {
        view: ['mSettings', 'mTeam']
      };

      const response = await this.get(endpoint, params);
      return response.data;
    } catch (error) {
      this.handleError(error, `Failed to fetch league info for ${leagueId} from ESPN`);
    }
  }

  public async getPlayerStats(playerId: string, week?: number): Promise<any> {
    try {
      const endpoint = `/games/ffl/seasons/${this.seasonId}/segments/0/leagues/0/players`;
      
      const params = {
        view: ['kona_player_info', 'kona_playercard'],
        playerId: parseInt(playerId, 10),
        ...(week && { scoringPeriodId: week })
      };

      const response = await this.get(endpoint, params);
      const data = response.data as any;
      
      if (!data.players || data.players.length === 0) {
        throw new PlatformAPIError(`Player stats for ${playerId} not found`, this.config.name);
      }

      return data.players[0];
    } catch (error) {
      this.handleError(error, `Failed to fetch player stats for ${playerId} from ESPN`);
    }
  }
}