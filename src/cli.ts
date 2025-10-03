#!/usr/bin/env node

// CLI interface for the Fantasy Football FAAB Blog System

import { Command } from 'commander';
import { FantasyFootballFAABBlogApp } from './index';
import { getContainer } from './container';
import { Logger } from './utils';

const program = new Command();
const logger = new Logger('CLI');

program
  .name('faab-blog')
  .description('Fantasy Football FAAB Blog System CLI')
  .version('1.0.0');

program
  .command('start')
  .description('Start the FAAB blog system with scheduled execution')
  .action(async () => {
    const app = new FantasyFootballFAABBlogApp();
    
    try {
      await app.start();
      console.log('✅ FAAB blog system started successfully');
      console.log('📅 Weekly blog posts will be generated automatically');
      
      const status = app.getStatus();
      if (status.nextExecution) {
        console.log(`⏰ Next execution: ${status.nextExecution.toLocaleString()}`);
      }
      
      // Keep running until interrupted
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down...');
        await app.stop();
        console.log('✅ System stopped');
        process.exit(0);
      });
      
      // Keep process alive
      await new Promise(() => {});
      
    } catch (error) {
      console.error('❌ Failed to start system:', error.message);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Execute a single blog post generation manually')
  .action(async () => {
    const app = new FantasyFootballFAABBlogApp();
    
    try {
      console.log('🚀 Starting manual blog post generation...');
      
      await app.start();
      const result = await app.executeManually();
      await app.stop();
      
      if (result.success) {
        console.log('✅ Blog post generated successfully!');
        if (result.publishedPostId) {
          console.log(`📝 Published post ID: ${result.publishedPostId}`);
        }
        console.log(`⏱️  Execution time: ${result.endTime.getTime() - result.startTime.getTime()}ms`);
        console.log(`🤖 Agents executed: ${result.agentsExecuted.join(', ')}`);
      } else {
        console.log('❌ Blog post generation failed');
        result.errors.forEach(error => {
          console.error(`   Error: ${error.message}`);
        });
        result.warnings.forEach(warning => {
          console.warn(`   Warning: ${warning}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Manual execution failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check the current status of the system')
  .action(async () => {
    try {
      const container = getContainer();
      await container.initialize();
      
      const orchestrator = container.getService('orchestrator');
      const healthMonitor = container.getService('healthMonitor');
      
      console.log('📊 System Status:');
      console.log(`   Scheduled: ${orchestrator.isScheduled() ? '✅ Yes' : '❌ No'}`);
      
      const nextExecution = orchestrator.getNextScheduledExecution();
      if (nextExecution) {
        console.log(`   Next execution: ${nextExecution.toLocaleString()}`);
      }
      
      const executionStatus = orchestrator.getExecutionStatus();
      if (executionStatus.isRunning) {
        console.log(`   Currently running: ${executionStatus.currentAgent} (${executionStatus.progress}%)`);
      } else {
        console.log('   Currently running: No');
      }
      
      const healthStatus = await healthMonitor.getHealthStatus();
      console.log(`   Health: ${healthStatus.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
      
      await container.shutdown();
      
    } catch (error) {
      console.error('❌ Failed to get status:', error.message);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('Show execution history')
  .option('-l, --limit <number>', 'Number of executions to show', '10')
  .action(async (options) => {
    try {
      const container = getContainer();
      await container.initialize();
      
      const orchestrator = container.getService('orchestrator');
      const history = await orchestrator.getExecutionHistory(parseInt(options.limit));
      
      console.log('📈 Execution History:');
      
      if (history.length === 0) {
        console.log('   No executions found');
      } else {
        history.forEach((execution, index) => {
          const status = execution.success ? '✅' : '❌';
          const date = new Date(execution.startTime).toLocaleString();
          const duration = execution.endTime ? 
            `${new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime()}ms` : 
            'N/A';
          
          console.log(`   ${index + 1}. ${status} ${date} (${duration})`);
          if (execution.publishedPostId) {
            console.log(`      📝 Post ID: ${execution.publishedPostId}`);
          }
          if (execution.errors && execution.errors.length > 0) {
            console.log(`      ❌ Errors: ${execution.errors.length}`);
          }
        });
      }
      
      await container.shutdown();
      
    } catch (error) {
      console.error('❌ Failed to get history:', error.message);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(async () => {
    try {
      const container = getContainer();
      await container.initialize();
      
      const configManager = container.getService('configManager');
      const config = await configManager.loadConfig();
      
      console.log('⚙️  Current Configuration:');
      console.log(`   Schedule: ${config.schedule.dayOfWeek === 0 ? 'Sunday' : 
                                   config.schedule.dayOfWeek === 1 ? 'Monday' :
                                   config.schedule.dayOfWeek === 2 ? 'Tuesday' :
                                   config.schedule.dayOfWeek === 3 ? 'Wednesday' :
                                   config.schedule.dayOfWeek === 4 ? 'Thursday' :
                                   config.schedule.dayOfWeek === 5 ? 'Friday' : 'Saturday'} at ${config.schedule.hour}:00 (${config.schedule.timezone})`);
      console.log(`   Blog Platform: ${config.blog.platform}`);
      console.log(`   Fantasy Platforms: ${config.apis.fantasyPlatforms.map(p => p.platform).join(', ')}`);
      console.log(`   News Services: ${config.apis.newsServices.map(s => s.service).join(', ')}`);
      
      await container.shutdown();
      
    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Test system connectivity and configuration')
  .action(async () => {
    try {
      console.log('🧪 Testing system connectivity...');
      
      const container = getContainer();
      await container.initialize();
      
      const healthMonitor = container.getService('healthMonitor');
      const healthStatus = await healthMonitor.getHealthStatus();
      
      console.log('📊 Health Check Results:');
      console.log(`   Overall Status: ${healthStatus.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
      
      if (healthStatus.checks) {
        Object.entries(healthStatus.checks).forEach(([service, status]) => {
          const icon = status === 'healthy' ? '✅' : '❌';
          console.log(`   ${service}: ${icon} ${status}`);
        });
      }
      
      if (healthStatus.status !== 'healthy') {
        console.log('\n⚠️  Some services are not healthy. Check your configuration and network connectivity.');
      }
      
      await container.shutdown();
      
    } catch (error) {
      console.error('❌ System test failed:', error.message);
      process.exit(1);
    }
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

program.parse();