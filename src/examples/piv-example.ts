/**
 * PIV Agent Example
 *
 * Demonstrates how to use the PIV loop for a sample epic.
 * This is a working example that can be run to test the PIV system.
 */

import { createPIVAgent } from '../agents/PIVAgent.js';
import type { PIVConfig } from '../types/piv.js';

/**
 * Example: Dark Mode Implementation
 *
 * This example shows how to use the PIV agent to implement
 * a dark mode feature for a hypothetical project.
 */
async function exampleDarkMode() {
  console.log('=== PIV Agent Example: Dark Mode ===\n');

  // Configure the PIV agent
  const config: PIVConfig = {
    // Project context
    project: {
      name: 'example-app',
      path: '/tmp/example-app', // Would be real project path
      techStack: ['TypeScript', 'React', 'Next.js'],
      conventions: {
        fileNaming: 'kebab-case',
        classNaming: 'PascalCase',
        functionNaming: 'camelCase',
        constantNaming: 'SCREAMING_SNAKE_CASE',
        componentNaming: 'PascalCase',
      },
    },

    // Epic to implement
    epic: {
      id: 'EPIC-007',
      title: 'Implement Dark Mode',
      description: `
Add dark mode support to the application with the following features:
- Theme toggle in user settings
- Dark mode styles for all components
- User preference persistence (localStorage)
- System preference detection
- Smooth transitions between themes
      `.trim(),
      acceptanceCriteria: [
        'Theme toggle visible in settings',
        'All pages support dark mode',
        'User preference persists across sessions',
        'System theme preference detected on first visit',
        'All existing tests pass',
        'New tests for dark mode functionality',
        'Documentation updated',
      ],
      tasks: [
        'Create theme context and types',
        'Implement theme provider',
        'Add theme toggle component',
        'Update CSS variables for dark mode',
        'Add localStorage persistence',
        'Detect system preference',
        'Update all components',
        'Write tests',
        'Update documentation',
      ],
    },

    // Working directory
    workingDirectory: '/tmp/example-app',

    // Model selection
    models: {
      prime: 'claude-sonnet-4.5',  // Research uses Sonnet
      plan: 'claude-sonnet-4.5',   // Planning uses Sonnet
      execute: 'claude-haiku-4',   // Execution uses Haiku (cheaper)
    },

    // Storage configuration
    storage: {
      plansDir: '.agents/plans',
      contextDir: '.agents/context',
    },

    // Git configuration
    git: {
      createBranch: true,
      createPR: true,
      baseBranch: 'main',
    },
  };

  // Create PIV agent
  const agent = createPIVAgent(config);

  console.log('Configuration:');
  console.log(`  Project: ${config.project.name}`);
  console.log(`  Epic: ${config.epic.id} - ${config.epic.title}`);
  console.log(`  Working Directory: ${config.workingDirectory}`);
  console.log('');

  try {
    // Option 1: Run complete PIV loop
    console.log('Running complete PIV loop...\n');
    const result = await agent.run();

    console.log('\n=== Results ===');
    console.log(`Success: ${result.success}`);
    console.log(`Total Duration: ${Math.round(result.totalDuration / 1000)}s`);
    console.log('');

    // Prime phase results
    console.log('Prime Phase:');
    console.log(`  Tech Stack: ${result.prime.techStack.join(', ')}`);
    console.log(`  Context: ${result.prime.contextPath}`);
    console.log(`  Integration Points: ${result.prime.integrationPoints.length}`);
    console.log('');

    // Plan phase results
    console.log('Plan Phase:');
    console.log(`  Tasks: ${result.plan.totalTasks}`);
    console.log(`  Estimated: ${result.plan.estimatedHours} hours`);
    console.log(`  Plan: ${result.plan.planPath}`);
    console.log('');

    // Execute phase results
    console.log('Execute Phase:');
    console.log(`  Branch: ${result.execute.branch}`);
    console.log(`  Files Changed: ${result.execute.filesChanged.length}`);
    console.log(`  Tests Pass: ${result.execute.testsPass}`);
    console.log(`  Build Success: ${result.execute.buildSuccess}`);

    if (result.execute.prUrl) {
      console.log(`  PR: ${result.execute.prUrl}`);
    }

    return result;
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error);
    throw error;
  }
}

