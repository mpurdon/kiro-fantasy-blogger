// Secure credential management system for API keys and sensitive configuration

import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';

export interface CredentialConfig {
  name: string;
  value: string;
  encrypted?: boolean;
  expiresAt?: Date;
  description?: string;
}

export interface CredentialStore {
  credentials: Record<string, CredentialConfig>;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CredentialManager {
  private credentialStore: CredentialStore | null = null;
  private credentialsPath: string;
  private logger: Logger;
  private encryptionKey?: string;

  constructor(credentialsPath?: string, encryptionKey?: string) {
    this.credentialsPath = credentialsPath || join(process.cwd(), 'config', 'credentials.json');
    this.encryptionKey = encryptionKey || process.env.CREDENTIAL_ENCRYPTION_KEY || '';
    this.logger = new Logger('CredentialManager');
  }

  /**
   * Initialize credential store
   */
  async initialize(): Promise<void> {
    try {
      await this.loadCredentials();
    } catch (error) {
      this.logger.info('Creating new credential store');
      await this.createCredentialStore();
    }
  }

  /**
   * Get credential value by name
   */
  async getCredential(name: string): Promise<string | null> {
    await this.ensureLoaded();
    
    const credential = this.credentialStore!.credentials[name];
    if (!credential) {
      return null;
    }
    
    // Check if credential has expired
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      this.logger.warn(`Credential ${name} has expired`);
      return null;
    }
    
    // Decrypt if necessary
    if (credential.encrypted && this.encryptionKey) {
      return this.decrypt(credential.value);
    }
    
    return credential.value;
  }

  /**
   * Set credential value
   */
  async setCredential(
    name: string, 
    value: string, 
    options: {
      encrypt?: boolean;
      expiresAt?: Date;
      description?: string;
    } = {}
  ): Promise<void> {
    await this.ensureLoaded();
    
    const encryptedValue = options.encrypt && this.encryptionKey 
      ? this.encrypt(value) 
      : value;
    
    const credential: any = {
      name,
      value: encryptedValue,
      encrypted: options.encrypt || false
    };
    
    if (options.expiresAt) {
      credential.expiresAt = options.expiresAt;
    }
    
    if (options.description) {
      credential.description = options.description;
    }
    
    this.credentialStore!.credentials[name] = credential;
    
    this.credentialStore!.updatedAt = new Date();
    await this.saveCredentials();
    
    this.logger.info(`Credential ${name} updated`);
  }

  /**
   * Remove credential
   */
  async removeCredential(name: string): Promise<boolean> {
    await this.ensureLoaded();
    
    if (this.credentialStore!.credentials[name]) {
      delete this.credentialStore!.credentials[name];
      this.credentialStore!.updatedAt = new Date();
      await this.saveCredentials();
      
      this.logger.info(`Credential ${name} removed`);
      return true;
    }
    
    return false;
  }

  /**
   * List all credential names (not values)
   */
  async listCredentials(): Promise<Array<{
    name: string;
    encrypted: boolean;
    expiresAt?: Date;
    description?: string;
  }>> {
    await this.ensureLoaded();
    
    return Object.values(this.credentialStore!.credentials).map(cred => {
      const result: any = {
        name: cred.name,
        encrypted: cred.encrypted || false
      };
      
      if (cred.expiresAt) {
        result.expiresAt = cred.expiresAt;
      }
      
      if (cred.description) {
        result.description = cred.description;
      }
      
      return result;
    });
  }

  /**
   * Validate all credentials (check for expired ones)
   */
  async validateCredentials(): Promise<{
    valid: string[];
    expired: string[];
    missing: string[];
  }> {
    await this.ensureLoaded();
    
    const now = new Date();
    const valid: string[] = [];
    const expired: string[] = [];
    
    Object.values(this.credentialStore!.credentials).forEach(cred => {
      if (cred.expiresAt && cred.expiresAt < now) {
        expired.push(cred.name);
      } else {
        valid.push(cred.name);
      }
    });
    
    // Check for missing required credentials
    const requiredCredentials = [
      'ESPN_API_KEY',
      'YAHOO_API_KEY',
      'SLEEPER_API_KEY',
      'ESPN_NEWS_API_KEY',
      'SPORTS_DATA_API_KEY',
      'BLOG_API_KEY'
    ];
    
    const missing = requiredCredentials.filter(name => 
      !this.credentialStore!.credentials[name]
    );
    
    return { valid, expired, missing };
  }

  /**
   * Import credentials from environment variables
   */
  async importFromEnvironment(): Promise<void> {
    const envCredentials = [
      { name: 'ESPN_API_KEY', env: 'ESPN_API_KEY', description: 'ESPN Fantasy API Key' },
      { name: 'YAHOO_API_KEY', env: 'YAHOO_API_KEY', description: 'Yahoo Fantasy API Key' },
      { name: 'SLEEPER_API_KEY', env: 'SLEEPER_API_KEY', description: 'Sleeper API Key' },
      { name: 'ESPN_NEWS_API_KEY', env: 'ESPN_NEWS_API_KEY', description: 'ESPN News API Key' },
      { name: 'SPORTS_DATA_API_KEY', env: 'SPORTS_DATA_API_KEY', description: 'Sports Data API Key' },
      { name: 'BLOG_API_KEY', env: 'BLOG_API_KEY', description: 'Blog Platform API Key' },
      { name: 'BLOG_BASE_URL', env: 'BLOG_BASE_URL', description: 'Blog Platform Base URL' },
      { name: 'BLOG_USERNAME', env: 'BLOG_USERNAME', description: 'Blog Platform Username' },
      { name: 'BLOG_ID', env: 'BLOG_ID', description: 'Blog Platform ID' }
    ];
    
    let imported = 0;
    
    for (const { name, env, description } of envCredentials) {
      const value = process.env[env];
      if (value) {
        await this.setCredential(name, value, {
          encrypt: name.includes('API_KEY'),
          description
        });
        imported++;
      }
    }
    
    this.logger.info(`Imported ${imported} credentials from environment variables`);
  }

