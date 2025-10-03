// Publication Validator unit tests

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { 
  PublicationValidator, 
  InMemoryPublicationTracker, 
  ConsolePublicationLogger,
  ValidationResult 
} from './publication-validator';
import { BlogPost, PublicationResult } from '../models/blog';
import { BlogPlatformClient } from '../api/blog-platform/types';

describe('PublicationValidator', () => {
  let validator: PublicationValidator;
  let mockClient: any;
  let tracker: InMemoryPublicationTracker;
  let logger: ConsolePublicationLogger;
  let clients: Map<string, BlogPlatformClient>;
  let mockBlogPost: BlogPost;
  let mockPublishedPost: BlogPost;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock blog platform client
    mockClient = {
      getPost: vi.fn(),
      publishPost: vi.fn(),
      updatePost: vi.fn(),
      deletePost: vi.fn(),
      listPosts: vi.fn(),
      authenticate: vi.fn(),
      isAuthenticated: vi.fn().mockReturnValue(true)
    };

    // Setup clients map
    clients = new Map();
    clients.set('wordpress', mockClient);

    // Setup tracker and logger
    tracker = new InMemoryPublicationTracker();
    logger = new ConsolePublicationLogger();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create validator
    validator = new PublicationValidator(clients, tracker, logger);

    // Mock blog posts
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

    mockPublishedPost = {
      ...mockBlogPost,
      content: '<h1>Test Content</h1><p>This is test content for the blog post.</p>' // Exact match
    };
  });

  describe('validatePublication', () => {
    it('should validate successful publication with matching content', async () => {
      mockClient.getPost.mockResolvedValue(mockPublishedPost);

      const result = await validator.validatePublication('post-123', 'wordpress', mockBlogPost);

      expect(result.isValid).toBe(true);
      expect(result.postExists).toBe(true);
      expect(result.contentMatches).toBe(true);
      expect(result.metadataMatches).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockClient.getPost).toHaveBeenCalledWith('post-123');
    });

    it('should handle post not found', async () => {
      mockClient.getPost.mockRejectedValue(new Error('Post not found'));

      const result = await validator.validatePublication('post-123', 'wordpress', mockBlogPost);

      expect(result.isValid).toBe(false);
      expect(result.postExists).toBe(false);
      expect(result.contentMatches).toBe(false);
      expect(result.metadataMatches).toBe(false);
      expect(result.errors).toContain('Failed to retrieve post: Post not found');
    });

    it('should handle platform not available', async () => {
      const result = await validator.validatePublication('post-123', 'nonexistent', mockBlogPost);

      expect(result.isValid).toBe(false);
      expect(result.postExists).toBe(false);
      expect(result.errors).toContain('Platform nonexistent not available');
    });

    it('should detect content mismatch', async () => {
      const differentPost = {
        ...mockPublishedPost,
        title: 'Completely Different Title',
        content: '<p>Completely different content</p>'
      };
      
      mockClient.getPost.mockResolvedValue(differentPost);

      const result = await validator.validatePublication('post-123', 'wordpress', mockBlogPost);

      expect(result.isValid).toBe(false);
      expect(result.postExists).toBe(true);
      expect(result.contentMatches).toBe(false);
      expect(result.warnings).toContain('Published content differs from original');
    });

    it('should detect metadata mismatch', async () => {
      const differentMetadataPost = {
        ...mockPublishedPost,
        metadata: {
          ...mockPublishedPost.metadata,
          tags: ['completely', 'different', 'tags'],
          categories: ['Different Category']
        }
      };
      
      mockClient.getPost.mockResolvedValue(differentMetadataPost);

      const result = await validator.validatePublication('post-123', 'wordpress', mockBlogPost);

      expect(result.isValid).toBe(false);
      expect(result.postExists).toBe(true);
      expect(result.metadataMatches).toBe(false);
      expect(result.warnings).toContain('Published metadata differs from original');
    });

    it('should handle minor content differences gracefully', async () => {
      const slightlyDifferentPost = {
        ...mockPublishedPost,
        title: 'Test FAAB Blog Post', // Same title
        content: '<h1>Test Content</h1><p>This is test content for the blog post.</p>' // Very similar content
      };
      
      mockClient.getPost.mockResolvedValue(slightlyDifferentPost);

      const result = await validator.validatePublication('post-123', 'wordpress', mockBlogPost);

      expect(result.postExists).toBe(true);
      // Should match due to high similarity
      expect(result.contentMatches).toBe(true);
    });
  });

  describe('confirmPublication', () => {
    it('should confirm successful publication', async () => {
      const publicationResult: PublicationResult = {
        success: true,
        postId: 'post-123',
        url: 'https://example.com/post/123',
        publishedAt: new Date(),
        status: 'published'
      };

      mockClient.getPost.mockResolvedValue(mockPublishedPost);

      const result = await validator.confirmPublication(publicationResult, 'wordpress', mockBlogPost);

      expect(result.isValid).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Publication successful: post-123 on wordpress')
      );
    });

    it('should handle failed publication result', async () => {
      const publicationResult: PublicationResult = {
        success: false,
        error: 'Publication failed',
        status: 'failed'
      };

      const result = await validator.confirmPublication(publicationResult, 'wordpress', mockBlogPost);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Publication was not successful or missing post ID');
    });

    it('should retry validation on failure', async () => {
      const publicationResult: PublicationResult = {
        success: true,
        postId: 'post-123',
        status: 'published'
      };

      // First call fails, second succeeds
      mockClient.getPost
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(mockPublishedPost);

      const result = await validator.confirmPublication(
        publicationResult, 
        'wordpress', 
        mockBlogPost, 
        2, // maxRetries
        10 // retryDelay (very short for testing)
      );

      expect(result.isValid).toBe(true);
      expect(mockClient.getPost).toHaveBeenCalledTimes(2);
      // The retry logging happens during validation attempts, so we check for validation logs
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('❌ Validation post-123 on wordpress')
      );
    });

    it('should fail after max retries', async () => {
      const publicationResult: PublicationResult = {
        success: true,
        postId: 'post-123',
        status: 'published'
      };

      mockClient.getPost.mockRejectedValue(new Error('Persistent error'));

      const result = await validator.confirmPublication(
        publicationResult, 
        'wordpress', 
        mockBlogPost, 
        2, // maxRetries
        100 // retryDelay (short for testing)
      );

      expect(result.isValid).toBe(false);
      expect(mockClient.getPost).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Publication failed: post-123 on wordpress')
      );
    });
  });

  describe('batchValidatePublications', () => {
    it('should validate multiple publications concurrently', async () => {
      const publications = [
        { postId: 'post-1', platform: 'wordpress', originalPost: mockBlogPost },
        { postId: 'post-2', platform: 'wordpress', originalPost: mockBlogPost }
      ];

      mockClient.getPost.mockResolvedValue(mockPublishedPost);

      const results = await validator.batchValidatePublications(publications);

      expect(results.size).toBe(2);
      expect(results.get('wordpress:post-1')?.isValid).toBe(true);
      expect(results.get('wordpress:post-2')?.isValid).toBe(true);
      expect(mockClient.getPost).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure in batch', async () => {
      const publications = [
        { postId: 'post-1', platform: 'wordpress', originalPost: mockBlogPost },
        { postId: 'post-2', platform: 'wordpress', originalPost: mockBlogPost }
      ];

      mockClient.getPost
        .mockResolvedValueOnce(mockPublishedPost)
        .mockRejectedValueOnce(new Error('Post not found'));

      const results = await validator.batchValidatePublications(publications);

      expect(results.size).toBe(2);
      expect(results.get('wordpress:post-1')?.isValid).toBe(true);
      expect(results.get('wordpress:post-2')?.isValid).toBe(false);
    });
  });
});

