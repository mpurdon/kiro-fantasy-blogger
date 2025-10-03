// Data Collection Agent implementation

import { DataCollectionAgent } from './interfaces';
import { PlayerAdditionData, PlayerSummary, PlayerDataTransformer, PlayerValidator } from '../models/player';
import { ESPNClient } from '../api/fantasy-platforms/espn-client';
import { YahooClient } from '../api/fantasy-platforms/yahoo-client';
import { SleeperClient } from '../api/fantasy-platforms/sleeper-client';
import { PlatformConfig } from '../models/config';
import { PlatformAuthConfig, PlatformAPIError } from '../api/fantasy-platforms/types';

export interface DataCollectionConfig {
  platforms: {
    espn: { config: PlatformConfig; auth?: PlatformAuthConfig; enabled: boolean };
    yahoo: { config: PlatformConfig; auth?: PlatformAuthConfig; enabled: boolean };
    sleeper: { config: PlatformConfig; auth?: PlatformAuthConfig; enabled: boolean };
  };
  caching: {
    enabled: boolean;
    ttl: number; // Time to live in milliseconds
    maxSize: number; // Maximum number of cached entries
    persistToDisk: boolean; // Whether to persist cache to disk
  };
  fallback: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number; // Delay between retries in milliseconds
    exponentialBackoff: boolean; // Whether to use exponential backoff
    fallbackToCache: boolean; // Whether to use stale cache data as fallback
    minimumSuccessfulPlatforms: number; // Minimum platforms needed for success
  };
  monitoring: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metricsCollection: boolean;
  };
}

export interface DataCollectionMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  platformStats: Record<string, {
    requests: number;
    successes: number;
    failures: number;
    averageResponseTime: number;
  }>;
}

export class DataCollectionAgentImpl implements DataCollectionAgent {
  private espnClient?: ESPNClient;
  private yahooClient?: YahooClient;
  private sleeperClient?: SleeperClient;
  private config: DataCollectionConfig;
  private cache: Map<string, { 
    data: PlayerAdditionData[]; 
    timestamp: Date; 
    expiresAt: Date;
    accessCount: number;
  }> = new Map();
  private metrics: DataCollectionMetrics;
  private logger: Console;

  constructor(config: DataCollectionConfig) {
    this.config = config;
    this.logger = console;
    
    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      platformStats: {
        ESPN: { requests: 0, successes: 0, failures: 0, averageResponseTime: 0 },
        Yahoo: { requests: 0, successes: 0, failures: 0, averageResponseTime: 0 },
        Sleeper: { requests: 0, successes: 0, failures: 0, averageResponseTime: 0 }
      }
    };
    
    // Initialize platform clients only if enabled
    if (config.platforms.espn.enabled) {
      this.espnClient = new ESPNClient(
        config.platforms.espn.config,
        config.platforms.espn.auth
      );
    }
    
    if (config.platforms.yahoo.enabled) {
      this.yahooClient = new YahooClient(
        config.platforms.yahoo.config,
        config.platforms.yahoo.auth
      );
    }
    
    if (config.platforms.sleeper.enabled) {
      this.sleeperClient = new SleeperClient(
        config.platforms.sleeper.config,
        config.platforms.sleeper.auth
      );
    }
    
