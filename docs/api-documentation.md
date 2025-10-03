# Fantasy Football FAAB Blog System - API Documentation

## Overview

The Fantasy Football FAAB Blog System is an automated AI agentic system that generates weekly fantasy football FAAB (Free Agent Acquisition Budget) acquisition blog posts. This document provides comprehensive API documentation and usage examples.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Installation and Setup](#installation-and-setup)
3. [Configuration](#configuration)
4. [CLI Commands](#cli-commands)
5. [Programmatic API](#programmatic-api)
6. [Agent APIs](#agent-apis)
7. [Health Monitoring](#health-monitoring)
8. [Error Handling](#error-handling)
9. [Examples](#examples)

## System Architecture

The system consists of several key components:

- **Orchestrator Service**: Manages the overall workflow execution
- **Data Collection Agent**: Retrieves most added players from fantasy platforms
- **Research Agent**: Gathers news and statistical data for players
- **Analysis Agent**: Evaluates players and generates recommendations
- **Writer Agent**: Creates formatted blog posts
- **Publisher Agent**: Publishes content to blog platforms

## Installation and Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- API keys for fantasy platforms and news services

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd fantasy-football-faab-blog

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env

# Build the application
npm run build
```

### Environment Setup

1. **Fantasy Platform API Keys**:
   - ESPN: Register at ESPN Developer Portal
   - Yahoo: Create app at Yahoo Developer Network
   - Sleeper: No API key required for public data

2. **News Service API Keys**:
   - ESPN News: Use ESPN Developer Portal
   - Sports Data API: Register at SportsData.io

3. **Blog Platform Setup**:
   - WordPress: Generate application password
   - Medium: Create integration token

## Configuration

### Configuration Files

The system supports environment-specific configuration files:

- `config/development.json` - Development environment
- `config/production.json` - Production environment  
- `config/test.json` - Testing environment

### Configuration Schema

```typescript
interface SystemConfig {
  schedule: {
    dayOfWeek: number; // 0-6, Sunday = 0
    hour: number; // 0-23
    timezone: string;
  };
  apis: {
    fantasyPlatforms: PlatformConfig[];
    newsServices: NewsServiceConfig[];
    sportsData: SportsDataConfig;
  };
  blog: BlogPlatformConfig;
  agents: AgentConfig[];
}
```

### Environment Variables

Environment variables override configuration file values:

```bash
# Schedule overrides
SCHEDULE_DAY_OF_WEEK=2
SCHEDULE_HOUR=6
SCHEDULE_TIMEZONE=America/New_York

# API key overrides
ESPN_API_KEY=your_key_here
YAHOO_API_KEY=your_key_here
BLOG_API_KEY=your_key_here
```

## CLI Commands

### Basic Commands

```bash
# Start the system with scheduled execution
faab-blog start

# Run a single blog post generation manually
faab-blog run

# Check system status
faab-blog status

# View execution history
faab-blog history --limit 10

# Show current configuration
faab-blog config

# Test system connectivity
faab-blog test
```

### Development Commands

```bash
# Run in development mode
npm run dev

# Run CLI in development
npm run cli start

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## Programmatic API

### Application Class

```typescript
import { FantasyFootballFAABBlogApp } from 'fantasy-football-faab-blog';

const app = new FantasyFootballFAABBlogApp();

// Start the application
await app.start();

// Execute manually
const result = await app.executeManually();

// Get status
const status = app.getStatus();

// Stop the application
await app.stop();
```

### Container API

```typescript
import { initializeContainer, getContainer } from 'fantasy-football-faab-blog';

// Initialize dependency injection container
const services = await initializeContainer();

// Get specific services
const container = getContainer();
const orchestrator = container.getService('orchestrator');
const healthMonitor = container.getService('healthMonitor');
```

### Orchestrator Service API

```typescript
interface OrchestratorService {
  // Execute the complete workflow
  executeWeeklyProcess(): Promise<ExecutionResult>;
  
  // Manual execution
  startManualExecution(): Promise<ExecutionResult>;
  
  // Control execution
  stopExecution(): Promise<void>;
  
  // Scheduling
  scheduleWeeklyExecution(): void;
  stopScheduledExecution(): void;
  
  // Status and monitoring
  getExecutionStatus(): ExecutionStatus;
  getExecutionHistory(limit?: number): Promise<ExecutionResult[]>;
  getExecutionMetrics(): Promise<ExecutionMetrics>;
  
  // Utility methods
  isScheduled(): boolean;
  getNextScheduledExecution(): Date | null;
}
```

## Agent APIs

### Data Collection Agent

```typescript
interface DataCollectionAgent {
  getMostAddedPlayers(): Promise<PlayerAdditionData[]>;
  filterToTopTen(players: PlayerAdditionData[]): PlayerSummary[];
}

// Usage example
const dataAgent = container.getService('dataCollectionAgent');
const mostAdded = await dataAgent.getMostAddedPlayers();
const topTen = dataAgent.filterToTopTen(mostAdded);
```

### Research Agent

```typescript
interface ResearchAgent {
  gatherPlayerResearch(players: PlayerSummary[]): Promise<PlayerResearch[]>;
}

// Usage example
const researchAgent = container.getService('researchAgent');
const research = await researchAgent.gatherPlayerResearch(topTen);
```

### Analysis Agent

```typescript
interface AnalysisAgent {
  analyzePlayer(research: PlayerResearch): Promise<PlayerAnalysis>;
}

// Usage example
const analysisAgent = container.getService('analysisAgent');
const analyses = await Promise.all(
  research.map(r => analysisAgent.analyzePlayer(r))
);
```

### Writer Agent

```typescript
interface WriterAgent {
  createBlogPost(analyses: PlayerAnalysis[]): Promise<BlogPost>;
}

// Usage example
const writerAgent = container.getService('writerAgent');
const blogPost = await writerAgent.createBlogPost(analyses);
```

### Publisher Agent

```typescript
interface PublisherAgent {
  publishPost(post: BlogPost): Promise<PublicationResult>;
}

// Usage example
const publisherAgent = container.getService('publisherAgent');
const result = await publisherAgent.publishPost(blogPost);
```

## Health Monitoring

### Health Check Endpoint

```bash
# Check system health
curl http://localhost:3001/health

# Response format
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600000,
  "version": "1.0.0",
  "environment": "production",
  "services": [
    {
      "name": "DataCollectionAgent",
      "status": "up",
      "lastCheck": "2024-01-15T10:29:30Z",
      "responseTime": 150
    }
  ]
}
```

### Metrics Endpoint

```bash
# Get system metrics
curl http://localhost:3002/metrics

# Response includes Prometheus-compatible metrics
# faab_blog_executions_total{status="success"} 42
# faab_blog_execution_duration_seconds 120.5
# faab_blog_agent_errors_total{agent="DataCollectionAgent"} 2
```

### Health Monitor API

```typescript
interface HealthMonitor {
  start(): Promise<void>;
  stop(): Promise<void>;
  getHealthStatus(): Promise<HealthStatus>;
  checkServiceHealth(serviceName: string): Promise<ServiceHealth>;
}
```

## Error Handling

### Error Types

```typescript
// API-related errors
class PlatformAPIError extends Error {
  constructor(
    public platform: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

// Agent execution errors
class AgentExecutionError extends Error {
  constructor(
    public agentName: string,
    public phase: string,
    message: string,
    public originalError?: Error
  ) {
    super(message);
  }
}

// Configuration errors
class ConfigurationError extends Error {
  constructor(
    public configPath: string,
    message: string
  ) {
    super(message);
  }
}
```

### Error Recovery

The system implements several error recovery mechanisms:

1. **Retry Logic**: Exponential backoff for transient failures
2. **Circuit Breaker**: Prevents cascading failures
3. **Fallback Data**: Uses cached or alternative data sources
4. **Graceful Degradation**: Continues with partial data when possible

### Error Monitoring

```typescript
// Error handler API
interface ErrorHandler {
  handleAPIFailure(service: string, error: Error): Promise<void>;
  handleAgentFailure(agent: string, error: Error): Promise<void>;
  isRetryable(error: Error): boolean;
  getRetryDelay(attempt: number, baseDelay: number): number;
}
```

## Examples

### Basic Usage

```typescript
import { FantasyFootballFAABBlogApp } from 'fantasy-football-faab-blog';

async function main() {
  const app = new FantasyFootballFAABBlogApp();
  
  try {
    // Start the application
    await app.start();
    console.log('Application started successfully');
    
    // Execute a manual blog post generation
    const result = await app.executeManually();
    
    if (result.success) {
      console.log(`Blog post published: ${result.publishedPostId}`);
    } else {
      console.error('Execution failed:', result.errors);
    }
    
  } catch (error) {
    console.error('Application error:', error);
  } finally {
    await app.stop();
  }
}

main().catch(console.error);
```

### Custom Agent Usage

```typescript
import { initializeContainer } from 'fantasy-football-faab-blog';

async function customWorkflow() {
  const services = await initializeContainer();
  
  // Get individual agents
  const dataAgent = services.dataCollectionAgent;
  const researchAgent = services.researchAgent;
  const analysisAgent = services.analysisAgent;
  
  // Custom workflow
  const players = await dataAgent.getMostAddedPlayers();
  const topFive = dataAgent.filterToTopTen(players).slice(0, 5);
  
  const research = await researchAgent.gatherPlayerResearch(topFive);
  
  const analyses = [];
  for (const playerResearch of research) {
    const analysis = await analysisAgent.analyzePlayer(playerResearch);
    analyses.push(analysis);
  }
  
  // Filter for only BUY recommendations
  const buyRecommendations = analyses.filter(a => a.recommendation === 'BUY');
  
  console.log(`Found ${buyRecommendations.length} BUY recommendations`);
  
  return buyRecommendations;
}
```

### Configuration Management

```typescript
import { ConfigManager } from 'fantasy-football-faab-blog';

async function configExample() {
  const configManager = new ConfigManager({
    configDir: './config',
    environment: 'production',
    validateOnLoad: true
  });
  
  // Load configuration
  const config = await configManager.loadConfig();
  
  // Modify configuration
  config.schedule.hour = 8; // Change to 8 AM
  
  // Save configuration
  await configManager.saveConfig(config);
  
  // Validate configuration
  const isValid = await configManager.validateConfig(config);
  console.log('Configuration valid:', isValid);
}
```

### Health Monitoring Integration

```typescript
import { getContainer } from 'fantasy-football-faab-blog';

async function monitoringExample() {
  const container = getContainer();
  await container.initialize();
  
  const healthMonitor = container.getService('healthMonitor');
  
  // Start health monitoring
  await healthMonitor.start();
  
  // Check health status
  const status = await healthMonitor.getHealthStatus();
  console.log('System status:', status.status);
  
  // Check individual service
  const serviceHealth = await healthMonitor.checkServiceHealth('DataCollectionAgent');
  console.log('Data collection agent status:', serviceHealth.status);
}
```

## Support and Troubleshooting

### Common Issues

1. **API Rate Limiting**: Adjust rate limits in configuration
2. **Authentication Failures**: Verify API keys and credentials
3. **Network Timeouts**: Increase timeout values in agent configuration
4. **Memory Issues**: Monitor system resources and adjust limits

### Debugging

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

Use the test command to verify connectivity:

```bash
faab-blog test
```

Check execution history for patterns:

```bash
faab-blog history --limit 50
```

### Performance Tuning

1. **Caching**: Enable caching for API responses
2. **Parallel Processing**: Adjust agent concurrency settings
3. **Rate Limiting**: Optimize API call frequency
4. **Resource Limits**: Configure appropriate timeouts and memory limits

For additional support, please refer to the troubleshooting guide or create an issue in the project repository.