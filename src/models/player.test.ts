import { describe, it, expect } from 'vitest';
import {
  Player,
  PlayerSummary,
  PlayerStats,
  PlayerAdditionData,
  NewsArticle,
  InjuryReport,
  Matchup,
  PerformanceMetrics,
  PlayerResearch,
  PlayerAnalysis,
  PlayerValidator,
  PlayerDataTransformer,
  NewsAndAnalysisValidator,
  NewsAndAnalysisTransformer
} from './player';

describe('PlayerValidator', () => {
  describe('validatePlayer', () => {
    it('should validate a valid player', () => {
      const validPlayer: Player = {
        id: 'player123',
        name: 'John Doe',
        position: 'RB',
        team: 'NYG',
        jerseyNumber: 21
      };

      expect(PlayerValidator.validatePlayer(validPlayer)).toBe(true);
    });

    it('should reject player with empty id', () => {
      const invalidPlayer: Player = {
        id: '',
        name: 'John Doe',
        position: 'RB',
        team: 'NYG'
      };

      expect(PlayerValidator.validatePlayer(invalidPlayer)).toBe(false);
    });

    it('should reject player with invalid position', () => {
      const invalidPlayer: Player = {
        id: 'player123',
        name: 'John Doe',
        position: 'INVALID' as any,
        team: 'NYG'
      };

      expect(PlayerValidator.validatePlayer(invalidPlayer)).toBe(false);
    });

    it('should reject player with invalid jersey number', () => {
      const invalidPlayer: Player = {
        id: 'player123',
        name: 'John Doe',
        position: 'RB',
        team: 'NYG',
        jerseyNumber: 100
      };

      expect(PlayerValidator.validatePlayer(invalidPlayer)).toBe(false);
    });

    it('should accept player without jersey number', () => {
      const validPlayer: Player = {
        id: 'player123',
        name: 'John Doe',
        position: 'RB',
        team: 'NYG'
      };

      expect(PlayerValidator.validatePlayer(validPlayer)).toBe(true);
    });
  });

  describe('validatePlayerSummary', () => {
    it('should validate a valid player summary', () => {
      const validSummary: PlayerSummary = {
        playerId: 'player123',
        name: 'John Doe',
        position: 'RB',
        team: 'NYG',
        additionCount: 150,
        additionPercentage: 25.5,
        platforms: ['ESPN', 'Yahoo']
      };

      expect(PlayerValidator.validatePlayerSummary(validSummary)).toBe(true);
    });

    it('should reject summary with negative addition count', () => {
      const invalidSummary: PlayerSummary = {
        playerId: 'player123',
        name: 'John Doe',
        position: 'RB',
        team: 'NYG',
        additionCount: -5,
        additionPercentage: 25.5,
        platforms: ['ESPN']
      };

      expect(PlayerValidator.validatePlayerSummary(invalidSummary)).toBe(false);
    });

    it('should reject summary with invalid addition percentage', () => {
      const invalidSummary: PlayerSummary = {
        playerId: 'player123',
        name: 'John Doe',
        position: 'RB',
        team: 'NYG',
        additionCount: 150,
        additionPercentage: 150,
        platforms: ['ESPN']
      };

      expect(PlayerValidator.validatePlayerSummary(invalidSummary)).toBe(false);
    });

    it('should reject summary with empty platforms array', () => {
      const invalidSummary: PlayerSummary = {
        playerId: 'player123',
        name: 'John Doe',
        position: 'RB',
        team: 'NYG',
        additionCount: 150,
        additionPercentage: 25.5,
        platforms: []
      };

      expect(PlayerValidator.validatePlayerSummary(invalidSummary)).toBe(false);
    });
  });

  describe('validatePlayerStats', () => {
    it('should validate valid player stats', () => {
      const validStats: PlayerStats = {
        season: 2024,
        week: 5,
        fantasyPoints: 15.6,
        projectedPoints: 12.8,
        usage: {
          snapCount: 45,
          targets: 8,
          carries: 12
        },
        efficiency: {
          yardsPerTarget: 8.5,
          yardsPerCarry: 4.2
        }
      };

      expect(PlayerValidator.validatePlayerStats(validStats)).toBe(true);
    });

    it('should reject stats with invalid season', () => {
      const invalidStats: PlayerStats = {
        season: 2019,
        week: 5,
        fantasyPoints: 15.6,
        projectedPoints: 12.8,
        usage: {},
        efficiency: {}
      };

      expect(PlayerValidator.validatePlayerStats(invalidStats)).toBe(false);
    });

    it('should reject stats with invalid week', () => {
      const invalidStats: PlayerStats = {
        season: 2024,
        week: 20,
        fantasyPoints: 15.6,
        projectedPoints: 12.8,
        usage: {},
        efficiency: {}
      };

      expect(PlayerValidator.validatePlayerStats(invalidStats)).toBe(false);
    });

    it('should reject stats with negative fantasy points', () => {
      const invalidStats: PlayerStats = {
        season: 2024,
        week: 5,
        fantasyPoints: -5,
        projectedPoints: 12.8,
        usage: {},
        efficiency: {}
      };

      expect(PlayerValidator.validatePlayerStats(invalidStats)).toBe(false);
    });
  });
});

