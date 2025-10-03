// Data Collection Agent tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataCollectionAgentImpl, DataCollectionConfig } from './data-collection-agent';
import { PlayerAdditionData } from '../models/player';
import { PlatformConfig } from '../models/config';

// Mock the platform clients
vi.mock('../api/fantasy-platforms/espn-client');
vi.mock('../api/fantasy-platforms/yahoo-client');
vi.mock('../api/fantasy-platforms/sleeper-client');

describe('DataCollectionAgent', () => {
  let agent: DataCollectionAgentImpl;
  let config: DataCollectionConfig;

  beforeEach(() => {
    config = {
      platforms: {
        espn: {
          enabled: true,
          config: {
            name: 'ESPN',
            baseUrl: 'https://fantasy.espn.com/apis/v3',
            rateLimit: { requestsPerSecond: 10, burstLimit: 50 }
          } as PlatformConfig
        },
        yahoo: {
          enabled: true,
          config: {
            name: 'Yahoo',
            baseUrl: 'https://fantasysports.yahooapis.com',
            rateLimit: { requestsPerSecond: 5, burstLimit: 25 }
          } as PlatformConfig
        },
        sleeper: {
          enabled: true,
          config: {
            name: 'Sleeper',
            baseUrl: 'https://api.sleeper.app/v1',
            rateLimit: { requestsPerSecond: 20, burstLimit: 100 }
          } as PlatformConfig
        }
      },
      caching: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 100,
        persistToDisk: false
      },
      fallback: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true,
        fallbackToCache: true,
        minimumSuccessfulPlatforms: 1
      },
      monitoring: {
        enabled: true,
        logLevel: 'info',
        metricsCollection: true
      }
    };

    agent = new DataCollectionAgentImpl(config);
  });

  describe('filterToTopTen', () => {
    it('should filter and rank players correctly', () => {
      const mockPlayerData: PlayerAdditionData[] = [
        {
          playerId: '1',
          name: 'Player One',
          position: 'RB',
          team: 'TB',
          additionCount: 100,
          platform: 'ESPN',
          timestamp: new Date()
        },
        {
          playerId: '2',
          name: 'Player Two',
          position: 'WR',
          team: 'KC',
          additionCount: 80,
          platform: 'Yahoo',
          timestamp: new Date()
        },
        {
          playerId: '1',
          name: 'Player One',
          position: 'RB',
          team: 'TB',
          additionCount: 50,
          platform: 'Sleeper',
          timestamp: new Date()
        },
        // Add more test data to ensure we have more than 10 players
        ...Array.from({ length: 15 }, (_, i) => ({
          playerId: `${i + 3}`,
          name: `Player ${i + 3}`,
          position: 'WR' as const,
          team: 'NYG',
          additionCount: 10 + i,
          platform: 'ESPN' as const,
          timestamp: new Date()
        }))
      ];

      const result = agent.filterToTopTen(mockPlayerData);

      // Should return exactly 10 players
      expect(result).toHaveLength(10);

      // Should be sorted by addition count (Player One should be first with 150 total)
      expect(result[0]?.name).toBe('Player One');
      expect(result[0]?.additionCount).toBe(150); // 100 + 50 from aggregation
      expect(result[0]?.platforms).toEqual(['ESPN', 'Sleeper']);

      // All results should have required properties
      result.forEach(player => {
        expect(player).toHaveProperty('playerId');
        expect(player).toHaveProperty('name');
        expect(player).toHaveProperty('position');
        expect(player).toHaveProperty('team');
        expect(player).toHaveProperty('additionCount');
        expect(player).toHaveProperty('additionPercentage');
        expect(player).toHaveProperty('platforms');
        expect(Array.isArray(player.platforms)).toBe(true);
      });
    });

    it('should handle empty input gracefully', () => {
      const result = agent.filterToTopTen([]);
      expect(result).toHaveLength(0);
    });

    it('should handle fewer than 10 players', () => {
      const mockPlayerData: PlayerAdditionData[] = [
        {
          playerId: '1',
          name: 'Player One',
          position: 'RB',
          team: 'TB',
          additionCount: 100,
          platform: 'ESPN',
          timestamp: new Date()
        },
        {
          playerId: '2',
          name: 'Player Two',
          position: 'WR',
          team: 'KC',
          additionCount: 80,
          platform: 'Yahoo',
          timestamp: new Date()
        }
      ];

      const result = agent.filterToTopTen(mockPlayerData);
      expect(result).toHaveLength(2);
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = agent.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('entries');
      expect(Array.isArray(stats.keys)).toBe(true);
      expect(Array.isArray(stats.entries)).toBe(true);
    });

    it('should clear cache', () => {
      agent.clearCache();
      const stats = agent.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('metrics', () => {
    it('should provide metrics data', () => {
      const metrics = agent.getMetrics();
      
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');
      expect(metrics).toHaveProperty('failedRequests');
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('cacheMisses');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('platformStats');
      
      expect(metrics.platformStats).toHaveProperty('ESPN');
      expect(metrics.platformStats).toHaveProperty('Yahoo');
      expect(metrics.platformStats).toHaveProperty('Sleeper');
    });

    it('should reset metrics', () => {
      agent.resetMetrics();
      const metrics = agent.getMetrics();
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe('platform connections', () => {
    it('should test platform connections', async () => {
      const connections = await agent.testPlatformConnections();
      
      console.log('Connections result:', connections);
      
      expect(connections).toHaveProperty('espn');
      expect(connections).toHaveProperty('yahoo');
      expect(connections).toHaveProperty('sleeper');
      
      // The connections should be boolean values (false for mocked/uninitialized clients)
      expect(connections.espn).toBe(false);
      expect(connections.yahoo).toBe(false);
      expect(connections.sleeper).toBe(false);
    });
  });
});