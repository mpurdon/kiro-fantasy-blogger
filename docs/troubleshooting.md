# Troubleshooting Guide

## Common Issues and Solutions

### Installation and Setup Issues

#### Issue: Node.js Version Compatibility
**Symptoms**: Installation fails with version errors
**Solution**: 
```bash
# Check Node.js version
node --version

# Install Node.js 18+ if needed
# Using nvm (recommended)
nvm install 18
nvm use 18

# Or download from nodejs.org
```

#### Issue: Package Installation Failures
**Symptoms**: `npm install` fails with permission or network errors
**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Use different registry if needed
npm install --registry https://registry.npmjs.org/

# Fix permissions (Linux/Mac)
sudo chown -R $(whoami) ~/.npm
```

#### Issue: TypeScript Compilation Errors
**Symptoms**: Build fails with TypeScript errors
**Solutions**:
```bash
# Clean build directory
rm -rf dist/

# Reinstall dependencies
rm -rf node_modules/
npm install

# Check TypeScript configuration
npm run type-check
```

### Configuration Issues

#### Issue: Invalid Configuration File
**Symptoms**: Application fails to start with configuration errors
**Solutions**:
1. Validate JSON syntax:
```bash
# Use JSON validator
node -e "console.log(JSON.parse(require('fs').readFileSync('config/production.json', 'utf8')))"
```

2. Check required fields:
```bash
# Use built-in validation
faab-blog config
```

3. Reset to default configuration:
```bash
# Backup current config
cp config/production.json config/production.json.backup

# Use development config as template
cp config/development.json config/production.json
```

#### Issue: Missing Environment Variables
**Symptoms**: Authentication failures or missing API keys
**Solutions**:
1. Check environment variables:
```bash
# List all environment variables
env | grep -E "(ESPN|YAHOO|SLEEPER|BLOG)_"

# Check specific variable
echo $ESPN_API_KEY
```

2. Verify .env file:
```bash
# Check if .env exists
ls -la .env

# Copy from template if missing
cp .env.example .env
```

3. Validate API keys:
```bash
# Test system connectivity
faab-blog test
```

### API Integration Issues

#### Issue: ESPN API Authentication Failures
**Symptoms**: 401 Unauthorized errors from ESPN
**Solutions**:
1. Verify API key format
2. Check if using correct ESPN API endpoint
3. For private leagues, ensure proper authentication cookies

**Example Fix**:
```typescript
// Check ESPN client configuration
const espnConfig = {
  name: "ESPN",
  apiKey: process.env.ESPN_API_KEY,
  baseUrl: "https://fantasy.espn.com/apis/v3",
  // Add league-specific authentication if needed
};
```

#### Issue: Yahoo API OAuth Issues
**Symptoms**: OAuth token expired or invalid
**Solutions**:
1. Refresh OAuth tokens
2. Check Yahoo app configuration
3. Verify redirect URLs

#### Issue: Rate Limiting Errors
**Symptoms**: 429 Too Many Requests errors
**Solutions**:
1. Adjust rate limits in configuration:
```json
{
  "rateLimit": {
    "requestsPerMinute": 30,
    "requestsPerHour": 500
  }
}
```

2. Enable request caching:
```json
{
  "caching": {
    "enabled": true,
    "ttl": 300000
  }
}
```

### Agent Execution Issues

#### Issue: Data Collection Agent Failures
**Symptoms**: No player data retrieved
**Debugging Steps**:
1. Check platform availability:
```bash
# Test individual platforms
curl -I https://api.sleeper.app/v1/players/nfl
curl -I https://fantasy.espn.com/apis/v3
```

2. Verify agent configuration:
```bash
faab-blog config | grep -A 10 "DataCollectionAgent"
```

3. Check logs for specific errors:
```bash
# Enable debug logging
LOG_LEVEL=debug faab-blog run
```

#### Issue: Research Agent Timeout
**Symptoms**: Agent times out during news gathering
**Solutions**:
1. Increase timeout values:
```json
{
  "name": "ResearchAgent",
  "timeout": 900000,
  "retryAttempts": 2
}
```

2. Reduce concurrent requests:
```json
{
  "rateLimit": {
    "requestsPerMinute": 20
  }
}
```

#### Issue: Analysis Agent Inconsistent Results
**Symptoms**: Analysis results vary significantly between runs
**Solutions**:
1. Check data quality validation
2. Verify statistical calculations
3. Review analysis algorithms

#### Issue: Writer Agent Formatting Problems
**Symptoms**: Blog posts have formatting issues
**Solutions**:
1. Check blog platform requirements
2. Verify HTML/Markdown formatting
3. Test with simple content first

#### Issue: Publisher Agent Publication Failures
**Symptoms**: Blog posts fail to publish
**Debugging Steps**:
1. Test blog platform connectivity:
```bash
# Test WordPress API
curl -X GET "https://your-site.com/wp-json/wp/v2/posts" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. Check publication permissions
3. Verify blog platform configuration

