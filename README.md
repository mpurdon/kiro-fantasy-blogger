# Fantasy Football FAAB Blog System

An automated AI agentic system that generates weekly fantasy football FAAB (Free Agent Acquisition Budget) acquisition blog posts. The system uses multiple specialized agents to research, analyze, and publish data-driven content about the most added fantasy football players across leagues.

## Spec-Driven Development Notes

This project was 100% developed using spec-driven development through Kiro. The initial prompt was:

> Create an AI agentic process to populate a blog that writes about fantasy football FAAB acquistions. One agent should should go out and grab a list of the most added players across fantasy football leagues and cull the list down to a top 10 list. Then, another agent should go out and retrieve news and data for each of the members of the top 10 list to determine why the player is on the most added list. Finally, a transactions expert agent should make the determination whether each player should be considered a buy or pass. All of this information should be put together into a blog post by a writer agent and published to a blog app.

There were no steering or guidance documents provided and no MCP servers were enabled. All designs and tasks were approved without review and development was run in full yolo/unsafe mode lasting a total of 1 hour and 45 minutes to complete at a cost of about $3.88 USD.

The price caclulation is based on a credit usage of 97 multiplied by the credit overage price of $0.04 USD per credit.

The developer time savings might be as much as 8-12 days.

- Core Infrastructure (2-3 days)
- External API Integrations (2-3 days)
- Agent Implementations (3-4 days)
- Orchestration and Production (1-2 days)


## 🚀 Features

- **Multi-Platform Data Collection**: Integrates with ESPN, Yahoo, and Sleeper fantasy platforms
- **AI-Powered Analysis**: Evaluates players using news, statistics, and injury reports
- **Automated Content Generation**: Creates well-formatted blog posts with buy/pass recommendations
- **Flexible Publishing**: Supports WordPress and Medium blog platforms
- **Intelligent Scheduling**: Runs automatically on configurable schedules
- **Comprehensive Monitoring**: Health checks, metrics, and error tracking
- **Robust Error Handling**: Retry logic, circuit breakers, and graceful degradation

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- API keys for fantasy platforms and news services
- Blog platform credentials (WordPress or Medium)

## 🛠️ Installation

### Quick Start

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

# Start the system
npm start
```

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with your API keys and configuration:

```bash
# Fantasy Platform API Keys
ESPN_API_KEY=your_espn_api_key_here
YAHOO_API_KEY=your_yahoo_api_key_here
SLEEPER_API_KEY=your_sleeper_api_key_here

# News Service API Keys
ESPN_NEWS_API_KEY=your_espn_news_api_key_here
SPORTS_DATA_API_KEY=your_sports_data_api_key_here

# Blog Platform Configuration
BLOG_API_KEY=your_blog_api_key_here
BLOG_BASE_URL=https://your-blog-site.com
BLOG_USERNAME=your_blog_username
BLOG_ID=your_blog_id

# Schedule Configuration
SCHEDULE_DAY_OF_WEEK=2  # Tuesday
SCHEDULE_HOUR=6         # 6 AM
SCHEDULE_TIMEZONE=America/New_York

# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
```

### Configuration Files

The system supports environment-specific configuration files:

- `config/development.json` - Development environment
- `config/production.json` - Production environment
- `config/test.json` - Testing environment

## 🎯 Usage

### Command Line Interface

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

### Programmatic Usage

```typescript
import { FantasyFootballFAABBlogApp } from 'fantasy-football-faab-blog';

const app = new FantasyFootballFAABBlogApp();

// Start the application
await app.start();

// Execute manually
const result = await app.executeManually();

if (result.success) {
  console.log(`Blog post published: ${result.publishedPostId}`);
} else {
  console.error('Execution failed:', result.errors);
}

// Stop the application
await app.stop();
```

## 🏗️ System Architecture

The system uses a multi-agent architecture where specialized agents work sequentially:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Data Collection │───▶│ Research Agent   │───▶│ Analysis Agent  │
│ Agent           │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Fantasy         │    │ News & Stats     │    │ FAAB Analysis   │
│ Platforms       │    │ Services         │    │ & Recommendations│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Publisher Agent │◀───│ Writer Agent     │◀───│ Blog Post       │
│                 │    │                  │    │ Generation      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Blog Platform   │
│ (WordPress/     │
│ Medium)         │
└─────────────────┘
```

### Agent Responsibilities

- **Data Collection Agent**: Retrieves most added players from ESPN, Yahoo, and Sleeper
- **Research Agent**: Gathers news articles, statistics, and injury reports
- **Analysis Agent**: Evaluates players and generates buy/pass recommendations
- **Writer Agent**: Creates formatted blog posts with engaging content
- **Publisher Agent**: Publishes content to blog platforms with proper metadata

## 📊 Monitoring and Health Checks

### Health Check Endpoint

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600000,
  "version": "1.0.0",
  "services": [
    {
      "name": "DataCollectionAgent",
      "status": "up",
      "responseTime": 150
    }
  ]
}
```

### Metrics Endpoint

```bash
curl http://localhost:3002/metrics
```

Provides Prometheus-compatible metrics for monitoring execution times, success rates, and error counts.

## 🔧 Development

### Project Structure

```
src/
├── agents/           # AI agents for different tasks
├── api/             # External API integrations
├── config/          # Configuration management
├── models/          # Data models and types
├── services/        # Core services (orchestrator, monitoring)
├── utils/           # Utility functions
├── container.ts     # Dependency injection
├── index.ts         # Main application entry point
└── cli.ts          # Command line interface
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/agents/data-collection-agent.test.ts

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📚 Documentation

- [API Documentation](docs/api-documentation.md) - Comprehensive API reference
- [Troubleshooting Guide](docs/troubleshooting.md) - Common issues and solutions
- [Operations Guide](docs/operations.md) - Production deployment and maintenance
- [Deployment Guide](docs/deployment.md) - Detailed deployment instructions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests for new features
- Update documentation for API changes
- Use conventional commit messages
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [docs](docs/) directory for detailed guides
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions for questions and support

## Requirements

- Node.js >= 18.0.0
- TypeScript 5.2+
- Valid API keys for fantasy platforms and news services