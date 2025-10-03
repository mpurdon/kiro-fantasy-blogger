#!/bin/bash

# Fantasy Football FAAB Blog System Deployment Script
# This script handles deployment to different environments

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEFAULT_ENV="production"
DEFAULT_NODE_VERSION="18"

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
Fantasy Football FAAB Blog System Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV    Target environment (development, staging, production)
    -n, --node-version VER   Node.js version to use (default: $DEFAULT_NODE_VERSION)
    -c, --config-only        Only deploy configuration files
    -s, --skip-tests         Skip running tests before deployment
    -f, --force              Force deployment without confirmation
    -h, --help               Show this help message

EXAMPLES:
    $0 -e production                    # Deploy to production
    $0 -e staging -s                    # Deploy to staging, skip tests
    $0 -e development -c                # Deploy only config to development
    $0 -e production -f                 # Force deploy to production

ENVIRONMENT VARIABLES:
    NODE_ENV                 Environment name (overrides -e option)
    DEPLOY_USER             SSH user for remote deployment
    DEPLOY_HOST             SSH host for remote deployment
    DEPLOY_PATH             Remote deployment path
    PM2_APP_NAME            PM2 application name
EOF
}

# Parse command line arguments
ENVIRONMENT="${NODE_ENV:-$DEFAULT_ENV}"
NODE_VERSION="$DEFAULT_NODE_VERSION"
CONFIG_ONLY=false
SKIP_TESTS=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--node-version)
            NODE_VERSION="$2"
            shift 2
            ;;
        -c|--config-only)
            CONFIG_ONLY=true
            shift
            ;;
        -s|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -f|--force)
            FORCE=true
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

# Validate environment
case $ENVIRONMENT in
    development|staging|production)
        ;;
    *)
        log_error "Invalid environment: $ENVIRONMENT"
        log_error "Valid environments: development, staging, production"
        exit 1
        ;;
esac

log_info "Starting deployment to $ENVIRONMENT environment"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    local current_node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    if [[ "$current_node_version" -lt "$NODE_VERSION" ]]; then
        log_warning "Node.js version $current_node_version is older than recommended $NODE_VERSION"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_error "package.json not found. Are you in the right directory?"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Clean install
    if [[ -d "node_modules" ]]; then
        log_info "Cleaning existing node_modules..."
        rm -rf node_modules
    fi
    
    if [[ -f "package-lock.json" ]]; then
        npm ci
    else
        npm install
    fi
    
    log_success "Dependencies installed"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warning "Skipping tests as requested"
        return
    fi
    
    log_info "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run linting
    if npm run lint &> /dev/null; then
        log_success "Linting passed"
    else
        log_error "Linting failed"
        exit 1
    fi
    
    # Run unit tests
    if npm test -- --run &> /dev/null; then
        log_success "Tests passed"
    else
        log_error "Tests failed"
        exit 1
    fi
}

# Build application
build_application() {
    log_info "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Clean previous build
    if [[ -d "dist" ]]; then
        rm -rf dist
    fi
    
    # Build TypeScript
    npm run build
    
    log_success "Application built successfully"
}

# Setup configuration
setup_configuration() {
    log_info "Setting up configuration for $ENVIRONMENT..."
    
    cd "$PROJECT_ROOT"
    
    # Create config directory if it doesn't exist
    mkdir -p config
    
    # Check if environment-specific config exists
    local env_config="config/config.$ENVIRONMENT.json"
    if [[ ! -f "$env_config" ]]; then
        log_warning "Environment config $env_config not found, creating default..."
        
        # Create basic environment config
        cat > "$env_config" << EOF
{
  "schedule": {
    "dayOfWeek": $([ "$ENVIRONMENT" = "production" ] && echo "2" || echo "1"),
    "hour": $([ "$ENVIRONMENT" = "production" ] && echo "9" || echo "8"),
    "timezone": "America/New_York"
  },
  "agents": [
    {
      "name": "DataCollectionAgent",
      "enabled": true,
      "timeout": $([ "$ENVIRONMENT" = "production" ] && echo "600000" || echo "300000"),
      "retryAttempts": $([ "$ENVIRONMENT" = "production" ] && echo "5" || echo "3"),
      "retryDelay": $([ "$ENVIRONMENT" = "production" ] && echo "10000" || echo "5000")
    }
  ]
}
EOF
    fi
    
    # Check for .env file
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.example" ]]; then
            log_warning ".env file not found, copying from .env.example"
            cp .env.example .env
            log_warning "Please update .env file with your actual API keys"
        else
            log_error ".env file not found and no .env.example available"
            exit 1
        fi
    fi
    
    log_success "Configuration setup completed"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    cd "$PROJECT_ROOT"
    
    # Create logs directory
    mkdir -p logs
    
    # Create monitoring configuration
    cat > "config/monitoring.json" << EOF
{
  "logging": {
    "level": "$([ "$ENVIRONMENT" = "production" ] && echo "info" || echo "debug")",
    "file": "logs/app.log",
    "maxSize": "10MB",
    "maxFiles": 5,
    "console": $([ "$ENVIRONMENT" = "development" ] && echo "true" || echo "false")
  },
  "healthCheck": {
    "enabled": true,
    "port": 3001,
    "path": "/health"
  },
  "metrics": {
    "enabled": $([ "$ENVIRONMENT" = "production" ] && echo "true" || echo "false"),
    "port": 3002,
    "path": "/metrics"
  }
}
EOF
    
    log_success "Monitoring setup completed"
}