### System Performance Issues

#### Issue: High Memory Usage
**Symptoms**: System runs out of memory
**Solutions**:
1. Monitor memory usage:
```bash
# Check system memory
free -h

# Monitor Node.js process
ps aux | grep node
```

2. Optimize caching:
```json
{
  "caching": {
    "maxSize": 500,
    "ttl": 300000
  }
}
```

3. Increase Node.js memory limit:
```bash
node --max-old-space-size=4096 dist/index.js
```

#### Issue: Slow Execution Times
**Symptoms**: Blog generation takes too long
**Solutions**:
1. Enable parallel processing where possible
2. Optimize API calls with caching
3. Reduce data collection scope
4. Profile execution times:
```bash
# Run with timing
time faab-blog run
```

#### Issue: Network Connectivity Problems
**Symptoms**: Intermittent API failures
**Solutions**:
1. Check network stability
2. Implement retry logic with exponential backoff
3. Use connection pooling
4. Monitor network latency

### Scheduling Issues

#### Issue: Cron Job Not Running
**Symptoms**: Scheduled execution doesn't occur
**Debugging Steps**:
1. Check if application is running:
```bash
faab-blog status
```

2. Verify cron schedule:
```bash
# Check next scheduled execution
faab-blog status | grep "Next execution"
```

3. Check system timezone:
```bash
# Verify timezone
date
timedatectl status
```

4. Test manual execution:
```bash
faab-blog run
```

#### Issue: Multiple Executions Running
**Symptoms**: Overlapping executions cause conflicts
**Solutions**:
1. Implement execution locking
2. Check execution status before starting
3. Increase execution timeouts if needed

### Health Monitoring Issues

#### Issue: Health Check Endpoints Not Responding
**Symptoms**: Health check URLs return errors
**Solutions**:
1. Check if health monitor is enabled:
```json
{
  "healthCheck": {
    "enabled": true,
    "port": 3001
  }
}
```

2. Verify port availability:
```bash
# Check if port is in use
netstat -tulpn | grep 3001
```

3. Test health endpoint:
```bash
curl http://localhost:3001/health
```

#### Issue: Metrics Collection Problems
**Symptoms**: Metrics endpoint returns no data
**Solutions**:
1. Enable metrics collection in configuration
2. Check metrics endpoint:
```bash
curl http://localhost:3002/metrics
```

3. Verify Prometheus format compatibility

### Database and Storage Issues

#### Issue: SQLite Database Corruption
**Symptoms**: Database errors or data loss
**Solutions**:
1. Check database file integrity:
```bash
sqlite3 data/faab-blog.db "PRAGMA integrity_check;"
```

2. Backup and restore database:
```bash
# Create backup
cp data/faab-blog.db data/faab-blog.db.backup

# Restore from backup if needed
cp data/faab-blog.db.backup data/faab-blog.db
```

3. Recreate database if corrupted:
```bash
rm data/faab-blog.db
# Application will recreate on next run
```

### Logging and Debugging

#### Enable Debug Logging
```bash
# Set log level to debug
export LOG_LEVEL=debug
faab-blog run

# Or in .env file
echo "LOG_LEVEL=debug" >> .env
```

#### Check Application Logs
```bash
# View recent logs
tail -f logs/application.log

# Search for errors
grep -i error logs/application.log

# Filter by agent
grep "DataCollectionAgent" logs/application.log
```

#### Debug Individual Agents
```typescript
// Enable agent-specific debugging
const agent = container.getService('dataCollectionAgent');
agent.setLogLevel('debug');
```

### Recovery Procedures

#### Complete System Reset
```bash
# Stop application
faab-blog stop

# Clear cache and temporary files
rm -rf cache/
rm -rf temp/
rm -rf logs/

# Reset configuration to defaults
cp config/development.json config/production.json

# Restart application
faab-blog start
```

#### Partial Recovery
```bash
# Reset only execution state
rm -rf data/execution-state.json

# Clear cache but keep logs
rm -rf cache/

# Restart specific services
faab-blog test
```

### Getting Help

#### Diagnostic Information
When reporting issues, include:

1. System information:
```bash
node --version
npm --version
uname -a
```

2. Application version:
```bash
faab-blog --version
```

3. Configuration (sanitized):
```bash
faab-blog config | sed 's/apiKey.*/apiKey: [REDACTED]/'
```

4. Recent logs:
```bash
tail -100 logs/application.log
```

5. Error details:
```bash
faab-blog test 2>&1
```

#### Support Channels
- GitHub Issues: For bug reports and feature requests
- Documentation: Check API documentation for usage examples
- Community: Join discussions for community support

#### Emergency Contacts
For critical production issues:
1. Check system status dashboard
2. Review monitoring alerts
3. Contact system administrator
4. Implement emergency fallback procedures