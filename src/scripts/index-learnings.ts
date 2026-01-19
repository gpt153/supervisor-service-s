#!/usr/bin/env tsx
/**
 * Script to index all learning files into the RAG system
 *
 * Usage:
 *   tsx src/scripts/index-learnings.ts [--project-id=<uuid>] [--watch]
 */

import { LearningsIndex, OpenAIEmbeddingProvider, LearningWatcher } from '../rag/index.js';
import { testConnection } from '../db/client.js';

interface ScriptOptions {
  projectId?: string;
  watch: boolean;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    watch: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--project-id=')) {
      options.projectId = arg.split('=')[1];
    } else if (arg === '--watch') {
      options.watch = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: tsx src/scripts/index-learnings.ts [options]

Options:
  --project-id=<uuid>    Associate learnings with a specific project
  --watch                Start file watcher for auto-indexing
  --help, -h             Show this help message

Examples:
  # Index all learnings once
  tsx src/scripts/index-learnings.ts

  # Index and watch for changes
  tsx src/scripts/index-learnings.ts --watch

  # Index for specific project
  tsx src/scripts/index-learnings.ts --project-id=550e8400-e29b-41d4-a716-446655440000
      `);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  console.log('=== Learning System Indexer ===\n');

  const options = parseArgs();

  // Check environment
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable not set');
    console.error('Please add OPENAI_API_KEY to your .env file');
    process.exit(1);
  }

  // Test database connection
  console.log('Testing database connection...');
  try {
    await testConnection();
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  // Initialize embedding provider and index
  console.log('Initializing embedding provider...');
  const embeddingProvider = new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY);
  const learningsIndex = new LearningsIndex(embeddingProvider);

  // Index all learnings
  console.log('\nIndexing learnings from: /home/samuel/sv/docs/supervisor-learnings/learnings');
  if (options.projectId) {
    console.log(`Project ID: ${options.projectId}`);
  }
  console.log('');

  try {
    const count = await learningsIndex.indexAllLearnings(options.projectId);
    console.log(`\n✓ Successfully indexed ${count} learnings`);

    // Get stats
    const stats = await learningsIndex.getStats(options.projectId);
    console.log('\n=== Statistics ===');
    console.log(`Total learnings: ${stats.total_learnings}`);
    console.log('\nBy category:');
    Object.entries(stats.by_category)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });
    console.log('\nBy impact level:');
    Object.entries(stats.by_impact)
      .sort((a, b) => b[1] - a[1])
      .forEach(([level, count]) => {
        console.log(`  ${level}: ${count}`);
      });
    console.log('\nBy type:');
    Object.entries(stats.by_type)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

    // Start watcher if requested
    if (options.watch) {
      console.log('\n=== Starting File Watcher ===');
      const watcher = new LearningWatcher(learningsIndex, {
        projectId: options.projectId,
        onIndexed: (filePath, learningId) => {
          console.log(`[${new Date().toISOString()}] ✓ Auto-indexed: ${filePath} -> ${learningId}`);
        },
        onError: (error, filePath) => {
          console.error(`[${new Date().toISOString()}] ✗ Failed to index ${filePath}:`, error.message);
        },
      });

      watcher.start();
      console.log('File watcher started. Monitoring for changes...');
      console.log('Press Ctrl+C to stop.\n');

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n\nStopping file watcher...');
        watcher.stop();
        console.log('Goodbye!');
        process.exit(0);
      });

      // Keep process running
      await new Promise(() => {});
    }
  } catch (error) {
    console.error('\nError during indexing:', error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
