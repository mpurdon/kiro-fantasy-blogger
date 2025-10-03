// Publisher Agent unit tests

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { PublisherAgent, PublisherAgentConfig } from './publisher-agent';
import { BlogPost, PublicationResult } from '../models/blog';
import { SystemConfig } from '../models/config';
import { WordPressClient } from '../api/blog-platform/wordpress-client';

// Mock the blog platform clients
vi.mock('../api/blog-platform/wordpress-client');

describe('PublisherAgent', () => {
  let publisherAgent: PublisherAgent;
  let mockSystemConfig: SystemConfig;
  let mockConfig: PublisherAgentConfig;
  let mockBlogPost: BlogPost;
  let mockWordPressClient: any;


  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock system configuration
    mockSystemConfig = {
      blog: {
        name: 'wordpress',
        baseUrl: 'https://example.com/wp-json',
        apiKey: 'test-api-key',
        username: 'testuser',
        defaultTags: ['test'],
        defaultCategories: ['test']
      }
    } as SystemConfig;

    // Mock publisher agent configuration
    mockConfig = {
      primaryPlatform: 'wordpress',
      fallbackPlatforms: [],
      retryAttempts: 2,
      retryDelay: 1000,
      validateBeforePublish: true,
      trackPublicationStatus: false // Disable for existing tests
    };

    // Mock blog post
    mockBlogPost = {
      title: 'Test FAAB Blog Post',
      summary: 'This is a test summary for the FAAB blog post.',
      content: '<h1>Test Content</h1><p>This is test content for the blog post.</p>',
      metadata: {
        tags: ['fantasy-football', 'faab', 'waiver-wire'],
        categories: ['Fantasy Football'],
        author: 'Test Author',
        seoTitle: 'Test SEO Title',
        seoDescription: 'Test SEO description for the blog post.'
      },
      publishDate: new Date('2024-01-15T10:00:00Z')
    };

    // Mock WordPress client
    mockWordPressClient = {
      authenticate: vi.fn().mockResolvedValue(undefined),
      publishPost: vi.fn(),
      updatePost: vi.fn(),
      deletePost: vi.fn(),
      getPost: vi.fn(),
      listPosts: vi.fn(),
      isAuthenticated: vi.fn().mockReturnValue(true),
      clearCache: vi.fn()
    };

    // Setup constructor mocks
    (WordPressClient as any).mockImplementation(() => mockWordPressClient);

    publisherAgent = new PublisherAgent(mockSystemConfig, mockConfig);
  });

  describe('initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      await expect(publisherAgent.initialize()).resolves.not.toThrow();
      
      expect(WordPressClient).toHaveBeenCalledWith(
        mockSystemConfig.blog,
        expect.objectContaining({
          apiKey: 'test-api-key',
          username: 'testuser'
        })
      );
      
      expect(mockWordPressClient.authenticate).toHaveBeenCalled();
    });

    it('should throw error if primary platform initialization fails', async () => {
      mockWordPressClient.authenticate.mockRejectedValue(new Error('Auth failed'));
      
      await expect(publisherAgent.initialize()).rejects.toThrow('Failed to initialize primary blog platform: wordpress');
    });

    it('should handle successful initialization', async () => {
      await expect(publisherAgent.initialize()).resolves.not.toThrow();
      expect(mockWordPressClient.authenticate).toHaveBeenCalled();
    });
  });

  describe('publishPost', () => {
    beforeEach(async () => {
      await publisherAgent.initialize();
    });

    it('should successfully publish to primary platform', async () => {
      const mockResult: PublicationResult = {
        success: true,
        postId: 'wp-123',
        url: 'https://example.com/post/123',
        publishedAt: new Date(),
        status: 'published'
      };
      
      mockWordPressClient.publishPost.mockResolvedValue(mockResult);
      
      const result = await publisherAgent.publishPost(mockBlogPost);
      
      expect(result).toEqual(mockResult);
      expect(mockWordPressClient.publishPost).toHaveBeenCalledWith(
        expect.objectContaining({
          title: mockBlogPost.title,
          content: mockBlogPost.content
        })
      );
    });

    it('should return failure if primary platform fails and no fallbacks', async () => {
      const primaryFailure: PublicationResult = {
        success: false,
        error: 'WordPress API error'
      };
      
      mockWordPressClient.publishPost.mockResolvedValue(primaryFailure);
      
      const result = await publisherAgent.publishPost(mockBlogPost);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('WordPress API error');
      expect(mockWordPressClient.publishPost).toHaveBeenCalled();
    });

    it('should return failure if platform fails', async () => {
      const failure: PublicationResult = {
        success: false,
        error: 'API error'
      };
      
      mockWordPressClient.publishPost.mockResolvedValue(failure);
      
      const result = await publisherAgent.publishPost(mockBlogPost);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('API error');
    });

    it('should validate post before publishing when enabled', async () => {
      const invalidPost = {
        ...mockBlogPost,
        title: '' // Invalid title
      };
      
      const result = await publisherAgent.publishPost(invalidPost);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Blog post validation failed');
      expect(mockWordPressClient.publishPost).not.toHaveBeenCalled();
    });

    it('should optimize post content before publishing', async () => {
      // Create a post with optimization needs but still valid
      const postWithOptimizationNeeds = {
        ...mockBlogPost,
        title: 'A'.repeat(150), // Long but not invalid title
        metadata: {
          ...mockBlogPost.metadata,
          tags: ['  fantasy-football  ', 'FAAB', 'fantasy-football'], // Duplicates and whitespace
          categories: ['  Fantasy Football  ', 'Sports']
        }
      };
      
      const mockResult: PublicationResult = {
        success: true,
        postId: 'wp-123',
        status: 'published'
      };
      
      mockWordPressClient.publishPost.mockResolvedValue(mockResult);
      
      await publisherAgent.publishPost(postWithOptimizationNeeds);
      
      expect(mockWordPressClient.publishPost).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/^A+$/), // Title should be A's only
          metadata: expect.objectContaining({
            tags: expect.arrayContaining(['faab', 'fantasy-football']), // Should be cleaned and deduplicated
            categories: expect.arrayContaining(['Fantasy Football', 'Sports']) // Should be cleaned
          })
        })
      );
    });

    it('should retry on failure with exponential backoff', async () => {
      mockWordPressClient.publishPost
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          postId: 'wp-123',
          status: 'published'
        });
      
      const result = await publisherAgent.publishPost(mockBlogPost);
      
      expect(result.success).toBe(true);
      expect(mockWordPressClient.publishPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('publication management', () => {
    beforeEach(async () => {
      await publisherAgent.initialize();
    });

    it('should verify publication successfully', async () => {
      mockWordPressClient.getPost.mockResolvedValue(mockBlogPost);
      
      const result = await publisherAgent.verifyPublication('wp-123', 'wordpress');
      
      expect(result).toBe(true);
      expect(mockWordPressClient.getPost).toHaveBeenCalledWith('wp-123');
    });

    it('should return false if verification fails', async () => {
      mockWordPressClient.getPost.mockRejectedValue(new Error('Post not found'));
      
      const result = await publisherAgent.verifyPublication('wp-123', 'wordpress');
      
      expect(result).toBe(false);
    });

    it('should update post successfully', async () => {
      const updatedPost = {
        ...mockBlogPost,
        title: 'Updated Title'
      };
      
      const mockResult: PublicationResult = {
        success: true,
        postId: 'wp-123',
        status: 'published'
      };
      
      mockWordPressClient.updatePost.mockResolvedValue(mockResult);
      
      const result = await publisherAgent.updatePost('wp-123', 'wordpress', updatedPost);
      
      expect(result).toEqual(mockResult);
      expect(mockWordPressClient.updatePost).toHaveBeenCalledWith('wp-123', expect.objectContaining({
        title: 'Updated Title'
      }));
    });

    it('should delete post successfully', async () => {
      mockWordPressClient.deletePost.mockResolvedValue(true);
      
      const result = await publisherAgent.deletePost('wp-123', 'wordpress');
      
      expect(result).toBe(true);
      expect(mockWordPressClient.deletePost).toHaveBeenCalledWith('wp-123');
    });

    it('should check platform health', async () => {
      const result = await publisherAgent.checkPlatformHealth('wordpress');
      
      expect(result).toBe(true);
      expect(mockWordPressClient.isAuthenticated).toHaveBeenCalled();
    });

    it('should refresh platform authentication', async () => {
      const result = await publisherAgent.refreshPlatformAuthentication('wordpress');
      
      expect(result).toBe(true);
      expect(mockWordPressClient.authenticate).toHaveBeenCalled();
    });

    it('should return available platforms', async () => {
      const platforms = publisherAgent.getAvailablePlatforms();
      
      expect(platforms).toContain('wordpress');
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await publisherAgent.initialize();
    });

    it('should cleanup successfully', async () => {
      await publisherAgent.cleanup();
      
      expect(mockWordPressClient.clearCache).toHaveBeenCalled();
    });
  });

  describe('execute method', () => {
    beforeEach(async () => {
      await publisherAgent.initialize();
    });

    it('should execute publishPost when called', async () => {
      const mockResult: PublicationResult = {
        success: true,
        postId: 'wp-123',
        status: 'published'
      };
      
      mockWordPressClient.publishPost.mockResolvedValue(mockResult);
      
      const result = await publisherAgent.execute(mockBlogPost);
      
      expect(result).toEqual(mockResult);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await publisherAgent.initialize();
    });

    it('should handle platform not available error', async () => {
      const result = await publisherAgent.verifyPublication('test-123', 'nonexistent');
      
      expect(result).toBe(false);
    });

    it('should handle invalid platform configuration', async () => {
      const invalidConfig = {
        ...mockSystemConfig,
        blog: {
          name: undefined, // Invalid name
          baseUrl: 'https://example.com',
          apiKey: 'test-key',
          defaultTags: [],
          defaultCategories: []
        }
      };
      
      const agent = new PublisherAgent(invalidConfig, {
        ...mockConfig,
        primaryPlatform: 'invalid'
      });
      
      await expect(agent.initialize()).rejects.toThrow('Failed to initialize primary blog platform: undefined');
    });
  });
});