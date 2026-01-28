/**
 * Next Step Generator Service (Epic 007-E)
 * Generates actionable next steps based on reconstructed context
 *
 * Responsibilities:
 * - Analyze work state to determine what user should do next
 * - Generate specific, actionable steps
 * - Prioritize based on epic status, tests, git state
 * - Provide commands to run
 */

import { ResumeSummary } from '../types/resume.js';

/**
 * Generate next steps based on reconstructed context
 *
 * @param workState Reconstructed work state
 * @param summary Resume summary
 * @returns Array of actionable next steps
 *
 * @example
 * const steps = generateNextSteps(
 *   { current_epic: 'epic-003', epic_status: 'in_progress' },
 *   summary
 * );
 * // Returns: [
 * //   'Continue working on epic-003',
 * //   'Run tests: npm test',
 * //   'Check git status: git status'
 * // ]
 */
export function generateNextSteps(
  workState: Record<string, any>,
  summary: ResumeSummary
): string[] {
  const steps: string[] = [];

  // Priority 1: Epic-based steps
  if (summary.current_epic) {
    const epicSteps = generateEpicSteps(summary.current_epic, workState);
    steps.push(...epicSteps);
  }

  // Priority 2: Git-based steps
  if (summary.git_status) {
    const gitSteps = generateGitSteps(summary.git_status, workState);
    steps.push(...gitSteps);
  }

  // Priority 3: Test-based steps
  if (workState.tests_passed !== undefined) {
    const testSteps = generateTestSteps(workState);
    steps.push(...testSteps);
  }

  // Priority 4: General verification steps
  if (steps.length === 0) {
    steps.push(...generateDefaultSteps(workState));
  }

  // Limit to 5 most important steps
  return steps.slice(0, 5);
}

/**
 * Generate epic-specific next steps
 */
function generateEpicSteps(
  epic: {
    epic_id: string;
    name: string;
    status: string;
    progress?: {
      tests_passed: number;
      tests_total: number;
    };
  },
  workState: Record<string, any>
): string[] {
  const steps: string[] = [];

  // Epic status: completed
  if (
    epic.status.toLowerCase().includes('complete') ||
    epic.status.toLowerCase().includes('done')
  ) {
    steps.push(`✅ Epic ${epic.epic_id} completed - Ready to merge`);

    if (workState.pr_number) {
      steps.push(
        `Verify PR #${workState.pr_number} tests pass on CI`
      );
      steps.push(`Merge PR #${workState.pr_number} into main`);
    } else {
      steps.push('Create PR for completed work');
    }

    const nextEpicNum = parseInt(epic.epic_id.split('-')[1]) + 1;
    const nextEpicId = `epic-${String(nextEpicNum).padStart(3, '0')}`;
    steps.push(`Start ${nextEpicId} (next epic)`);

    return steps;
  }

  // Epic status: in progress
  if (
    epic.status.toLowerCase().includes('progress') ||
    epic.status.toLowerCase().includes('active')
  ) {
    steps.push(`Continue working on ${epic.epic_id}: ${epic.name}`);

    // Check test status
    if (epic.progress) {
      const { tests_passed, tests_total } = epic.progress;
      if (tests_passed < tests_total) {
        steps.push(
          `Fix failing tests (${tests_passed}/${tests_total} passing)`
        );
      } else if (tests_total > 0) {
        steps.push(`✅ All tests passing (${tests_total}/${tests_total})`);
        steps.push('Mark epic as complete');
      }
    } else {
      steps.push('Run tests: npm test');
    }

    return steps;
  }

  // Epic status: planning or other
  steps.push(`Review ${epic.epic_id} status`);
  steps.push('Check epic acceptance criteria');

  return steps;
}

/**
 * Generate git-specific next steps
 */
function generateGitSteps(
  gitStatus: {
    branch: string;
    commits_ahead: number;
    staged_files: number;
    changed_files: number;
  },
  workState: Record<string, any>
): string[] {
  const steps: string[] = [];

  // Uncommitted changes
  if (gitStatus.changed_files > 0 || gitStatus.staged_files > 0) {
    steps.push(
      `Commit changes (${gitStatus.changed_files} changed, ${gitStatus.staged_files} staged)`
    );
    steps.push(`Command: git add . && git commit -m "chore: resume work"`);
  }

  // Unpushed commits
  if (gitStatus.commits_ahead > 0) {
    steps.push(`Push ${gitStatus.commits_ahead} unpushed commits`);
    steps.push(`Command: git push origin ${gitStatus.branch}`);
  }

  // Clean state
  if (
    gitStatus.commits_ahead === 0 &&
    gitStatus.changed_files === 0 &&
    gitStatus.staged_files === 0
  ) {
    steps.push('✅ Git state clean');
  }

  return steps;
}

/**
 * Generate test-specific next steps
 */
function generateTestSteps(workState: Record<string, any>): string[] {
  const steps: string[] = [];

  const testsPassed = workState.tests_passed || 0;
  const testsTotal = workState.tests_total || 0;

  if (testsTotal === 0) {
    steps.push('Run test suite: npm test');
    return steps;
  }

  if (testsPassed < testsTotal) {
    const failing = testsTotal - testsPassed;
    steps.push(`Fix ${failing} failing tests`);
    steps.push('Run tests: npm test');
  } else {
    steps.push(`✅ All tests passing (${testsTotal}/${testsTotal})`);
  }

  // Coverage
  if (workState.coverage_percent !== undefined) {
    const coverage = workState.coverage_percent;
    if (coverage < 80) {
      steps.push(`Improve test coverage (current: ${coverage}%, target: 80%)`);
    } else {
      steps.push(`✅ Test coverage: ${coverage}%`);
    }
  }

  return steps;
}

/**
 * Generate default verification steps
 */
function generateDefaultSteps(workState: Record<string, any>): string[] {
  return [
    'Check project status: git status',
    'Review active epics',
    'Run tests: npm test',
    'Check for pending PRs',
    'Continue building: Say "continue building"',
  ];
}

/**
 * Generate command to continue work
 *
 * @param workState Reconstructed work state
 * @returns Command string to resume work
 */
export function generateContinueCommand(
  workState: Record<string, any>
): string {
  if (workState.current_epic) {
    return `Continue working on ${workState.current_epic}: Say "continue building"`;
  }

  return 'Start work: Say "continue building"';
}

/**
 * Format next steps as markdown list
 *
 * @param steps Array of next steps
 * @returns Markdown formatted list
 */
export function formatNextStepsAsMarkdown(steps: string[]): string {
  return steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
}

/**
 * Prioritize steps based on urgency
 *
 * @param steps Array of next steps
 * @returns Prioritized steps (critical first)
 */
export function prioritizeSteps(steps: string[]): string[] {
  const critical: string[] = [];
  const important: string[] = [];
  const normal: string[] = [];

  for (const step of steps) {
    if (
      step.includes('failing') ||
      step.includes('error') ||
      step.includes('blocked')
    ) {
      critical.push(step);
    } else if (
      step.includes('merge') ||
      step.includes('complete') ||
      step.includes('push')
    ) {
      important.push(step);
    } else {
      normal.push(step);
    }
  }

  return [...critical, ...important, ...normal];
}
