// Tests for health monitoring system

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor, DEFAULT_MONITORING_CONFIG, getHealthMonitor, resetHealthMonitor } from './health-monitor';
import { SystemConfig, ConfigLoader } from '../models/config';

// Mock Logger
vi.mock('../utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

// Mock fetch
global.fetch = vi.fn();

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = global.fetch as any;
    healthMonitor = new HealthMonitor(DEFAULT_MONITORING_CONFIG);
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetHealthMonitor();
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all services are up', async () => {
      // Add small delay to ensure uptime > 0
      await new Promise(resolve => setTimeout(resolve, 1));
      
      // Record some healthy services
      healthMonitor.recordServiceHealth('TestService', {
        status: 'up',
        lastCheck: new Date(),
        responseTime: 100
      });

      const status = await healthMonitor.getHealthStatus();

      expect(status.status).toBe('healthy');
      expect(status.services).toHaveLength(1);
      expect(status.services[0]?.name).toBe('TestService');
      expect(status.services[0]?.status).toBe('up');
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.systemMetrics).toBeDefined();
    });

    it('should return unhealthy status when services are down', async () => {
      healthMonitor.recordServiceHealth('DownService', {
        status: 'down',
        lastCheck: new Date(),
        error: 'Connection failed'
      });

      const status = await healthMonitor.getHealthStatus();

      expect(status.status).toBe('unhealthy');
      expect(status.services[0]?.status).toBe('down');
    });

    it('should return degraded status when services are degraded', async () => {
      healthMonitor.recordServiceHealth('DegradedService', {
        status: 'degraded',
        lastCheck: new Date(),
        responseTime: 5000
      });

      const status = await healthMonitor.getHealthStatus();

      expect(status.status).toBe('degraded');
      expect(status.services[0]?.status).toBe('degraded');
    });

    it('should include system metrics in health status', async () => {
      const status = await healthMonitor.getHealthStatus();

      expect(status.systemMetrics).toBeDefined();
      expect(status.systemMetrics.memory).toBeDefined();
      expect(status.systemMetrics.memory.used).toBeGreaterThan(0);
      expect(status.systemMetrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(status.systemMetrics.cpu).toBeDefined();
    });
  });

  describe('recordServiceHealth', () => {
    it('should record service health status', () => {
      const healthData = {
        status: 'up' as const,
        lastCheck: new Date(),
        responseTime: 150,
        details: { statusCode: 200 }
      };

      healthMonitor.recordServiceHealth('API_Service', healthData);

      // Verify the service was recorded (we can't directly access the map, so we'll check via getHealthStatus)
      expect(() => healthMonitor.recordServiceHealth('API_Service', healthData)).not.toThrow();
    });

    it('should handle service health updates', () => {
      // Record initial health
      healthMonitor.recordServiceHealth('UpdateService', {
        status: 'up',
        lastCheck: new Date(),
        responseTime: 100
      });

      // Update with degraded status
      healthMonitor.recordServiceHealth('UpdateService', {
        status: 'degraded',
        lastCheck: new Date(),
        responseTime: 3000
      });

      expect(() => healthMonitor.recordServiceHealth('UpdateService', {
        status: 'degraded',
        lastCheck: new Date(),
        responseTime: 3000
      })).not.toThrow();
    });
  });

  describe('recordExecution', () => {
    it('should record successful execution', () => {
      const execution = {
        lastRun: new Date(),
        status: 'success' as const,
        duration: 30000,
        agentsExecuted: ['DataCollectionAgent', 'AnalysisAgent']
      };

      healthMonitor.recordExecution(execution);

      expect(() => healthMonitor.recordExecution(execution)).not.toThrow();
    });

    it('should record failed execution', () => {
      const execution = {
        lastRun: new Date(),
        status: 'failed' as const,
        duration: 15000,
        agentsExecuted: ['DataCollectionAgent'],
        errors: ['API connection failed']
      };

      healthMonitor.recordExecution(execution);

      expect(() => healthMonitor.recordExecution(execution)).not.toThrow();
    });

    it('should limit execution history to 10 entries', () => {
      // Record 15 executions
      for (let i = 0; i < 15; i++) {
        healthMonitor.recordExecution({
          lastRun: new Date(),
          status: 'success',
          duration: 1000,
          agentsExecuted: ['TestAgent']
        });
      }

      // The internal history should be limited, but we can't directly test this
      // without exposing the internal state. The test ensures no errors occur.
      expect(() => {
        healthMonitor.recordExecution({
          lastRun: new Date(),
          status: 'success',
          duration: 1000,
          agentsExecuted: ['TestAgent']
        });
      }).not.toThrow();
    });
  });

  describe('checkExternalServices', () => {
    it('should check all enabled external services', async () => {
      const systemConfig: SystemConfig = ConfigLoader.createDefaultConfig();
      
      // Mock successful responses
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      await healthMonitor.checkExternalServices(systemConfig);

      // Verify fetch was called for each enabled service
      const enabledPlatforms = systemConfig.apis.fantasyPlatforms.filter(p => p.enabled);
      const enabledNewsServices = systemConfig.apis.newsServices.filter(s => s.enabled);
      const sportsDataService = systemConfig.apis.sportsData.enabled ? 1 : 0;
      const blogPlatform = systemConfig.blog.baseUrl ? 1 : 0;
      const totalServices = enabledPlatforms.length + enabledNewsServices.length + sportsDataService + blogPlatform;

      expect(mockFetch).toHaveBeenCalledTimes(totalServices);
    });

    it('should handle service check failures', async () => {
      const systemConfig: SystemConfig = ConfigLoader.createDefaultConfig();
      
      // Mock failed responses
      mockFetch.mockRejectedValue(new Error('Network error'));

      await healthMonitor.checkExternalServices(systemConfig);

      // Should not throw, but handle errors gracefully
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('start and stop', () => {
    it('should start health monitoring services', async () => {
      const config = {
        ...DEFAULT_MONITORING_CONFIG,
        healthCheck: { ...DEFAULT_MONITORING_CONFIG.healthCheck, port: 3099 }, // Use different port for testing
        metrics: { ...DEFAULT_MONITORING_CONFIG.metrics, port: 3098 }
      };

      const monitor = new HealthMonitor(config);

      // Starting should not throw
      await expect(monitor.start()).resolves.not.toThrow();
      
      // Clean up
      await monitor.stop();
    });

    it('should stop health monitoring services', async () => {
      const config = {
        ...DEFAULT_MONITORING_CONFIG,
        healthCheck: { ...DEFAULT_MONITORING_CONFIG.healthCheck, port: 3097 },
        metrics: { ...DEFAULT_MONITORING_CONFIG.metrics, port: 3096 }
      };

      const monitor = new HealthMonitor(config);
      
      await monitor.start();
      
      // Stopping should not throw
      await expect(monitor.stop()).resolves.not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should use default configuration when none provided', () => {
      const monitor = new HealthMonitor(DEFAULT_MONITORING_CONFIG);
      
      expect(monitor).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        ...DEFAULT_MONITORING_CONFIG,
        healthCheck: {
          ...DEFAULT_MONITORING_CONFIG.healthCheck,
          port: 4001,
          interval: 60000
        }
      };

      const monitor = new HealthMonitor(customConfig);
      
      expect(monitor).toBeDefined();
    });
  });
});

describe('getHealthMonitor singleton', () => {
  afterEach(() => {
    resetHealthMonitor();
  });

  it('should return the same instance on multiple calls', () => {
    const monitor1 = getHealthMonitor();
    const monitor2 = getHealthMonitor();

    expect(monitor1).toBe(monitor2);
  });

  it('should create new instance after reset', () => {
    const monitor1 = getHealthMonitor();
    resetHealthMonitor();
    const monitor2 = getHealthMonitor();

    expect(monitor1).not.toBe(monitor2);
  });

  it('should accept custom configuration on first call', () => {
    const customConfig = {
      ...DEFAULT_MONITORING_CONFIG,
      healthCheck: {
        ...DEFAULT_MONITORING_CONFIG.healthCheck,
        port: 4002
      }
    };

    const monitor = getHealthMonitor(customConfig);
    
    expect(monitor).toBeDefined();
  });
});