# Setup process management (PM2)
setup_pm2() {
    log_info "Setting up PM2 configuration..."
    
    cd "$PROJECT_ROOT"
    
    local app_name="${PM2_APP_NAME:-faab-blog-$ENVIRONMENT}"
    
    # Create PM2 ecosystem file
    cat > "ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: '$app_name',
    script: './dist/index.js',
    instances: $([ "$ENVIRONMENT" = "production" ] && echo "2" || echo "1"),
    exec_mode: $([ "$ENVIRONMENT" = "production" ] && echo "'cluster'" || echo "'fork'"),
    env: {
      NODE_ENV: '$ENVIRONMENT',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
    
    log_success "PM2 configuration created"
}

# Deploy to remote server
deploy_remote() {
    if [[ -z "$DEPLOY_HOST" || -z "$DEPLOY_USER" || -z "$DEPLOY_PATH" ]]; then
        log_info "Remote deployment variables not set, skipping remote deployment"
        return
    fi
    
    log_info "Deploying to remote server $DEPLOY_HOST..."
    
    # Create deployment package
    local deploy_package="faab-blog-$ENVIRONMENT-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    tar -czf "$deploy_package" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=logs \
        --exclude="*.tar.gz" \
        .
    
    # Upload and extract
    scp "$deploy_package" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
    
    ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
        cd $DEPLOY_PATH
        tar -xzf $deploy_package
        rm $deploy_package
        npm ci --production
        npm run build
        
        # Restart PM2 if running
        if command -v pm2 &> /dev/null; then
            pm2 reload ecosystem.config.js --env $ENVIRONMENT || pm2 start ecosystem.config.js --env $ENVIRONMENT
        fi
EOF
    
    # Clean up local package
    rm "$deploy_package"
    
    log_success "Remote deployment completed"
}

# Confirmation prompt
confirm_deployment() {
    if [[ "$FORCE" == true ]]; then
        return
    fi
    
    echo
    log_warning "You are about to deploy to $ENVIRONMENT environment"
    echo "This will:"
    echo "  - Install dependencies"
    if [[ "$SKIP_TESTS" != true ]]; then
        echo "  - Run tests and linting"
    fi
    echo "  - Build the application"
    echo "  - Setup configuration and monitoring"
    if [[ -n "$DEPLOY_HOST" ]]; then
        echo "  - Deploy to remote server $DEPLOY_HOST"
    fi
    echo
    
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled"
        exit 0
    fi
}

# Main deployment function
main() {
    log_info "Fantasy Football FAAB Blog System Deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Node Version: $NODE_VERSION"
    log_info "Config Only: $CONFIG_ONLY"
    log_info "Skip Tests: $SKIP_TESTS"
    echo
    
    confirm_deployment
    
    check_prerequisites
    
    if [[ "$CONFIG_ONLY" == true ]]; then
        setup_configuration
        setup_monitoring
        log_success "Configuration deployment completed"
        exit 0
    fi
    
    install_dependencies
    run_tests
    build_application
    setup_configuration
    setup_monitoring
    setup_pm2
    deploy_remote
    
    log_success "Deployment to $ENVIRONMENT completed successfully!"
    
    # Show next steps
    echo
    log_info "Next steps:"
    echo "  1. Update .env file with your API keys"
    echo "  2. Start the application: npm start"
    echo "  3. Or use PM2: pm2 start ecosystem.config.js --env $ENVIRONMENT"
    echo "  4. Monitor logs: tail -f logs/app.log"
    echo "  5. Check health: curl http://localhost:3001/health"
}

# Run main function
main "$@"