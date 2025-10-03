// Health monitoring and system status tracking

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { SystemConfig } from '../models/config';
import { Logger } from '../utils/logger';
// import { ExecutionStatus } from '../models/config';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  services: ServiceHealth[];
  lastExecution?: ExecutionSummary;
  systemMetrics: SystemMetrics;
}

export interface ServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface ExecutionSummary {
  lastRun: Date;
  status: 'success' | 'failed' | 'running';
  duration?: number;
  agentsExecuted?: string[];
  errors?: string[];
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface MonitoringConfig {
  healthCheck: {
    enabled: boolean;
    port: number;
    path: string;
    interval: number; // milliseconds
  };
  metrics: {
    enabled: boolean;
    port: number;
    path: string;
  };
  alerts: {
    enabled: boolean;
    webhookUrl?: string;
    emailRecipients?: string[];
    thresholds: {
      memoryUsage: number; // percentage
      cpuUsage: number; // percentage
      diskUsage: number; // percentage
      errorRate: number; // percentage
    };
  };
}

export class HealthMonitor {
  private config: MonitoringConfig;
  private logger: Logger;
  private healthServer?: any;
  private metricsServer?: any;
  private serviceHealthMap: Map<string, ServiceHealth> = new Map();
  private executionHistory: ExecutionSummary[] = [];
  private startTime: Date;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.logger = new Logger('HealthMonitor');
    this.startTime = new Date();
  }

  /**
   * Start health monitoring services
   */
  async start(): Promise<void> {
    try {
      if (this.config.healthCheck.enabled) {
        await this.startHealthCheckServer();
      }

      if (this.config.metrics.enabled) {
        await this.startMetricsServer();
      }

      // Start periodic health checks
      this.startPeriodicHealthChecks();

      this.logger.info('Health monitoring started');
    } catch (error) {
      this.logger.error('Failed to start health monitoring', error);
      throw error;
    }
  }

  /**
   * Stop health monitoring services
   */
  async stop(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      if (this.healthServer) {
        this.healthServer.close();
      }

      if (this.metricsServer) {
        this.metricsServer.close();
      }

      this.logger.info('Health monitoring stopped');
    } catch (error) {
      this.logger.error('Error stopping health monitoring', error);
    }
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const systemMetrics = await this.getSystemMetrics();
    const services = Array.from(this.serviceHealthMap.values());
    const lastExecution = this.executionHistory[this.executionHistory.length - 1];

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check service health
    const downServices = services.filter(s => s.status === 'down');
    const degradedServices = services.filter(s => s.status === 'degraded');

    if (downServices.length > 0) {
      status = 'unhealthy';
    } else if (degradedServices.length > 0 || systemMetrics.memory.percentage > 90) {
      status = 'degraded';
    }

    const healthStatus: HealthStatus = {
      status,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      systemMetrics
    };
    
    if (lastExecution) {
      healthStatus.lastExecution = lastExecution;
    }
    