describe('PlayerDataTransformer', () => {
  describe('playerAdditionDataToSummary', () => {
    it('should transform addition data to summary', () => {
      const additionData: PlayerAdditionData[] = [
        {
          playerId: 'player1',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          additionCount: 50,
          platform: 'ESPN',
          timestamp: new Date()
        },
        {
          playerId: 'player1',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          additionCount: 30,
          platform: 'Yahoo',
          timestamp: new Date()
        }
      ];

      const result = PlayerDataTransformer.playerAdditionDataToSummary(additionData);

      expect(result).toHaveLength(1);
      expect(result[0]?.playerId).toBe('player1');
      expect(result[0]?.additionCount).toBe(80);
      expect(result[0]?.platforms).toEqual(['ESPN', 'Yahoo']);
    });

    it('should handle empty addition data', () => {
      const result = PlayerDataTransformer.playerAdditionDataToSummary([]);
      expect(result).toEqual([]);
    });
  });

  describe('calculateAdditionPercentages', () => {
    it('should calculate correct percentages', () => {
      const summaries: PlayerSummary[] = [
        {
          playerId: 'player1',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          additionCount: 50,
          additionPercentage: 0,
          platforms: ['ESPN']
        }
      ];

      const result = PlayerDataTransformer.calculateAdditionPercentages(summaries, 200);

      expect(result[0]?.additionPercentage).toBe(25);
    });
  });

  describe('sortByAdditionCount', () => {
    it('should sort players by addition count descending', () => {
      const summaries: PlayerSummary[] = [
        {
          playerId: 'player1',
          name: 'Player 1',
          position: 'RB',
          team: 'NYG',
          additionCount: 30,
          additionPercentage: 15,
          platforms: ['ESPN']
        },
        {
          playerId: 'player2',
          name: 'Player 2',
          position: 'WR',
          team: 'DAL',
          additionCount: 50,
          additionPercentage: 25,
          platforms: ['Yahoo']
        }
      ];

      const result = PlayerDataTransformer.sortByAdditionCount(summaries);

      expect(result[0]?.playerId).toBe('player2');
      expect(result[1]?.playerId).toBe('player1');
    });
  });

  describe('filterTopN', () => {
    it('should return top N players', () => {
      const summaries: PlayerSummary[] = Array.from({ length: 15 }, (_, i) => ({
        playerId: `player${i}`,
        name: `Player ${i}`,
        position: 'RB',
        team: 'NYG',
        additionCount: i * 10,
        additionPercentage: i * 5,
        platforms: ['ESPN']
      }));

      const result = PlayerDataTransformer.filterTopN(summaries, 10);

      expect(result).toHaveLength(10);
    });
  });

  describe('normalizePlayerName', () => {
    it('should normalize player names correctly', () => {
      expect(PlayerDataTransformer.normalizePlayerName('  John  Doe Jr.  ')).toBe('john doe jr.');
      expect(PlayerDataTransformer.normalizePlayerName('D\'Angelo Russell')).toBe('dangelo russell');
      expect(PlayerDataTransformer.normalizePlayerName('Mike Evans')).toBe('mike evans');
    });
  });

  describe('normalizeTeamName', () => {
    it('should normalize team names to abbreviations', () => {
      expect(PlayerDataTransformer.normalizeTeamName('New York Giants')).toBe('NYG');
      expect(PlayerDataTransformer.normalizeTeamName('dallas cowboys')).toBe('DAL');
      expect(PlayerDataTransformer.normalizeTeamName('KC')).toBe('KC');
    });
  });

  describe('mergePlayerStats', () => {
    it('should merge multiple player stats correctly', () => {
      const stats: PlayerStats[] = [
        {
          season: 2024,
          week: 1,
          fantasyPoints: 10,
          projectedPoints: 12,
          usage: { targets: 5, carries: 8 },
          efficiency: { yardsPerTarget: 10, yardsPerCarry: 4 }
        },
        {
          season: 2024,
          week: 2,
          fantasyPoints: 20,
          projectedPoints: 15,
          usage: { targets: 8, carries: 12 },
          efficiency: { yardsPerTarget: 12, yardsPerCarry: 5 }
        }
      ];

      const result = PlayerDataTransformer.mergePlayerStats(stats);

      expect(result.fantasyPoints).toBe(15);
      expect(result.projectedPoints).toBe(13.5);
      expect(result.usage.targets).toBe(7);
      expect(result.usage.carries).toBe(10);
      expect(result.efficiency.yardsPerTarget).toBe(11);
      expect(result.efficiency.yardsPerCarry).toBe(4.5);
    });

    it('should throw error for empty stats array', () => {
      expect(() => PlayerDataTransformer.mergePlayerStats([])).toThrow('Cannot merge empty stats array');
    });

    it('should return single stat unchanged', () => {
      const singleStat: PlayerStats = {
        season: 2024,
        week: 1,
        fantasyPoints: 10,
        projectedPoints: 12,
        usage: {},
        efficiency: {}
      };

      const result = PlayerDataTransformer.mergePlayerStats([singleStat]);

      expect(result).toEqual(singleStat);
    });
  });
});