    // Set up cache cleanup interval
    if (this.config.caching.enabled) {
      setInterval(() => this.cleanupExpiredCache(), 300000); // Clean every 5 minutes
    }
  }

  public async getMostAddedPlayers(): Promise<PlayerAdditionData[]> {
    const startTime = Date.now();
    const cacheKey = 'most_added_players';
    
    try {
      this.metrics.totalRequests++;
      
      // Check cache first if enabled
      if (this.config.caching.enabled) {
        const cached = this.getCachedData(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          this.log('info', 'Returning cached player addition data');
          return cached;
        }
        this.metrics.cacheMisses++;
      }

      this.log('info', 'Fetching most added players from all platforms...');
      
      const allPlayerData: PlayerAdditionData[] = [];
      const platformResults: { platform: string; success: boolean; count: number; error?: string; responseTime: number }[] = [];

      // Prepare platform fetch operations
      const fetchOperations: Promise<{ platform: string; data: PlayerAdditionData[]; responseTime: number }>[] = [];
      
      if (this.config.platforms.espn.enabled && this.espnClient) {
        fetchOperations.push(this.fetchWithMetrics('ESPN', () => this.fetchFromESPN()));
      }
      
      if (this.config.platforms.yahoo.enabled && this.yahooClient) {
        fetchOperations.push(this.fetchWithMetrics('Yahoo', () => this.fetchFromYahoo()));
      }
      
      if (this.config.platforms.sleeper.enabled && this.sleeperClient) {
        fetchOperations.push(this.fetchWithMetrics('Sleeper', () => this.fetchFromSleeper()));
      }

      // Fetch data from each platform with error handling
      const results = await Promise.allSettled(fetchOperations);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { platform, data, responseTime } = result.value;
          allPlayerData.push(...data);
          platformResults.push({
            platform,
            success: true,
            count: data.length,
            responseTime
          });
          
          // Update platform metrics
          this.updatePlatformMetrics(platform, true, responseTime);
          this.log('info', `✓ Successfully fetched ${data.length} players from ${platform} (${responseTime}ms)`);
        } else {
          // Try to extract platform name from error or use index
          const platforms = ['ESPN', 'Yahoo', 'Sleeper'];
          const platform = platforms[index] || 'Unknown';
          
          platformResults.push({
            platform,
            success: false,
            count: 0,
            error: result.reason?.message || 'Unknown error',
            responseTime: 0
          });
          
          this.updatePlatformMetrics(platform, false, 0);
          this.log('warn', `✗ Failed to fetch from ${platform}: ${result.reason?.message}`);
        }
      });

      // Check if we have minimum required successful platforms
      const successfulPlatforms = platformResults.filter(r => r.success).length;
      const totalPlayers = allPlayerData.length;
      
      this.log('info', `Data collection summary: ${successfulPlatforms}/${fetchOperations.length} platforms successful, ${totalPlayers} total players`);
      
      if (successfulPlatforms < this.config.fallback.minimumSuccessfulPlatforms) {
        // Try fallback to cached data if enabled
        if (this.config.fallback.fallbackToCache && this.config.caching.enabled) {
          const staleCache = this.getStaleCache(cacheKey);
          if (staleCache) {
            this.log('warn', 'Using stale cached data as fallback');
            return staleCache;
          }
        }
        
        throw new Error(`Insufficient successful platforms: ${successfulPlatforms}/${this.config.fallback.minimumSuccessfulPlatforms} required`);
      }
      
      if (totalPlayers === 0) {
        throw new Error('No player data retrieved from any platform');
      }

      // Normalize and deduplicate player data
      const normalizedData = this.normalizePlayerData(allPlayerData);
      const deduplicatedData = this.deduplicatePlayerData(normalizedData);
      
      this.log('info', `After normalization and deduplication: ${deduplicatedData.length} unique players`);

      // Cache the results if caching is enabled
      if (this.config.caching.enabled) {
        this.setCachedData(cacheKey, deduplicatedData);
      }

      // Update success metrics
      this.metrics.successfulRequests++;
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      return deduplicatedData;
      
    } catch (error) {
      this.metrics.failedRequests++;
      this.log('error', `Data collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  public filterToTopTen(players: PlayerAdditionData[]): PlayerSummary[] {
    console.log(`Filtering ${players.length} players to top 10...`);
    
    // Convert to PlayerSummary format and aggregate by player
    const summaries = PlayerDataTransformer.playerAdditionDataToSummary(players);
    
    // Calculate addition percentages (using total leagues as approximation)
    const totalLeagues = this.estimateTotalLeagues(players);
    const summariesWithPercentages = PlayerDataTransformer.calculateAdditionPercentages(summaries, totalLeagues);
    
    // Apply ranking algorithm based on addition frequency
    const rankedSummaries = this.applyRankingAlgorithm(summariesWithPercentages);
    
    // Filter to top 10 and collect metadata
    const topTen = this.selectTopTenWithMetadata(rankedSummaries);
    
    // Validate the results
    const validSummaries = topTen.filter(summary => {
      const isValid = PlayerValidator.validatePlayerSummary(summary);
      if (!isValid) {
        console.warn(`Invalid player summary filtered out: ${summary.name}`);
      }
      return isValid;
    });
    
    console.log(`Top 10 most added players:`);
    validSummaries.forEach((player, index) => {
      console.log(`${index + 1}. ${player.name} (${player.position}, ${player.team}) - ${player.additionCount} adds (${player.additionPercentage}%) [${player.platforms.join(', ')}]`);
    });
    
    // Log ranking statistics
    this.logRankingStatistics(validSummaries, summariesWithPercentages);
    
    return validSummaries;
  }

  private applyRankingAlgorithm(summaries: PlayerSummary[]): PlayerSummary[] {
    // Enhanced ranking algorithm that considers multiple factors
    return summaries
      .map(summary => ({
        ...summary,
        // Calculate composite score based on:
        // 1. Raw addition count (70% weight)
        // 2. Addition percentage (20% weight) 
        // 3. Platform diversity bonus (10% weight)
        compositeScore: this.calculateCompositeScore(summary)
      }))
      .sort((a, b) => (b as any).compositeScore - (a as any).compositeScore);
  }

  private calculateCompositeScore(summary: PlayerSummary): number {
    const additionWeight = 0.7;
    const percentageWeight = 0.2;
    const diversityWeight = 0.1;
    
    // Normalize addition count (0-100 scale)
    const maxAdditions = 1000; // Reasonable max for normalization
    const normalizedAdditions = Math.min(summary.additionCount / maxAdditions * 100, 100);
    
    // Addition percentage is already 0-100
    const normalizedPercentage = summary.additionPercentage;
    
    // Platform diversity bonus (more platforms = higher score)
    const maxPlatforms = 3; // ESPN, Yahoo, Sleeper
    const diversityBonus = (summary.platforms.length / maxPlatforms) * 100;
    
    return (
      normalizedAdditions * additionWeight +
      normalizedPercentage * percentageWeight +
      diversityBonus * diversityWeight
    );
  }

  private selectTopTenWithMetadata(rankedSummaries: PlayerSummary[]): PlayerSummary[] {
    const topTen = rankedSummaries.slice(0, 10);
    
    // Collect additional metadata for each selected player
    return topTen.map((summary, index) => ({
      ...summary,
      // Add ranking metadata
      rank: index + 1,
      // Calculate relative popularity compared to #1
      relativePopularity: topTen[0] ? 
        Math.round((summary.additionCount / topTen[0].additionCount) * 100) : 100,
      // Determine trending status
      trendingStatus: this.determineTrendingStatus(summary, index),
      // Platform coverage score
      platformCoverage: (summary.platforms.length / 3) * 100
    }));
  }

  private determineTrendingStatus(summary: PlayerSummary, rank: number): 'hot' | 'rising' | 'steady' {
    // Simple heuristic based on rank and platform coverage
    if (rank <= 3 && summary.platforms.length >= 2) {
      return 'hot';
    } else if (rank <= 7 && summary.additionPercentage > 5) {
      return 'rising';
    } else {
      return 'steady';
    }
  }

  private logRankingStatistics(topTen: PlayerSummary[], allSummaries: PlayerSummary[]): void {
    const stats = {
      totalPlayersConsidered: allSummaries.length,
      averageAdditions: Math.round(
        allSummaries.reduce((sum, p) => sum + p.additionCount, 0) / allSummaries.length
      ),
      topTenAverageAdditions: Math.round(
        topTen.reduce((sum, p) => sum + p.additionCount, 0) / topTen.length
      ),
      positionBreakdown: this.getPositionBreakdown(topTen),
      platformCoverage: this.getPlatformCoverage(topTen)
    };
    
    console.log('Ranking Statistics:');
    console.log(`- Total players considered: ${stats.totalPlayersConsidered}`);
    console.log(`- Average additions (all): ${stats.averageAdditions}`);
    console.log(`- Average additions (top 10): ${stats.topTenAverageAdditions}`);
    console.log(`- Position breakdown: ${JSON.stringify(stats.positionBreakdown)}`);
    console.log(`- Platform coverage: ${JSON.stringify(stats.platformCoverage)}`);
  }

  private getPositionBreakdown(players: PlayerSummary[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    players.forEach(player => {
      breakdown[player.position] = (breakdown[player.position] || 0) + 1;
    });
    
    return breakdown;
  }

  private getPlatformCoverage(players: PlayerSummary[]): Record<string, number> {
    const coverage: Record<string, number> = {
      'ESPN': 0,
      'Yahoo': 0,
      'Sleeper': 0,
      'Multi-platform': 0
    };
    
    players.forEach(player => {
      player.platforms.forEach(platform => {
        if (platform in coverage) {
          coverage[platform] = (coverage[platform] || 0) + 1;
        }
      });
      
      if (player.platforms.length > 1) {
        coverage['Multi-platform'] = (coverage['Multi-platform'] || 0) + 1;
      }
    });
    
    return coverage;
  }

  private async fetchFromESPN(): Promise<PlayerAdditionData[]> {
    if (!this.espnClient) {
      throw new PlatformAPIError('ESPN client not initialized', 'ESPN');
    }
    
    try {
      await this.espnClient.authenticate();
      const players = await this.retryWithFallback(
        () => this.espnClient!.getMostAddedPlayers(),
        'ESPN'
      );
      return players || [];
    } catch (error) {
      console.error('ESPN fetch failed:', error);
      throw new PlatformAPIError(
        `ESPN data collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ESPN'
      );
    }
  }

  private async fetchFromYahoo(): Promise<PlayerAdditionData[]> {
    if (!this.yahooClient) {
      throw new PlatformAPIError('Yahoo client not initialized', 'Yahoo');
    }
    
    try {
      await this.yahooClient.authenticate();
      const players = await this.retryWithFallback(
        () => this.yahooClient!.getMostAddedPlayers(),
        'Yahoo'
      );
      return players || [];
    } catch (error) {
      console.error('Yahoo fetch failed:', error);
      throw new PlatformAPIError(
        `Yahoo data collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Yahoo'
      );
    }
  }

  private async fetchFromSleeper(): Promise<PlayerAdditionData[]> {
    if (!this.sleeperClient) {
      throw new PlatformAPIError('Sleeper client not initialized', 'Sleeper');
    }
    
    try {
      await this.sleeperClient.authenticate();
      const players = await this.retryWithFallback(
        () => this.sleeperClient!.getMostAddedPlayers(),
        'Sleeper'
      );
      return players || [];
    } catch (error) {
      console.error('Sleeper fetch failed:', error);
      throw new PlatformAPIError(
        `Sleeper data collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Sleeper'
      );
    }
  }

  private async fetchWithMetrics(
    platform: string, 
    operation: () => Promise<PlayerAdditionData[]>
  ): Promise<{ platform: string; data: PlayerAdditionData[]; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      const data = await this.retryWithFallback(operation, platform);
      const responseTime = Date.now() - startTime;
      
      return { platform, data, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw { platform, error, responseTime };
    }
  }

  private async retryWithFallback<T>(
    operation: () => Promise<T>,
    platformName: string
  ): Promise<T> {
    if (!this.config.fallback.enabled) {
      return await operation();
    }

    let lastError: Error | undefined;
    let delay = this.config.fallback.retryDelay;
    
    for (let attempt = 1; attempt <= this.config.fallback.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.config.fallback.maxRetries) {
          this.log('warn', `${platformName} attempt ${attempt} failed, retrying in ${delay}ms...`);
          await this.delay(delay);
          
          // Apply exponential backoff if enabled
          if (this.config.fallback.exponentialBackoff) {
            delay *= 2;
          }
        }
      }
    }
    
    throw lastError || new Error(`All ${this.config.fallback.maxRetries} attempts failed for ${platformName}`);
  }

  private normalizePlayerData(players: PlayerAdditionData[]): PlayerAdditionData[] {
    return players.map(player => ({
      ...player,
      name: PlayerDataTransformer.normalizePlayerName(player.name),
      team: PlayerDataTransformer.normalizeTeamName(player.team),
      position: this.normalizePosition(player.position)
    }));
  }

  private normalizePosition(position: string): string {
    const positionMap: Record<string, string> = {
      'DEF': 'DST',
      'D/ST': 'DST',
      'DEFENSE': 'DST'
    };
    
    const normalized = position.toUpperCase();
    return positionMap[normalized] || normalized;
  }

  private deduplicatePlayerData(players: PlayerAdditionData[]): PlayerAdditionData[] {
    const playerMap = new Map<string, PlayerAdditionData>();
    
    players.forEach(player => {
      // Create a unique key based on normalized name and team
      const key = `${player.name.toLowerCase()}_${player.team.toLowerCase()}_${player.position}`;
      
      const existing = playerMap.get(key);
      if (existing) {
        // Merge data from multiple platforms
        existing.additionCount += player.additionCount;
        // Keep the most recent timestamp
        if (player.timestamp > existing.timestamp) {
          existing.timestamp = player.timestamp;
        }
      } else {
        playerMap.set(key, { ...player });
      }
    });
    
    return Array.from(playerMap.values());
  }

  private estimateTotalLeagues(players: PlayerAdditionData[]): number {
    // Estimate total leagues based on the highest addition count
    // This is a rough approximation since we don't have exact league counts
    const maxAdditions = Math.max(...players.map(p => p.additionCount));
    
    // Assume the most added player represents about 10-20% of all leagues
    const estimatedTotal = Math.max(1000, maxAdditions * 5); // Minimum 1000 leagues
    
    return estimatedTotal;
  }

  private getCachedData(key: string): PlayerAdditionData[] | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }
    
    const now = new Date();
    
    // Check if cache entry has expired
    if (now > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access count for LRU tracking
    cached.accessCount++;
    
    return cached.data;
  }

  private getStaleCache(key: string): PlayerAdditionData[] | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }
    
    this.log('warn', `Using stale cache data (age: ${Date.now() - cached.timestamp.getTime()}ms)`);
    return cached.data;
  }

  private setCachedData(key: string, data: PlayerAdditionData[]): void {
    // Check cache size limit
    if (this.cache.size >= this.config.caching.maxSize) {
      this.evictLeastRecentlyUsed();
    }
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.caching.ttl);
    
    this.cache.set(key, {
      data: [...data], // Create a copy to avoid mutations
      timestamp: now,
      expiresAt,
      accessCount: 1
    });
  }

  private evictLeastRecentlyUsed(): void {
    let lruKey: string | null = null;
    let minAccessCount = Infinity;
    let oldestTimestamp = new Date();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < minAccessCount || 
          (entry.accessCount === minAccessCount && entry.timestamp < oldestTimestamp)) {
        lruKey = key;
        minAccessCount = entry.accessCount;
        oldestTimestamp = entry.timestamp;
      }
    }
    
    if (lruKey) {
      this.cache.delete(lruKey);
      this.log('debug', `Evicted LRU cache entry: ${lruKey}`);
    }
  }

  private cleanupExpiredCache(): void {
    const now = new Date();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.log('debug', `Cleaned up ${expiredCount} expired cache entries`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (!this.config.monitoring.enabled) {
      return;
    }
    
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = logLevels[this.config.monitoring.logLevel];
    const messageLevel = logLevels[level];
    
    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [DataCollectionAgent] [${level.toUpperCase()}] ${message}`;
      
      switch (level) {
        case 'debug':
        case 'info':
          this.logger.log(logMessage, ...args);
          break;
        case 'warn':
          this.logger.warn(logMessage, ...args);
          break;
        case 'error':
          this.logger.error(logMessage, ...args);
          break;
      }
    }
  }

  private updatePlatformMetrics(platform: string, success: boolean, responseTime: number): void {
    if (!this.config.monitoring.metricsCollection) {
      return;
    }
    
    const stats = this.metrics.platformStats[platform];
    if (stats) {
      stats.requests++;
      
      if (success) {
        stats.successes++;
        // Update average response time
        const totalTime = stats.averageResponseTime * (stats.successes - 1) + responseTime;
        stats.averageResponseTime = Math.round(totalTime / stats.successes);
      } else {
        stats.failures++;
      }
    }
  }

  private updateAverageResponseTime(responseTime: number): void {
    if (!this.config.monitoring.metricsCollection) {
      return;
    }
    
    const totalTime = this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + responseTime;
    this.metrics.averageResponseTime = Math.round(totalTime / this.metrics.successfulRequests);
  }

  // Public methods for monitoring and debugging
  public clearCache(): void {
    this.cache.clear();
    this.log('info', 'Data collection cache cleared');
  }

  public getCacheStats(): { 
    size: number; 
    keys: string[]; 
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; size: number; age: number; accessCount: number }>;
  } {
    const now = new Date();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: JSON.stringify(entry.data).length,
      age: now.getTime() - entry.timestamp.getTime(),
      accessCount: entry.accessCount
    }));
    
    const hitRate = this.metrics.totalRequests > 0 ? 
      (this.metrics.cacheHits / this.metrics.totalRequests) * 100 : 0;
    
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      maxSize: this.config.caching.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      entries
    };
  }

  public getMetrics(): DataCollectionMetrics {
    return { ...this.metrics };
  }

  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      platformStats: {
        ESPN: { requests: 0, successes: 0, failures: 0, averageResponseTime: 0 },
        Yahoo: { requests: 0, successes: 0, failures: 0, averageResponseTime: 0 },
        Sleeper: { requests: 0, successes: 0, failures: 0, averageResponseTime: 0 }
      }
    };
    this.log('info', 'Metrics reset');
  }

  public async testPlatformConnections(): Promise<{
    espn: boolean;
    yahoo: boolean;
    sleeper: boolean;
  }> {
    const results = {
      espn: false,
      yahoo: false,
      sleeper: false
    };

    // Test ESPN connection
    if (this.espnClient) {
      try {
        await this.espnClient.authenticate();
        results.espn = this.espnClient.isAuthenticated() || false;
      } catch (error) {
        this.log('warn', 'ESPN connection test failed:', error);
        results.espn = false;
      }
    } else {
      results.espn = false;
    }

    // Test Yahoo connection
    if (this.yahooClient) {
      try {
        await this.yahooClient.authenticate();
        results.yahoo = this.yahooClient.isAuthenticated() || false;
      } catch (error) {
        this.log('warn', 'Yahoo connection test failed:', error);
        results.yahoo = false;
      }
    } else {
      results.yahoo = false;
    }

    // Test Sleeper connection
    if (this.sleeperClient) {
      try {
        await this.sleeperClient.authenticate();
        results.sleeper = this.sleeperClient.isAuthenticated() || false;
      } catch (error) {
        this.log('warn', 'Sleeper connection test failed:', error);
        results.sleeper = false;
      }
    } else {
      results.sleeper = false;
    }

    return results;
  }
}