/**
 * Example: Running individual phases
 *
 * This example shows how to run each phase separately,
 * which is useful for debugging or manual intervention.
 */
async function exampleIndividualPhases() {
  console.log('=== PIV Agent Example: Individual Phases ===\n');

  const config: PIVConfig = {
    project: {
      name: 'example-app',
      path: '/tmp/example-app',
    },
    epic: {
      id: 'EPIC-008',
      title: 'Add Search Feature',
      description: 'Implement full-text search for content',
      acceptanceCriteria: [
        'Search input visible',
        'Results update as user types',
        'Tests pass',
      ],
    },
    workingDirectory: '/tmp/example-app',
  };

  const agent = createPIVAgent(config);

  try {
    // Phase 1: Prime
    console.log('Running Prime phase...');
    const primeResult = await agent.runPrimeOnly();
    console.log(`✓ Prime complete: ${primeResult.contextPath}`);
    console.log('');

    // Phase 2: Plan
    console.log('Running Plan phase...');
    const planResult = await agent.runPlanOnly(primeResult.contextPath);
    console.log(`✓ Plan complete: ${planResult.planPath}`);
    console.log(`  Tasks: ${planResult.totalTasks}`);
    console.log('');

    // Phase 3: Execute
    console.log('Running Execute phase...');
    const executeResult = await agent.runExecuteOnly({
      createBranch: true,
      createPR: false, // Don't create PR automatically
    });
    console.log(`✓ Execute complete`);
    console.log(`  Branch: ${executeResult.branch}`);
    console.log(`  Tests: ${executeResult.testsPass ? 'PASS' : 'FAIL'}`);

    return {
      prime: primeResult,
      plan: planResult,
      execute: executeResult,
    };
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error);
    throw error;
  }
}

/**
 * Example: Custom configuration
 *
 * Shows advanced configuration options
 */
async function exampleCustomConfig() {
  console.log('=== PIV Agent Example: Custom Configuration ===\n');

  const config: PIVConfig = {
    project: {
      name: 'custom-app',
      path: '/tmp/custom-app',
      techStack: ['TypeScript', 'Vue', 'Vite'],
      conventions: {
        fileNaming: 'PascalCase', // Different from default
        classNaming: 'PascalCase',
        functionNaming: 'camelCase',
        constantNaming: 'SCREAMING_SNAKE_CASE',
      },
    },
    epic: {
      id: 'EPIC-009',
      title: 'Custom Feature',
      description: 'A feature with custom configuration',
      acceptanceCriteria: ['Feature works', 'Tests pass'],
    },
    workingDirectory: '/tmp/custom-app',
    storage: {
      plansDir: 'custom-plans', // Custom directory
      contextDir: 'custom-context',
    },
    git: {
      createBranch: true,
      createPR: false, // Don't auto-create PRs
      baseBranch: 'develop', // Different base branch
    },
  };

  const agent = createPIVAgent(config);

  console.log('Custom Configuration:');
  console.log(`  Storage: ${config.storage?.plansDir}`);
  console.log(`  Base Branch: ${config.git?.baseBranch}`);
  console.log(`  Auto PR: ${config.git?.createPR}`);
  console.log('');

  // Run with custom config
  const result = await agent.run();
  return result;
}

/**
 * Main function - choose which example to run
 */
async function main() {
  const example = process.argv[2] || 'dark-mode';

  console.log(`Running example: ${example}\n`);

  switch (example) {
    case 'dark-mode':
      await exampleDarkMode();
      break;

    case 'individual':
      await exampleIndividualPhases();
      break;

    case 'custom':
      await exampleCustomConfig();
      break;

    default:
      console.error(`Unknown example: ${example}`);
      console.log('Available examples:');
      console.log('  - dark-mode (default)');
      console.log('  - individual');
      console.log('  - custom');
      process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Example failed:', error);
    process.exit(1);
  });
}

// Export for use in other modules
export {
  exampleDarkMode,
  exampleIndividualPhases,
  exampleCustomConfig,
};
