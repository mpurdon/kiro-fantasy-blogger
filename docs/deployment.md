# Fantasy Football FAAB Blog System - Deployment Guide

This guide covers the deployment process for the Fantasy Football FAAB Blog System across different environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Configuration](#configuration)
- [Deployment Process](#deployment-process)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Prerequisites

### System Requirements

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **Operating System**: Linux, macOS, or Windows
- **Memory**: Minimum 512MB RAM, recommended 1GB+
- **Storage**: Minimum 1GB free space
- **Network**: Outbound internet access for API calls

### Required Services

- **Fantasy Platform APIs**: ESPN, Yahoo, Sleeper API access
- **News Services**: ESPN News API, Sports Data API
- **Blog Platform**: WordPress, Medium, or similar with API access
- **Process Manager**: PM2 (recommended for production)

### Optional Services

- **Monitoring**: Prometheus, Grafana for metrics collection
- **Alerting**: Slack webhook or email service for alerts
- **Load Balancer**: Nginx or similar for high availability

## Environment Setup

### Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd fantasy-football-faab-blog

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit configuration with your API keys
nano .env

# Run in development mode
npm run dev
```

### Staging Environment

```bash
# Deploy to staging
./scripts/deploy.sh -e staging

# Or with specific options
./scripts/deploy.sh -e staging -n 18 -s
```

### Production Environment

```bash
# Deploy to production
./scripts/deploy.sh -e production

# Or force deploy (skip confirmation)
./scripts/deploy.sh -e production -f
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Environment
NODE_ENV=production

# Schedule Configuration
SCHEDULE_DAY_OF_WEEK=2          # Tuesday
SCHEDULE_HOUR=9                 # 9 AM
SCHEDULE_TIMEZONE=America/New_York

# Fantasy Platform API Keys
ESPN_API_KEY=your_espn_api_key_here
YAHOO_API_KEY=your_yahoo_api_key_here
SLEEPER_API_KEY=your_sleeper_api_key_here

# News Service API Keys
ESPN_NEWS_API_KEY=your_espn_news_api_key_here
SPORTS_DATA_API_KEY=your_sports_data_api_key_here

# Blog Platform Configuration
BLOG_API_KEY=your_blog_api_key_here
BLOG_BASE_URL=https://your-blog.com
BLOG_USERNAME=your_blog_username
BLOG_ID=your_blog_id

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log
LOG_CONSOLE=false

# Monitoring Configuration
WEBHOOK_URL=https://hooks.slack.com/your-webhook-url
ALERT_EMAIL=admin@yourdomain.com

# Security
CREDENTIAL_ENCRYPTION_KEY=your_32_character_encryption_key
```

### Configuration Files

The system uses JSON configuration files for different environments:

- `config/config.json` - Base configuration
- `config/config.development.json` - Development overrides
- `config/config.staging.json` - Staging overrides
- `config/config.production.json` - Production overrides

Example production configuration:

```json
{
  "schedule": {
    "dayOfWeek": 2,
    "hour": 9,
    "timezone": "America/New_York"
  },
  "agents": [
    {
      "name": "DataCollectionAgent",
      "enabled": true,
      "timeout": 600000,
      "retryAttempts": 5,
      "retryDelay": 10000
    }
  ]
}
```

## Deployment Process

### Automated Deployment

Use the provided deployment script for automated deployment:

```bash
# Basic deployment
./scripts/deploy.sh -e production

# Deployment with options
./scripts/deploy.sh \
  --environment production \
  --node-version 18 \
  --force
```

### Manual Deployment

For manual deployment, follow these steps:

1. **Install Dependencies**
   ```bash
   npm ci --production
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Setup Configuration**
   ```bash
   # Copy configuration files
   cp config/config.production.json config/config.json
   
   # Setup environment variables
   cp .env.production .env
   ```

4. **Start Application**
   ```bash
   # Using PM2 (recommended)
   pm2 start ecosystem.config.js --env production
   
   # Or direct start
   npm start
   ```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Expose ports
EXPOSE 3000 3001 3002

# Start application
CMD ["npm", "start"]
```

Build and run:

```bash
# Build image
docker build -t faab-blog .

# Run container
docker run -d \
  --name faab-blog-prod \
  -p 3000:3000 \
  -p 3001:3001 \
  -p 3002:3002 \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  faab-blog
```

### Remote Deployment

For deployment to remote servers, set these environment variables:

```bash
export DEPLOY_USER=ubuntu
export DEPLOY_HOST=your-server.com
export DEPLOY_PATH=/opt/faab-blog
export PM2_APP_NAME=faab-blog-prod
```

Then run the deployment script:

```bash
./scripts/deploy.sh -e production
```

## Monitoring and Health Checks

### Health Check Endpoint

The system provides a health check endpoint at `/health`:

```bash
# Check application health
curl http://localhost:3001/health

# Response example
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600000,
  "version": "1.0.0",
  "environment": "production",
  "services": [
    {
      "name": "ESPN",
      "status": "up",
      "lastCheck": "2024-01-15T10:29:45.000Z",
      "responseTime": 150
    }
  ],
  "systemMetrics": {
    "memory": {
      "used": 134217728,
      "total": 536870912,
      "percentage": 25.0
    }
  }
}
```

### Metrics Endpoint

Prometheus metrics are available at `/metrics`:

```bash
# Get Prometheus metrics
curl http://localhost:3002/metrics
```

### Log Monitoring

Logs are written to the configured log file and can be monitored:

```bash
# Follow logs
tail -f logs/app.log

# Search for errors
grep "ERROR" logs/app.log

# View structured logs (if JSON format enabled)
cat logs/app.log | jq '.'
```

### Alerting

Configure alerts in your monitoring configuration:

```json
{
  "alerts": {
    "enabled": true,
    "webhookUrl": "https://hooks.slack.com/your-webhook",
    "thresholds": {
      "memoryUsage": 85,
      "cpuUsage": 80,
      "diskUsage": 90,
      "errorRate": 10
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **API Key Issues**
   ```bash
   # Check API key configuration
   npm run config:validate
   
   # Test API connectivity
   npm run test:apis
   ```

2. **Memory Issues**
   ```bash
   # Check memory usage
   curl http://localhost:3001/health | jq '.systemMetrics.memory'
   
   # Restart application
   pm2 restart faab-blog-prod
   ```

3. **Scheduling Issues**
   ```bash
   # Check cron configuration
   npm run schedule:status
   
   # Manually trigger execution
   npm run execute:manual
   ```

### Log Analysis

Common log patterns to look for:

```bash
# API failures
grep "API.*failed" logs/app.log

# Agent execution errors
grep "Agent.*error" logs/app.log

# Configuration issues
grep "Configuration.*invalid" logs/app.log

# Memory warnings
grep "memory.*high" logs/app.log
```

### Performance Issues

Monitor these metrics:

- **Response Times**: API call durations
- **Memory Usage**: Heap and RSS memory
- **Error Rates**: Failed API calls or agent executions
- **Execution Duration**: Time taken for full workflow

## Maintenance

### Regular Maintenance Tasks

1. **Log Rotation**
   ```bash
   # Rotate logs manually
   npm run logs:rotate
   
   # Clean old logs
   find logs/ -name "*.log.*" -mtime +30 -delete
   ```

2. **Dependency Updates**
   ```bash
   # Check for updates
   npm outdated
   
   # Update dependencies
   npm update
   
   # Security audit
   npm audit
   ```

3. **Configuration Updates**
   ```bash
   # Update configuration
   npm run config:update
   
   # Validate configuration
   npm run config:validate
   
   # Restart with new config
   pm2 reload faab-blog-prod
   ```

### Backup and Recovery

1. **Configuration Backup**
   ```bash
   # Backup configuration
   tar -czf config-backup-$(date +%Y%m%d).tar.gz config/
   ```

2. **Log Backup**
   ```bash
   # Backup logs
   tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/
   ```

3. **Recovery Process**
   ```bash
   # Restore configuration
   tar -xzf config-backup-20240115.tar.gz
   
   # Restart application
   pm2 restart faab-blog-prod
   ```

### Scaling Considerations

For high-traffic scenarios:

1. **Horizontal Scaling**
   - Deploy multiple instances behind a load balancer
   - Use shared configuration and logging storage
   - Implement distributed locking for scheduled tasks

2. **Vertical Scaling**
   - Increase memory allocation
   - Use faster storage (SSD)
   - Optimize agent timeouts and retry logic

3. **Caching**
   - Implement Redis for API response caching
   - Cache player data between executions
   - Use CDN for static assets

## Security Considerations

1. **API Key Management**
   - Use environment variables for sensitive data
   - Rotate API keys regularly
   - Monitor API usage for anomalies

2. **Network Security**
   - Use HTTPS for all external API calls
   - Implement rate limiting
   - Monitor for suspicious activity

3. **Access Control**
   - Restrict access to configuration files
   - Use proper file permissions (600 for .env)
   - Implement audit logging

## Support and Monitoring

### Health Monitoring

Set up monitoring dashboards with:

- Application uptime and availability
- API response times and error rates
- System resource usage (CPU, memory, disk)
- Execution success rates and duration

### Alerting Rules

Configure alerts for:

- Application downtime
- High error rates (>5%)
- Memory usage >85%
- Failed executions
- API rate limit exceeded

### Support Contacts

For deployment issues:

- Check logs first: `tail -f logs/app.log`
- Review health status: `curl http://localhost:3001/health`
- Validate configuration: `npm run config:validate`
- Contact system administrator if issues persist