describe('NewsAndAnalysisValidator', () => {
  describe('validateNewsArticle', () => {
    it('should validate a valid news article', () => {
      const validArticle: NewsArticle = {
        title: 'Player News Update',
        source: 'ESPN',
        publishDate: new Date(),
        summary: 'Player had a great game',
        url: 'https://espn.com/article/123',
        sentiment: 'positive'
      };

      expect(NewsAndAnalysisValidator.validateNewsArticle(validArticle)).toBe(true);
    });

    it('should reject article with invalid URL', () => {
      const invalidArticle: NewsArticle = {
        title: 'Player News Update',
        source: 'ESPN',
        publishDate: new Date(),
        summary: 'Player had a great game',
        url: 'not-a-valid-url',
        sentiment: 'positive'
      };

      expect(NewsAndAnalysisValidator.validateNewsArticle(invalidArticle)).toBe(false);
    });

    it('should reject article with invalid sentiment', () => {
      const invalidArticle: NewsArticle = {
        title: 'Player News Update',
        source: 'ESPN',
        publishDate: new Date(),
        summary: 'Player had a great game',
        url: 'https://espn.com/article/123',
        sentiment: 'invalid' as any
      };

      expect(NewsAndAnalysisValidator.validateNewsArticle(invalidArticle)).toBe(false);
    });
  });

  describe('validateInjuryReport', () => {
    it('should validate a valid injury report', () => {
      const validReport: InjuryReport = {
        status: 'questionable',
        description: 'Ankle injury',
        expectedReturn: new Date(),
        impactLevel: 'medium'
      };

      expect(NewsAndAnalysisValidator.validateInjuryReport(validReport)).toBe(true);
    });

    it('should reject report with invalid status', () => {
      const invalidReport: InjuryReport = {
        status: 'invalid' as any,
        impactLevel: 'medium'
      };

      expect(NewsAndAnalysisValidator.validateInjuryReport(invalidReport)).toBe(false);
    });

    it('should reject report with invalid impact level', () => {
      const invalidReport: InjuryReport = {
        status: 'healthy',
        impactLevel: 'invalid' as any
      };

      expect(NewsAndAnalysisValidator.validateInjuryReport(invalidReport)).toBe(false);
    });
  });

  describe('validatePlayerAnalysis', () => {
    it('should validate a valid player analysis', () => {
      const validAnalysis: PlayerAnalysis = {
        player: {
          playerId: 'player123',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          additionCount: 150,
          additionPercentage: 25.5,
          platforms: ['ESPN']
        },
        recommendation: 'BUY',
        confidence: 85,
        reasoning: ['Strong recent performance', 'Favorable matchup'],
        suggestedFAABPercentage: 15,
        riskFactors: ['Injury concern'],
        upside: ['High ceiling']
      };

      expect(NewsAndAnalysisValidator.validatePlayerAnalysis(validAnalysis)).toBe(true);
    });

    it('should reject analysis with invalid confidence', () => {
      const invalidAnalysis: PlayerAnalysis = {
        player: {
          playerId: 'player123',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          additionCount: 150,
          additionPercentage: 25.5,
          platforms: ['ESPN']
        },
        recommendation: 'BUY',
        confidence: 150,
        reasoning: ['Strong recent performance'],
        riskFactors: [],
        upside: []
      };

      expect(NewsAndAnalysisValidator.validatePlayerAnalysis(invalidAnalysis)).toBe(false);
    });

    it('should reject analysis with empty reasoning', () => {
      const invalidAnalysis: PlayerAnalysis = {
        player: {
          playerId: 'player123',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          additionCount: 150,
          additionPercentage: 25.5,
          platforms: ['ESPN']
        },
        recommendation: 'BUY',
        confidence: 85,
        reasoning: [],
        riskFactors: [],
        upside: []
      };

      expect(NewsAndAnalysisValidator.validatePlayerAnalysis(invalidAnalysis)).toBe(false);
    });
  });

  describe('validateMatchup', () => {
    it('should validate a valid matchup', () => {
      const validMatchup: Matchup = {
        opponent: 'DAL',
        isHome: true,
        gameDate: new Date(),
        difficulty: 'medium'
      };

      expect(NewsAndAnalysisValidator.validateMatchup(validMatchup)).toBe(true);
    });

    it('should reject matchup with invalid difficulty', () => {
      const invalidMatchup: Matchup = {
        opponent: 'DAL',
        isHome: true,
        gameDate: new Date(),
        difficulty: 'invalid' as any
      };

      expect(NewsAndAnalysisValidator.validateMatchup(invalidMatchup)).toBe(false);
    });
  });

  describe('validatePerformanceMetrics', () => {
    it('should validate valid performance metrics', () => {
      const validMetrics: PerformanceMetrics = {
        lastThreeWeeks: [
          {
            season: 2024,
            week: 1,
            fantasyPoints: 10,
            projectedPoints: 12,
            usage: {},
            efficiency: {}
          }
        ],
        seasonAverage: {
          season: 2024,
          week: 5,
          fantasyPoints: 12,
          projectedPoints: 11,
          usage: {},
          efficiency: {}
        },
        trend: 'improving'
      };

      expect(NewsAndAnalysisValidator.validatePerformanceMetrics(validMetrics)).toBe(true);
    });

    it('should reject metrics with empty lastThreeWeeks', () => {
      const invalidMetrics: PerformanceMetrics = {
        lastThreeWeeks: [],
        seasonAverage: {
          season: 2024,
          week: 5,
          fantasyPoints: 12,
          projectedPoints: 11,
          usage: {},
          efficiency: {}
        },
        trend: 'improving'
      };

      expect(NewsAndAnalysisValidator.validatePerformanceMetrics(invalidMetrics)).toBe(false);
    });

    it('should reject metrics with invalid trend', () => {
      const invalidMetrics: PerformanceMetrics = {
        lastThreeWeeks: [
          {
            season: 2024,
            week: 1,
            fantasyPoints: 10,
            projectedPoints: 12,
            usage: {},
            efficiency: {}
          }
        ],
        seasonAverage: {
          season: 2024,
          week: 5,
          fantasyPoints: 12,
          projectedPoints: 11,
          usage: {},
          efficiency: {}
        },
        trend: 'invalid' as any
      };

      expect(NewsAndAnalysisValidator.validatePerformanceMetrics(invalidMetrics)).toBe(false);
    });
  });
});

