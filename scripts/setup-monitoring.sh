#!/bin/bash

# Fantasy Football FAAB Blog System - Monitoring Setup Script
# This script sets up monitoring, logging, and alerting for the system

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEFAULT_ENV="production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Fantasy Football FAAB Blog System - Monitoring Setup

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV    Target environment (development, staging, production)
    -p, --prometheus         Setup Prometheus monitoring
    -g, --grafana           Setup Grafana dashboards
    -l, --logs              Setup log aggregation
    -a, --alerts            Setup alerting
    -f, --full              Setup full monitoring stack
    -h, --help              Show this help message

EXAMPLES:
    $0 -e production -f                 # Full monitoring setup for production
    $0 -e staging -p -g                 # Prometheus and Grafana for staging
    $0 -e development -l                # Log setup for development

ENVIRONMENT VARIABLES:
    GRAFANA_ADMIN_PASSWORD             Grafana admin password
    PROMETHEUS_RETENTION               Prometheus data retention period
    ALERT_WEBHOOK_URL                  Webhook URL for alerts
    LOG_AGGREGATION_ENDPOINT           Log aggregation service endpoint
EOF
}

# Parse command line arguments
ENVIRONMENT="${NODE_ENV:-$DEFAULT_ENV}"
SETUP_PROMETHEUS=false
SETUP_GRAFANA=false
SETUP_LOGS=false
SETUP_ALERTS=false
SETUP_FULL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -p|--prometheus)
            SETUP_PROMETHEUS=true
            shift
            ;;
        -g|--grafana)
            SETUP_GRAFANA=true
            shift
            ;;
        -l|--logs)
            SETUP_LOGS=true
            shift
            ;;
        -a|--alerts)
            SETUP_ALERTS=true
            shift
            ;;
        -f|--full)
            SETUP_FULL=true
            SETUP_PROMETHEUS=true
            SETUP_GRAFANA=true
            SETUP_LOGS=true
            SETUP_ALERTS=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

log_info "Setting up monitoring for $ENVIRONMENT environment"

# Create monitoring directories
setup_directories() {
    log_info "Creating monitoring directories..."
    
    cd "$PROJECT_ROOT"
    
    mkdir -p monitoring/{prometheus,grafana,logs,alerts}
    mkdir -p logs
    mkdir -p config/monitoring
    
    log_success "Monitoring directories created"
}

