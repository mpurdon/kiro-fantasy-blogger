// Caching utilities for API responses

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxSize: number;    // Maximum number of entries
}

export class CacheManager<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const timeToLive = ttl || this.config.defaultTTL;
    
    // Remove expired entries if cache is at max size
    if (this.cache.size >= this.config.maxSize) {
      this.cleanup();
      
      // If still at max size after cleanup, remove oldest entry
      if (this.cache.size >= this.config.maxSize) {
        const oldestKey = this.getOldestKey();
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + timeToLive
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
  }

  size(): number {
    this.cleanup(); // Clean up expired entries first
    return this.cache.size;
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    this.cleanup();
    
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;
    
    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
    }
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
      ...(oldestTimestamp !== Infinity && { oldestEntry: new Date(oldestTimestamp) }),
      ...(newestTimestamp > 0 && { newestEntry: new Date(newestTimestamp) })
    };
  }

  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }
}

export class CacheManagerFactory {
  private static instances: Map<string, CacheManager> = new Map();

  static create<T>(name: string, config: CacheConfig): CacheManager<T> {
    const manager = new CacheManager<T>(config);
    this.instances.set(name, manager);
    return manager;
  }

  static get<T>(name: string): CacheManager<T> | undefined {
    return this.instances.get(name) as CacheManager<T> | undefined;
  }

  static getOrCreate<T>(name: string, config: CacheConfig): CacheManager<T> {
    const existing = this.get<T>(name);
    if (existing) {
      return existing;
    }
    return this.create<T>(name, config);
  }

  static delete(name: string): boolean {
    const manager = this.instances.get(name);
    if (manager) {
      manager.clear();
      return this.instances.delete(name);
    }
    return false;
  }

  static clearAll(): void {
    for (const manager of this.instances.values()) {
      manager.clear();
    }
    this.instances.clear();
  }
}