// Writer Agent tests

import { WriterAgent } from './writer-agent';
import { PlayerAnalysis, PlayerSummary, BlogPost } from '../models';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('WriterAgent', () => {
  let writerAgent: WriterAgent;
  let mockAnalyses: PlayerAnalysis[];

  beforeEach(() => {
    writerAgent = new WriterAgent();
    
    // Create mock player analyses
    mockAnalyses = [
      {
        player: {
          playerId: '1',
          name: 'John Smith',
          position: 'RB',
          team: 'DAL',
          additionCount: 1500,
          additionPercentage: 25.5,
          platforms: ['ESPN', 'Yahoo']
        },
        recommendation: 'BUY',
        confidence: 85,
        reasoning: [
          'High snap count indicates significant role in offense',
          'Favorable upcoming schedule with 2 easy matchups',
          'Recent news suggests increased opportunity'
        ],
        suggestedFAABPercentage: 12.5,
        riskFactors: ['Limited sample size'],
        upside: ['Red zone usage provides touchdown upside', 'High manager interest indicates strong perceived value']
      },
      {
        player: {
          playerId: '2',
          name: 'Jane Doe',
          position: 'WR',
          team: 'KC',
          additionCount: 800,
          additionPercentage: 15.2,
          platforms: ['Sleeper', 'Yahoo']
        },
        recommendation: 'PASS',
        confidence: 70,
        reasoning: [
          'Below threshold for acquisition (FAAB: 45, Impact: 55, Sustainability: 40)',
          'Injury concerns (questionable)',
          'Limited snap count suggests reduced opportunity'
        ],
        suggestedFAABPercentage: undefined,
        riskFactors: ['Currently questionable: knee injury', 'Limited snap count (25%) suggests reduced opportunity'],
        upside: []
      }
    ];
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(writerAgent.initialize()).resolves.not.toThrow();
      expect(writerAgent.name).toBe('WriterAgent');
    });

    it('should handle multiple initializations', async () => {
      await writerAgent.initialize();
      await expect(writerAgent.initialize()).resolves.not.toThrow();
    });
  });

  describe('createBlogPost', () => {
    beforeEach(async () => {
      await writerAgent.initialize();
    });

    it('should create a valid blog post from analyses', async () => {
      const blogPost = await writerAgent.createBlogPost(mockAnalyses);

      expect(blogPost).toBeDefined();
      expect(blogPost.title).toBeTruthy();
      expect(blogPost.summary).toBeTruthy();
      expect(blogPost.content).toBeTruthy();
      expect(blogPost.metadata).toBeDefined();
      expect(blogPost.publishDate).toBeInstanceOf(Date);
    });

    it('should include player information in content', async () => {
      const blogPost = await writerAgent.createBlogPost(mockAnalyses);

      expect(blogPost.content).toContain('John Smith');
      expect(blogPost.content).toContain('Jane Doe');
      expect(blogPost.content).toContain('BUY');
      expect(blogPost.content).toContain('PASS');
    });

    it('should generate appropriate metadata', async () => {
      const blogPost = await writerAgent.createBlogPost(mockAnalyses);

      expect(blogPost.metadata.tags).toContain('fantasy football');
      expect(blogPost.metadata.tags).toContain('faab');
      expect(blogPost.metadata.categories).toContain('Fantasy Football');
      expect(blogPost.metadata.author).toBe('Fantasy Football FAAB Analyzer');
      expect(blogPost.metadata.seoTitle).toBeTruthy();
      expect(blogPost.metadata.seoDescription).toBeTruthy();
    });

    it('should handle empty analyses array', async () => {
      await expect(writerAgent.createBlogPost([])).rejects.toThrow();
    });

    it('should include FAAB percentages for BUY recommendations', async () => {
      const blogPost = await writerAgent.createBlogPost(mockAnalyses);

      expect(blogPost.content).toContain('12.5%');
    });
  });

  describe('content formatting', () => {
    let blogPost: BlogPost;

    beforeEach(async () => {
      await writerAgent.initialize();
      blogPost = await writerAgent.createBlogPost(mockAnalyses);
    });

    it('should format content for HTML', () => {
      const htmlContent = writerAgent.formatForHTML(blogPost);

      expect(htmlContent).toContain('<article class="faab-analysis-post">');
      expect(htmlContent).toContain('<h1 class="main-header">');
      expect(htmlContent).toContain('<span class="recommendation-badge buy-badge">');
      expect(htmlContent).toContain('<span class="recommendation-badge pass-badge">');
    });

    it('should format content for Markdown', () => {
      const markdownContent = writerAgent.formatForMarkdown(blogPost);

      expect(markdownContent).toContain('---');
      expect(markdownContent).toContain('title:');
      expect(markdownContent).toContain('tags:');
      expect(markdownContent).toContain('# Week');
    });

    it('should format for different platforms', () => {
      const wordpressContent = writerAgent.formatForPlatform(blogPost, 'wordpress');
      const mediumContent = writerAgent.formatForPlatform(blogPost, 'medium');
      const ghostContent = writerAgent.formatForPlatform(blogPost, 'ghost');

      expect(wordpressContent).toContain('wp-block-group');
      expect(mediumContent).toBeTruthy();
      expect(ghostContent).toContain('kg-card-markdown');
    });

    it('should apply style guidelines', () => {
      const content = 'This player should be targeted for your waiver wire.';
      const styled = writerAgent.applyStyleGuidelines(content);

      expect(styled).toContain('target');
      expect(styled).not.toContain('should be targeted');
    });

    it('should generate table of contents for long posts', () => {
      const longContent = `
## Section 1
Content here
## Section 2  
More content
## Section 3
Even more content
      `.trim();

      const toc = writerAgent.generateTableOfContents(longContent);

      expect(toc).toContain('Table of Contents');
      expect(toc).toContain('Section 1');
      expect(toc).toContain('Section 2');
      expect(toc).toContain('Section 3');
    });
  });

  describe('social media optimization', () => {
    let blogPost: BlogPost;

    beforeEach(async () => {
      await writerAgent.initialize();
      blogPost = await writerAgent.createBlogPost(mockAnalyses);
    });

    it('should generate social media preview', () => {
      const socialPreview = writerAgent.generateSocialPreview(blogPost);

      expect(socialPreview.title).toBeTruthy();
      expect(socialPreview.description).toBeTruthy();
      expect(socialPreview.hashtags).toContain('#FantasyFootball');
      expect(socialPreview.hashtags).toContain('#FAAB');
      expect(socialPreview.hashtags).toContain('#WaiverWire');
    });

    it('should truncate long titles for social media', () => {
      const longTitlePost = { ...blogPost };
      longTitlePost.title = 'This is a very long title that exceeds the typical social media character limits and should be truncated appropriately';

      const socialPreview = writerAgent.generateSocialPreview(longTitlePost);

      expect(socialPreview.title.length).toBeLessThanOrEqual(60);
      expect(socialPreview.title).toContain('...');
    });
  });

  describe('execute method', () => {
    it('should execute the full workflow', async () => {
      const result = await writerAgent.execute(mockAnalyses);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('metadata');
    });

    it('should handle execution errors gracefully', async () => {
      const invalidAnalyses = [
        {
          // Missing required fields
          player: null,
          recommendation: 'INVALID'
        }
      ] as any;

      await expect(writerAgent.execute(invalidAnalyses)).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await writerAgent.initialize();
    });

    it('should handle all BUY recommendations', async () => {
      const allBuyAnalyses = mockAnalyses.map(analysis => ({
        ...analysis,
        recommendation: 'BUY' as const,
        suggestedFAABPercentage: 10
      }));

      const blogPost = await writerAgent.createBlogPost(allBuyAnalyses);

      expect(blogPost.content).toContain('BUY');
      expect(blogPost.title).toContain('2'); // Should mention count
    });

    it('should handle all PASS recommendations', async () => {
      const allPassAnalyses = mockAnalyses.map(analysis => ({
        ...analysis,
        recommendation: 'PASS' as const,
        suggestedFAABPercentage: undefined
      }));

      const blogPost = await writerAgent.createBlogPost(allPassAnalyses);

      expect(blogPost.content).toContain('PASS');
      expect(blogPost.content).toContain('save budget');
    });

    it('should handle single player analysis', async () => {
      const singleAnalysis = [mockAnalyses[0]!];

      const blogPost = await writerAgent.createBlogPost(singleAnalysis);

      expect(blogPost).toBeDefined();
      expect(blogPost.content).toContain('John Smith');
    });

    it('should handle players with no upside or risk factors', async () => {
      const minimalAnalysis = [{
        ...mockAnalyses[0]!,
        upside: [],
        riskFactors: []
      }];

      const blogPost = await writerAgent.createBlogPost(minimalAnalysis);

      expect(blogPost).toBeDefined();
      expect(blogPost.content).toBeTruthy();
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully', async () => {
      await expect(writerAgent.cleanup()).resolves.not.toThrow();
    });
  });
});