# Setup Prometheus configuration
setup_prometheus() {
    if [[ "$SETUP_PROMETHEUS" != true ]]; then
        return
    fi
    
    log_info "Setting up Prometheus configuration..."
    
    cd "$PROJECT_ROOT"
    
    # Create Prometheus configuration
    cat > monitoring/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: '$ENVIRONMENT'
    service: 'faab-blog'

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'faab-blog'
    static_configs:
      - targets: ['localhost:3002']
    scrape_interval: 30s
    metrics_path: /metrics
    
  - job_name: 'faab-blog-health'
    static_configs:
      - targets: ['localhost:3001']
    scrape_interval: 30s
    metrics_path: /health
    
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

EOF

    # Create alert rules
    cat > monitoring/prometheus/alert_rules.yml << EOF
groups:
  - name: faab_blog_alerts
    rules:
      - alert: ApplicationDown
        expr: up{job="faab-blog"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "FAAB Blog application is down"
          description: "The FAAB Blog application has been down for more than 1 minute."

      - alert: HighMemoryUsage
        expr: faab_blog_memory_usage_percent > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 85% for more than 5 minutes."

      - alert: ExecutionFailure
        expr: faab_blog_last_execution_success == 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Blog execution failed"
          description: "The last blog execution failed."

      - alert: ServiceDown
        expr: faab_blog_service_up == 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "External service is down"
          description: "Service {{ \$labels.service }} has been down for more than 2 minutes."

      - alert: HighResponseTime
        expr: faab_blog_service_response_time_ms > 5000
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "Service {{ \$labels.service }} response time is above 5 seconds."
EOF

    # Create Docker Compose for Prometheus
    cat > monitoring/prometheus/docker-compose.yml << EOF
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: faab-blog-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alert_rules.yml:/etc/prometheus/alert_rules.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=${PROMETHEUS_RETENTION:-15d}'
      - '--web.enable-lifecycle'
    restart: unless-stopped

volumes:
  prometheus_data:
EOF

    log_success "Prometheus configuration created"
}

# Setup Grafana dashboards
setup_grafana() {
    if [[ "$SETUP_GRAFANA" != true ]]; then
        return
    fi
    
    log_info "Setting up Grafana dashboards..."
    
    cd "$PROJECT_ROOT"
    
    # Create Grafana provisioning configuration
    mkdir -p monitoring/grafana/{provisioning/{datasources,dashboards},dashboards}
    
    # Datasource configuration
    cat > monitoring/grafana/provisioning/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

    # Dashboard provisioning
    cat > monitoring/grafana/provisioning/dashboards/dashboards.yml << EOF
apiVersion: 1

providers:
  - name: 'FAAB Blog Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

    # Main dashboard
    cat > monitoring/grafana/dashboards/faab-blog-dashboard.json << 'EOF'
{
  "dashboard": {
    "id": null,
    "title": "FAAB Blog System Dashboard",
    "tags": ["faab", "blog", "fantasy-football"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "System Status",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"faab-blog\"}",
            "legendFormat": "Application Status"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "mappings": [
              {
                "options": {
                  "0": {
                    "text": "DOWN",
                    "color": "red"
                  },
                  "1": {
                    "text": "UP",
                    "color": "green"
                  }
                },
                "type": "value"
              }
            ]
          }
        },
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 0
        }
      },
      {
        "id": 2,
        "title": "Memory Usage",
        "type": "timeseries",
        "targets": [
          {
            "expr": "faab_blog_memory_usage_percent",
            "legendFormat": "Memory Usage %"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 0
        }
      },
      {
        "id": 3,
        "title": "Service Health",
        "type": "table",
        "targets": [
          {
            "expr": "faab_blog_service_up",
            "legendFormat": "{{service}}"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 24,
          "x": 0,
          "y": 8
        }
      },
      {
        "id": 4,
        "title": "Execution Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "faab_blog_last_execution_success",
            "legendFormat": "Last Execution"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 16
        }
      },
      {
        "id": 5,
        "title": "Response Times",
        "type": "timeseries",
        "targets": [
          {
            "expr": "faab_blog_service_response_time_ms",
            "legendFormat": "{{service}}"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 16
        }
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
EOF

    # Docker Compose for Grafana
    cat > monitoring/grafana/docker-compose.yml << EOF
version: '3.8'

services:
  grafana:
    image: grafana/grafana:latest
    container_name: faab-blog-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=\${GRAFANA_ADMIN_PASSWORD:-admin}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./provisioning:/etc/grafana/provisioning
      - ./dashboards:/etc/grafana/provisioning/dashboards
      - grafana_data:/var/lib/grafana
    restart: unless-stopped

volumes:
  grafana_data:
EOF

    log_success "Grafana configuration created"
}

# Setup log aggregation
setup_logs() {
    if [[ "$SETUP_LOGS" != true ]]; then
        return
    fi
    
    log_info "Setting up log aggregation..."
    
    cd "$PROJECT_ROOT"
    
    # Create log rotation configuration
    cat > monitoring/logs/logrotate.conf << EOF
$PROJECT_ROOT/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        # Reload application if using PM2
        if command -v pm2 &> /dev/null; then
            pm2 reload faab-blog-$ENVIRONMENT 2>/dev/null || true
        fi
    endscript
}
EOF

    # Create log monitoring script
    cat > monitoring/logs/monitor-logs.sh << 'EOF'
#!/bin/bash

# Log monitoring script for FAAB Blog System

LOG_DIR="../../logs"
ALERT_THRESHOLD=10  # Number of errors in 5 minutes to trigger alert
CHECK_INTERVAL=300  # 5 minutes

while true; do
    # Count errors in the last 5 minutes
    error_count=$(find "$LOG_DIR" -name "*.log" -mmin -5 -exec grep -c "ERROR" {} \; 2>/dev/null | awk '{sum += $1} END {print sum+0}')
    
    if [[ $error_count -gt $ALERT_THRESHOLD ]]; then
        echo "$(date): High error rate detected: $error_count errors in last 5 minutes"
        
        # Send alert if webhook URL is configured
        if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
            curl -X POST "$ALERT_WEBHOOK_URL" \
                -H 'Content-Type: application/json' \
                -d "{\"text\": \"🚨 FAAB Blog Alert: $error_count errors detected in last 5 minutes\"}" \
                2>/dev/null || true
        fi
    fi
    
    sleep $CHECK_INTERVAL
done
EOF

    chmod +x monitoring/logs/monitor-logs.sh

    # Create Fluentd configuration for log aggregation (optional)
    cat > monitoring/logs/fluentd.conf << EOF
<source>
  @type tail
  path $PROJECT_ROOT/logs/*.log
  pos_file /var/log/fluentd/faab-blog.log.pos
  tag faab.blog
  format json
  time_key timestamp
  time_format %Y-%m-%dT%H:%M:%S.%LZ
</source>

<match faab.blog>
  @type forward
  <server>
    host \${LOG_AGGREGATION_ENDPOINT:-localhost}
    port 24224
  </server>
  <buffer>
    @type file
    path /var/log/fluentd/faab-blog
    flush_mode interval
    flush_interval 10s
  </buffer>
</match>
EOF

    log_success "Log aggregation setup completed"
}

# Setup alerting
setup_alerts() {
    if [[ "$SETUP_ALERTS" != true ]]; then
        return
    fi
    
    log_info "Setting up alerting..."
    
    cd "$PROJECT_ROOT"
    
    # Create Alertmanager configuration
    cat > monitoring/alerts/alertmanager.yml << EOF
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@yourdomain.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: '\${ALERT_WEBHOOK_URL:-http://localhost:5001/webhook}'
        send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
EOF

    # Create alert notification script
    cat > monitoring/alerts/send-alert.sh << 'EOF'
#!/bin/bash

# Alert notification script

ALERT_TYPE="$1"
ALERT_MESSAGE="$2"
ALERT_SEVERITY="${3:-warning}"

# Slack webhook notification
if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
    case $ALERT_SEVERITY in
        critical)
            COLOR="danger"
            EMOJI="🚨"
            ;;
        warning)
            COLOR="warning"
            EMOJI="⚠️"
            ;;
        *)
            COLOR="good"
            EMOJI="ℹ️"
            ;;
    esac
    
    curl -X POST "$ALERT_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"$EMOJI FAAB Blog Alert\",
            \"attachments\": [{
                \"color\": \"$COLOR\",
                \"fields\": [{
                    \"title\": \"Alert Type\",
                    \"value\": \"$ALERT_TYPE\",
                    \"short\": true
                }, {
                    \"title\": \"Severity\",
                    \"value\": \"$ALERT_SEVERITY\",
                    \"short\": true
                }, {
                    \"title\": \"Message\",
                    \"value\": \"$ALERT_MESSAGE\",
                    \"short\": false
                }, {
                    \"title\": \"Environment\",
                    \"value\": \"${NODE_ENV:-unknown}\",
                    \"short\": true
                }, {
                    \"title\": \"Timestamp\",
                    \"value\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                    \"short\": true
                }]
            }]
        }"
fi

# Email notification (if configured)
if [[ -n "$ALERT_EMAIL" ]]; then
    echo "Subject: FAAB Blog Alert - $ALERT_TYPE
    
Alert: $ALERT_TYPE
Severity: $ALERT_SEVERITY
Message: $ALERT_MESSAGE
Environment: ${NODE_ENV:-unknown}
Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)
    " | sendmail "$ALERT_EMAIL" 2>/dev/null || true
fi

# Log the alert
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [$ALERT_SEVERITY] $ALERT_TYPE: $ALERT_MESSAGE" >> ../logs/alerts.log
EOF

    chmod +x monitoring/alerts/send-alert.sh

    # Create health check monitoring script
    cat > monitoring/alerts/health-monitor.sh << 'EOF'
#!/bin/bash

# Health monitoring script with alerting

HEALTH_URL="http://localhost:3001/health"
CHECK_INTERVAL=60  # 1 minute
FAILURE_THRESHOLD=3  # Number of consecutive failures before alert

failure_count=0

while true; do
    if curl -f -s "$HEALTH_URL" > /dev/null 2>&1; then
        # Health check passed
        if [[ $failure_count -gt 0 ]]; then
            # Recovery from previous failures
            ./send-alert.sh "Health Check Recovery" "Application health check is now passing" "info"
            failure_count=0
        fi
    else
        # Health check failed
        ((failure_count++))
        
        if [[ $failure_count -ge $FAILURE_THRESHOLD ]]; then
            ./send-alert.sh "Health Check Failure" "Application health check has failed $failure_count consecutive times" "critical"
        fi
    fi
    
    sleep $CHECK_INTERVAL
done
EOF

    chmod +x monitoring/alerts/health-monitor.sh

    log_success "Alerting setup completed"
}

# Create monitoring startup script
create_startup_script() {
    log_info "Creating monitoring startup script..."
    
    cd "$PROJECT_ROOT"
    
    cat > monitoring/start-monitoring.sh << EOF
#!/bin/bash

# Start monitoring services for FAAB Blog System

MONITORING_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="\$(dirname "\$MONITORING_DIR")"

echo "Starting monitoring services..."

# Start Prometheus (if configured)
if [[ -f "\$MONITORING_DIR/prometheus/docker-compose.yml" ]]; then
    echo "Starting Prometheus..."
    cd "\$MONITORING_DIR/prometheus"
    docker-compose up -d
    cd "\$PROJECT_ROOT"
fi

# Start Grafana (if configured)
if [[ -f "\$MONITORING_DIR/grafana/docker-compose.yml" ]]; then
    echo "Starting Grafana..."
    cd "\$MONITORING_DIR/grafana"
    docker-compose up -d
    cd "\$PROJECT_ROOT"
fi

# Start log monitoring (if configured)
if [[ -f "\$MONITORING_DIR/logs/monitor-logs.sh" ]]; then
    echo "Starting log monitoring..."
    nohup "\$MONITORING_DIR/logs/monitor-logs.sh" > /dev/null 2>&1 &
    echo \$! > "\$MONITORING_DIR/logs/monitor-logs.pid"
fi

# Start health monitoring (if configured)
if [[ -f "\$MONITORING_DIR/alerts/health-monitor.sh" ]]; then
    echo "Starting health monitoring..."
    cd "\$MONITORING_DIR/alerts"
    nohup ./health-monitor.sh > /dev/null 2>&1 &
    echo \$! > health-monitor.pid
    cd "\$PROJECT_ROOT"
fi

echo "Monitoring services started!"
echo ""
echo "Access points:"
if [[ -f "\$MONITORING_DIR/prometheus/docker-compose.yml" ]]; then
    echo "  Prometheus: http://localhost:9090"
fi
if [[ -f "\$MONITORING_DIR/grafana/docker-compose.yml" ]]; then
    echo "  Grafana: http://localhost:3000 (admin/\${GRAFANA_ADMIN_PASSWORD:-admin})"
fi
echo "  Application Health: http://localhost:3001/health"
echo "  Application Metrics: http://localhost:3002/metrics"
EOF

    chmod +x monitoring/start-monitoring.sh

    # Create stop script
    cat > monitoring/stop-monitoring.sh << EOF
#!/bin/bash

# Stop monitoring services for FAAB Blog System

MONITORING_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping monitoring services..."

# Stop Docker services
for compose_file in prometheus/docker-compose.yml grafana/docker-compose.yml; do
    if [[ -f "\$MONITORING_DIR/\$compose_file" ]]; then
        cd "\$MONITORING_DIR/\$(dirname \$compose_file)"
        docker-compose down
    fi
done

# Stop background processes
for pid_file in logs/monitor-logs.pid alerts/health-monitor.pid; do
    if [[ -f "\$MONITORING_DIR/\$pid_file" ]]; then
        kill "\$(cat "\$MONITORING_DIR/\$pid_file")" 2>/dev/null || true
        rm "\$MONITORING_DIR/\$pid_file"
    fi
done

echo "Monitoring services stopped!"
EOF

    chmod +x monitoring/stop-monitoring.sh

    log_success "Monitoring startup scripts created"
}

# Main setup function
main() {
    log_info "FAAB Blog System - Monitoring Setup"
    log_info "Environment: $ENVIRONMENT"
    log_info "Prometheus: $SETUP_PROMETHEUS"
    log_info "Grafana: $SETUP_GRAFANA"
    log_info "Logs: $SETUP_LOGS"
    log_info "Alerts: $SETUP_ALERTS"
    echo
    
    setup_directories
    setup_prometheus
    setup_grafana
    setup_logs
    setup_alerts
    create_startup_script
    
    log_success "Monitoring setup completed successfully!"
    
    echo
    log_info "Next steps:"
    echo "  1. Review configuration files in monitoring/ directory"
    echo "  2. Set environment variables (GRAFANA_ADMIN_PASSWORD, ALERT_WEBHOOK_URL, etc.)"
    echo "  3. Start monitoring services: ./monitoring/start-monitoring.sh"
    echo "  4. Access Grafana at http://localhost:3000"
    echo "  5. Access Prometheus at http://localhost:9090"
    echo "  6. Check application health at http://localhost:3001/health"
}

# Run main function
main "$@"