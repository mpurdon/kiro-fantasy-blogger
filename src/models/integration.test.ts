import { describe, it, expect } from 'vitest';
import {
  Player,
  PlayerSummary,
  PlayerStats,
  PlayerAdditionData,
  NewsArticle,
  InjuryReport,
  PlayerAnalysis,
  PlayerValidator,
  PlayerDataTransformer,
  NewsAndAnalysisValidator,
  NewsAndAnalysisTransformer
} from './player';
import {
  BlogPost,
  BlogMetadata,
  PublicationResult,
  DataQualityIssue,
  BlogValidator,
  BlogTransformer
} from './blog';
import {
  SystemConfig,
  PlatformConfig,
  AgentConfig,
  ExecutionResult,
  ConfigValidator,
  ConfigLoader,
  ConfigUtils
} from './config';

describe('Data Model Integration Tests', () => {
  describe('End-to-end player data processing', () => {
    it('should process player addition data through complete pipeline', () => {
      // Start with raw addition data
      const rawAdditionData: PlayerAdditionData[] = [
        {
          playerId: 'player1',
          name: 'John Doe',
          position: 'RB',
          team: 'New York Giants',
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
        },
        {
          playerId: 'player2',
          name: 'Jane Smith',
          position: 'WR',
          team: 'Dallas Cowboys',
          additionCount: 40,
          platform: 'ESPN',
          timestamp: new Date()
        }
      ];

      // Transform to summaries
      let summaries = PlayerDataTransformer.playerAdditionDataToSummary(rawAdditionData);
      expect(summaries).toHaveLength(2);

      // Calculate percentages
      summaries = PlayerDataTransformer.calculateAdditionPercentages(summaries, 200);
      expect(summaries[0]?.additionPercentage).toBe(40); // 80/200 * 100

      // Sort and filter
      summaries = PlayerDataTransformer.sortByAdditionCount(summaries);
      expect(summaries[0]?.playerId).toBe('player1'); // Higher addition count

      const topPlayers = PlayerDataTransformer.filterTopN(summaries, 1);
      expect(topPlayers).toHaveLength(1);

      // Validate final result
      expect(PlayerValidator.validatePlayerSummary(topPlayers[0]!)).toBe(true);
    });

    it('should process news articles through analysis pipeline', () => {
      const articles: NewsArticle[] = [
        {
          title: 'Player Injury Update',
          source: 'ESPN',
          publishDate: new Date(),
          summary: 'Player suffered minor injury',
          url: 'https://espn.com/injury',
          sentiment: 'negative'
        },
        {
          title: 'Great Performance',
          source: 'NFL.com',
          publishDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          summary: 'Player had excellent game',
          url: 'https://nfl.com/performance',
          sentiment: 'positive'
        },
        {
          title: 'Old News',
          source: 'ESPN',
          publishDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          summary: 'Old news article',
          url: 'https://espn.com/old',
          sentiment: 'neutral'
        }
      ];

      // Validate all articles
      expect(articles.every(article => NewsAndAnalysisValidator.validateNewsArticle(article))).toBe(true);

      // Filter recent news
      const recentNews = NewsAndAnalysisTransformer.filterRecentNews(articles, 7);
      expect(recentNews).toHaveLength(2); // Should exclude 10-day-old news

      // Sort by date
      const sortedNews = NewsAndAnalysisTransformer.sortNewsByDate(recentNews);
      expect(sortedNews[0]?.title).toBe('Player Injury Update'); // Most recent first

      // Categorize by sentiment
      const categorized = NewsAndAnalysisTransformer.categorizeNewsBySentiment(recentNews);
      expect(categorized.positive).toHaveLength(1);
      expect(categorized.negative).toHaveLength(1);

      // Calculate sentiment score
      const sentimentScore = NewsAndAnalysisTransformer.calculateSentimentScore(recentNews);
      expect(sentimentScore).toBe(0); // (1 + (-1)) / 2 = 0
    });
  });

  describe('Blog post creation and validation pipeline', () => {
    it('should create and validate complete blog post', () => {
      // Create raw blog post data
      const rawTitle = '  Week 5 FAAB Targets: Top 10 Players to Add!!!  ';
      const rawSummary = 'This is a comprehensive analysis of the top fantasy football players to target in Week 5 FAAB bidding. We analyze each player\'s recent performance, injury status, and upcoming matchups to provide actionable recommendations.';
      const rawContent = '<h1>Week 5 FAAB Targets</h1><p>Here are this week\'s top targets with detailed analysis...</p><ul><li>Player 1: BUY recommendation</li><li>Player 2: PASS recommendation</li></ul>';
      const rawTags = ['  Fantasy Football  ', 'FAAB', 'fantasy football', 'NFL', 'Week 5', ''];
      const rawCategories = ['Fantasy Football', 'Analysis', 'Fantasy Football', '   '];

      // Transform and clean data
      const cleanTitle = BlogTransformer.sanitizeTitle(rawTitle);
      const cleanSummary = BlogTransformer.truncateSummary(rawSummary);
      const cleanTags = BlogTransformer.cleanTags(rawTags);
      const cleanCategories = BlogTransformer.cleanCategories(rawCategories);
      const seoTitle = BlogTransformer.optimizeSEOTitle(cleanTitle);
      const seoDescription = BlogTransformer.optimizeSEODescription(cleanSummary);

      // Create metadata
      const metadata: BlogMetadata = {
        tags: cleanTags,
        categories: cleanCategories,
        author: 'AI Fantasy Analyst',
        seoTitle,
        seoDescription,
        featuredImage: 'https://example.com/featured.jpg'
      };

      // Create blog post
      const blogPost: BlogPost = {
        title: cleanTitle,
        summary: cleanSummary,
        content: rawContent,
        metadata,
        publishDate: new Date()
      };

      // Validate complete blog post
      expect(BlogValidator.validateBlogPost(blogPost)).toBe(true);
      expect(BlogValidator.validateBlogMetadata(metadata)).toBe(true);

      // Test additional transformations
      const slug = BlogTransformer.generateSlug(cleanTitle);
      expect(slug).toBe('week-5-faab-targets-top-10-players-to-add');

      const readingTime = BlogTransformer.estimateReadingTime(rawContent);
      expect(readingTime).toBeGreaterThan(0);

      const plainText = BlogTransformer.stripHtmlTags(rawContent);
      expect(plainText).not.toContain('<');
    });

    it('should handle data quality issues throughout pipeline', () => {
      const issues: DataQualityIssue[] = [
        BlogTransformer.createDataQualityIssue(
          'missing_data',
          'Player statistics unavailable',
          'high',
          'John Doe'
        ),
        BlogTransformer.createDataQualityIssue(
          'api_error',
          'ESPN API rate limit exceeded',
          'medium'
        ),
        BlogTransformer.createDataQualityIssue(
          'stale_data',
          'Injury report is 2 days old',
          'low'
        )
      ];

      // Validate all issues
      expect(issues.every(issue => BlogValidator.validateDataQualityIssue(issue))).toBe(true);

      // Categorize issues
      const categorized = BlogTransformer.categorizeDataQualityIssues(issues);
      expect(categorized.high).toHaveLength(1);
      expect(categorized.medium).toHaveLength(1);
      expect(categorized.low).toHaveLength(1);

      // Summarize issues
      const summary = BlogTransformer.summarizeDataQualityIssues(issues);
      expect(summary).toContain('Found 3 data quality issues');
      expect(summary).toContain('1 high severity issue');
    });
  });

  describe('Configuration validation and management pipeline', () => {
    it('should validate complete system configuration', () => {
      // Create a complete system configuration
      const config: SystemConfig = {
        schedule: {
          dayOfWeek: 2,
          hour: 9,
          timezone: 'America/New_York'
        },
        apis: {
          fantasyPlatforms: [
            {
              name: 'ESPN',
              apiKey: 'test-espn-key',
              baseUrl: 'https://fantasy.espn.com/apis/v3',
              rateLimit: {
                requestsPerMinute: 60,
                requestsPerHour: 1000
              },
              enabled: true
            },
            {
              name: 'Yahoo',
              apiKey: 'test-yahoo-key',
              baseUrl: 'https://fantasysports.yahooapis.com',
              rateLimit: {
                requestsPerMinute: 60,
                requestsPerHour: 1000
              },
              enabled: false // Disabled platform
            }
          ],
          newsServices: [
            {
              name: 'ESPN News',
              apiKey: 'test-news-key',
              baseUrl: 'https://site.api.espn.com/apis/site/v2',
              rateLimit: {
                requestsPerMinute: 60,
                requestsPerHour: 1000
              },
              enabled: true
            }
          ],
          sportsData: {
            name: 'Sports Data API',
            apiKey: 'test-sports-key',
            baseUrl: 'https://api.sportsdata.io/v3/nfl',
            rateLimit: {
              requestsPerMinute: 60,
              requestsPerHour: 1000
            },
            enabled: true
          }
        },
        blog: {
          name: 'WordPress',
          apiKey: 'test-blog-key',
          baseUrl: 'https://myblog.com',
          username: 'blogger',
          blogId: 'blog123',
          defaultTags: ['fantasy football', 'FAAB'],
          defaultCategories: ['Fantasy Football', 'Analysis']
        },
        agents: [
          {
            name: 'DataCollectionAgent',
            enabled: true,
            timeout: 300000,
            retryAttempts: 3,
            retryDelay: 5000
          },
          {
            name: 'AnalysisAgent',
            enabled: false,
            timeout: 180000,
            retryAttempts: 2,
            retryDelay: 3000
          }
        ]
      };

      // Validate complete configuration
      expect(ConfigValidator.validateSystemConfig(config)).toBe(true);

      // Test utility functions
      const enabledPlatforms = ConfigUtils.getEnabledPlatforms(config);
      expect(enabledPlatforms).toHaveLength(1);
      expect(enabledPlatforms[0]?.name).toBe('ESPN');

      const enabledAgents = ConfigUtils.getEnabledAgents(config);
      expect(enabledAgents).toHaveLength(1);
      expect(enabledAgents[0]?.name).toBe('DataCollectionAgent');

      const totalTimeout = ConfigUtils.getTotalTimeout(config);
      expect(totalTimeout).toBe(300000); // Only enabled agent timeout

      // Test agent config updates
      const updatedConfig = ConfigUtils.updateAgentConfig(config, 'DataCollectionAgent', {
        timeout: 600000,
        retryAttempts: 5
      });

      const updatedAgent = ConfigUtils.getAgentConfig(updatedConfig, 'DataCollectionAgent');
      expect(updatedAgent?.timeout).toBe(600000);
      expect(updatedAgent?.retryAttempts).toBe(5);
      expect(updatedAgent?.name).toBe('DataCollectionAgent'); // Preserved
    });

    it('should create and validate execution results', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:30:00Z');
      const agentsExecuted = ['DataCollectionAgent', 'AnalysisAgent', 'WriterAgent'];
      const errors = [new Error('Test error 1'), new Error('Test error 2')];
      const warnings = ['Warning 1', 'Warning 2'];

      // Create execution result
      const result = ConfigUtils.createExecutionResult(
        true,
        startTime,
        endTime,
        agentsExecuted,
        errors,
        warnings,
        'published-post-123'
      );

      // Validate result
      expect(ConfigValidator.validateExecutionResult(result)).toBe(true);
      expect(result.duration).toBe(30 * 60 * 1000); // 30 minutes
      expect(result.agentsExecuted).toEqual(agentsExecuted);
      expect(result.errors).toEqual(errors);
      expect(result.warnings).toEqual(warnings);
      expect(result.publishedPostId).toBe('published-post-123');

      // Create execution status
      const status = ConfigUtils.createExecutionStatus(
        true,
        'DataCollectionAgent',
        75,
        startTime,
        endTime
      );

      expect(status.isRunning).toBe(true);
      expect(status.currentAgent).toBe('DataCollectionAgent');
      expect(status.progress).toBe(75);
      expect(status.startTime).toBe(startTime);
      expect(status.estimatedCompletion).toBe(endTime);
    });
  });

  describe('Cross-model validation scenarios', () => {
    it('should validate player analysis with complete data chain', () => {
      // Create a complete player analysis with all related data
      const playerSummary: PlayerSummary = {
        playerId: 'player123',
        name: 'John Doe',
        position: 'RB',
        team: 'NYG',
        additionCount: 150,
        additionPercentage: 25.5,
        platforms: ['ESPN', 'Yahoo']
      };

      const playerStats: PlayerStats = {
        season: 2024,
        week: 5,
        fantasyPoints: 15.6,
        projectedPoints: 12.8,
        usage: {
          snapCount: 45,
          targets: 8,
          carries: 12,
          redZoneTargets: 3
        },
        efficiency: {
          yardsPerTarget: 8.5,
          yardsPerCarry: 4.2,
          touchdownRate: 0.15
        }
      };

      const injuryReport: InjuryReport = {
        status: 'questionable',
        description: 'Ankle sprain',
        expectedReturn: new Date('2024-12-01'),
        impactLevel: 'medium'
      };

      const analysis: PlayerAnalysis = {
        player: playerSummary,
        recommendation: 'BUY',
        confidence: 85,
        reasoning: [
          'Strong recent performance with 15.6 fantasy points',
          'High target share with 8 targets per game',
          'Favorable upcoming matchup'
        ],
        suggestedFAABPercentage: 15,
        riskFactors: ['Ankle injury concern', 'Heavy workload'],
        upside: ['Goal line touches', 'Pass-catching ability']
      };

      // Validate all components
      expect(PlayerValidator.validatePlayerSummary(playerSummary)).toBe(true);
      expect(PlayerValidator.validatePlayerStats(playerStats)).toBe(true);
      expect(NewsAndAnalysisValidator.validateInjuryReport(injuryReport)).toBe(true);
      expect(NewsAndAnalysisValidator.validatePlayerAnalysis(analysis)).toBe(true);

      // Test transformations
      const analysisSummary = NewsAndAnalysisTransformer.generateAnalysisSummary(analysis);
      expect(analysisSummary).toContain('BUY recommendation with 85% confidence');
      expect(analysisSummary).toContain('Suggested FAAB: 15%');

      const injurySummary = NewsAndAnalysisTransformer.summarizeInjuryImpact(injuryReport);
      expect(injurySummary).toContain('Limited practice, game-time decision');
      expect(injurySummary).toContain('Ankle sprain');
    });

    it('should handle error scenarios across all models', () => {
      // Test various error conditions that could occur in real usage

      // Invalid player data
      const invalidPlayer: Player = {
        id: '',
        name: 'John Doe',
        position: 'INVALID' as any,
        team: 'NYG'
      };
      expect(PlayerValidator.validatePlayer(invalidPlayer)).toBe(false);

      // Invalid blog post
      const invalidBlogPost: BlogPost = {
        title: '',
        summary: 'Valid summary',
        content: 'Valid content',
        metadata: {
          tags: [''],
          categories: ['Valid'],
          author: ''
        },
        publishDate: new Date('invalid')
      };
      expect(BlogValidator.validateBlogPost(invalidBlogPost)).toBe(false);

      // Invalid system config
      const invalidConfig: SystemConfig = {
        schedule: {
          dayOfWeek: 8, // Invalid
          hour: 25, // Invalid
          timezone: ''
        },
        apis: {
          fantasyPlatforms: [],
          newsServices: [],
          sportsData: {
            name: '',
            apiKey: '',
            baseUrl: 'invalid-url',
            rateLimit: { requestsPerMinute: 0, requestsPerHour: 0 },
            enabled: true
          }
        },
        blog: {
          name: '',
          apiKey: '',
          baseUrl: 'invalid-url',
          defaultTags: [''],
          defaultCategories: ['']
        },
        agents: [] // Empty agents array
      };
      expect(ConfigValidator.validateSystemConfig(invalidConfig)).toBe(false);
    });
  });
});