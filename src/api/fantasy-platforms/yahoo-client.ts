// Yahoo Fantasy API client implementation

import { AxiosRequestConfig } from 'axios';
import { BaseFantasyClient } from './base-client';
import { PlayerAdditionData } from '../../models/player';
import { PlatformConfig } from '../../models/config';
import { 
  YahooPlayerData, 
  PlatformAuthConfig, 
  YAHOO_POSITION_MAPPING,
  PlatformAPIError 
} from './types';

export class YahooClient extends BaseFantasyClient {
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiry?: Date;

  constructor(config: PlatformConfig, authConfig: PlatformAuthConfig = {}) {
    super(config, authConfig);
    this.accessToken = authConfig.accessToken;
    this.refreshToken = authConfig.refreshToken;
  }

  protected addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig {
    if (this.accessToken) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${this.accessToken}`
      };
    }
    return config;
  }

  public async authenticate(): Promise<void> {
    if (!this.authConfig.clientId || !this.authConfig.clientSecret) {
      throw new PlatformAPIError(
        'Yahoo OAuth requires clientId and clientSecret',
        this.config.name
      );
    }

    try {
      // If we have a refresh token, try to refresh the access token
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        // Would need to implement OAuth flow for initial authentication
        throw new PlatformAPIError(
          'Yahoo OAuth flow not implemented - requires manual token setup',
          this.config.name
        );
      }
    } catch (error) {
      this.handleError(error, 'Yahoo authentication failed');
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.authConfig.clientId || !this.authConfig.clientSecret) {
      throw new PlatformAPIError('Missing OAuth credentials for token refresh', this.config.name);
    }

    try {
      const tokenEndpoint = 'https://api.login.yahoo.com/oauth2/get_token';
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.authConfig.clientId,
        client_secret: this.authConfig.clientSecret
      });

      const response = await this.post<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
      }>(tokenEndpoint, params.toString());

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
      this.authenticated = true;
    } catch (error) {
      this.handleError(error, 'Failed to refresh Yahoo access token');
    }
  }

  public async getMostAddedPlayers(timeframe: string = 'week'): Promise<PlayerAdditionData[]> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      // Yahoo Fantasy API endpoint for player ownership changes
      const gameKey = await this.getCurrentGameKey();
      const endpoint = `/fantasy/v2/game/${gameKey}/players;sort=percent_owned_delta;sort_type=desc;count=50`;

      const response = await this.get<any>(endpoint);
      
      // Yahoo API returns XML by default, would need to handle XML parsing
      // For this implementation, assuming JSON response format
      const players = this.parseYahooPlayersResponse(response.data);
      
      return this.transformYahooPlayers(players);
    } catch (error) {
      this.handleError(error, 'Failed to fetch most added players from Yahoo');
    }
  }

  public async getPlayerInfo(playerId: string): Promise<YahooPlayerData> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const gameKey = await this.getCurrentGameKey();
      const endpoint = `/fantasy/v2/game/${gameKey}/player/${playerId}`;

      const response = await this.get<any>(endpoint);
      
      const playerData = this.parseYahooPlayerResponse(response.data);
      return playerData;
    } catch (error) {
      this.handleError(error, `Failed to fetch player info for ${playerId} from Yahoo`);
    }
  }

  public async getPlayerOwnershipTrends(days: number = 7): Promise<PlayerAdditionData[]> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const gameKey = await this.getCurrentGameKey();
      const endpoint = `/fantasy/v2/game/${gameKey}/players;sort=percent_owned_delta;sort_type=desc;count=100`;

      const response = await this.get<any>(endpoint);
      const players = this.parseYahooPlayersResponse(response.data);
      
      // Filter for players with positive ownership change
      const trendingPlayers = players.filter((player: any) => 
        player.ownership && player.ownership.percent_owned_delta > 0
      );

      return this.transformYahooPlayers(trendingPlayers);
    } catch (error) {
      console.warn('Failed to fetch ownership trends from Yahoo:', error);
      return [];
    }
  }

  private async getCurrentGameKey(): Promise<string> {
    try {
      // Yahoo uses game keys like "nfl.l.{league_id}" for NFL
      const currentYear = new Date().getFullYear();
      const endpoint = `/fantasy/v2/games;game_codes=nfl;seasons=${currentYear}`;
      
      const response = await this.get<any>(endpoint);
      
      // Parse the game key from response
      // This is a simplified implementation
      return `nfl.l.${currentYear}`;
    } catch (error) {
      // Fallback to current year format
      return `nfl.l.${new Date().getFullYear()}`;
    }
  }

  private parseYahooPlayersResponse(data: any): any[] {
    // Yahoo API typically returns XML, this would need proper XML parsing
    // For this implementation, assuming the data is already parsed to JSON
    if (data.fantasy_content && data.fantasy_content.game && data.fantasy_content.game.players) {
      return data.fantasy_content.game.players.player || [];
    }
    return [];
  }

  private parseYahooPlayerResponse(data: any): YahooPlayerData {
    // Simplified parsing - would need proper XML to JSON conversion
    const player = data.fantasy_content?.game?.player || data;
    
    return {
      player_key: player.player_key || '',
      player_id: player.player_id || '',
      name: {
        full: player.name?.full || '',
        first: player.name?.first || '',
        last: player.name?.last || ''
      },
      editorial_team_abbr: player.editorial_team_abbr || '',
      display_position: player.display_position || '',
      position_type: player.position_type || '',
      ownership: player.ownership
    };
  }

  private transformYahooPlayers(players: any[]): PlayerAdditionData[] {
    return players
      .filter(player => player.ownership && player.ownership.percent_owned_delta > 0)
      .map(player => {
        const position = YAHOO_POSITION_MAPPING[player.display_position] || player.display_position;
        
        return {
          playerId: player.player_id,
          name: player.name.full,
          position,
          team: player.editorial_team_abbr,
          additionCount: Math.round(player.ownership.percent_owned_delta * 100),
          platform: 'Yahoo',
          timestamp: new Date()
        };
      })
      .sort((a, b) => b.additionCount - a.additionCount);
  }

  public async getLeagues(): Promise<any[]> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    try {
      const endpoint = '/fantasy/v2/users;use_login=1/games;game_codes=nfl/leagues';
      const response = await this.get<any>(endpoint);
      
      return this.parseYahooLeaguesResponse(response.data);
    } catch (error) {
      this.handleError(error, 'Failed to fetch leagues from Yahoo');
    }
  }

  private parseYahooLeaguesResponse(data: any): any[] {
    // Simplified parsing for leagues data
    if (data.fantasy_content && data.fantasy_content.users) {
      const user = data.fantasy_content.users.user;
      if (user && user.games && user.games.game) {
        const game = user.games.game;
        return game.leagues?.league || [];
      }
    }
    return [];
  }

  public isTokenExpired(): boolean {
    if (!this.tokenExpiry) {
      return true;
    }
    return new Date() >= this.tokenExpiry;
  }

  public async ensureValidToken(): Promise<void> {
    if (!this.authenticated || this.isTokenExpired()) {
      await this.authenticate();
    }
  }
}