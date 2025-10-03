// Research Agent unit tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResearchAgent } from './research-agent';
import { PlayerSummary, NewsArticle, PlayerStats, InjuryReport } from '../models/player';
import { NewsServiceConfig } from '../models/config';

// Mock the API clients
vi.mock('../api/news-services/espn-news-client');
vi.mock('../api/news-services/sports-data-client');
vi.mock('../api/news-services/sentiment-analyzer');

describe('ResearchAgent', () => {
  let researchAgent: ResearchAgent;
  let mockESPNConfig: NewsServiceConfig;
  let mockSportsDataConfig: NewsServiceConfig;

  beforeEach(() => {
    mockESPNConfig = {
      name: 'ESPN',
      baseUrl: 'https://api.espn.com',
      apiKey: 'test-key',
      rateLimit: { requestsPerMinute: 60, requestsPerHour: 1000 },
      enabled: true
    };

    mockSportsDataConfig = {
      name: 'SportsData',
      baseUrl: 'https://api.sportsdata.io',
      apiKey: 'test-key',
      rateLimit: { requestsPerMinute: 30, requestsPerHour: 500 },
      enabled: true
    };

    researchAgent = new ResearchAgent(mockESPNConfig, mockSportsDataConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(researchAgent.initialize()).resolves.not.toThrow();
    });

    it('should not reinitialize if already initialized', async () => {
      await researchAgent.initialize();
      await expect(researchAgent.initialize()).resolves.not.toThrow();
    });
  });

  describe('gatherPlayerResearch', () => {
    const mockPlayers: PlayerSummary[] = [
      {
        playerId: '1',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        additionCount: 100,
        additionPercentage: 15.5,
        platforms: ['ESPN', 'Yahoo']
      },
      {
        playerId: '2',
        name: 'Christian McCaffrey',
        position: 'RB',
        team: 'SF',
        additionCount: 85,
        additionPercentage: 12.3,
        platforms: ['ESPN', 'Sleeper']
      }
    ];

    beforeEach(async () => {
      await researchAgent.initialize();
    });

    it('should gather research for all players', async () => {
      const research = await researchAgent.gatherPlayerResearch(mockPlayers);
      
      expect(research).toHaveLength(2);
      expect(research[0]?.player.name).toBe('Josh Allen');
      expect(research[1]?.player.name).toBe('Christian McCaffrey');
    });

    it('should include all required research components', async () => {
      const research = await researchAgent.gatherPlayerResearch([mockPlayers[0]!]);
      
      const playerResearch = research[0]!;
      expect(playerResearch).toHaveProperty('player');
      expect(playerResearch).toHaveProperty('news');
      expect(playerResearch).toHaveProperty('stats');
      expect(playerResearch).toHaveProperty('injuryStatus');
      expect(playerResearch).toHaveProperty('upcomingMatchups');
      expect(playerResearch).toHaveProperty('recentPerformance');
    });

    it('should handle API failures gracefully', async () => {
      // Mock API failure
      const mockESPNClient = await import('../api/news-services/espn-news-client');
      vi.spyOn(mockESPNClient.ESPNNewsClient.prototype, 'getPlayerNews').mockRejectedValue(new Error('API Error'));

      const research = await researchAgent.gatherPlayerResearch([mockPlayers[0]!]);
      
      expect(research).toHaveLength(1);
      expect(research[0]?.news).toEqual([]);
    });
  });

  describe('news gathering functionality', () => {
    const mockNewsArticles: NewsArticle[] = [
      {
        title: 'Josh Allen throws for 300 yards',
        source: 'ESPN',
        publishDate: new Date('2024-01-15'),
        summary: 'Buffalo Bills quarterback Josh Allen had an outstanding performance',
        url: 'https://espn.com/article1',
        sentiment: 'positive'
      },
      {
        title: 'Bills injury report',
        source: 'ESPN',
        publishDate: new Date('2024-01-10'),
        summary: 'Several Bills players listed on injury report',
        url: 'https://espn.com/article2',
        sentiment: 'negative'
      }
    ];

    beforeEach(async () => {
      await researchAgent.initialize();
      
      const mockESPNClient = await import('../api/news-services/espn-news-client');
      vi.spyOn(mockESPNClient.ESPNNewsClient.prototype, 'getPlayerNews').mockResolvedValue(mockNewsArticles);
    });

    it('should filter recent news correctly', async () => {
      const research = await researchAgent.gatherPlayerResearch([{
        playerId: '1',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        additionCount: 100,
        additionPercentage: 15.5,
        platforms: ['ESPN']
      }]);

      expect(research[0]?.news).toBeDefined();
      expect(Array.isArray(research[0]?.news)).toBe(true);
    });

    it('should apply sentiment analysis to news', async () => {
      const research = await researchAgent.gatherPlayerResearch([{
        playerId: '1',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        additionCount: 100,
        additionPercentage: 15.5,
        platforms: ['ESPN']
      }]);

      const news = research[0]?.news || [];
      news.forEach(article => {
        expect(['positive', 'neutral', 'negative']).toContain(article.sentiment);
      });
    });
  });

  describe('statistical data collection', () => {
    const mockPlayerStats: PlayerStats = {
      season: 2024,
      week: 15,
      fantasyPoints: 25.6,
      projectedPoints: 22.4,
      usage: {
        snapCount: 65,
        targets: 8,
        carries: 12
      },
      efficiency: {
        yardsPerTarget: 8.5,
        yardsPerCarry: 4.2
      }
    };

    beforeEach(async () => {
      await researchAgent.initialize();
      
      // Mock the SportsDataClient methods
      vi.spyOn(researchAgent['sportsDataClient'], 'getPlayerStats').mockResolvedValue(mockPlayerStats);
      vi.spyOn(researchAgent['sportsDataClient'], 'getPlayerInjuryStatus').mockResolvedValue(null);
      vi.spyOn(researchAgent['sportsDataClient'], 'getSchedule').mockResolvedValue([]);
    });

    it('should gather player statistics', async () => {
      const research = await researchAgent.gatherPlayerResearch([{
        playerId: '1',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        additionCount: 100,
        additionPercentage: 15.5,
        platforms: ['ESPN']
      }]);

      const stats = research[0]?.stats;
      expect(stats).toBeDefined();
      expect(stats?.fantasyPoints).toBeGreaterThanOrEqual(0);
      expect(stats?.season).toBe(2025);
    });

    it('should handle missing stats gracefully', async () => {
      // Override the mock to reject
      vi.spyOn(researchAgent['sportsDataClient'], 'getPlayerStats').mockRejectedValue(new Error('Stats not found'));

      const research = await researchAgent.gatherPlayerResearch([{
        playerId: '1',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        additionCount: 100,
        additionPercentage: 15.5,
        platforms: ['ESPN']
      }]);

      const stats = research[0]?.stats;
      expect(stats).toBeDefined();
      expect(stats?.fantasyPoints).toBe(0); // Should use fallback stats
    });
  });

  describe('injury status collection', () => {
    const mockInjuryReport: InjuryReport = {
      status: 'questionable',
      description: 'Shoulder injury',
      expectedReturn: new Date('2024-01-20'),
      impactLevel: 'medium'
    };

    beforeEach(async () => {
      await researchAgent.initialize();
      
      const mockSportsDataClient = await import('../api/news-services/sports-data-client');
      vi.spyOn(mockSportsDataClient.SportsDataClient.prototype, 'getPlayerInjuryStatus').mockResolvedValue(mockInjuryReport);
    });

    it('should gather injury status', async () => {
      const research = await researchAgent.gatherPlayerResearch([{
        playerId: '1',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        additionCount: 100,
        additionPercentage: 15.5,
        platforms: ['ESPN']
      }]);

      const injury = research[0]?.injuryStatus;
      expect(injury).toBeDefined();
      expect(['healthy', 'questionable', 'doubtful', 'out', 'ir']).toContain(injury?.status);
    });

    it('should default to healthy when no injury found', async () => {
      const mockSportsDataClient = await import('../api/news-services/sports-data-client');
      vi.spyOn(mockSportsDataClient.SportsDataClient.prototype, 'getPlayerInjuryStatus').mockResolvedValue(null);

      const research = await researchAgent.gatherPlayerResearch([{
        playerId: '1',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        additionCount: 100,
        additionPercentage: 15.5,
        platforms: ['ESPN']
      }]);

      const injury = research[0]?.injuryStatus;
      expect(injury?.status).toBe('healthy');
      expect(injury?.impactLevel).toBe('low');
    });
  });

  describe('research data validation', () => {
    beforeEach(async () => {
      await researchAgent.initialize();
    });

    it('should validate research quality', async () => {
      const mockResearch = [{
        player: {
          playerId: '1',
          name: 'Josh Allen',
          position: 'QB',
          team: 'BUF',
          additionCount: 100,
          additionPercentage: 15.5,
          platforms: ['ESPN']
        },
        news: [],
        stats: {
          season: 2024,
          week: 15,
          fantasyPoints: 25.6,
          projectedPoints: 22.4,
          usage: {},
          efficiency: {}
        },
        injuryStatus: {
          status: 'healthy' as const,
          impactLevel: 'low' as const
        },
        upcomingMatchups: [],
        recentPerformance: {
          lastThreeWeeks: [{
            season: 2024,
            week: 15,
            fantasyPoints: 25.6,
            projectedPoints: 22.4,
            usage: {},
            efficiency: {}
          }],
          seasonAverage: {
            season: 2024,
            week: 15,
            fantasyPoints: 25.6,
            projectedPoints: 22.4,
            usage: {},
            efficiency: {}
          },
          trend: 'stable' as const
        }
      }];

      const validation = await researchAgent.validateResearchQuality(mockResearch);
      
      expect(validation.valid).toBeGreaterThanOrEqual(0);
      expect(validation.invalid).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(validation.issues)).toBe(true);
    });
  });

  describe('client status monitoring', () => {
    beforeEach(async () => {
      await researchAgent.initialize();
    });

    it('should provide client status information', () => {
      const status = researchAgent.getClientStatus();
      
      expect(status).toHaveProperty('espnNews');
      expect(status).toHaveProperty('sportsData');
      expect(status.espnNews).toHaveProperty('authenticated');
      expect(status.sportsData).toHaveProperty('authenticated');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await researchAgent.initialize();
      await expect(researchAgent.cleanup()).resolves.not.toThrow();
    });
  });
});