describe('NewsAndAnalysisTransformer', () => {
  describe('filterRecentNews', () => {
    it('should filter news from last 7 days by default', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const articles: NewsArticle[] = [
        {
          title: 'Recent News',
          source: 'ESPN',
          publishDate: recentDate,
          summary: 'Recent news',
          url: 'https://espn.com/recent',
          sentiment: 'positive'
        },
        {
          title: 'Old News',
          source: 'ESPN',
          publishDate: oldDate,
          summary: 'Old news',
          url: 'https://espn.com/old',
          sentiment: 'neutral'
        }
      ];

      const result = NewsAndAnalysisTransformer.filterRecentNews(articles);

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Recent News');
    });

    it('should filter news with custom days back', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const oldDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

      const articles: NewsArticle[] = [
        {
          title: 'Recent News',
          source: 'ESPN',
          publishDate: recentDate,
          summary: 'Recent news',
          url: 'https://espn.com/recent',
          sentiment: 'positive'
        },
        {
          title: 'Old News',
          source: 'ESPN',
          publishDate: oldDate,
          summary: 'Old news',
          url: 'https://espn.com/old',
          sentiment: 'neutral'
        }
      ];

      const result = NewsAndAnalysisTransformer.filterRecentNews(articles, 3);

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Recent News');
    });
  });

  describe('sortNewsByDate', () => {
    it('should sort news by date descending by default', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-02');

      const articles: NewsArticle[] = [
        {
          title: 'Article 1',
          source: 'ESPN',
          publishDate: date1,
          summary: 'Article 1',
          url: 'https://espn.com/1',
          sentiment: 'positive'
        },
        {
          title: 'Article 2',
          source: 'ESPN',
          publishDate: date2,
          summary: 'Article 2',
          url: 'https://espn.com/2',
          sentiment: 'neutral'
        }
      ];

      const result = NewsAndAnalysisTransformer.sortNewsByDate(articles);

      expect(result[0]?.title).toBe('Article 2');
      expect(result[1]?.title).toBe('Article 1');
    });

    it('should sort news by date ascending when specified', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-02');

      const articles: NewsArticle[] = [
        {
          title: 'Article 1',
          source: 'ESPN',
          publishDate: date2,
          summary: 'Article 1',
          url: 'https://espn.com/1',
          sentiment: 'positive'
        },
        {
          title: 'Article 2',
          source: 'ESPN',
          publishDate: date1,
          summary: 'Article 2',
          url: 'https://espn.com/2',
          sentiment: 'neutral'
        }
      ];

      const result = NewsAndAnalysisTransformer.sortNewsByDate(articles, true);

      expect(result[0]?.title).toBe('Article 2');
      expect(result[1]?.title).toBe('Article 1');
    });
  });

  describe('categorizeNewsBySentiment', () => {
    it('should categorize news by sentiment correctly', () => {
      const articles: NewsArticle[] = [
        {
          title: 'Positive News',
          source: 'ESPN',
          publishDate: new Date(),
          summary: 'Good news',
          url: 'https://espn.com/positive',
          sentiment: 'positive'
        },
        {
          title: 'Negative News',
          source: 'ESPN',
          publishDate: new Date(),
          summary: 'Bad news',
          url: 'https://espn.com/negative',
          sentiment: 'negative'
        },
        {
          title: 'Neutral News',
          source: 'ESPN',
          publishDate: new Date(),
          summary: 'Neutral news',
          url: 'https://espn.com/neutral',
          sentiment: 'neutral'
        }
      ];

      const result = NewsAndAnalysisTransformer.categorizeNewsBySentiment(articles);

      expect(result.positive).toHaveLength(1);
      expect(result.negative).toHaveLength(1);
      expect(result.neutral).toHaveLength(1);
      expect(result.positive[0]?.title).toBe('Positive News');
    });
  });

  describe('calculateSentimentScore', () => {
    it('should calculate correct sentiment score', () => {
      const articles: NewsArticle[] = [
        {
          title: 'Positive News',
          source: 'ESPN',
          publishDate: new Date(),
          summary: 'Good news',
          url: 'https://espn.com/positive',
          sentiment: 'positive'
        },
        {
          title: 'Negative News',
          source: 'ESPN',
          publishDate: new Date(),
          summary: 'Bad news',
          url: 'https://espn.com/negative',
          sentiment: 'negative'
        }
      ];

      const result = NewsAndAnalysisTransformer.calculateSentimentScore(articles);

      expect(result).toBe(0); // (1 + (-1)) / 2 = 0
    });

    it('should return 0 for empty articles array', () => {
      const result = NewsAndAnalysisTransformer.calculateSentimentScore([]);
      expect(result).toBe(0);
    });
  });

  describe('summarizeInjuryImpact', () => {
    it('should summarize healthy status correctly', () => {
      const report: InjuryReport = {
        status: 'healthy',
        impactLevel: 'low'
      };

      const result = NewsAndAnalysisTransformer.summarizeInjuryImpact(report);

      expect(result).toBe('No injury concerns');
    });

    it('should include description when provided', () => {
      const report: InjuryReport = {
        status: 'questionable',
        description: 'Ankle sprain',
        impactLevel: 'medium'
      };

      const result = NewsAndAnalysisTransformer.summarizeInjuryImpact(report);

      expect(result).toBe('Limited practice, game-time decision - Ankle sprain');
    });

    it('should include expected return date when provided', () => {
      const returnDate = new Date('2024-12-01');
      const report: InjuryReport = {
        status: 'out',
        expectedReturn: returnDate,
        impactLevel: 'high'
      };

      const result = NewsAndAnalysisTransformer.summarizeInjuryImpact(report);

      expect(result).toContain('Will not play');
      expect(result).toContain('Expected return:');
      // The exact date format may vary by locale, so just check that it contains the date info
      expect(result).toContain('2024');
    });
  });

  describe('generateAnalysisSummary', () => {
    it('should generate summary for BUY recommendation with FAAB percentage', () => {
      const analysis: PlayerAnalysis = {
        player: {
          playerId: 'player123',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          additionCount: 150,
          additionPercentage: 25.5,
          platforms: ['ESPN']
        },
        recommendation: 'BUY',
        confidence: 85,
        reasoning: ['Strong recent performance', 'Favorable matchup'],
        suggestedFAABPercentage: 15,
        riskFactors: [],
        upside: []
      };

      const result = NewsAndAnalysisTransformer.generateAnalysisSummary(analysis);

      expect(result).toContain('BUY recommendation with 85% confidence');
      expect(result).toContain('Suggested FAAB: 15%');
      expect(result).toContain('Key reason: Strong recent performance');
    });

    it('should generate summary for PASS recommendation', () => {
      const analysis: PlayerAnalysis = {
        player: {
          playerId: 'player123',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          additionCount: 150,
          additionPercentage: 25.5,
          platforms: ['ESPN']
        },
        recommendation: 'PASS',
        confidence: 70,
        reasoning: ['Injury concerns'],
        riskFactors: [],
        upside: []
      };

      const result = NewsAndAnalysisTransformer.generateAnalysisSummary(analysis);

      expect(result).toContain('PASS recommendation with 70% confidence');
      expect(result).not.toContain('Suggested FAAB');
      expect(result).toContain('Key reason: Injury concerns');
    });
  });

  describe('rankAnalysesByConfidence', () => {
    it('should rank analyses by confidence descending', () => {
      const analyses: PlayerAnalysis[] = [
        {
          player: {
            playerId: 'player1',
            name: 'Player 1',
            position: 'RB',
            team: 'NYG',
            additionCount: 150,
            additionPercentage: 25.5,
            platforms: ['ESPN']
          },
          recommendation: 'BUY',
          confidence: 70,
          reasoning: ['Reason 1'],
          riskFactors: [],
          upside: []
        },
        {
          player: {
            playerId: 'player2',
            name: 'Player 2',
            position: 'WR',
            team: 'DAL',
            additionCount: 100,
            additionPercentage: 20,
            platforms: ['Yahoo']
          },
          recommendation: 'BUY',
          confidence: 90,
          reasoning: ['Reason 2'],
          riskFactors: [],
          upside: []
        }
      ];

      const result = NewsAndAnalysisTransformer.rankAnalysesByConfidence(analyses);

      expect(result[0]?.confidence).toBe(90);
      expect(result[1]?.confidence).toBe(70);
    });
  });

  describe('filterAnalysesByRecommendation', () => {
    it('should filter analyses by recommendation type', () => {
      const analyses: PlayerAnalysis[] = [
        {
          player: {
            playerId: 'player1',
            name: 'Player 1',
            position: 'RB',
            team: 'NYG',
            additionCount: 150,
            additionPercentage: 25.5,
            platforms: ['ESPN']
          },
          recommendation: 'BUY',
          confidence: 85,
          reasoning: ['Reason 1'],
          riskFactors: [],
          upside: []
        },
        {
          player: {
            playerId: 'player2',
            name: 'Player 2',
            position: 'WR',
            team: 'DAL',
            additionCount: 100,
            additionPercentage: 20,
            platforms: ['Yahoo']
          },
          recommendation: 'PASS',
          confidence: 60,
          reasoning: ['Reason 2'],
          riskFactors: [],
          upside: []
        }
      ];

      const buyResult = NewsAndAnalysisTransformer.filterAnalysesByRecommendation(analyses, 'BUY');
      const passResult = NewsAndAnalysisTransformer.filterAnalysesByRecommendation(analyses, 'PASS');

      expect(buyResult).toHaveLength(1);
      expect(passResult).toHaveLength(1);
      expect(buyResult[0]?.recommendation).toBe('BUY');
      expect(passResult[0]?.recommendation).toBe('PASS');
    });
  });

  describe('calculateAverageConfidence', () => {
    it('should calculate average confidence correctly', () => {
      const analyses: PlayerAnalysis[] = [
        {
          player: {
            playerId: 'player1',
            name: 'Player 1',
            position: 'RB',
            team: 'NYG',
            additionCount: 150,
            additionPercentage: 25.5,
            platforms: ['ESPN']
          },
          recommendation: 'BUY',
          confidence: 80,
          reasoning: ['Reason 1'],
          riskFactors: [],
          upside: []
        },
        {
          player: {
            playerId: 'player2',
            name: 'Player 2',
            position: 'WR',
            team: 'DAL',
            additionCount: 100,
            additionPercentage: 20,
            platforms: ['Yahoo']
          },
          recommendation: 'BUY',
          confidence: 90,
          reasoning: ['Reason 2'],
          riskFactors: [],
          upside: []
        }
      ];

      const result = NewsAndAnalysisTransformer.calculateAverageConfidence(analyses);

      expect(result).toBe(85); // (80 + 90) / 2 = 85
    });

    it('should return 0 for empty analyses array', () => {
      const result = NewsAndAnalysisTransformer.calculateAverageConfidence([]);
      expect(result).toBe(0);
    });
  });

  describe('Edge cases and additional validation tests', () => {
    describe('PlayerValidator edge cases', () => {
      it('should handle boundary jersey numbers', () => {
        const validPlayer: Player = {
          id: 'player123',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          jerseyNumber: 0
        };
        expect(PlayerValidator.validatePlayer(validPlayer)).toBe(true);

        const invalidPlayer: Player = {
          id: 'player123',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          jerseyNumber: -1
        };
        expect(PlayerValidator.validatePlayer(invalidPlayer)).toBe(false);
      });

      it('should handle boundary addition percentages', () => {
        const validSummary: PlayerSummary = {
          playerId: 'player123',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          additionCount: 150,
          additionPercentage: 0,
          platforms: ['ESPN']
        };
        expect(PlayerValidator.validatePlayerSummary(validSummary)).toBe(true);

        const validSummary100: PlayerSummary = {
          playerId: 'player123',
          name: 'John Doe',
          position: 'RB',
          team: 'NYG',
          additionCount: 150,
          additionPercentage: 100,
          platforms: ['ESPN']
        };
        expect(PlayerValidator.validatePlayerSummary(validSummary100)).toBe(true);
      });

      it('should handle boundary season and week values', () => {
        const validStats2020: PlayerStats = {
          season: 2020,
          week: 1,
          fantasyPoints: 15.6,
          projectedPoints: 12.8,
          usage: {},
          efficiency: {}
        };
        expect(PlayerValidator.validatePlayerStats(validStats2020)).toBe(true);

        const validStats2030: PlayerStats = {
          season: 2030,
          week: 18,
          fantasyPoints: 15.6,
          projectedPoints: 12.8,
          usage: {},
          efficiency: {}
        };
        expect(PlayerValidator.validatePlayerStats(validStats2030)).toBe(true);

        const invalidStats: PlayerStats = {
          season: 2019,
          week: 1,
          fantasyPoints: 15.6,
          projectedPoints: 12.8,
          usage: {},
          efficiency: {}
        };
        expect(PlayerValidator.validatePlayerStats(invalidStats)).toBe(false);
      });
    });

    describe('PlayerDataTransformer edge cases', () => {
      it('should handle duplicate platforms in playerAdditionDataToSummary', () => {
        const additionData: PlayerAdditionData[] = [
          {
            playerId: 'player1',
            name: 'John Doe',
            position: 'RB',
            team: 'NYG',
            additionCount: 50,
            platform: 'ESPN',
            timestamp: new Date()
          },
          {
            playerId: 'player1',
            name: 'John Doe',
            position: 'RB',
            team: 'NYG',
            additionCount: 30,
            platform: 'ESPN', // Duplicate platform
            timestamp: new Date()
          }
        ];

        const result = PlayerDataTransformer.playerAdditionDataToSummary(additionData);
        expect(result[0]?.platforms).toEqual(['ESPN', 'ESPN']); // Should include duplicates
      });

      it('should handle zero total leagues in calculateAdditionPercentages', () => {
        const summaries: PlayerSummary[] = [
          {
            playerId: 'player1',
            name: 'John Doe',
            position: 'RB',
            team: 'NYG',
            additionCount: 50,
            additionPercentage: 0,
            platforms: ['ESPN']
          }
        ];

        const result = PlayerDataTransformer.calculateAdditionPercentages(summaries, 0);
        expect(result[0]?.additionPercentage).toBe(Infinity);
      });

      it('should handle empty array in sortByAdditionCount', () => {
        const result = PlayerDataTransformer.sortByAdditionCount([]);
        expect(result).toEqual([]);
      });

      it('should handle n greater than array length in filterTopN', () => {
        const summaries: PlayerSummary[] = [
          {
            playerId: 'player1',
            name: 'Player 1',
            position: 'RB',
            team: 'NYG',
            additionCount: 30,
            additionPercentage: 15,
            platforms: ['ESPN']
          }
        ];

        const result = PlayerDataTransformer.filterTopN(summaries, 10);
        expect(result).toHaveLength(1);
      });

      it('should handle edge cases in normalizePlayerName', () => {
        expect(PlayerDataTransformer.normalizePlayerName('')).toBe('');
        expect(PlayerDataTransformer.normalizePlayerName('   ')).toBe('');
        expect(PlayerDataTransformer.normalizePlayerName('A')).toBe('a');
        expect(PlayerDataTransformer.normalizePlayerName('D\'Angelo')).toBe('dangelo');
      });

      it('should handle unknown team names in normalizeTeamName', () => {
        expect(PlayerDataTransformer.normalizeTeamName('Unknown Team')).toBe('UNKNOWN TEAM');
        expect(PlayerDataTransformer.normalizeTeamName('')).toBe('');
      });

      it('should handle stats with missing efficiency data in mergePlayerStats', () => {
        const stats: PlayerStats[] = [
          {
            season: 2024,
            week: 1,
            fantasyPoints: 10,
            projectedPoints: 12,
            usage: {},
            efficiency: {} // No efficiency data
          },
          {
            season: 2024,
            week: 2,
            fantasyPoints: 20,
            projectedPoints: 15,
            usage: {},
            efficiency: { yardsPerTarget: 10 } // Partial efficiency data
          }
        ];

        const result = PlayerDataTransformer.mergePlayerStats(stats);
        expect(result.efficiency.yardsPerTarget).toBe(10);
        expect(result.efficiency.yardsPerCarry).toBeUndefined();
      });
    });

    describe('NewsAndAnalysisValidator edge cases', () => {
      it('should handle future dates in validateNewsArticle', () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const validArticle: NewsArticle = {
          title: 'Future News',
          source: 'ESPN',
          publishDate: futureDate,
          summary: 'Future news article',
          url: 'https://espn.com/future',
          sentiment: 'positive'
        };

        expect(NewsAndAnalysisValidator.validateNewsArticle(validArticle)).toBe(true);
      });

      it('should handle edge cases in validatePlayerAnalysis', () => {
        const analysisWithZeroConfidence: PlayerAnalysis = {
          player: {
            playerId: 'player123',
            name: 'John Doe',
            position: 'RB',
            team: 'NYG',
            additionCount: 150,
            additionPercentage: 25.5,
            platforms: ['ESPN']
          },
          recommendation: 'PASS',
          confidence: 0,
          reasoning: ['No confidence'],
          riskFactors: [],
          upside: []
        };

        expect(NewsAndAnalysisValidator.validatePlayerAnalysis(analysisWithZeroConfidence)).toBe(true);

        const analysisWithMaxConfidence: PlayerAnalysis = {
          player: {
            playerId: 'player123',
            name: 'John Doe',
            position: 'RB',
            team: 'NYG',
            additionCount: 150,
            additionPercentage: 25.5,
            platforms: ['ESPN']
          },
          recommendation: 'BUY',
          confidence: 100,
          reasoning: ['Maximum confidence'],
          riskFactors: [],
          upside: []
        };

        expect(NewsAndAnalysisValidator.validatePlayerAnalysis(analysisWithMaxConfidence)).toBe(true);
      });
    });

    describe('NewsAndAnalysisTransformer edge cases', () => {
      it('should handle edge cases in filterRecentNews', () => {
        const now = new Date();
        const exactCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const articles: NewsArticle[] = [
          {
            title: 'Exact Cutoff News',
            source: 'ESPN',
            publishDate: exactCutoff,
            summary: 'News at exact cutoff',
            url: 'https://espn.com/exact',
            sentiment: 'positive'
          }
        ];

        const result = NewsAndAnalysisTransformer.filterRecentNews(articles, 7);
        expect(result).toHaveLength(1); // Should include articles at exact cutoff
      });

      it('should handle identical dates in sortNewsByDate', () => {
        const sameDate = new Date('2024-01-01');

        const articles: NewsArticle[] = [
          {
            title: 'Article A',
            source: 'ESPN',
            publishDate: sameDate,
            summary: 'Article A',
            url: 'https://espn.com/a',
            sentiment: 'positive'
          },
          {
            title: 'Article B',
            source: 'ESPN',
            publishDate: sameDate,
            summary: 'Article B',
            url: 'https://espn.com/b',
            sentiment: 'neutral'
          }
        ];

        const result = NewsAndAnalysisTransformer.sortNewsByDate(articles);
        expect(result).toHaveLength(2); // Should maintain order for identical dates
      });

      it('should handle empty arrays in all transformer methods', () => {
        expect(NewsAndAnalysisTransformer.filterRecentNews([])).toEqual([]);
        expect(NewsAndAnalysisTransformer.sortNewsByDate([])).toEqual([]);
        expect(NewsAndAnalysisTransformer.rankAnalysesByConfidence([])).toEqual([]);
        expect(NewsAndAnalysisTransformer.filterAnalysesByRecommendation([], 'BUY')).toEqual([]);
      });

      it('should handle injury reports with all optional fields', () => {
        const completeReport: InjuryReport = {
          status: 'questionable',
          description: 'Ankle sprain',
          expectedReturn: new Date('2024-12-01'),
          impactLevel: 'medium'
        };

        const result = NewsAndAnalysisTransformer.summarizeInjuryImpact(completeReport);
        expect(result).toContain('Limited practice, game-time decision');
        expect(result).toContain('Ankle sprain');
        expect(result).toContain('Expected return:');
      });
    });
  });
});