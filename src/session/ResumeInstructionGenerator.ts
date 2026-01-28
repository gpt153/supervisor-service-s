/**
 * Resume Instruction Generator (Epic 007-D)
 * Generates plain-language recovery instructions from checkpoint data
 *
 * Performance target: <50ms generation
 */

import { WorkState, CheckpointType, GitStatusSnapshot } from '../types/checkpoint.js';

/**
 * Resume Instruction Generator
 */
export class ResumeInstructionGenerator {
  /**
   * Generate resume instructions from work state
   * @param workState Work state from checkpoint
   * @param checkpointType Type of checkpoint (context_window, epic_completion, etc.)
   * @returns Plain-language markdown instructions
   */
  generate(workState: WorkState, checkpointType: CheckpointType): string {
    const start = Date.now();

    try {
      let instructions = this.generateHeader(workState, checkpointType);
      instructions += this.generateEpicSection(workState);
      instructions += this.generateFilesSection(workState);
      instructions += this.generateGitSection(workState);
      instructions += this.generateNextStepsSection(workState, checkpointType);

      const duration = Date.now() - start;

      if (duration > 50) {
        console.warn(`ResumeInstructionGenerator.generate slow: ${duration}ms`);
      }

      return instructions;
    } catch (error) {
      console.error('Failed to generate resume instructions:', error);
      return '# Error generating resume instructions\n\nPlease check the checkpoint data manually.';
    }
  }

  /**
   * Generate header section
   */
  private generateHeader(workState: WorkState, checkpointType: CheckpointType): string {
    const timestamp = new Date(workState.snapshot_at);
    const timeStr = timestamp.toLocaleString();

    let typeDescription = '';
    if (checkpointType === 'context_window') {
      typeDescription = 'Context window checkpoint';
    } else if (checkpointType === 'epic_completion') {
      typeDescription = 'Epic completion checkpoint';
    } else {
      typeDescription = 'Manual checkpoint';
    }

    return `# Resume Instructions

**Checkpoint Type**: ${typeDescription}
**Snapshot Time**: ${timeStr}
**Environment**: ${workState.environment.project} (${workState.environment.hostname})

---

## Summary

`;
  }

  /**
   * Generate epic section
   */
  private generateEpicSection(workState: WorkState): string {
    if (!workState.current_epic) {
      return '### Current Work\n\nNo active epic at checkpoint time.\n\n';
    }

    const epic = workState.current_epic;
    let section = `### Current Work

**Epic**: ${epic.epic_id}`;

    if (epic.feature_name) {
      section += ` (${epic.feature_name})`;
    }

    section += `\n**Status**: ${epic.status}`;

    if (epic.duration_hours) {
      section += `\n**Time Invested**: ${epic.duration_hours.toFixed(1)} hours`;
    }

    if (epic.test_results) {
      section += `\n**Test Results**:
  - Passed: ${epic.test_results.passed}
  - Failed: ${epic.test_results.failed}`;

      if (epic.test_results.coverage) {
        section += `\n  - Coverage: ${epic.test_results.coverage}%`;
      }
    }

    section += '\n\n';
    return section;
  }

  /**
   * Generate files section
   */
  private generateFilesSection(workState: WorkState): string {
    if (workState.files_modified.length === 0) {
      return '### Files Modified\n\nNo files modified at checkpoint time.\n\n';
    }

    let section = `### Files Modified

${workState.files_modified.length} file(s) changed:

`;

    for (const file of workState.files_modified.slice(0, 10)) {
      const status_icon = file.status === 'added' ? '✏️' : file.status === 'deleted' ? '❌' : '🔄';
      section += `- ${status_icon} \`${file.path}\` (${file.lines_changed} lines)`;
      section += '\n';
    }

    if (workState.files_modified.length > 10) {
      section += `\n... and ${workState.files_modified.length - 10} more files\n`;
    }

    section += '\n';
    return section;
  }

  /**
   * Generate git section
   */
  private generateGitSection(workState: WorkState): string {
    const git = workState.git_status;

    let section = `### Git Status

- **Branch**: \`${git.branch}\`
- **Commits**: ${git.commit_count}
- **Staged**: ${git.staged_files} file(s)
- **Unstaged**: ${git.unstaged_files} file(s)
- **Untracked**: ${git.untracked_files} file(s)

`;

    return section;
  }

  /**
   * Generate next steps section
   */
  private generateNextStepsSection(workState: WorkState, checkpointType: CheckpointType): string {
    let section = '### Next Steps\n\n';

    const steps: string[] = [];

    if (checkpointType === 'context_window') {
      steps.push(
        '1. **Continue development**: You were at 80% context usage. Continue with the current epic.'
      );
      steps.push('2. **Commit progress**: Stage and commit any changes.');
      steps.push(
        '3. **Monitor context**: Watch for next checkpoint at 90-95% context window.'
      );
    } else if (checkpointType === 'epic_completion') {
      steps.push(
        `1. **Epic Complete**: ${workState.current_epic?.epic_id || 'Epic'} is done!`
      );
      steps.push('2. **Merge PR**: Create or merge pull request if not already done.');
      steps.push('3. **Review Results**: Check test coverage and deployment status.');
      steps.push('4. **Plan Next Epic**: Start planning the next feature.');
    } else {
      steps.push('1. **Resume work**: Continue from where you left off.');
      steps.push('2. **Review changes**: Check git status and modified files.');
      steps.push('3. **Next action**: Reference the epic status to determine next steps.');
    }

    section += steps.join('\n');
    section += '\n\n';

    if (workState.last_commands.length > 0) {
      section += '### Recent Commands\n\n';
      section += 'Last actions taken:\n\n';

      for (const cmd of workState.last_commands.slice(0, 5)) {
        section += `- ${cmd.timestamp}: ${cmd.action || cmd.type}`;
        section += '\n';
      }

      section += '\n';
    }

    return section;
  }
}

/**
 * Global instance (singleton)
 */
let globalGenerator: ResumeInstructionGenerator | null = null;

/**
 * Get or create the global resume instruction generator
 */
export function getResumeInstructionGenerator(): ResumeInstructionGenerator {
  if (!globalGenerator) {
    globalGenerator = new ResumeInstructionGenerator();
  }
  return globalGenerator;
}

/**
 * Reset the global instance (for testing)
 */
export function resetResumeInstructionGenerator(): void {
  globalGenerator = null;
}
