/**
 * Learning System Usage Example
 *
 * Demonstrates how to use the learning system in supervisor workflows.
 */

import { LearningsIndex, OpenAIEmbeddingProvider, LearningWatcher } from '../rag/index.js';

/**
 * Example 1: Basic setup and indexing
 */
async function exampleSetup() {
  // Initialize embedding provider
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const embeddingProvider = new OpenAIEmbeddingProvider(apiKey);
  const learningsIndex = new LearningsIndex(embeddingProvider);

  // Index all existing learnings
  console.log('Indexing all learnings...');
  const count = await learningsIndex.indexAllLearnings();
  console.log(`Indexed ${count} learnings`);

  return learningsIndex;
}

/**
 * Example 2: Search for relevant learnings before task planning
 */
async function exampleTaskPlanning(learningsIndex: LearningsIndex) {
  // Supervisor receives a task to plan
  const taskDescription = `
    Deploy SCAR agent to monitor issue #142.
    SCAR needs to fix TypeScript build errors in the frontend.
  `;

  // Search for relevant learnings
  console.log('\nSearching for relevant learnings...');
  const learnings = await learningsIndex.searchLearnings(taskDescription, {
    category: 'scar-integration',
    limit: 5,
    min_similarity: 0.7,
  });

  console.log(`\nFound ${learnings.length} relevant learnings:`);
  learnings.forEach((learning, i) => {
    console.log(`\n${i + 1}. ${learning.title}`);
    console.log(`   Category: ${learning.category}`);
    console.log(`   Similarity: ${learning.similarity}`);
    console.log(`   Type: ${learning.learning_type}`);
  });

  // Include learnings in planning prompt
  const planningPrompt = `
Task: Deploy SCAR agent to monitor issue #142

RELEVANT PAST LEARNINGS:
${learnings.map(l => `
### ${l.title}
${l.content}
`).join('\n---\n')}

Based on these learnings, create a plan that:
1. Avoids past mistakes (especially SCAR verification issues)
2. Applies proven patterns from successful resolutions
3. Includes verification steps

Your plan:
  `;

  console.log('\n=== Planning Prompt with Learnings ===');
  console.log(planningPrompt.substring(0, 500) + '...');

  return { taskDescription, learnings, planningPrompt };
}

/**
 * Example 3: Track learning application
 */
async function exampleTrackApplication(
  learningsIndex: LearningsIndex,
  learningId: string,
  issueId: string
) {
  console.log('\nTracking learning application...');

  await learningsIndex.trackApplication(
    learningId,
    'issue',
    issueId,
    'Applied SCAR verification pattern. Supervisor now verifies build output instead of trusting SCAR summary.',
    'successful',
    'Caught 22 TypeScript errors that SCAR missed. Build verification prevented wasted time.'
  );

  console.log('Learning application tracked successfully');
}

/**
 * Example 4: Get learning statistics
 */
async function exampleGetStats(learningsIndex: LearningsIndex) {
  console.log('\nGetting learning statistics...');

  const stats = await learningsIndex.getStats();

  console.log('\n=== Learning System Statistics ===');
  console.log(`Total learnings: ${stats.total_learnings}`);
  console.log('\nBy category:');
  Object.entries(stats.by_category).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });
  console.log('\nBy impact level:');
  Object.entries(stats.by_impact).forEach(([level, count]) => {
    console.log(`  ${level}: ${count}`);
  });
  console.log('\nMost used learnings:');
  stats.most_used.slice(0, 5).forEach((learning, i) => {
    console.log(`  ${i + 1}. ${learning.title} (used ${learning.usage_count} times)`);
  });
  console.log('\nEffectiveness:');
  console.log(`  Average success rate: ${stats.effectiveness_summary.avg_success_rate.toFixed(1)}%`);
  console.log(`  Total applications: ${stats.effectiveness_summary.total_applications}`);
}

/**
 * Example 5: File watcher for auto-indexing
 */
async function exampleFileWatcher(learningsIndex: LearningsIndex) {
  console.log('\nStarting file watcher...');

  const watcher = new LearningWatcher(learningsIndex, {
    onIndexed: (filePath, learningId) => {
      console.log(`✓ Auto-indexed: ${filePath} -> ${learningId}`);
    },
    onError: (error, filePath) => {
      console.error(`✗ Failed to index ${filePath}:`, error.message);
    },
  });

  watcher.start();

  console.log('File watcher started. Learning files will be auto-indexed on change.');
  console.log('Press Ctrl+C to stop...');

  // Keep running until interrupted
  await new Promise(() => {});
}

/**
 * Example 6: Complete supervisor workflow integration
 */
async function exampleCompleteSupervisorWorkflow() {
  console.log('=== Complete Supervisor Workflow with Learnings ===\n');

  // 1. Setup
  const learningsIndex = await exampleSetup();

  // 2. Task planning with learning lookup
  const { learnings } = await exampleTaskPlanning(learningsIndex);

  if (learnings.length > 0) {
    // 3. Simulate task execution
    console.log('\n[Simulating task execution...]');
    console.log('Supervisor creates plan incorporating learnings');
    console.log('SCAR executes task');
    console.log('Supervisor verifies (following learning 006)');

    // 4. Track application of most relevant learning
    const mostRelevant = learnings[0];
    await exampleTrackApplication(
      learningsIndex,
      mostRelevant.learning_id,
      'issue-142'
    );
  }

  // 5. Get statistics
  await exampleGetStats(learningsIndex);
}

/**
 * Run examples
 */
async function main() {
  const example = process.argv[2] || 'complete';

  try {
    switch (example) {
      case 'setup':
        await exampleSetup();
        break;
      case 'search':
        const index = await exampleSetup();
        await exampleTaskPlanning(index);
        break;
      case 'stats':
        const idx = await exampleSetup();
        await exampleGetStats(idx);
        break;
      case 'watcher':
        const i = await exampleSetup();
        await exampleFileWatcher(i);
        break;
      case 'complete':
      default:
        await exampleCompleteSupervisorWorkflow();
        break;
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  exampleSetup,
  exampleTaskPlanning,
  exampleTrackApplication,
  exampleGetStats,
  exampleFileWatcher,
  exampleCompleteSupervisorWorkflow,
};
