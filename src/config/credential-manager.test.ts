// Tests for credential management system

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { CredentialManager, CredentialUtils, getCredentialManager, resetCredentialManager } from './credential-manager';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}));

// Mock Logger
vi.mock('../utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('CredentialManager', () => {
  let credentialManager: CredentialManager;
  let mockFs: any;
  const testCredentialsPath = '/test/credentials.json';

  beforeEach(() => {
    mockFs = fs as any;
    credentialManager = new CredentialManager(testCredentialsPath, 'test-encryption-key');
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetCredentialManager();
  });

  describe('initialize', () => {
    it('should create new credential store if file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);

      await credentialManager.initialize();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testCredentialsPath,
        expect.stringContaining('"credentials":'),
        'utf-8'
      );
    });

    it('should load existing credential store', async () => {
      const existingStore = {
        credentials: {
          TEST_KEY: {
            name: 'TEST_KEY',
            value: 'test-value',
            encrypted: false
          }
        },
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(existingStore));

      await credentialManager.initialize();

      const credential = await credentialManager.getCredential('TEST_KEY');
      expect(credential).toBe('test-value');
    });
  });

  describe('setCredential and getCredential', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);
      await credentialManager.initialize();
    });

    it('should store and retrieve plain text credentials', async () => {
      await credentialManager.setCredential('API_KEY', 'secret-key-123');
      
      const retrieved = await credentialManager.getCredential('API_KEY');
      expect(retrieved).toBe('secret-key-123');
    });

    it('should store and retrieve encrypted credentials', async () => {
      await credentialManager.setCredential('ENCRYPTED_KEY', 'secret-key-456', {
        encrypt: true,
        description: 'Test encrypted key'
      });
      
      const retrieved = await credentialManager.getCredential('ENCRYPTED_KEY');
      expect(retrieved).toBe('secret-key-456');
    });

    it('should handle credential expiration', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

      await credentialManager.setCredential('EXPIRED_KEY', 'expired-value', {
        expiresAt: expiredDate
      });
      
      const retrieved = await credentialManager.getCredential('EXPIRED_KEY');
      expect(retrieved).toBeNull();
    });

    it('should return null for non-existent credentials', async () => {
      const retrieved = await credentialManager.getCredential('NON_EXISTENT');
      expect(retrieved).toBeNull();
    });
  });

  describe('removeCredential', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);
      await credentialManager.initialize();
      await credentialManager.setCredential('TO_REMOVE', 'value-to-remove');
    });

    it('should remove existing credential', async () => {
      const removed = await credentialManager.removeCredential('TO_REMOVE');
      expect(removed).toBe(true);
      
      const retrieved = await credentialManager.getCredential('TO_REMOVE');
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent credential', async () => {
      const removed = await credentialManager.removeCredential('NON_EXISTENT');
      expect(removed).toBe(false);
    });
  });

  describe('listCredentials', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);
      await credentialManager.initialize();
    });

    it('should list all credentials without values', async () => {
      await credentialManager.setCredential('KEY1', 'value1', { description: 'First key' });
      await credentialManager.setCredential('KEY2', 'value2', { encrypt: true });
      
      const list = await credentialManager.listCredentials();
      
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({
        name: 'KEY1',
        encrypted: false,
        description: 'First key',
        expiresAt: undefined
      });
      expect(list[1]).toEqual({
        name: 'KEY2',
        encrypted: true,
        description: undefined,
        expiresAt: undefined
      });
    });
  });

  describe('validateCredentials', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);
      await credentialManager.initialize();
    });

    it('should identify valid, expired, and missing credentials', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await credentialManager.setCredential('VALID_KEY', 'valid-value');
      await credentialManager.setCredential('EXPIRED_KEY', 'expired-value', {
        expiresAt: pastDate
      });
      await credentialManager.setCredential('ESPN_API_KEY', 'espn-key');

      const validation = await credentialManager.validateCredentials();

      expect(validation.valid).toContain('VALID_KEY');
      expect(validation.valid).toContain('ESPN_API_KEY');
      expect(validation.expired).toContain('EXPIRED_KEY');
      expect(validation.missing).toContain('YAHOO_API_KEY');
      expect(validation.missing).toContain('BLOG_API_KEY');
    });
  });

  describe('importFromEnvironment', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);
      await credentialManager.initialize();
    });

    it('should import credentials from environment variables', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        ESPN_API_KEY: 'espn-test-key',
        YAHOO_API_KEY: 'yahoo-test-key',
        BLOG_BASE_URL: 'https://test-blog.com'
      };

      await credentialManager.importFromEnvironment();

      const espnKey = await credentialManager.getCredential('ESPN_API_KEY');
      const yahooKey = await credentialManager.getCredential('YAHOO_API_KEY');
      const blogUrl = await credentialManager.getCredential('BLOG_BASE_URL');

      expect(espnKey).toBe('espn-test-key');
      expect(yahooKey).toBe('yahoo-test-key');
      expect(blogUrl).toBe('https://test-blog.com');

      process.env = originalEnv;
    });
  });

  describe('rotateCredentials', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);
      await credentialManager.initialize();
      await credentialManager.setCredential('ROTATE_KEY', 'old-value');
    });

    it('should mark credentials for rotation', async () => {
      await credentialManager.rotateCredentials(['ROTATE_KEY']);

      const credentials = await credentialManager.listCredentials();
      const rotatedCred = credentials.find(c => c.name === 'ROTATE_KEY');

      expect(rotatedCred?.expiresAt).toBeDefined();
      expect(rotatedCred?.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });
});

