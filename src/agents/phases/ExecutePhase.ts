/**
 * Execute Phase - Validation-Driven Implementation
 *
 * Executes the implementation plan:
 * - Reads prescriptive instructions from Plan phase
 * - Implements each task in order
 * - Runs validation after each task
 * - Retries on failure (once)
 * - Creates feature branch and commits
 * - Creates PR linked to GitHub issue
 *
 * NOTE: This class orchestrates execution but doesn't do the actual coding.
 * In production, this would spawn a Claude agent (Haiku) with the prescriptive
 * instructions to perform the actual implementation.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  Epic,
  ExecuteResult,
  TaskResult,
  ValidationResult,
  ImplementationPlan,
} from '../../types/piv.js';
import { PIVStorage } from '../../utils/storage.js';

const execAsync = promisify(exec);

export interface ExecuteOptions {
  baseBranch?: string;
  createBranch?: boolean;
  createPR?: boolean;
  maxRetries?: number;
}

export class ExecutePhase {
  private storage: PIVStorage;
  private workingDirectory: string;

  constructor(
    workingDirectory: string,
    options?: {
      plansDir?: string;
      contextDir?: string;
    }
  ) {
    this.workingDirectory = workingDirectory;
    this.storage = new PIVStorage(workingDirectory, {
      plansDir: options?.plansDir,
      contextDir: options?.contextDir,
    });
  }

  /**
   * Execute the Execute phase
   *
   * Process:
   * 1. Load implementation plan
   * 2. Create feature branch
   * 3. Execute phases in order
   * 4. For each task:
   *    - Execute implementation (via AI agent)
   *    - Run validations
   *    - Retry if needed
   *    - Commit changes
   * 5. Run overall validation
   * 6. Create PR
   *
   * @returns ExecuteResult with PR info and validation results
   */
  async execute(
    epic: Epic,
    options: ExecuteOptions = {}
  ): Promise<ExecuteResult> {
    console.log(`[ExecutePhase] Starting execution for ${epic.id}...`);

    const startTime = Date.now();
    const {
      baseBranch = 'main',
      createBranch = true,
      createPR = true,
      maxRetries = 1,
    } = options;

    // Step 1: Load implementation plan
    console.log('[ExecutePhase] Loading implementation plan...');
    const plan = await this.storage.loadPlanJSON(epic.id);

    // Step 2: Create feature branch
    let branch = '';
    if (createBranch) {
      console.log('[ExecutePhase] Creating feature branch...');
      branch = await this.createFeatureBranch(epic, baseBranch);
    } else {
      branch = await this.getCurrentBranch();
    }

    // Step 3: Execute tasks
    const taskResults: TaskResult[] = [];
    const filesChanged: Set<string> = new Set();

    for (const phase of plan.phases) {
      console.log(`[ExecutePhase] Executing phase: ${phase.name}`);

      for (const task of phase.tasks) {
        console.log(`[ExecutePhase] Executing task: ${task.id} - ${task.title}`);

        const taskStartTime = Date.now();
        const result = await this.executeTask(task, plan, maxRetries);

        taskResults.push({
          ...result,
          duration: Date.now() - taskStartTime,
        });

        // Track changed files
        for (const file of result.filesChanged) {
          filesChanged.add(file);
        }

        // If task failed and can't be retried, stop execution
        if (!result.success) {
          console.error(`[ExecutePhase] Task ${task.id} failed. Stopping execution.`);
          break;
        }

        // Commit after each successful task
        if (result.success && result.filesChanged.length > 0) {
          await this.commitTask(task, result.filesChanged);
        }
      }
    }

    // Step 4: Run overall validation
    console.log('[ExecutePhase] Running overall validation...');
    const overallValidation = await this.runOverallValidation(plan);

    const testsPass = overallValidation.every((v) => v.success);
    const buildSuccess = overallValidation.find((v) => v.command.includes('build'))?.success || false;

    // Step 5: Create PR
    let prNumber: number | undefined;
    let prUrl: string | undefined;

    if (createPR && testsPass && buildSuccess) {
      console.log('[ExecutePhase] Creating pull request...');
      const prResult = await this.createPullRequest(epic, branch, baseBranch);
      prNumber = prResult.number;
      prUrl = prResult.url;
    } else if (!testsPass || !buildSuccess) {
      console.warn('[ExecutePhase] Skipping PR creation due to validation failures');
    }

    const totalDuration = Date.now() - startTime;
    const success = taskResults.every((r) => r.success) && testsPass && buildSuccess;

    console.log(`[ExecutePhase] Execution ${success ? 'completed successfully' : 'failed'}`);

    return {
      success,
      branch,
      commit: await this.getLatestCommit(),
      prNumber,
      prUrl,
      taskResults,
      totalDuration,
      filesChanged: Array.from(filesChanged),
      testsPass,
      buildSuccess,
    };
  }

  /**
   * Execute a single task with retries
   */
  private async executeTask(
    task: any,
    plan: ImplementationPlan,
    maxRetries: number
  ): Promise<TaskResult> {
    let retries = 0;
    let lastError: string | undefined;

    while (retries <= maxRetries) {
      try {
        // NOTE: In production, this would spawn a Claude agent (Haiku)
        // with the prescriptive instructions to perform actual implementation.
        // For now, this is a placeholder that returns a simulated result.

        console.log(`[ExecutePhase] Attempt ${retries + 1}/${maxRetries + 1} for task ${task.id}`);

        // Simulate implementation (in production, call AI agent here)
        const filesChanged = task.files;

        // Run validations
        const validationResults: ValidationResult[] = [];
        let allValidationsPassed = true;

        for (const validation of task.validations) {
          const validationResult = await this.runValidation(validation);
          validationResults.push(validationResult);

          if (!validationResult.success) {
            allValidationsPassed = false;

            if (validation.failureAction === 'retry' && retries < maxRetries) {
              console.warn(`[ExecutePhase] Validation failed: ${validation.description}. Retrying...`);
              lastError = validationResult.error || 'Validation failed';
              break;
            } else if (validation.failureAction === 'escalate') {
              console.error(`[ExecutePhase] Validation failed: ${validation.description}. Escalating...`);
              return {
                taskId: task.id,
                success: false,
                filesChanged: [],
                validationResults,
                retries,
                error: validationResult.error || 'Validation failed - escalation required',
                duration: 0,
              };
            }
          }
        }

        if (allValidationsPassed) {
          return {
            taskId: task.id,
            success: true,
            filesChanged,
            validationResults,
            retries,
            duration: 0,
          };
        }

        retries++;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error(`[ExecutePhase] Task execution error:`, lastError);
        retries++;
      }
    }

    // All retries exhausted
    return {
      taskId: task.id,
      success: false,
      filesChanged: [],
      validationResults: [],
      retries,
      error: lastError || 'Max retries exhausted',
      duration: 0,
    };
  }

  /**
   * Run a validation command
   */
  private async runValidation(validation: any): Promise<ValidationResult> {
    const timestamp = new Date().toISOString();

    try {
      const { stdout, stderr } = await execAsync(validation.command, {
        cwd: this.workingDirectory,
      });

      const output = stdout + stderr;
      const success = this.checkValidationSuccess(output, validation.expectedOutput);

      return {
        command: validation.command,
        success,
        output: output.trim(),
        error: success ? undefined : 'Output does not match expected',
        timestamp,
      };
    } catch (error) {
      return {
        command: validation.command,
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      };
    }
  }

  /**
   * Check if validation output matches expected
   */
  private checkValidationSuccess(output: string, expectedOutput?: string): boolean {
    if (!expectedOutput) {
      // If no expected output specified, just check for no errors
      return !output.toLowerCase().includes('error') || output.includes('0 errors');
    }

    // Simple substring match (in production, use more sophisticated matching)
    return output.toLowerCase().includes(expectedOutput.toLowerCase());
  }

  /**
   * Run overall validation commands
   */
  private async runOverallValidation(plan: ImplementationPlan): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const validation of plan.overallValidation) {
      console.log(`[ExecutePhase] Running validation: ${validation.description}`);
      const result = await this.runValidation(validation);
      results.push(result);

      if (!result.success) {
        console.warn(`[ExecutePhase] Validation failed: ${validation.description}`);
      }
    }

    return results;
  }

  /**
   * Create feature branch
   */
  private async createFeatureBranch(epic: Epic, baseBranch: string): Promise<string> {
    const branchName = `feature/${epic.id.toLowerCase()}`;

    try {
      // Ensure we're on base branch
      await execAsync(`git checkout ${baseBranch}`, { cwd: this.workingDirectory });

      // Pull latest
      await execAsync('git pull', { cwd: this.workingDirectory });

      // Create and checkout feature branch
      await execAsync(`git checkout -b ${branchName}`, { cwd: this.workingDirectory });

      console.log(`[ExecutePhase] Created branch: ${branchName}`);
      return branchName;
    } catch (error) {
      console.error('[ExecutePhase] Failed to create branch:', error);
      throw error;
    }
  }

  /**
   * Get current branch name
   */
  private async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: this.workingDirectory,
      });
      return stdout.trim();
    } catch (error) {
      console.error('[ExecutePhase] Failed to get current branch:', error);
      return 'unknown';
    }
  }

  /**
   * Commit task changes
   */
  private async commitTask(task: any, filesChanged: string[]): Promise<void> {
    try {
      // Add files
      for (const file of filesChanged) {
        await execAsync(`git add ${file}`, { cwd: this.workingDirectory });
      }

      // Commit
      const commitMessage = `${task.id}: ${task.title}\n\nCo-Authored-By: PIV Agent <noreply@supervisor.dev>`;
      await execAsync(`git commit -m "${commitMessage}"`, { cwd: this.workingDirectory });

      console.log(`[ExecutePhase] Committed task ${task.id}`);
    } catch (error) {
      console.error('[ExecutePhase] Failed to commit:', error);
      // Non-fatal - continue execution
    }
  }

  /**
   * Get latest commit hash
   */
  private async getLatestCommit(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', {
        cwd: this.workingDirectory,
      });
      return stdout.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Create pull request
   */
  private async createPullRequest(
    epic: Epic,
    branch: string,
    baseBranch: string
  ): Promise<{ number: number; url: string }> {
    try {
      // Push branch
      await execAsync(`git push -u origin ${branch}`, { cwd: this.workingDirectory });

      // Create PR using GitHub CLI
      const prTitle = epic.title;
      const prBody = `${epic.description}\n\nImplements: #${epic.id}\n\n🤖 Generated by PIV Agent`;

      const { stdout } = await execAsync(
        `gh pr create --title "${prTitle}" --body "${prBody}" --base ${baseBranch}`,
        { cwd: this.workingDirectory }
      );

      // Extract PR number from URL (e.g., https://github.com/user/repo/pull/42)
      const prUrl = stdout.trim();
      const prNumber = parseInt(prUrl.split('/').pop() || '0', 10);

      console.log(`[ExecutePhase] Created PR #${prNumber}: ${prUrl}`);

      return { number: prNumber, url: prUrl };
    } catch (error) {
      console.error('[ExecutePhase] Failed to create PR:', error);
      throw error;
    }
  }
}
