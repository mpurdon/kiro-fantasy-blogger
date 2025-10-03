# Fantasy Football FAAB Blog System

An automated AI agentic system that generates weekly fantasy football FAAB (Free Agent Acquisition Budget) acquisition blog posts.

## Project Structure

```
src/
├── agents/           # Agent implementations and interfaces
│   ├── interfaces.ts # Agent contract definitions
│   └── index.ts     # Agent exports
├── services/         # Core services
│   ├── orchestrator.ts # Orchestrator service interface
│   └── index.ts     # Service exports
├── models/          # Data models and types
│   ├── player.ts    # Player-related models
│   ├── blog.ts      # Blog-related models
│   ├── config.ts    # Configuration models
│   └── index.ts     # Model exports
├── config/          # Configuration management
│   ├── system-config.ts # System configuration
│   └── index.ts     # Config exports
└── index.ts         # Main application entry point
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

3. Configure your API keys in the `.env` file

4. Build the project:
   ```bash
   npm run build
   ```

5. Run the application:
   ```bash
   npm start
   ```

## Development

- `npm run dev` - Run in development mode with ts-node
- `npm run test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run type-check` - Run TypeScript type checking

## Architecture

The system uses a multi-agent architecture where specialized agents work sequentially:

1. **Data Collection Agent** - Retrieves most added players from fantasy platforms
2. **Research Agent** - Gathers news, stats, and injury information
3. **Analysis Agent** - Evaluates players and generates recommendations
4. **Writer Agent** - Creates formatted blog posts
5. **Publisher Agent** - Publishes content to blog platform
6. **Orchestrator Service** - Coordinates the entire workflow

## Configuration

The system is configured through environment variables and the `SystemConfig` interface. See `.env.example` for all available configuration options.

## Requirements

- Node.js >= 18.0.0
- TypeScript 5.2+
- Valid API keys for fantasy platforms and news services