describe('CredentialUtils', () => {
  describe('validateApiKey', () => {
    it('should validate ESPN API keys', () => {
      expect(CredentialUtils.validateApiKey('abcd1234567890abcd1234567890abcd', 'ESPN')).toBe(true);
      expect(CredentialUtils.validateApiKey('short', 'ESPN')).toBe(false);
      expect(CredentialUtils.validateApiKey('', 'ESPN')).toBe(false);
    });

    it('should validate Yahoo API keys', () => {
      expect(CredentialUtils.validateApiKey('yahoo-api-key-12345678', 'YAHOO')).toBe(true);
      expect(CredentialUtils.validateApiKey('short', 'YAHOO')).toBe(false);
    });

    it('should use generic validation for unknown platforms', () => {
      expect(CredentialUtils.validateApiKey('generic-key-1234567890', 'UNKNOWN')).toBe(true);
      expect(CredentialUtils.validateApiKey('short', 'UNKNOWN')).toBe(false);
    });
  });

  describe('maskCredential', () => {
    it('should mask long credentials properly', () => {
      const masked = CredentialUtils.maskCredential('abcdefghijklmnopqrstuvwxyz');
      expect(masked).toBe('abcd******************wxyz');
    });

    it('should mask short credentials', () => {
      const masked = CredentialUtils.maskCredential('short');
      expect(masked).toBe('***');
    });

    it('should handle empty credentials', () => {
      const masked = CredentialUtils.maskCredential('');
      expect(masked).toBe('***');
    });
  });

  describe('generateTestApiKey', () => {
    it('should generate API key of specified length', () => {
      const key = CredentialUtils.generateTestApiKey(32);
      expect(key).toHaveLength(32);
      expect(/^[A-Za-z0-9]+$/.test(key)).toBe(true);
    });

    it('should generate different keys on multiple calls', () => {
      const key1 = CredentialUtils.generateTestApiKey();
      const key2 = CredentialUtils.generateTestApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('isCredentialExpiringSoon', () => {
    it('should identify credentials expiring soon', () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 3); // 3 days from now

      expect(CredentialUtils.isCredentialExpiringSoon(soonDate, 7)).toBe(true);
    });

    it('should not flag credentials expiring far in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now

      expect(CredentialUtils.isCredentialExpiringSoon(futureDate, 7)).toBe(false);
    });

    it('should not flag credentials without expiration', () => {
      expect(CredentialUtils.isCredentialExpiringSoon(undefined, 7)).toBe(false);
    });
  });
});

describe('getCredentialManager singleton', () => {
  afterEach(() => {
    resetCredentialManager();
  });

  it('should return the same instance on multiple calls', () => {
    const manager1 = getCredentialManager();
    const manager2 = getCredentialManager();

    expect(manager1).toBe(manager2);
  });

  it('should create new instance after reset', () => {
    const manager1 = getCredentialManager();
    resetCredentialManager();
    const manager2 = getCredentialManager();

    expect(manager1).not.toBe(manager2);
  });
});