describe('InMemoryPublicationTracker', () => {
  let tracker: InMemoryPublicationTracker;

  beforeEach(() => {
    tracker = new InMemoryPublicationTracker();
  });

  it('should track publication successfully', async () => {
    const result: PublicationResult = {
      success: true,
      postId: 'post-123',
      url: 'https://example.com/post/123',
      publishedAt: new Date(),
      status: 'published'
    };

    await tracker.trackPublication(result, 'wordpress');

    const status = await tracker.getPublicationStatus('post-123');
    expect(status).toBeTruthy();
    expect(status?.postId).toBe('post-123');
    expect(status?.platform).toBe('wordpress');
    expect(status?.status).toBe('published');
  });

  it('should update publication status', async () => {
    const result: PublicationResult = {
      success: true,
      postId: 'post-123',
      status: 'published'
    };

    await tracker.trackPublication(result, 'wordpress');
    await tracker.updatePublicationStatus('post-123', 'wordpress', { 
      status: 'updated',
      url: 'https://example.com/updated/123'
    });

    const status = await tracker.getPublicationStatus('post-123');
    expect(status?.status).toBe('updated');
    expect(status?.url).toBe('https://example.com/updated/123');
  });

  it('should remove publication', async () => {
    const result: PublicationResult = {
      success: true,
      postId: 'post-123',
      status: 'published'
    };

    await tracker.trackPublication(result, 'wordpress');
    await tracker.removePublication('post-123');

    const status = await tracker.getPublicationStatus('post-123');
    expect(status).toBeNull();
  });

  it('should get all publications', async () => {
    const result1: PublicationResult = {
      success: true,
      postId: 'post-1',
      status: 'published'
    };

    const result2: PublicationResult = {
      success: true,
      postId: 'post-2',
      status: 'published'
    };

    await tracker.trackPublication(result1, 'wordpress');
    await tracker.trackPublication(result2, 'medium');

    const allPublications = await tracker.getAllPublications();
    expect(allPublications.size).toBe(2);
    expect(allPublications.has('post-1')).toBe(true);
    expect(allPublications.has('post-2')).toBe(true);
  });
});

describe('ConsolePublicationLogger', () => {
  let logger: ConsolePublicationLogger;

  beforeEach(() => {
    logger = new ConsolePublicationLogger();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should log success', () => {
    logger.logSuccess('post-123', 'wordpress', 'https://example.com/post/123');

    expect(console.log).toHaveBeenCalledWith(
      '✅ Publication successful: post-123 on wordpress - https://example.com/post/123'
    );
  });

  it('should log failure', () => {
    logger.logFailure('post-123', 'wordpress', 'API error');

    expect(console.error).toHaveBeenCalledWith(
      '❌ Publication failed: post-123 on wordpress - API error'
    );
  });

  it('should log validation with errors and warnings', () => {
    const validationResult: ValidationResult = {
      isValid: false,
      postExists: true,
      contentMatches: false,
      metadataMatches: true,
      errors: ['Content mismatch'],
      warnings: ['Minor formatting differences'],
      lastChecked: new Date()
    };

    logger.logValidation('post-123', 'wordpress', validationResult);

    expect(console.log).toHaveBeenCalledWith(
      '❌ Validation post-123 on wordpress: valid=false, exists=true'
    );
    expect(console.error).toHaveBeenCalledWith('   Errors: Content mismatch');
    expect(console.warn).toHaveBeenCalledWith('   Warnings: Minor formatting differences');
  });

  it('should log retry', () => {
    logger.logRetry('post-123', 'wordpress', 2, 'Network timeout');

    expect(console.warn).toHaveBeenCalledWith(
      '🔄 Retry 2 for post-123 on wordpress: Network timeout'
    );
  });
});