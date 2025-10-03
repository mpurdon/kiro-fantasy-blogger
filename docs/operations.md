# Operations Guide

## Production Deployment

### Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Node.js 18.0.0 or higher
- Process manager (PM2 recommended)
- Reverse proxy (Nginx recommended)
- SSL certificate for HTTPS
- Monitoring system (optional but recommended)

### Deployment Steps

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash faab-blog
sudo usermod -aG sudo faab-blog
```

#### 2. Application Deployment

```bash
# Switch to application user
sudo su - faab-blog

# Clone repository
git clone <repository-url> /home/faab-blog/app
cd /home/faab-blog/app

# Install dependencies
npm ci --production

# Build application
npm run build

# Create necessary directories
mkdir -p logs data cache config
```

#### 3. Configuration

```bash
# Copy production configuration
cp config/production.json.example config/production.json

# Set up environment variables
cp .env.example .env
nano .env

# Set proper permissions
chmod 600 .env
chmod 644 config/production.json
```

#### 4. Process Management with PM2

Create PM2 ecosystem file:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'faab-blog',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

Start the application:

```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u faab-blog --hp /home/faab-blog
```

#### 5. Nginx Configuration

```nginx
# /etc/nginx/sites-available/faab-blog
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        access_log off;
    }

    # Metrics endpoint (restrict access)
    location /metrics {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Main application (if needed)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/faab-blog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Monitoring and Alerting

#### 1. System Monitoring

```bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Monitor system resources
htop
iotop -o
nethogs
```

#### 2. Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# Check application status
pm2 status
pm2 logs faab-blog

# View detailed info
pm2 show faab-blog
```

#### 3. Health Checks

```bash
# Manual health check
curl -f http://localhost:3001/health || echo "Health check failed"

# Automated health monitoring script
#!/bin/bash
# /home/faab-blog/scripts/health-check.sh

HEALTH_URL="http://localhost:3001/health"
WEBHOOK_URL="https://your-webhook-endpoint.com/alert"

if ! curl -f -s $HEALTH_URL > /dev/null; then
    echo "Health check failed at $(date)"
    
    # Send alert (optional)
    curl -X POST $WEBHOOK_URL \
        -H "Content-Type: application/json" \
        -d '{"text":"FAAB Blog system health check failed","timestamp":"'$(date -Iseconds)'"}'
    
    # Restart application
    pm2 restart faab-blog
fi
```

Add to crontab:

```bash
# Check health every 5 minutes
*/5 * * * * /home/faab-blog/scripts/health-check.sh
```

#### 4. Log Monitoring

```bash
# Monitor error logs
tail -f logs/error.log

# Monitor application logs
tail -f logs/combined.log

# Search for specific errors
grep -i "error\|fail\|exception" logs/combined.log | tail -20
```

### Backup and Recovery

#### 1. Database Backup

```bash
#!/bin/bash
# /home/faab-blog/scripts/backup.sh

BACKUP_DIR="/home/faab-blog/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
if [ -f "data/faab-blog.db" ]; then
    cp data/faab-blog.db $BACKUP_DIR/faab-blog_$DATE.db
    echo "Database backed up to $BACKUP_DIR/faab-blog_$DATE.db"
fi

# Backup configuration
cp config/production.json $BACKUP_DIR/config_$DATE.json
cp .env $BACKUP_DIR/env_$DATE.backup

# Cleanup old backups (keep last 30 days)
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.json" -mtime +30 -delete
find $BACKUP_DIR -name "*.backup" -mtime +30 -delete

echo "Backup completed at $(date)"
```

Schedule daily backups:

```bash
# Add to crontab
0 2 * * * /home/faab-blog/scripts/backup.sh
```

#### 2. Recovery Procedures

```bash
# Stop application
pm2 stop faab-blog

# Restore database
cp backups/faab-blog_YYYYMMDD_HHMMSS.db data/faab-blog.db

# Restore configuration
cp backups/config_YYYYMMDD_HHMMSS.json config/production.json

# Start application
pm2 start faab-blog
```

### Security

#### 1. System Security

```bash
# Update system regularly
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow from 10.0.0.0/8 to any port 3001  # Health checks
sudo ufw allow from 10.0.0.0/8 to any port 3002  # Metrics
```

#### 2. Application Security

```bash
# Secure file permissions
chmod 600 .env
chmod 644 config/production.json
chmod 755 scripts/*.sh

# Secure API keys
# Never commit API keys to version control
# Use environment variables or secure key management
```

#### 3. SSL/TLS Configuration

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# Security headers
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Performance Optimization

#### 1. Node.js Optimization

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=2048"

# Enable production optimizations
export NODE_ENV=production
```

#### 2. Database Optimization

```bash
# SQLite optimization
sqlite3 data/faab-blog.db "PRAGMA optimize;"
sqlite3 data/faab-blog.db "VACUUM;"
```

#### 3. Caching Configuration

```json
{
  "caching": {
    "enabled": true,
    "ttl": 300000,
    "maxSize": 1000,
    "persistToDisk": true
  }
}
```

### Scaling Considerations

#### 1. Horizontal Scaling

For high-traffic scenarios:

```bash
# Run multiple instances with PM2
pm2 start ecosystem.config.js -i max

# Use load balancer (Nginx upstream)
upstream faab_blog {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}
```

#### 2. Database Scaling

```bash
# Consider PostgreSQL for larger datasets
# Implement read replicas for heavy read workloads
# Use connection pooling
```

### Maintenance

#### 1. Regular Maintenance Tasks

```bash
#!/bin/bash
# /home/faab-blog/scripts/maintenance.sh

echo "Starting maintenance at $(date)"

# Update application
cd /home/faab-blog/app
git pull origin main
npm ci --production
npm run build

# Restart application
pm2 restart faab-blog

# Clean up logs
find logs/ -name "*.log" -mtime +7 -delete

# Clean up cache
find cache/ -mtime +1 -delete

# Optimize database
sqlite3 data/faab-blog.db "PRAGMA optimize;"

echo "Maintenance completed at $(date)"
```

#### 2. Update Procedures

```bash
# 1. Backup current version
./scripts/backup.sh

# 2. Update code
git pull origin main

# 3. Install dependencies
npm ci --production

# 4. Build application
npm run build

# 5. Test configuration
npm run type-check

# 6. Restart application
pm2 restart faab-blog

# 7. Verify deployment
curl -f http://localhost:3001/health
```

### Troubleshooting Production Issues

#### 1. Application Won't Start

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs faab-blog --lines 50

# Check configuration
node -e "console.log(JSON.parse(require('fs').readFileSync('config/production.json')))"

# Test manually
node dist/index.js
```

#### 2. High Memory Usage

```bash
# Check memory usage
pm2 monit

# Restart application
pm2 restart faab-blog

# Check for memory leaks
node --inspect dist/index.js
```

#### 3. Performance Issues

```bash
# Check system resources
htop
iotop

# Check network connectivity
ping api.sleeper.app
curl -I https://fantasy.espn.com

# Profile application
node --prof dist/index.js
```

### Emergency Procedures

#### 1. Service Outage

```bash
# Immediate response
pm2 restart faab-blog

# If restart fails
pm2 delete faab-blog
pm2 start ecosystem.config.js --env production

# Check dependencies
curl -I https://api.sleeper.app/v1/players/nfl
```

#### 2. Data Corruption

```bash
# Stop application
pm2 stop faab-blog

# Restore from backup
cp backups/faab-blog_latest.db data/faab-blog.db

# Verify integrity
sqlite3 data/faab-blog.db "PRAGMA integrity_check;"

# Restart application
pm2 start faab-blog
```

#### 3. Security Incident

```bash
# Immediate actions
pm2 stop faab-blog
sudo ufw deny all

# Investigate
grep -i "error\|fail\|attack" logs/combined.log
sudo tail -f /var/log/auth.log

# Recovery
# 1. Patch security vulnerabilities
# 2. Update all dependencies
# 3. Rotate API keys
# 4. Review access logs
# 5. Restart services
```

This operations guide provides comprehensive procedures for deploying, monitoring, and maintaining the Fantasy Football FAAB Blog System in production environments.