  /**
   * Export credentials to environment format (for .env file)
   */
  async exportToEnvironmentFormat(): Promise<string> {
    await this.ensureLoaded();
    
    const lines: string[] = [
      '# Fantasy Football FAAB Blog System Credentials',
      '# Generated on ' + new Date().toISOString(),
      ''
    ];
    
    for (const [name, credential] of Object.entries(this.credentialStore!.credentials)) {
      if (credential.description) {
        lines.push(`# ${credential.description}`);
      }
      
      const value = credential.encrypted && this.encryptionKey 
        ? this.decrypt(credential.value)
        : credential.value;
      
      lines.push(`${name}=${value}`);
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Rotate API keys (mark current as expired, prompt for new ones)
   */
  async rotateCredentials(credentialNames: string[]): Promise<void> {
    await this.ensureLoaded();
    
    const rotationDate = new Date();
    rotationDate.setDate(rotationDate.getDate() + 7); // Give 7 days to update
    
    for (const name of credentialNames) {
      const credential = this.credentialStore!.credentials[name];
      if (credential) {
        credential.expiresAt = rotationDate;
        this.logger.warn(`Credential ${name} marked for rotation, expires ${rotationDate.toISOString()}`);
      }
    }
    
    this.credentialStore!.updatedAt = new Date();
    await this.saveCredentials();
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.credentialStore) {
      await this.initialize();
    }
  }

  private async loadCredentials(): Promise<void> {
    try {
      const data = await fs.readFile(this.credentialsPath, 'utf-8');
      this.credentialStore = JSON.parse(data, (key, value) => {
        // Parse dates
        if (key === 'createdAt' || key === 'updatedAt' || key === 'expiresAt') {
          return value ? new Date(value) : undefined;
        }
        return value;
      });
      
      this.logger.debug('Credentials loaded successfully');
    } catch (error) {
      throw new Error(`Failed to load credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async saveCredentials(): Promise<void> {
    try {
      const data = JSON.stringify(this.credentialStore, null, 2);
      await fs.writeFile(this.credentialsPath, data, 'utf-8');
      this.logger.debug('Credentials saved successfully');
    } catch (error) {
      throw new Error(`Failed to save credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createCredentialStore(): Promise<void> {
    this.credentialStore = {
      credentials: {},
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.saveCredentials();
    this.logger.info('New credential store created');
  }

  private encrypt(value: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }
    
    // Simple base64 encoding for demo - in production, use proper encryption
    // like crypto.createCipher with the encryption key
    return Buffer.from(value).toString('base64');
  }

  private decrypt(encryptedValue: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }
    
    // Simple base64 decoding for demo - in production, use proper decryption
    return Buffer.from(encryptedValue, 'base64').toString('utf-8');
  }
}

// Utility functions for credential management
export class CredentialUtils {
  /**
   * Validate API key format
   */
  static validateApiKey(apiKey: string, platform: string): boolean {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return false;
    }
    
    // Platform-specific validation rules
    const validationRules: Record<string, RegExp> = {
      ESPN: /^[A-Za-z0-9]{32,}$/,
      YAHOO: /^[A-Za-z0-9\-_]{20,}$/,
      SLEEPER: /^[A-Za-z0-9]{20,}$/,
      SPORTS_DATA: /^[A-Za-z0-9]{32}$/
    };
    
    const rule = validationRules[platform.toUpperCase()];
    return rule ? rule.test(apiKey) : apiKey.length >= 16;
  }

  /**
   * Mask sensitive credential for logging
   */
  static maskCredential(credential: string): string {
    if (!credential || credential.length < 8) {
      return '***';
    }
    
    const start = credential.substring(0, 4);
    const end = credential.substring(credential.length - 4);
    const middle = '*'.repeat(Math.max(0, credential.length - 8));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Generate secure random API key (for testing)
   */
  static generateTestApiKey(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Check if credential is about to expire
   */
  static isCredentialExpiringSoon(expiresAt?: Date, daysThreshold: number = 7): boolean {
    if (!expiresAt) {
      return false;
    }
    
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);
    
    return expiresAt <= threshold && expiresAt > now;
  }
}

// Singleton instance for global access
let credentialManagerInstance: CredentialManager | null = null;

export function getCredentialManager(credentialsPath?: string, encryptionKey?: string): CredentialManager {
  if (!credentialManagerInstance) {
    credentialManagerInstance = new CredentialManager(credentialsPath, encryptionKey);
  }
  return credentialManagerInstance;
}

export function resetCredentialManager(): void {
  credentialManagerInstance = null;
}