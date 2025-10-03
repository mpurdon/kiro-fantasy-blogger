// ESPN News API client implementation

import { AxiosRequestConfig } from 'axios';
import { BaseNewsClient } from './base-news-client';
import { NewsArticle } from '../../models/player';
import { NewsServiceConfig } from '../../models/config';
import { 
  ESPNNewsResponse, 
  ESPNArticle, 
  NewsSearchParams,
  NewsAPIError 
} from './types';

export class ESPNNewsClient extends BaseNewsClient {
  constructor(config: NewsServiceConfig) {
    super(config);
    // ESPN News API doesn't require authentication for public endpoints
    this.authenticated = true;
  }

  protected addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig {
    if (this.config.apiKey) {
      config.headers = {
        ...config.headers,
        'X-API-Key': this.config.apiKey
      };
    }
    return config;
  }

  public async getPlayerNews(playerId: string, playerName: string): Promise<NewsArticle[]> {
    try {
      // ESPN News API endpoint for athlete-specific news
      const endpoint = '/sports/football/nfl/news';
      
      const params = {
        athlete: playerId,
        limit: 20
      };

      const response = await this.get<ESPNNewsResponse>(endpoint, params);
      
      if (!response.data.articles) {
        // Fallback to search by player name if athlete ID doesn't work
        return await this.searchNews(playerName, 10);
      }

      return this.transformESPNArticles(response.data.articles);
    } catch (error) {
      // Fallback to name search if player ID search fails
      try {
        return await this.searchNews(playerName, 10);
      } catch (fallbackError) {
        this.handleError(error, `Failed to fetch news for player ${playerName}`);
      }
    }
  }

  public async getRecentNews(limit: number = 50): Promise<NewsArticle[]> {
    try {
      const endpoint = '/sports/football/nfl/news';
      
      const params = {
        limit,
        sort: 'recent'
      };

      const response = await this.get<ESPNNewsResponse>(endpoint, params);
      
      if (!response.data.articles) {
        return [];
      }

      return this.transformESPNArticles(response.data.articles);
    } catch (error) {
      this.handleError(error, 'Failed to fetch recent NFL news from ESPN');
    }
  }

  public async searchNews(query: string, limit: number = 20): Promise<NewsArticle[]> {
    try {
      const endpoint = '/sports/football/nfl/news';
      
      const params = {
        search: query,
        limit
      };

      const response = await this.get<ESPNNewsResponse>(endpoint, params);
      
      if (!response.data.articles) {
        return [];
      }

      return this.transformESPNArticles(response.data.articles);
    } catch (error) {
      this.handleError(error, `Failed to search news for query: ${query}`);
    }
  }

  public async getTeamNews(teamId: string, limit: number = 20): Promise<NewsArticle[]> {
    try {
      const endpoint = '/sports/football/nfl/news';
      
      const params = {
        team: teamId,
        limit
      };

      const response = await this.get<ESPNNewsResponse>(endpoint, params);
      
      if (!response.data.articles) {
        return [];
      }

      return this.transformESPNArticles(response.data.articles);
    } catch (error) {
      this.handleError(error, `Failed to fetch team news for ${teamId}`);
    }
  }

  public async getInjuryNews(limit: number = 30): Promise<NewsArticle[]> {
    try {
      const injuryKeywords = ['injury', 'injured', 'hurt', 'questionable', 'doubtful', 'out'];
      const allNews: NewsArticle[] = [];

      // Search for each injury-related keyword
      for (const keyword of injuryKeywords) {
        try {
          const news = await this.searchNews(keyword, Math.ceil(limit / injuryKeywords.length));
          allNews.push(...news);
        } catch (error) {
          console.warn(`Failed to search for injury news with keyword: ${keyword}`, error);
        }
      }

      // Remove duplicates and sort by date
      const uniqueNews = this.removeDuplicateArticles(allNews);
      return uniqueNews
        .sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime())
        .slice(0, limit);
    } catch (error) {
      this.handleError(error, 'Failed to fetch injury news from ESPN');
    }
  }

  private transformESPNArticles(articles: ESPNArticle[]): NewsArticle[] {
    return articles.map(article => ({
      title: article.headline,
      source: 'ESPN',
      publishDate: new Date(article.published),
      summary: article.description || article.headline,
      url: article.links.web.href,
      sentiment: 'neutral' as const // Will be analyzed separately
    }));
  }

  private removeDuplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>();
    return articles.filter(article => {
      const key = `${article.title}:${article.url}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  public async getNewsWithAdvancedSearch(params: NewsSearchParams): Promise<NewsArticle[]> {
    try {
      const endpoint = '/sports/football/nfl/news';
      
      const searchParams: any = {
        limit: params.limit || 20,
        offset: params.offset || 0
      };

      if (params.query) {
        searchParams.search = params.query;
      }

      if (params.team) {
        searchParams.team = params.team;
      }

      if (params.dateFrom) {
        searchParams.dateFrom = params.dateFrom.toISOString().split('T')[0];
      }

      if (params.dateTo) {
        searchParams.dateTo = params.dateTo.toISOString().split('T')[0];
      }

      const response = await this.get<ESPNNewsResponse>(endpoint, searchParams);
      
      if (!response.data.articles) {
        return [];
      }

      let articles = this.transformESPNArticles(response.data.articles);

      // Additional filtering by player name if specified
      if (params.playerName) {
        const playerNameLower = params.playerName.toLowerCase();
        articles = articles.filter(article => 
          article.title.toLowerCase().includes(playerNameLower) ||
          article.summary.toLowerCase().includes(playerNameLower)
        );
      }

      // Additional filtering by position if specified
      if (params.position) {
        const positionLower = params.position.toLowerCase();
        articles = articles.filter(article => 
          article.title.toLowerCase().includes(positionLower) ||
          article.summary.toLowerCase().includes(positionLower)
        );
      }

      return articles;
    } catch (error) {
      this.handleError(error, 'Failed to perform advanced news search');
    }
  }

  public async getBreakingNews(limit: number = 10): Promise<NewsArticle[]> {
    try {
      const endpoint = '/sports/football/nfl/news';
      
      const params = {
        limit,
        type: 'breaking',
        sort: 'recent'
      };

      const response = await this.get<ESPNNewsResponse>(endpoint, params, false); // Don't cache breaking news
      
      if (!response.data.articles) {
        return [];
      }

      return this.transformESPNArticles(response.data.articles);
    } catch (error) {
      // If breaking news endpoint doesn't exist, fall back to recent news
      console.warn('Breaking news endpoint not available, falling back to recent news');
      return await this.getRecentNews(limit);
    }
  }

  public async getPlayerNewsById(athleteId: number, limit: number = 10): Promise<NewsArticle[]> {
    try {
      const endpoint = `/sports/football/nfl/athletes/${athleteId}/news`;
      
      const params = {
        limit
      };

      const response = await this.get<ESPNNewsResponse>(endpoint, params);
      
      if (!response.data.articles) {
        return [];
      }

      return this.transformESPNArticles(response.data.articles);
    } catch (error) {
      this.handleError(error, `Failed to fetch news for athlete ID ${athleteId}`);
    }
  }
}