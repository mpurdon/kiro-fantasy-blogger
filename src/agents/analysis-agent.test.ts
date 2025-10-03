// Analysis Agent tests

import { describe, it, expect, beforeEach } from 'vitest';
import { AnalysisAgent } from './analysis-agent';
import { 
  PlayerResearch, 
  PlayerSummary, 
  PlayerStats, 
  InjuryReport, 
  Matchup, 
  PerformanceMetrics,
  NewsArticle 
} from '../models/player';

describe('AnalysisAgent', () => {
  let analysisAgent: AnalysisAgent;
  let mockPlayerResearch: PlayerResearch;

  beforeEach(() => {
    analysisAgent = new AnalysisAgent();
    
    // Create comprehensive mock data
    const mockPlayer: PlayerSummary = {
      playerId: 'test-player-1',
      name: 'Test Player',
      position: 'RB',
      team: 'TEST',
      additionCount: 150,
      additionPercentage: 25.5,
      platforms: ['ESPN', 'Yahoo']
    };

    const mockStats: PlayerStats = {
      season: 2024,
      week: 8,
      fantasyPoints: 12.5,
      projectedPoints: 14.0,
      usage: {
        snapCount: 65,
        targets: 4,
        carries: 18,
        redZoneTargets: 2
      },
      efficiency: {
        yardsPerTarget: 8.5,
        yardsPerCarry: 4.2,
        touchdownRate: 0.15
      }
    };

    const mockNews: NewsArticle[] = [
      {
        title: 'Test Player sees increased role in offense',
        source: 'ESPN',
        publishDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        summary: 'Coach mentions expanded role for Test Player going forward',
        url: 'https://example.com/news1',
        sentiment: 'positive'
      },
      {
        title: 'Test Player injury update',
        source: 'NFL.com',
        publishDate: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
        summary: 'Player listed as questionable but expected to play',
        url: 'https://example.com/news2',
        sentiment: 'neutral'
      }
    ];

    const mockInjury: InjuryReport = {
      status: 'healthy',
      impactLevel: 'low'
    };

    const mockMatchups: Matchup[] = [
      {
        opponent: 'WEAK',
        isHome: true,
        gameDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
        difficulty: 'easy'
      },
      {
        opponent: 'STRONG',
        isHome: false,
        gameDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Week after
        difficulty: 'hard'
      }
    ];

    const mockPerformance: PerformanceMetrics = {
      lastThreeWeeks: [
        { ...mockStats, week: 6, fantasyPoints: 8.5 },
        { ...mockStats, week: 7, fantasyPoints: 10.2 },
        { ...mockStats, week: 8, fantasyPoints: 12.5 }
      ],
      seasonAverage: mockStats,
      trend: 'improving'
    };

    mockPlayerResearch = {
      player: mockPlayer,
      news: mockNews,
      stats: mockStats,
      injuryStatus: mockInjury,
      upcomingMatchups: mockMatchups,
      recentPerformance: mockPerformance
    };
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(analysisAgent.initialize()).resolves.not.toThrow();
      expect(analysisAgent.name).toBe('AnalysisAgent');
    });

    it('should handle multiple initialization calls', async () => {
      await analysisAgent.initialize();
      await expect(analysisAgent.initialize()).resolves.not.toThrow();
    });
  });

  describe('analyzePlayer', () => {
    beforeEach(async () => {
      await analysisAgent.initialize();
    });

    it('should analyze a player and return valid analysis', async () => {
      const analysis = await analysisAgent.analyzePlayer(mockPlayerResearch);
      
      expect(analysis).toBeDefined();
      expect(analysis.player).toEqual(mockPlayerResearch.player);
      expect(['BUY', 'PASS']).toContain(analysis.recommendation);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(100);
      expect(Array.isArray(analysis.reasoning)).toBe(true);
      expect(analysis.reasoning.length).toBeGreaterThan(0);
      expect(Array.isArray(analysis.riskFactors)).toBe(true);
      expect(Array.isArray(analysis.upside)).toBe(true);
    });

    it('should provide FAAB percentage for BUY recommendations', async () => {
      // Create a strong player profile that should result in BUY
      const strongPlayer = {
        ...mockPlayerResearch,
        player: {
          ...mockPlayerResearch.player,
          additionPercentage: 45 // Very high interest
        },
        stats: {
          ...mockPlayerResearch.stats,
          fantasyPoints: 18.5, // High production
          usage: {
            snapCount: 85,
            targets: 8,
            carries: 22,
            redZoneTargets: 4
          }
        }
      };

      const analysis = await analysisAgent.analyzePlayer(strongPlayer);
      
      if (analysis.recommendation === 'BUY') {
        expect(analysis.suggestedFAABPercentage).toBeDefined();
        expect(analysis.suggestedFAABPercentage).toBeGreaterThan(0);
        expect(analysis.suggestedFAABPercentage).toBeLessThanOrEqual(30);
      }
    });

    it('should identify risk factors correctly', async () => {
      // Create a risky player profile
      const riskyPlayer = {
        ...mockPlayerResearch,
        injuryStatus: {
          status: 'questionable' as const,
          description: 'Ankle injury',
          impactLevel: 'medium' as const
        },
        recentPerformance: {
          ...mockPlayerResearch.recentPerformance,
          trend: 'declining' as const
        },
        stats: {
          ...mockPlayerResearch.stats,
          usage: {
            snapCount: 25, // Low snap count
            targets: 1,
            carries: 5
          }
        }
      };

      const analysis = await analysisAgent.analyzePlayer(riskyPlayer);
      
      expect(analysis.riskFactors.length).toBeGreaterThan(0);
      expect(analysis.riskFactors.some(risk => risk.includes('questionable'))).toBe(true);
    });

    it('should identify upside correctly', async () => {
      // Create a player with clear upside
      const upsidePlayer = {
        ...mockPlayerResearch,
        recentPerformance: {
          ...mockPlayerResearch.recentPerformance,
          trend: 'improving' as const
        },
        stats: {
          ...mockPlayerResearch.stats,
          usage: {
            snapCount: 75,
            redZoneTargets: 5,
            targets: 10,
            carries: 20
          }
        },
        upcomingMatchups: [
          {
            opponent: 'WEAK1',
            isHome: true,
            gameDate: new Date(),
            difficulty: 'easy' as const
          },
          {
            opponent: 'WEAK2',
            isHome: true,
            gameDate: new Date(),
            difficulty: 'easy' as const
          }
        ]
      };

      const analysis = await analysisAgent.analyzePlayer(upsidePlayer);
      
      expect(analysis.upside.length).toBeGreaterThan(0);
    });

    it('should handle players with minimal data', async () => {
      const minimalPlayer = {
        ...mockPlayerResearch,
        news: [],
        upcomingMatchups: [],
        recentPerformance: {
          lastThreeWeeks: [mockPlayerResearch.stats],
          seasonAverage: mockPlayerResearch.stats,
          trend: 'stable' as const
        }
      };

      const analysis = await analysisAgent.analyzePlayer(minimalPlayer);
      
      expect(analysis).toBeDefined();
      expect(analysis.confidence).toBeLessThan(80); // Should have lower confidence
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await analysisAgent.initialize();
    });

    it('should process multiple players', async () => {
      const players = [mockPlayerResearch, mockPlayerResearch];
      const analyses = await analysisAgent.execute(players);
      
      expect(analyses).toHaveLength(2);
      analyses.forEach(analysis => {
        expect(analysis).toBeDefined();
        expect(['BUY', 'PASS']).toContain(analysis.recommendation);
      });
    });

    it('should handle empty input', async () => {
      const analyses = await analysisAgent.execute([]);
      expect(analyses).toHaveLength(0);
    });
  });

  describe('validation and quality checks', () => {
    beforeEach(async () => {
      await analysisAgent.initialize();
    });

    it('should validate analysis quality', async () => {
      const analysis = await analysisAgent.analyzePlayer(mockPlayerResearch);
      const validation = analysisAgent.validateAnalysisQuality([analysis]);
      
      expect(validation.valid).toBe(1);
      expect(validation.invalid).toBe(0);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect consistency issues', async () => {
      // Create analyses that should trigger consistency warnings
      const analyses = Array(6).fill(null).map(() => ({
        player: mockPlayerResearch.player,
        recommendation: 'BUY' as const,
        confidence: 95,
        reasoning: ['Test reason'],
        suggestedFAABPercentage: 15,
        riskFactors: [],
        upside: ['Test upside']
      }));

      const validation = analysisAgent.validateAnalysisQuality(analyses);
      
      expect(validation.consistencyIssues.length).toBeGreaterThan(0);
    });

    it('should generate analysis statistics', async () => {
      const analysis1 = await analysisAgent.analyzePlayer(mockPlayerResearch);
      const analysis2 = await analysisAgent.analyzePlayer({
        ...mockPlayerResearch,
        player: { ...mockPlayerResearch.player, position: 'WR' }
      });

      const stats = analysisAgent.getAnalysisStats([analysis1, analysis2]);
      
      expect(stats.totalAnalyzed).toBe(2);
      expect(stats.buyRecommendations + stats.passRecommendations).toBe(2);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.positionBreakdown).toBeDefined();
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await analysisAgent.initialize();
    });

    it('should handle invalid player data gracefully', async () => {
      const invalidPlayer = {
        ...mockPlayerResearch,
        player: {
          ...mockPlayerResearch.player,
          name: '', // Invalid name
          additionPercentage: -5 // Invalid percentage
        }
      };

      // Should not throw, but create fallback analysis
      const analysis = await analysisAgent.analyzePlayer(invalidPlayer);
      expect(analysis.recommendation).toBe('PASS');
      expect(analysis.confidence).toBeLessThan(50);
    });

    it('should handle extreme values', async () => {
      const extremePlayer = {
        ...mockPlayerResearch,
        player: {
          ...mockPlayerResearch.player,
          additionPercentage: 100 // Maximum possible
        },
        stats: {
          ...mockPlayerResearch.stats,
          fantasyPoints: 50, // Extremely high
          usage: {
            snapCount: 100,
            targets: 20,
            carries: 30,
            redZoneTargets: 10
          }
        }
      };

      const analysis = await analysisAgent.analyzePlayer(extremePlayer);
      
      // Should handle extreme values without breaking
      expect(analysis).toBeDefined();
      expect(analysis.confidence).toBeLessThanOrEqual(100);
      if (analysis.suggestedFAABPercentage) {
        expect(analysis.suggestedFAABPercentage).toBeLessThanOrEqual(30);
      }
    });
  });

  describe('cleanup', () => {
    it('should cleanup without errors', async () => {
      await expect(analysisAgent.cleanup()).resolves.not.toThrow();
    });
  });
});