    return healthStatus;
  }

  /**
   * Record service health check result
   */
  recordServiceHealth(serviceName: string, health: Omit<ServiceHealth, 'name'>): void {
    this.serviceHealthMap.set(serviceName, {
      name: serviceName,
      ...health
    });

    // Check for alerts
    if (health.status === 'down' && this.config.alerts.enabled) {
      this.sendAlert(`Service ${serviceName} is down: ${health.error || 'Unknown error'}`);
    }
  }

  /**
   * Record execution result
   */
  recordExecution(execution: ExecutionSummary): void {
    this.executionHistory.push(execution);

    // Keep only last 10 executions
    if (this.executionHistory.length > 10) {
      this.executionHistory.shift();
    }

    // Check for execution failures
    if (execution.status === 'failed' && this.config.alerts.enabled) {
      const errorMessage = execution.errors?.join(', ') || 'Unknown error';
      this.sendAlert(`Execution failed: ${errorMessage}`);
    }
  }

  /**
   * Check health of external services
   */
  async checkExternalServices(systemConfig: SystemConfig): Promise<void> {
    const services = [
      ...systemConfig.apis.fantasyPlatforms.filter(p => p.enabled),
      ...systemConfig.apis.newsServices.filter(s => s.enabled),
      systemConfig.apis.sportsData
    ];

    for (const service of services) {
      await this.checkServiceHealth(service.name, service.baseUrl);
    }

    // Check blog platform
    if (systemConfig.blog.baseUrl) {
      await this.checkServiceHealth('Blog Platform', systemConfig.blog.baseUrl);
    }
  }

  private async startHealthCheckServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.healthServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        if (req.url === this.config.healthCheck.path && req.method === 'GET') {
          try {
            const health = await this.getHealthStatus();
            
            res.writeHead(health.status === 'healthy' ? 200 : 503, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            });
            
            res.end(JSON.stringify(health, null, 2));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'unhealthy', 
              error: error instanceof Error ? error.message : 'Unknown error' 
            }));
          }
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      this.healthServer.listen(this.config.healthCheck.port, () => {
        this.logger.info(`Health check server listening on port ${this.config.healthCheck.port}`);
        resolve();
      });

      this.healthServer.on('error', reject);
    });
  }

  private async startMetricsServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.metricsServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        if (req.url === this.config.metrics.path && req.method === 'GET') {
          try {
            const metrics = await this.getPrometheusMetrics();
            
            res.writeHead(200, {
              'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
            });
            
            res.end(metrics);
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error generating metrics');
          }
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      this.metricsServer.listen(this.config.metrics.port, () => {
        this.logger.info(`Metrics server listening on port ${this.config.metrics.port}`);
        resolve();
      });

      this.metricsServer.on('error', reject);
    });
  }

  private startPeriodicHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const systemMetrics = await this.getSystemMetrics();
        
        // Check system resource thresholds
        if (this.config.alerts.enabled) {
          if (systemMetrics.memory.percentage > this.config.alerts.thresholds.memoryUsage) {
            this.sendAlert(`High memory usage: ${systemMetrics.memory.percentage.toFixed(1)}%`);
          }
          
          if (systemMetrics.cpu.usage > this.config.alerts.thresholds.cpuUsage) {
            this.sendAlert(`High CPU usage: ${systemMetrics.cpu.usage.toFixed(1)}%`);
          }
          
          if (systemMetrics.disk.percentage > this.config.alerts.thresholds.diskUsage) {
            this.sendAlert(`High disk usage: ${systemMetrics.disk.percentage.toFixed(1)}%`);
          }
        }
      } catch (error) {
        this.logger.error('Error during periodic health check', error);
      }
    }, this.config.healthCheck.interval);
  }

  private async checkServiceHealth(serviceName: string, baseUrl: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simple HTTP check - in production, you might want more sophisticated checks
      const response = await fetch(baseUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const responseTime = Date.now() - startTime;
      
      this.recordServiceHealth(serviceName, {
        status: response.ok ? 'up' : 'degraded',
        lastCheck: new Date(),
        responseTime,
        details: {
          statusCode: response.status,
          statusText: response.statusText
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.recordServiceHealth(serviceName, {
        status: 'down',
        lastCheck: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    
    // Get system memory (approximation)
    const totalMemory = memUsage.rss * 4; // Rough estimate
    const usedMemory = memUsage.heapUsed;
    
    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000 // Convert to percentage approximation
      },
      disk: {
        used: 0, // Would need additional library to get actual disk usage
        total: 0,
        percentage: 0
      }
    };
  }

  private async getPrometheusMetrics(): Promise<string> {
    const health = await this.getHealthStatus();
    const metrics: string[] = [];

    // System metrics
    metrics.push(`# HELP faab_blog_uptime_seconds Total uptime in seconds`);
    metrics.push(`# TYPE faab_blog_uptime_seconds counter`);
    metrics.push(`faab_blog_uptime_seconds ${Math.floor(health.uptime / 1000)}`);

    metrics.push(`# HELP faab_blog_memory_usage_bytes Memory usage in bytes`);
    metrics.push(`# TYPE faab_blog_memory_usage_bytes gauge`);
    metrics.push(`faab_blog_memory_usage_bytes ${health.systemMetrics.memory.used}`);

    metrics.push(`# HELP faab_blog_memory_usage_percent Memory usage percentage`);
    metrics.push(`# TYPE faab_blog_memory_usage_percent gauge`);
    metrics.push(`faab_blog_memory_usage_percent ${health.systemMetrics.memory.percentage}`);

    // Service health metrics
    metrics.push(`# HELP faab_blog_service_up Service availability (1 = up, 0 = down)`);
    metrics.push(`# TYPE faab_blog_service_up gauge`);
    
    health.services.forEach(service => {
      const value = service.status === 'up' ? 1 : 0;
      metrics.push(`faab_blog_service_up{service="${service.name}"} ${value}`);
      
      if (service.responseTime) {
        metrics.push(`faab_blog_service_response_time_ms{service="${service.name}"} ${service.responseTime}`);
      }
    });

    // Execution metrics
    if (health.lastExecution) {
      metrics.push(`# HELP faab_blog_last_execution_success Last execution success (1 = success, 0 = failed)`);
      metrics.push(`# TYPE faab_blog_last_execution_success gauge`);
      metrics.push(`faab_blog_last_execution_success ${health.lastExecution.status === 'success' ? 1 : 0}`);
      
      if (health.lastExecution.duration) {
        metrics.push(`# HELP faab_blog_last_execution_duration_ms Last execution duration in milliseconds`);
        metrics.push(`# TYPE faab_blog_last_execution_duration_ms gauge`);
        metrics.push(`faab_blog_last_execution_duration_ms ${health.lastExecution.duration}`);
      }
    }

    return metrics.join('\n') + '\n';
  }

  private async sendAlert(message: string): Promise<void> {
    try {
      if (this.config.alerts.webhookUrl) {
        await this.sendWebhookAlert(message);
      }

      // Email alerts would be implemented here if needed
      
      this.logger.warn(`ALERT: ${message}`);
    } catch (error) {
      this.logger.error('Failed to send alert', error);
    }
  }

  private async sendWebhookAlert(message: string): Promise<void> {
    if (!this.config.alerts.webhookUrl) return;

    const payload = {
      text: `🚨 Fantasy Football FAAB Blog Alert`,
      attachments: [{
        color: 'danger',
        fields: [{
          title: 'Alert Message',
          value: message,
          short: false
        }, {
          title: 'Environment',
          value: process.env.NODE_ENV || 'unknown',
          short: true
        }, {
          title: 'Timestamp',
          value: new Date().toISOString(),
          short: true
        }]
      }]
    };

    await fetch(this.config.alerts.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }
}

// Default monitoring configuration
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  healthCheck: {
    enabled: true,
    port: 3001,
    path: '/health',
    interval: 30000 // 30 seconds
  },
  metrics: {
    enabled: process.env.NODE_ENV === 'production',
    port: 3002,
    path: '/metrics'
  },
  alerts: {
    enabled: process.env.NODE_ENV === 'production',
    ...(process.env.WEBHOOK_URL && { webhookUrl: process.env.WEBHOOK_URL }),
    emailRecipients: process.env.ALERT_EMAIL ? [process.env.ALERT_EMAIL] : [],
    thresholds: {
      memoryUsage: 85, // 85%
      cpuUsage: 80,    // 80%
      diskUsage: 90,   // 90%
      errorRate: 10    // 10%
    }
  }
};

// Singleton instance
let healthMonitorInstance: HealthMonitor | null = null;

export function getHealthMonitor(config?: MonitoringConfig): HealthMonitor {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new HealthMonitor(config || DEFAULT_MONITORING_CONFIG);
  }
  return healthMonitorInstance;
}

export function resetHealthMonitor(): void {
  healthMonitorInstance = null;
}