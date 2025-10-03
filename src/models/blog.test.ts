import { describe, it, expect } from 'vitest';
import {
  BlogPost,
  BlogMetadata,
  PublicationResult,
  DataQualityIssue,
  BlogValidator,
  BlogTransformer
} from './blog';

describe('Blog Models', () => {
  describe('BlogPost interface', () => {
    it('should accept valid blog post data', () => {
      const validBlogPost: BlogPost = {
        title: 'Week 5 FAAB Targets: Top 10 Waiver Wire Adds',
        summary: 'Analysis of the most added players this week with buy/pass recommendations',
        content: '<h1>Week 5 FAAB Targets</h1><p>Here are this week\'s top targets...</p>',
        metadata: {
          tags: ['fantasy football', 'FAAB', 'waiver wire'],
          categories: ['Fantasy Football', 'Analysis'],
          author: 'Fantasy Bot',
          seoTitle: 'Week 5 FAAB Targets - Fantasy Football Waiver Wire Analysis',
          seoDescription: 'Expert analysis of Week 5 fantasy football FAAB targets',
          featuredImage: 'https://example.com/featured-image.jpg'
        },
        publishDate: new Date('2024-10-01T09:00:00Z')
      };

      // Type checking - if this compiles, the interface is working correctly
      expect(validBlogPost.title).toBe('Week 5 FAAB Targets: Top 10 Waiver Wire Adds');
      expect(validBlogPost.metadata.tags).toContain('fantasy football');
      expect(validBlogPost.publishDate).toBeInstanceOf(Date);
    });

    it('should accept blog post with minimal metadata', () => {
      const minimalBlogPost: BlogPost = {
        title: 'Simple Blog Post',
        summary: 'A simple blog post summary',
        content: 'Simple content',
        metadata: {
          tags: ['test'],
          categories: ['General'],
          author: 'Test Author'
        },
        publishDate: new Date()
      };

      expect(minimalBlogPost.metadata.seoTitle).toBeUndefined();
      expect(minimalBlogPost.metadata.seoDescription).toBeUndefined();
      expect(minimalBlogPost.metadata.featuredImage).toBeUndefined();
    });
  });

  describe('BlogMetadata interface', () => {
    it('should accept complete metadata', () => {
      const completeMetadata: BlogMetadata = {
        tags: ['fantasy football', 'FAAB', 'NFL', 'waiver wire'],
        categories: ['Fantasy Football', 'Sports Analysis'],
        author: 'Fantasy Football Bot',
        seoTitle: 'Complete SEO Title for Search Engines',
        seoDescription: 'Complete SEO description that helps with search engine optimization',
        featuredImage: 'https://cdn.example.com/images/featured-fantasy-football.jpg'
      };

      expect(completeMetadata.tags).toHaveLength(4);
      expect(completeMetadata.categories).toContain('Fantasy Football');
      expect(completeMetadata.seoTitle).toBeDefined();
    });

    it('should accept minimal metadata', () => {
      const minimalMetadata: BlogMetadata = {
        tags: [],
        categories: [],
        author: 'Anonymous'
      };

      expect(minimalMetadata.tags).toHaveLength(0);
      expect(minimalMetadata.seoTitle).toBeUndefined();
    });

    it('should handle empty arrays for tags and categories', () => {
      const emptyArraysMetadata: BlogMetadata = {
        tags: [],
        categories: [],
        author: 'Test Author'
      };

      expect(Array.isArray(emptyArraysMetadata.tags)).toBe(true);
      expect(Array.isArray(emptyArraysMetadata.categories)).toBe(true);
      expect(emptyArraysMetadata.tags).toHaveLength(0);
      expect(emptyArraysMetadata.categories).toHaveLength(0);
    });
  });

  describe('PublicationResult interface', () => {
    it('should accept successful publication result', () => {
      const successResult: PublicationResult = {
        success: true,
        postId: 'wp_post_12345',
        url: 'https://myblog.com/2024/10/week-5-faab-targets',
        publishedAt: new Date('2024-10-01T09:00:00Z')
      };

      expect(successResult.success).toBe(true);
      expect(successResult.postId).toBe('wp_post_12345');
      expect(successResult.url).toContain('week-5-faab-targets');
      expect(successResult.error).toBeUndefined();
    });

    it('should accept failed publication result', () => {
      const failureResult: PublicationResult = {
        success: false,
        error: 'Authentication failed: Invalid API key'
      };

      expect(failureResult.success).toBe(false);
      expect(failureResult.error).toBe('Authentication failed: Invalid API key');
      expect(failureResult.postId).toBeUndefined();
      expect(failureResult.url).toBeUndefined();
      expect(failureResult.publishedAt).toBeUndefined();
    });

    it('should accept partial success result', () => {
      const partialResult: PublicationResult = {
        success: true,
        postId: 'draft_67890',
        error: 'Published as draft due to content review requirements'
      };

      expect(partialResult.success).toBe(true);
      expect(partialResult.postId).toBeDefined();
      expect(partialResult.error).toContain('draft');
    });
  });

  describe('DataQualityIssue interface', () => {
    it('should accept missing data issue', () => {
      const missingDataIssue: DataQualityIssue = {
        type: 'missing_data',
        description: 'Player statistics not available for John Doe',
        severity: 'medium',
        affectedPlayer: 'John Doe'
      };

      expect(missingDataIssue.type).toBe('missing_data');
      expect(missingDataIssue.severity).toBe('medium');
      expect(missingDataIssue.affectedPlayer).toBe('John Doe');
    });

    it('should accept invalid format issue', () => {
      const invalidFormatIssue: DataQualityIssue = {
        type: 'invalid_format',
        description: 'API returned malformed JSON response',
        severity: 'high'
      };

      expect(invalidFormatIssue.type).toBe('invalid_format');
      expect(invalidFormatIssue.severity).toBe('high');
      expect(invalidFormatIssue.affectedPlayer).toBeUndefined();
    });

    it('should accept stale data issue', () => {
      const staleDataIssue: DataQualityIssue = {
        type: 'stale_data',
        description: 'Player data is more than 24 hours old',
        severity: 'low',
        affectedPlayer: 'Jane Smith'
      };

      expect(staleDataIssue.type).toBe('stale_data');
      expect(staleDataIssue.severity).toBe('low');
    });

    it('should accept API error issue', () => {
      const apiErrorIssue: DataQualityIssue = {
        type: 'api_error',
        description: 'ESPN API returned 500 Internal Server Error',
        severity: 'high'
      };

      expect(apiErrorIssue.type).toBe('api_error');
      expect(apiErrorIssue.severity).toBe('high');
    });

    it('should handle all severity levels', () => {
      const lowSeverity: DataQualityIssue = {
        type: 'stale_data',
        description: 'Minor data staleness',
        severity: 'low'
      };

      const mediumSeverity: DataQualityIssue = {
        type: 'missing_data',
        description: 'Some player data missing',
        severity: 'medium'
      };

      const highSeverity: DataQualityIssue = {
        type: 'api_error',
        description: 'Critical API failure',
        severity: 'high'
      };

      expect(lowSeverity.severity).toBe('low');
      expect(mediumSeverity.severity).toBe('medium');
      expect(highSeverity.severity).toBe('high');
    });

    it('should handle all issue types', () => {
      const issueTypes: DataQualityIssue['type'][] = [
        'missing_data',
        'invalid_format',
        'stale_data',
        'api_error'
      ];

      issueTypes.forEach(type => {
        const issue: DataQualityIssue = {
          type,
          description: `Test issue of type ${type}`,
          severity: 'medium'
        };

        expect(issue.type).toBe(type);
      });
    });
  });

  describe('Complex blog post scenarios', () => {
    it('should handle blog post with extensive content', () => {
      const extensiveBlogPost: BlogPost = {
        title: 'Comprehensive Week 5 FAAB Analysis: 15 Players to Target or Avoid',
        summary: 'In-depth analysis of Week 5 waiver wire targets including statistical breakdowns, injury reports, and matchup analysis for all top additions across ESPN, Yahoo, and Sleeper platforms.',
        content: `
          <article>
            <h1>Week 5 FAAB Targets: Complete Analysis</h1>
            <section id="introduction">
              <p>This week's waiver wire presents several intriguing options...</p>
            </section>
            <section id="buy-recommendations">
              <h2>BUY Recommendations</h2>
              <div class="player-analysis">
                <h3>Player 1: Running Back Analysis</h3>
                <p>Statistical breakdown and reasoning...</p>
              </div>
            </section>
            <section id="pass-recommendations">
              <h2>PASS Recommendations</h2>
              <p>Players to avoid this week...</p>
            </section>
            <section id="conclusion">
              <p>Summary and final thoughts...</p>
            </section>
          </article>
        `,
        metadata: {
          tags: [
            'fantasy football',
            'FAAB',
            'waiver wire',
            'NFL',
            'week 5',
            'running backs',
            'wide receivers',
            'tight ends',
            'quarterbacks',
            'analysis'
          ],
          categories: [
            'Fantasy Football',
            'Weekly Analysis',
            'FAAB Strategy',
            'Waiver Wire'
          ],
          author: 'AI Fantasy Football Analyst',
          seoTitle: 'Week 5 FAAB Targets 2024 - Complete Waiver Wire Analysis & Recommendations',
          seoDescription: 'Expert AI analysis of Week 5 fantasy football FAAB targets. Get buy/pass recommendations for all top waiver wire adds with statistical breakdowns and injury updates.',
          featuredImage: 'https://cdn.fantasyfootball.com/images/week5-faab-analysis-2024.jpg'
        },
        publishDate: new Date('2024-10-01T06:00:00Z')
      };

      expect(extensiveBlogPost.title.length).toBeGreaterThan(50);
      expect(extensiveBlogPost.content.includes('<article>')).toBe(true);
      expect(extensiveBlogPost.metadata.tags.length).toBeGreaterThan(5);
      expect(extensiveBlogPost.metadata.seoDescription!.length).toBeGreaterThan(100);
    });

    it('should handle publication result with detailed error information', () => {
      const detailedErrorResult: PublicationResult = {
        success: false,
        error: JSON.stringify({
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid API credentials provided',
          details: {
            apiKey: 'Key expired on 2024-09-30',
            endpoint: '/wp-json/wp/v2/posts',
            timestamp: '2024-10-01T09:15:23Z'
          },
          suggestions: [
            'Refresh API key in configuration',
            'Check WordPress user permissions',
            'Verify endpoint URL is correct'
          ]
        })
      };

      expect(detailedErrorResult.success).toBe(false);
      expect(detailedErrorResult.error).toContain('AUTHENTICATION_FAILED');
      
      // Parse the error to verify it's valid JSON
      const errorData = JSON.parse(detailedErrorResult.error!);
      expect(errorData.code).toBe('AUTHENTICATION_FAILED');
      expect(errorData.suggestions).toHaveLength(3);
    });

    it('should handle multiple data quality issues', () => {
      const multipleIssues: DataQualityIssue[] = [
        {
          type: 'missing_data',
          description: 'Player statistics unavailable for 3 players',
          severity: 'medium',
          affectedPlayer: 'Multiple players'
        },
        {
          type: 'stale_data',
          description: 'Injury report data is 18 hours old',
          severity: 'low'
        },
        {
          type: 'api_error',
          description: 'Yahoo Fantasy API rate limit exceeded',
          severity: 'high'
        },
        {
          type: 'invalid_format',
          description: 'ESPN returned unexpected data structure for player additions',
          severity: 'medium'
        }
      ];

      expect(multipleIssues).toHaveLength(4);
      expect(multipleIssues.filter(issue => issue.severity === 'high')).toHaveLength(1);
      expect(multipleIssues.filter(issue => issue.severity === 'medium')).toHaveLength(2);
      expect(multipleIssues.filter(issue => issue.severity === 'low')).toHaveLength(1);
      
      const typeCounts = multipleIssues.reduce((counts, issue) => {
        counts[issue.type] = (counts[issue.type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      expect(Object.keys(typeCounts)).toHaveLength(4);
    });
  });
});

describe('BlogValidator', () => {
  describe('validateBlogPost', () => {
    it('should validate a complete valid blog post', () => {
      const validPost: BlogPost = {
        title: 'Week 5 FAAB Targets: Top 10 Waiver Wire Adds',
        summary: 'Analysis of the most added players this week with buy/pass recommendations',
        content: '<h1>Week 5 FAAB Targets</h1><p>Here are this week\'s top targets...</p>',
        metadata: {
          tags: ['fantasy football', 'FAAB'],
          categories: ['Fantasy Football'],
          author: 'Fantasy Bot',
          seoTitle: 'Week 5 FAAB Targets - Fantasy Football Analysis',
          seoDescription: 'Expert analysis of Week 5 fantasy football FAAB targets'
        },
        publishDate: new Date('2024-10-01T09:00:00Z')
      };

      expect(BlogValidator.validateBlogPost(validPost)).toBe(true);
    });

    it('should reject post with empty title', () => {
      const invalidPost: BlogPost = {
        title: '',
        summary: 'Valid summary',
        content: 'Valid content',
        metadata: {
          tags: ['test'],
          categories: ['Test'],
          author: 'Test Author'
        },
        publishDate: new Date()
      };

      expect(BlogValidator.validateBlogPost(invalidPost)).toBe(false);
    });

    it('should reject post with title too long', () => {
      const invalidPost: BlogPost = {
        title: 'A'.repeat(201), // Too long
        summary: 'Valid summary',
        content: 'Valid content',
        metadata: {
          tags: ['test'],
          categories: ['Test'],
          author: 'Test Author'
        },
        publishDate: new Date()
      };

      expect(BlogValidator.validateBlogPost(invalidPost)).toBe(false);
    });

    it('should reject post with empty summary', () => {
      const invalidPost: BlogPost = {
        title: 'Valid Title',
        summary: '',
        content: 'Valid content',
        metadata: {
          tags: ['test'],
          categories: ['Test'],
          author: 'Test Author'
        },
        publishDate: new Date()
      };

      expect(BlogValidator.validateBlogPost(invalidPost)).toBe(false);
    });

    it('should reject post with summary too long', () => {
      const invalidPost: BlogPost = {
        title: 'Valid Title',
        summary: 'A'.repeat(501), // Too long
        content: 'Valid content',
        metadata: {
          tags: ['test'],
          categories: ['Test'],
          author: 'Test Author'
        },
        publishDate: new Date()
      };

      expect(BlogValidator.validateBlogPost(invalidPost)).toBe(false);
    });

    it('should reject post with empty content', () => {
      const invalidPost: BlogPost = {
        title: 'Valid Title',
        summary: 'Valid summary',
        content: '',
        metadata: {
          tags: ['test'],
          categories: ['Test'],
          author: 'Test Author'
        },
        publishDate: new Date()
      };

      expect(BlogValidator.validateBlogPost(invalidPost)).toBe(false);
    });

    it('should reject post with invalid publish date', () => {
      const invalidPost: BlogPost = {
        title: 'Valid Title',
        summary: 'Valid summary',
        content: 'Valid content',
        metadata: {
          tags: ['test'],
          categories: ['Test'],
          author: 'Test Author'
        },
        publishDate: new Date('invalid-date')
      };

      expect(BlogValidator.validateBlogPost(invalidPost)).toBe(false);
    });
  });

  describe('validateBlogMetadata', () => {
    it('should validate complete valid metadata', () => {
      const validMetadata: BlogMetadata = {
        tags: ['fantasy football', 'FAAB', 'NFL'],
        categories: ['Fantasy Football', 'Sports'],
        author: 'Fantasy Football Bot',
        seoTitle: 'SEO Optimized Title',
        seoDescription: 'SEO optimized description for search engines',
        featuredImage: 'https://example.com/image.jpg'
      };

      expect(BlogValidator.validateBlogMetadata(validMetadata)).toBe(true);
    });

    it('should validate minimal metadata', () => {
      const minimalMetadata: BlogMetadata = {
        tags: ['test'],
        categories: ['Test'],
        author: 'Test Author'
      };

      expect(BlogValidator.validateBlogMetadata(minimalMetadata)).toBe(true);
    });

    it('should reject metadata with non-array tags', () => {
      const invalidMetadata: BlogMetadata = {
        tags: 'not-an-array' as any,
        categories: ['Test'],
        author: 'Test Author'
      };

      expect(BlogValidator.validateBlogMetadata(invalidMetadata)).toBe(false);
    });

    it('should reject metadata with empty tag strings', () => {
      const invalidMetadata: BlogMetadata = {
        tags: ['valid-tag', ''],
        categories: ['Test'],
        author: 'Test Author'
      };

      expect(BlogValidator.validateBlogMetadata(invalidMetadata)).toBe(false);
    });

    it('should reject metadata with empty author', () => {
      const invalidMetadata: BlogMetadata = {
        tags: ['test'],
        categories: ['Test'],
        author: ''
      };

      expect(BlogValidator.validateBlogMetadata(invalidMetadata)).toBe(false);
    });

    it('should reject metadata with SEO title too long', () => {
      const invalidMetadata: BlogMetadata = {
        tags: ['test'],
        categories: ['Test'],
        author: 'Test Author',
        seoTitle: 'A'.repeat(61) // Too long
      };

      expect(BlogValidator.validateBlogMetadata(invalidMetadata)).toBe(false);
    });

    it('should reject metadata with SEO description too long', () => {
      const invalidMetadata: BlogMetadata = {
        tags: ['test'],
        categories: ['Test'],
        author: 'Test Author',
        seoDescription: 'A'.repeat(161) // Too long
      };

      expect(BlogValidator.validateBlogMetadata(invalidMetadata)).toBe(false);
    });

    it('should reject metadata with invalid featured image URL', () => {
      const invalidMetadata: BlogMetadata = {
        tags: ['test'],
        categories: ['Test'],
        author: 'Test Author',
        featuredImage: 'not-a-valid-url'
      };

      expect(BlogValidator.validateBlogMetadata(invalidMetadata)).toBe(false);
    });
  });

  describe('validatePublicationResult', () => {
    it('should validate successful publication result', () => {
      const validResult: PublicationResult = {
        success: true,
        postId: 'post_123',
        url: 'https://myblog.com/post/123',
        publishedAt: new Date()
      };

      expect(BlogValidator.validatePublicationResult(validResult)).toBe(true);
    });

    it('should validate failed publication result', () => {
      const validResult: PublicationResult = {
        success: false,
        error: 'Authentication failed'
      };

      expect(BlogValidator.validatePublicationResult(validResult)).toBe(true);
    });

    it('should reject successful result without postId', () => {
      const invalidResult: PublicationResult = {
        success: true,
        url: 'https://myblog.com/post/123'
      };

      expect(BlogValidator.validatePublicationResult(invalidResult)).toBe(false);
    });

    it('should reject failed result without error', () => {
      const invalidResult: PublicationResult = {
        success: false,
        postId: 'post_123'
      };

      expect(BlogValidator.validatePublicationResult(invalidResult)).toBe(false);
    });

    it('should reject result with invalid URL', () => {
      const invalidResult: PublicationResult = {
        success: true,
        postId: 'post_123',
        url: 'not-a-valid-url'
      };

      expect(BlogValidator.validatePublicationResult(invalidResult)).toBe(false);
    });

    it('should reject result with invalid published date', () => {
      const invalidResult: PublicationResult = {
        success: true,
        postId: 'post_123',
        publishedAt: new Date('invalid-date')
      };

      expect(BlogValidator.validatePublicationResult(invalidResult)).toBe(false);
    });
  });

  describe('validateDataQualityIssue', () => {
    it('should validate all issue types', () => {
      const issueTypes: DataQualityIssue['type'][] = [
        'missing_data',
        'invalid_format',
        'stale_data',
        'api_error'
      ];

      issueTypes.forEach(type => {
        const validIssue: DataQualityIssue = {
          type,
          description: `Test ${type} issue`,
          severity: 'medium'
        };

        expect(BlogValidator.validateDataQualityIssue(validIssue)).toBe(true);
      });
    });

    it('should validate all severity levels', () => {
      const severities: DataQualityIssue['severity'][] = ['low', 'medium', 'high'];

      severities.forEach(severity => {
        const validIssue: DataQualityIssue = {
          type: 'missing_data',
          description: `Test ${severity} severity issue`,
          severity
        };

        expect(BlogValidator.validateDataQualityIssue(validIssue)).toBe(true);
      });
    });

    it('should reject issue with invalid type', () => {
      const invalidIssue: DataQualityIssue = {
        type: 'invalid_type' as any,
        description: 'Test issue',
        severity: 'medium'
      };

      expect(BlogValidator.validateDataQualityIssue(invalidIssue)).toBe(false);
    });

    it('should reject issue with empty description', () => {
      const invalidIssue: DataQualityIssue = {
        type: 'missing_data',
        description: '',
        severity: 'medium'
      };

      expect(BlogValidator.validateDataQualityIssue(invalidIssue)).toBe(false);
    });

    it('should reject issue with invalid severity', () => {
      const invalidIssue: DataQualityIssue = {
        type: 'missing_data',
        description: 'Test issue',
        severity: 'invalid' as any
      };

      expect(BlogValidator.validateDataQualityIssue(invalidIssue)).toBe(false);
    });

    it('should reject issue with empty affected player', () => {
      const invalidIssue: DataQualityIssue = {
        type: 'missing_data',
        description: 'Test issue',
        severity: 'medium',
        affectedPlayer: ''
      };

      expect(BlogValidator.validateDataQualityIssue(invalidIssue)).toBe(false);
    });
  });
});

describe('BlogTransformer', () => {
  describe('sanitizeTitle', () => {
    it('should clean up title formatting', () => {
      const messyTitle = '  Week   5  FAAB  Targets!!!  ';
      const result = BlogTransformer.sanitizeTitle(messyTitle);
      
      expect(result).toBe('Week 5 FAAB Targets');
    });

    it('should remove special characters except allowed ones', () => {
      const titleWithSpecialChars = 'Week 5: FAAB Targets & Analysis!@#$%';
      const result = BlogTransformer.sanitizeTitle(titleWithSpecialChars);
      
      expect(result).toBe('Week 5: FAAB Targets  Analysis');
    });

    it('should truncate long titles', () => {
      const longTitle = 'A'.repeat(250);
      const result = BlogTransformer.sanitizeTitle(longTitle);
      
      expect(result.length).toBe(200);
    });
  });

  describe('generateSlug', () => {
    it('should create URL-friendly slug', () => {
      const title = 'Week 5 FAAB Targets: Top Players to Add';
      const result = BlogTransformer.generateSlug(title);
      
      expect(result).toBe('week-5-faab-targets-top-players-to-add');
    });

    it('should handle special characters', () => {
      const title = 'Player\'s Analysis & Review (2024)';
      const result = BlogTransformer.generateSlug(title);
      
      expect(result).toBe('players-analysis-review-2024');
    });

    it('should handle multiple spaces and dashes', () => {
      const title = 'Week   5  --  FAAB   Targets';
      const result = BlogTransformer.generateSlug(title);
      
      expect(result).toBe('week-5-faab-targets');
    });
  });

  describe('truncateSummary', () => {
    it('should not truncate short summaries', () => {
      const shortSummary = 'This is a short summary.';
      const result = BlogTransformer.truncateSummary(shortSummary);
      
      expect(result).toBe(shortSummary);
    });

    it('should truncate long summaries at word boundary', () => {
      const longSummary = 'This is a very long summary that exceeds the maximum length limit and should be truncated at a word boundary to maintain readability and proper formatting for the blog post summary section.';
      const result = BlogTransformer.truncateSummary(longSummary, 100);
      
      expect(result.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(result.endsWith('...')).toBe(true);
      expect(result.includes(' ')).toBe(true); // Should break at word boundary
    });

    it('should handle custom max length', () => {
      const summary = 'This is a summary that should be truncated at fifty characters.';
      const result = BlogTransformer.truncateSummary(summary, 50);
      
      expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('optimizeSEOTitle', () => {
    it('should not modify short titles', () => {
      const shortTitle = 'Week 5 FAAB Targets';
      const result = BlogTransformer.optimizeSEOTitle(shortTitle);
      
      expect(result).toBe(shortTitle);
    });

    it('should truncate long titles at word boundary', () => {
      const longTitle = 'This is a very long SEO title that exceeds the recommended sixty character limit for search engine optimization';
      const result = BlogTransformer.optimizeSEOTitle(longTitle);
      
      expect(result.length).toBeLessThanOrEqual(60);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('optimizeSEODescription', () => {
    it('should not modify short descriptions', () => {
      const shortDesc = 'This is a short SEO description.';
      const result = BlogTransformer.optimizeSEODescription(shortDesc);
      
      expect(result).toBe(shortDesc);
    });

    it('should truncate long descriptions at word boundary', () => {
      const longDesc = 'This is a very long SEO description that exceeds the recommended one hundred sixty character limit for search engine optimization and should be truncated appropriately.';
      const result = BlogTransformer.optimizeSEODescription(longDesc);
      
      expect(result.length).toBeLessThanOrEqual(160);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('cleanTags', () => {
    it('should clean and deduplicate tags', () => {
      const messyTags = ['  Fantasy Football  ', 'FAAB', 'fantasy football', 'NFL', 'faab'];
      const result = BlogTransformer.cleanTags(messyTags);
      
      expect(result).toEqual(['faab', 'fantasy football', 'nfl']);
    });

    it('should remove empty tags', () => {
      const tagsWithEmpty = ['fantasy football', '', '   ', 'FAAB'];
      const result = BlogTransformer.cleanTags(tagsWithEmpty);
      
      expect(result).toEqual(['faab', 'fantasy football']);
    });

    it('should sort tags alphabetically', () => {
      const unsortedTags = ['NFL', 'FAAB', 'Analysis', 'Fantasy Football'];
      const result = BlogTransformer.cleanTags(unsortedTags);
      
      expect(result).toEqual(['analysis', 'faab', 'fantasy football', 'nfl']);
    });
  });

  describe('cleanCategories', () => {
    it('should clean and deduplicate categories', () => {
      const messyCategories = ['  Fantasy Football  ', 'Analysis', 'Fantasy Football', 'Sports'];
      const result = BlogTransformer.cleanCategories(messyCategories);
      
      expect(result).toEqual(['Analysis', 'Fantasy Football', 'Sports']);
    });

    it('should remove empty categories', () => {
      const categoriesWithEmpty = ['Fantasy Football', '', '   ', 'Analysis'];
      const result = BlogTransformer.cleanCategories(categoriesWithEmpty);
      
      expect(result).toEqual(['Analysis', 'Fantasy Football']);
    });

    it('should preserve case for categories', () => {
      const categories = ['Fantasy Football', 'Weekly Analysis', 'FAAB Strategy'];
      const result = BlogTransformer.cleanCategories(categories);
      
      expect(result).toEqual(['FAAB Strategy', 'Fantasy Football', 'Weekly Analysis']);
    });
  });

  describe('stripHtmlTags', () => {
    it('should remove HTML tags', () => {
      const htmlContent = '<h1>Title</h1><p>This is a <strong>paragraph</strong> with <em>formatting</em>.</p>';
      const result = BlogTransformer.stripHtmlTags(htmlContent);
      
      expect(result).toBe('TitleThis is a paragraph with formatting.');
    });

    it('should handle self-closing tags', () => {
      const htmlContent = '<p>Line 1<br/>Line 2<img src="image.jpg" alt="test"/></p>';
      const result = BlogTransformer.stripHtmlTags(htmlContent);
      
      expect(result).toBe('Line 1Line 2');
    });

    it('should handle nested tags', () => {
      const htmlContent = '<div><p><strong><em>Nested content</em></strong></p></div>';
      const result = BlogTransformer.stripHtmlTags(htmlContent);
      
      expect(result).toBe('Nested content');
    });
  });

  describe('estimateReadingTime', () => {
    it('should calculate reading time for short content', () => {
      const shortContent = 'This is a short piece of content with about twenty words in total for testing purposes.';
      const result = BlogTransformer.estimateReadingTime(shortContent);
      
      expect(result).toBe(1); // Should round up to 1 minute
    });

    it('should calculate reading time for longer content', () => {
      const words = Array(400).fill('word').join(' '); // 400 words
      const result = BlogTransformer.estimateReadingTime(words);
      
      expect(result).toBe(2); // 400 words / 200 wpm = 2 minutes
    });

    it('should handle HTML content', () => {
      const htmlContent = '<h1>Title</h1>' + '<p>' + Array(199).fill('word').join(' ') + '</p>';
      const result = BlogTransformer.estimateReadingTime(htmlContent);
      
      expect(result).toBe(1); // Should strip HTML and count words (200 words total: 1 + 199)
    });
  });

  describe('createPublicationResult', () => {
    it('should create successful publication result', () => {
      const result = BlogTransformer.createPublicationResult(
        true,
        'post_123',
        'https://myblog.com/post/123'
      );
      
      expect(result.success).toBe(true);
      expect(result.postId).toBe('post_123');
      expect(result.url).toBe('https://myblog.com/post/123');
      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });

    it('should create failed publication result', () => {
      const result = BlogTransformer.createPublicationResult(
        false,
        undefined,
        undefined,
        'Authentication failed'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
      expect(result.postId).toBeUndefined();
      expect(result.url).toBeUndefined();
      expect(result.publishedAt).toBeUndefined();
    });
  });

  describe('categorizeDataQualityIssues', () => {
    it('should categorize issues by severity', () => {
      const issues: DataQualityIssue[] = [
        {
          type: 'missing_data',
          description: 'High severity issue',
          severity: 'high'
        },
        {
          type: 'stale_data',
          description: 'Medium severity issue',
          severity: 'medium'
        },
        {
          type: 'api_error',
          description: 'Low severity issue',
          severity: 'low'
        },
        {
          type: 'missing_data',
          description: 'Another high severity issue',
          severity: 'high'
        }
      ];

      const result = BlogTransformer.categorizeDataQualityIssues(issues);

      expect(result.high).toHaveLength(2);
      expect(result.medium).toHaveLength(1);
      expect(result.low).toHaveLength(1);
    });

    it('should handle empty issues array', () => {
      const result = BlogTransformer.categorizeDataQualityIssues([]);

      expect(result.high).toHaveLength(0);
      expect(result.medium).toHaveLength(0);
      expect(result.low).toHaveLength(0);
    });
  });

  describe('summarizeDataQualityIssues', () => {
    it('should summarize no issues', () => {
      const result = BlogTransformer.summarizeDataQualityIssues([]);
      
      expect(result).toBe('No data quality issues detected');
    });

    it('should summarize mixed severity issues', () => {
      const issues: DataQualityIssue[] = [
        {
          type: 'missing_data',
          description: 'High severity issue',
          severity: 'high'
        },
        {
          type: 'stale_data',
          description: 'Medium severity issue 1',
          severity: 'medium'
        },
        {
          type: 'stale_data',
          description: 'Medium severity issue 2',
          severity: 'medium'
        },
        {
          type: 'api_error',
          description: 'Low severity issue',
          severity: 'low'
        }
      ];

      const result = BlogTransformer.summarizeDataQualityIssues(issues);

      expect(result).toContain('Found 4 data quality issues');
      expect(result).toContain('1 high severity issue');
      expect(result).toContain('2 medium severity issues');
      expect(result).toContain('1 low severity issue');
    });

    it('should handle single issue correctly', () => {
      const issues: DataQualityIssue[] = [
        {
          type: 'missing_data',
          description: 'Single issue',
          severity: 'high'
        }
      ];

      const result = BlogTransformer.summarizeDataQualityIssues(issues);

      expect(result).toContain('Found 1 data quality issue');
      expect(result).toContain('1 high severity issue');
      expect(result).not.toContain('issues:'); // Should use singular form
    });
  });

  describe('createDataQualityIssue', () => {
    it('should create issue with all fields', () => {
      const result = BlogTransformer.createDataQualityIssue(
        'missing_data',
        'Player statistics unavailable',
        'high',
        'John Doe'
      );

      expect(result.type).toBe('missing_data');
      expect(result.description).toBe('Player statistics unavailable');
      expect(result.severity).toBe('high');
      expect(result.affectedPlayer).toBe('John Doe');
    });

    it('should create issue without affected player', () => {
      const result = BlogTransformer.createDataQualityIssue(
        'api_error',
        'API rate limit exceeded',
        'medium'
      );

      expect(result.type).toBe('api_error');
      expect(result.description).toBe('API rate limit exceeded');
      expect(result.severity).toBe('medium');
      expect(result.affectedPlayer).toBeUndefined();
    });
  });

  describe('Edge cases and additional validation', () => {
    it('should handle empty content in stripHtmlTags', () => {
      expect(BlogTransformer.stripHtmlTags('')).toBe('');
      expect(BlogTransformer.stripHtmlTags('   ')).toBe('');
    });

    it('should handle malformed HTML in stripHtmlTags', () => {
      const malformedHtml = '<p>Unclosed paragraph<div>Nested without closing</p>';
      const result = BlogTransformer.stripHtmlTags(malformedHtml);
      expect(result).toBe('Unclosed paragraphNested without closing');
    });

    it('should handle very long titles in sanitizeTitle', () => {
      const longTitle = 'A'.repeat(300);
      const result = BlogTransformer.sanitizeTitle(longTitle);
      expect(result.length).toBe(200);
    });

    it('should handle special characters in generateSlug', () => {
      const titleWithSpecialChars = 'Week 5: FAAB Targets & Analysis (2024) - Part #1!';
      const result = BlogTransformer.generateSlug(titleWithSpecialChars);
      expect(result).toBe('week-5-faab-targets-analysis-2024-part-1');
    });

    it('should handle empty arrays in cleanTags and cleanCategories', () => {
      expect(BlogTransformer.cleanTags([])).toEqual([]);
      expect(BlogTransformer.cleanCategories([])).toEqual([]);
    });

    it('should handle zero word content in estimateReadingTime', () => {
      expect(BlogTransformer.estimateReadingTime('')).toBe(1);
      expect(BlogTransformer.estimateReadingTime('   ')).toBe(1);
    });

    it('should handle edge cases in truncateSummary', () => {
      // Test with exactly max length
      const exactLength = 'A'.repeat(500);
      expect(BlogTransformer.truncateSummary(exactLength)).toBe(exactLength);
      
      // Test with no good word boundary
      const noSpaces = 'A'.repeat(600);
      const result = BlogTransformer.truncateSummary(noSpaces);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length).toBe(503); // 500 + '...'
    });

    it('should handle edge cases in optimizeSEOTitle', () => {
      // Test with exactly 60 characters
      const exactLength = 'A'.repeat(60);
      expect(BlogTransformer.optimizeSEOTitle(exactLength)).toBe(exactLength);
      
      // Test with no good word boundary
      const noSpaces = 'A'.repeat(80);
      const result = BlogTransformer.optimizeSEOTitle(noSpaces);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle edge cases in optimizeSEODescription', () => {
      // Test with exactly 160 characters
      const exactLength = 'A'.repeat(160);
      expect(BlogTransformer.optimizeSEODescription(exactLength)).toBe(exactLength);
      
      // Test with no good word boundary
      const noSpaces = 'A'.repeat(200);
      const result = BlogTransformer.optimizeSEODescription(noSpaces);
      expect(result.endsWith('...')).toBe(true);
    });
  });
});