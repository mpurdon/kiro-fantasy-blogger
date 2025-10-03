// Research Agent implementation for gathering player news, stats, and analysis data

import { BaseAgent, ResearchAgent as IResearchAgent } from './interfaces';
import { 
  PlayerSummary, 
  PlayerResearch, 
  NewsArticle, 
  PlayerStats, 
  InjuryReport, 
  Matchup, 
  PerformanceMetrics 
} from '../models/player';
import { ESPNNewsClient } from '../api/news-services/espn-news-client';
import { SportsDataClient } from '../api/news-services/sports-data-client';
import { SentimentAnalyzer } from '../api/news-services/sentiment-analyzer';
import { NewsServiceConfig } from '../models/config';
import { NewsAndAnalysisValidator } from '../models/player';

export class ResearchAgent implements BaseAgent, IResearchAgent {
  public readonly name = 'ResearchAgent';
  
  private espnNewsClient: ESPNNewsClient;
  private sportsDataClient: SportsDataClient;
  private sentimentAnalyzer: SentimentAnalyzer;
  private initialized = false;

  constructor(
    espnConfig: NewsServiceConfig,
    sportsDataConfig: NewsServiceConfig
  ) {
    this.espnNewsClient = new ESPNNewsClient(espnConfig);
    this.sportsDataClient = new SportsDataClient(sportsDataConfig);
    this.sentimentAnalyzer = new SentimentAnalyzer();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Verify API connections
      console.log('Initializing Research Agent...');
      
      // Test ESPN News API connection
      try {
        await this.espnNewsClient.getRecentNews(1);
        console.log('ESPN News API connection verified');
      } catch (error) {
        console.warn('ESPN News API connection failed:', error);
      }

      // Test Sports Data API connection
      try {
        await this.sportsDataClient.getAllPlayers();
        console.log('Sports Data API connection verified');
      } catch (error) {
        console.warn('Sports Data API connection failed:', error);
      }

      this.initialized = true;
      console.log('Research Agent initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize Research Agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async execute(input: PlayerSummary[]): Promise<PlayerResearch[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return await this.gatherPlayerResearch(input);
  }

  public async cleanup(): Promise<void> {
    // Clear caches and cleanup resources
    this.espnNewsClient.clearCache();
    this.sportsDataClient.clearCache();
    console.log('Research Agent cleanup completed');
  }

  public async gatherPlayerResearch(players: PlayerSummary[]): Promise<PlayerResearch[]> {
    console.log(`Starting research for ${players.length} players...`);
    
    const research: PlayerResearch[] = [];
    
    for (const player of players) {
      try {
        console.log(`Researching player: ${player.name} (${player.position}, ${player.team})`);
        
        const playerResearch = await this.researchSinglePlayer(player);
        research.push(playerResearch);
        
        // Add small delay to respect rate limits
        await this.delay(100);
      } catch (error) {
        console.error(`Failed to research player ${player.name}:`, error);
        
        // Create minimal research object for failed players
        const fallbackResearch: PlayerResearch = {
          player,
          news: [],
          stats: this.createFallbackStats(),
          injuryStatus: { status: 'healthy', impactLevel: 'low' },
          upcomingMatchups: [],
          recentPerformance: this.createFallbackPerformance()
        };
        
        research.push(fallbackResearch);
      }
    }
    
    console.log(`Research completed for ${research.length} players`);
    return research;
  }

  private async researchSinglePlayer(player: PlayerSummary): Promise<PlayerResearch> {
    // Gather all research data in parallel where possible
    const [news, stats, injuryStatus, upcomingMatchups] = await Promise.allSettled([
      this.gatherPlayerNews(player),
      this.gatherPlayerStats(player),
      this.gatherInjuryStatus(player),
      this.gatherUpcomingMatchups(player)
    ]);

    // Extract successful results or use fallbacks
    const playerNews = news.status === 'fulfilled' ? news.value : [];
    const playerStats = stats.status === 'fulfilled' ? stats.value : this.createFallbackStats();
    const playerInjury = injuryStatus.status === 'fulfilled' ? injuryStatus.value : { status: 'healthy' as const, impactLevel: 'low' as const };
    const playerMatchups = upcomingMatchups.status === 'fulfilled' ? upcomingMatchups.value : [];

    // Generate recent performance metrics
    const recentPerformance = await this.gatherRecentPerformance(player, playerStats);

    const research: PlayerResearch = {
      player,
      news: playerNews,
      stats: playerStats,
      injuryStatus: playerInjury,
      upcomingMatchups: playerMatchups,
      recentPerformance
    };

    // Validate the research data
    if (!NewsAndAnalysisValidator.validatePlayerResearch(research)) {
      console.warn(`Research validation failed for player ${player.name}, using fallback data`);
      return this.createFallbackResearch(player);
    }

    return research;
  }

  // Task 5.1: News gathering functionality
  private async gatherPlayerNews(player: PlayerSummary): Promise<NewsArticle[]> {
    try {
      console.log(`Gathering news for ${player.name}...`);
      
      // Get news from ESPN
      const espnNews = await this.espnNewsClient.getPlayerNews(player.playerId, player.name);
      
      // Filter for recent and relevant news (last 14 days)
      const recentNews = this.filterRecentNews(espnNews, 14);
      
      // Apply sentiment analysis
      const newsWithSentiment = await this.applySentimentAnalysis(recentNews);
      
      // Filter for fantasy-relevant news
      const relevantNews = this.filterRelevantNews(newsWithSentiment, player);
      
      // Sort by relevance and date
      const sortedNews = this.sortNewsByRelevance(relevantNews);
      
      // Limit to top 10 most relevant articles
      const topNews = sortedNews.slice(0, 10);
      
      console.log(`Found ${topNews.length} relevant news articles for ${player.name}`);
      return topNews;
    } catch (error) {
      console.error(`Failed to gather news for ${player.name}:`, error);
      return [];
    }
  }

  private filterRecentNews(articles: NewsArticle[], daysBack: number): NewsArticle[] {
    if (!Array.isArray(articles)) {
      return [];
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    return articles.filter(article => article.publishDate >= cutoffDate);
  }

  private async applySentimentAnalysis(articles: NewsArticle[]): Promise<NewsArticle[]> {
    return articles.map(article => {
      const sentimentResult = this.sentimentAnalyzer.analyzeArticle(article);
      return {
        ...article,
        sentiment: sentimentResult.sentiment
      };
    });
  }

  private filterRelevantNews(articles: NewsArticle[], player: PlayerSummary): NewsArticle[] {
    const playerNameLower = player.name.toLowerCase();
    const teamLower = player.team.toLowerCase();
    
    return articles.filter(article => {
      const titleLower = article.title.toLowerCase();
      const summaryLower = article.summary.toLowerCase();
      
      // Must mention the player by name
      const mentionsPlayer = titleLower.includes(playerNameLower) || 
                           summaryLower.includes(playerNameLower);
      
      // Or mention their team with position-relevant keywords
      const mentionsTeamAndPosition = (titleLower.includes(teamLower) || summaryLower.includes(teamLower)) &&
                                    (titleLower.includes(player.position.toLowerCase()) || 
                                     summaryLower.includes(player.position.toLowerCase()));
      
      return mentionsPlayer || mentionsTeamAndPosition;
    });
  }

  private sortNewsByRelevance(articles: NewsArticle[]): NewsArticle[] {
    return articles.sort((a, b) => {
      // Sort by date first (more recent = higher relevance)
      const dateScore = b.publishDate.getTime() - a.publishDate.getTime();
      
      // Then by sentiment (negative news often more impactful for fantasy)
      const sentimentScore = this.getSentimentRelevanceScore(b.sentiment) - 
                           this.getSentimentRelevanceScore(a.sentiment);
      
      return dateScore + (sentimentScore * 86400000); // Weight sentiment by 1 day
    });
  }

  private getSentimentRelevanceScore(sentiment: NewsArticle['sentiment']): number {
    switch (sentiment) {
      case 'negative': return 3; // Injury/bad news is highly relevant
      case 'positive': return 2; // Good news is relevant
      case 'neutral': return 1;  // Neutral news is less relevant
      default: return 0;
    }
  }

  // Task 5.2: Statistical data collection
  private async gatherPlayerStats(player: PlayerSummary): Promise<PlayerStats> {
    try {
      console.log(`Gathering stats for ${player.name}...`);
      
      // Get current season stats
      const currentSeason = new Date().getFullYear();
      const stats = await this.sportsDataClient.getPlayerStats(player.playerId, currentSeason);
      
      console.log(`Retrieved stats for ${player.name}`);
      return stats;
    } catch (error) {
      console.error(`Failed to gather stats for ${player.name}:`, error);
      return this.createFallbackStats();
    }
  }

  private async gatherInjuryStatus(player: PlayerSummary): Promise<InjuryReport> {
    try {
      console.log(`Checking injury status for ${player.name}...`);
      
      const injuryStatus = await this.sportsDataClient.getPlayerInjuryStatus(player.playerId);
      
      if (injuryStatus) {
        console.log(`Found injury report for ${player.name}: ${injuryStatus.status}`);
        return injuryStatus;
      }
      
      // No injury found, player is healthy
      return {
        status: 'healthy',
        impactLevel: 'low'
      };
    } catch (error) {
      console.error(`Failed to check injury status for ${player.name}:`, error);
      return {
        status: 'healthy',
        impactLevel: 'low'
      };
    }
  }

  private async gatherUpcomingMatchups(player: PlayerSummary): Promise<Matchup[]> {
    try {
      console.log(`Gathering upcoming matchups for ${player.name}...`);
      
      // Get next 3 weeks of schedule
      const matchups: Matchup[] = [];
      const currentWeek = this.getCurrentNFLWeek();
      
      for (let week = currentWeek; week <= currentWeek + 2 && week <= 18; week++) {
        try {
          const schedule = await this.sportsDataClient.getSchedule(week);
          const teamMatchup = this.findTeamMatchup(schedule, player.team, week);
          
          if (teamMatchup) {
            matchups.push(teamMatchup);
          }
        } catch (error) {
          console.warn(`Failed to get schedule for week ${week}:`, error);
        }
      }
      
      console.log(`Found ${matchups.length} upcoming matchups for ${player.name}`);
      return matchups;
    } catch (error) {
      console.error(`Failed to gather matchups for ${player.name}:`, error);
      return [];
    }
  }

  private async gatherRecentPerformance(player: PlayerSummary, currentStats: PlayerStats): Promise<PerformanceMetrics> {
    try {
      console.log(`Analyzing recent performance for ${player.name}...`);
      
      const currentWeek = this.getCurrentNFLWeek();
      const lastThreeWeeks: PlayerStats[] = [];
      
      // Get stats for last 3 weeks
      for (let week = Math.max(1, currentWeek - 2); week <= currentWeek; week++) {
        try {
          const weekStats = await this.sportsDataClient.getPlayerStats(
            player.playerId, 
            currentStats?.season || new Date().getFullYear(), 
            week
          );
          lastThreeWeeks.push(weekStats);
        } catch (error) {
          console.warn(`Failed to get week ${week} stats for ${player.name}:`, error);
        }
      }
      
      // Calculate trend
      const trend = this.calculatePerformanceTrend(lastThreeWeeks);
      
      const performance: PerformanceMetrics = {
        lastThreeWeeks,
        seasonAverage: currentStats,
        trend
      };
      
      console.log(`Performance analysis complete for ${player.name}: ${trend} trend`);
      return performance;
    } catch (error) {
      console.error(`Failed to analyze performance for ${player.name}:`, error);
      return this.createFallbackPerformance();
    }
  }

  // Task 5.3: Research data compilation and validation
  private calculatePerformanceTrend(weeklyStats: PlayerStats[]): PerformanceMetrics['trend'] {
    if (weeklyStats.length < 2) {
      return 'stable';
    }
    
    // Calculate fantasy points trend
    const points = weeklyStats.map(stats => stats.fantasyPoints);
    let improvingWeeks = 0;
    let decliningWeeks = 0;
    
    for (let i = 1; i < points.length; i++) {
      if (points[i]! > points[i - 1]!) {
        improvingWeeks++;
      } else if (points[i]! < points[i - 1]!) {
        decliningWeeks++;
      }
    }
    
    if (improvingWeeks > decliningWeeks) {
      return 'improving';
    } else if (decliningWeeks > improvingWeeks) {
      return 'declining';
    } else {
      return 'stable';
    }
  }

  private findTeamMatchup(schedule: any[], team: string, _week: number): Matchup | null {
    try {
      if (!Array.isArray(schedule)) {
        return null;
      }
      
      const game = schedule.find(game => 
        game.HomeTeam === team || game.AwayTeam === team
      );
      
      if (!game) {
        return null;
      }
      
      const isHome = game.HomeTeam === team;
      const opponent = isHome ? game.AwayTeam : game.HomeTeam;
      
      return {
        opponent,
        isHome,
        gameDate: new Date(game.DateTime || game.Date),
        difficulty: this.assessMatchupDifficulty(opponent, team)
      };
    } catch (error) {
      console.warn(`Failed to parse matchup data for ${team}:`, error);
      return null;
    }
  }

  private assessMatchupDifficulty(opponent: string, _team: string): Matchup['difficulty'] {
    // This is a simplified difficulty assessment
    // In a real implementation, you'd use defensive rankings, etc.
    const toughDefenses = ['SF', 'BAL', 'BUF', 'DAL', 'PIT'];
    const easyDefenses = ['DET', 'LV', 'ARI', 'CAR', 'WAS'];
    
    if (toughDefenses.includes(opponent)) {
      return 'hard';
    } else if (easyDefenses.includes(opponent)) {
      return 'easy';
    } else {
      return 'medium';
    }
  }

  private getCurrentNFLWeek(): number {
    // Simplified week calculation - in reality you'd use NFL schedule data
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // September 1st
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(18, weeksSinceStart + 1));
  }

  // Utility methods for fallback data
  private createFallbackStats(): PlayerStats {
    return {
      season: new Date().getFullYear(),
      week: this.getCurrentNFLWeek(),
      fantasyPoints: 0,
      projectedPoints: 0,
      usage: {},
      efficiency: {}
    };
  }

  private createFallbackPerformance(): PerformanceMetrics {
    const fallbackStats = this.createFallbackStats();
    return {
      lastThreeWeeks: [fallbackStats],
      seasonAverage: fallbackStats,
      trend: 'stable'
    };
  }

  private createFallbackResearch(player: PlayerSummary): PlayerResearch {
    return {
      player,
      news: [],
      stats: this.createFallbackStats(),
      injuryStatus: { status: 'healthy', impactLevel: 'low' },
      upcomingMatchups: [],
      recentPerformance: this.createFallbackPerformance()
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for testing and monitoring
  public getClientStatus() {
    return {
      espnNews: {
        authenticated: this.espnNewsClient.isAuthenticated(),
        rateLimit: this.espnNewsClient.getRateLimitStatus(),
        cache: this.espnNewsClient.getCacheStats()
      },
      sportsData: {
        authenticated: this.sportsDataClient.isAuthenticated(),
        rateLimit: this.sportsDataClient.getRateLimitStatus(),
        cache: this.sportsDataClient.getCacheStats()
      }
    };
  }

  public async validateResearchQuality(research: PlayerResearch[]): Promise<{
    valid: number;
    invalid: number;
    issues: string[];
  }> {
    let valid = 0;
    let invalid = 0;
    const issues: string[] = [];

    for (const playerResearch of research) {
      if (NewsAndAnalysisValidator.validatePlayerResearch(playerResearch)) {
        valid++;
      } else {
        invalid++;
        issues.push(`Invalid research data for player ${playerResearch.player.name}`);
      }
    }

    return { valid, invalid, issues };
  }
}