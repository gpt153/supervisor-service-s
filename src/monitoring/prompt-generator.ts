/**
 * Prompt Generator - Generates appropriate prompts for PS health checks
 *
 * This module creates contextual prompts based on health status:
 * - Spawn status updates
 * - Spawn stall warnings
 * - Context usage checks
 * - Handoff triggers
 */

import {
  PromptType,
  PromptContext,
  GeneratedPrompt,
  ActiveSpawn,
} from '../types/monitoring.js';

/**
 * Prompt Generator class
 * Generates appropriate prompts based on PS health monitoring events
 */
export class PromptGenerator {
  /**
   * Generate prompt for regular spawn status update
   * Used for normal health checks when spawn is running normally
   *
   * @param spawn - Active spawn to check
   * @returns Generated prompt
   */
  generateSpawnUpdatePrompt(spawn: ActiveSpawn): GeneratedPrompt {
    const prompt = `Check active spawn status and provide brief progress update for task: ${spawn.task_id}${spawn.description ? ` (${spawn.description})` : ''}`;

    return {
      type: 'spawn_update',
      prompt,
      context: {
        project: spawn.project,
        task_id: spawn.task_id,
        task_description: spawn.description || undefined,
      },
      priority: 'normal',
    };
  }

  /**
   * Generate prompt for stalled spawn
   * Used when spawn hasn't produced output for 15+ minutes
   *
   * @param spawn - Stalled spawn
   * @param stallDurationMinutes - How long spawn has been stalled
   * @returns Generated prompt
   */
  generateSpawnStalledPrompt(
    spawn: ActiveSpawn,
    stallDurationMinutes: number
  ): GeneratedPrompt {
    const prompt = `Spawn ${spawn.task_id} has not produced output for ${Math.round(stallDurationMinutes)} minutes. Investigate and report status.`;

    return {
      type: 'spawn_stalled',
      prompt,
      context: {
        project: spawn.project,
        task_id: spawn.task_id,
        task_description: spawn.description || undefined,
        stall_duration_minutes: stallDurationMinutes,
      },
      priority: 'high',
    };
  }

  /**
   * Generate prompt for failed spawn
   * Used when spawn output indicates errors or failures
   *
   * @param spawn - Failed spawn
   * @param errorMessage - Optional error message detected
   * @returns Generated prompt
   */
  generateSpawnFailedPrompt(
    spawn: ActiveSpawn,
    errorMessage?: string
  ): GeneratedPrompt {
    let prompt = `Spawn ${spawn.task_id} appears to have failed.`;
    if (errorMessage) {
      prompt += ` Error detected: ${errorMessage}.`;
    }
    prompt += ' Investigate and determine next steps.';

    return {
      type: 'spawn_failed',
      prompt,
      context: {
        project: spawn.project,
        task_id: spawn.task_id,
        task_description: spawn.description || undefined,
        error_message: errorMessage,
      },
      priority: 'high',
    };
  }

  /**
   * Generate prompt for context usage check
   * Used for regular context monitoring every 10 minutes
   *
   * @param project - Project name
   * @returns Generated prompt
   */
  generateContextCheckPrompt(project: string): GeneratedPrompt {
    const prompt = 'Report your current context window usage from system warnings';

    return {
      type: 'context_check',
      prompt,
      context: {
        project,
      },
      priority: 'normal',
    };
  }

  /**
   * Generate prompt for high context warning
   * Used when context usage > 70% but < 85%
   *
   * @param project - Project name
   * @param contextPercentage - Current context usage percentage (0-100)
   * @returns Generated prompt
   */
  generateContextWarningPrompt(
    project: string,
    contextPercentage: number
  ): GeneratedPrompt {
    const prompt = `Context usage is high (${Math.round(contextPercentage)}%). Consider creating a handoff document after current work completes.`;

    return {
      type: 'context_warning',
      prompt,
      context: {
        project,
        context_percentage: contextPercentage,
      },
      priority: 'normal',
    };
  }

  /**
   * Generate prompt for critical context level
   * Used when context usage > 85% - requires immediate handoff
   *
   * @param project - Project name
   * @param contextPercentage - Current context usage percentage (0-100)
   * @returns Generated prompt
   */
  generateContextCriticalPrompt(
    project: string,
    contextPercentage: number
  ): GeneratedPrompt {
    const prompt = `CRITICAL: Context usage at ${Math.round(contextPercentage)}%. Stop accepting new work and focus only on completing current tasks. Prepare for handoff.`;

    return {
      type: 'context_critical',
      prompt,
      context: {
        project,
        context_percentage: contextPercentage,
      },
      priority: 'critical',
    };
  }

  /**
   * Generate prompt for handoff trigger
   * Used when context > 85% and PS must create handoff document now
   *
   * @param project - Project name
   * @param contextPercentage - Current context usage percentage (0-100)
   * @returns Generated prompt
   */
  generateHandoffTriggerPrompt(
    project: string,
    contextPercentage: number
  ): GeneratedPrompt {
    const prompt = `Create handoff document now - context at ${Math.round(contextPercentage)}%. Document current state, active work, and next steps in .bmad/handoffs/handoff-{timestamp}.md`;

    return {
      type: 'handoff_trigger',
      prompt,
      context: {
        project,
        context_percentage: contextPercentage,
      },
      priority: 'critical',
    };
  }

  /**
   * Generate appropriate prompt based on context usage level
   * Implements the context decision logic from Epic 040
   *
   * @param project - Project name
   * @param contextUsage - Context usage (0.0 to 1.0)
   * @returns Generated prompt or null if no action needed
   */
  generateContextPrompt(
    project: string,
    contextUsage: number
  ): GeneratedPrompt | null {
    const percentage = contextUsage * 100;

    if (contextUsage >= 0.85) {
      // Critical: MANDATORY handoff
      return this.generateHandoffTriggerPrompt(project, percentage);
    } else if (contextUsage >= 0.70) {
      // Warning: Only tiny tasks
      return this.generateContextCriticalPrompt(project, percentage);
    } else if (contextUsage >= 0.50) {
      // Moderate: Consider handoff timing
      return this.generateContextWarningPrompt(project, percentage);
    } else {
      // Normal: Regular check
      return this.generateContextCheckPrompt(project);
    }
  }

  /**
   * Generate prompt based on spawn status
   * Determines appropriate prompt type based on spawn state
   *
   * @param spawn - Active spawn
   * @param minutesSinceLastOutput - Minutes since last output change
   * @param errorDetected - Optional error message if detected
   * @returns Generated prompt
   */
  generateSpawnPrompt(
    spawn: ActiveSpawn,
    minutesSinceLastOutput?: number,
    errorDetected?: string
  ): GeneratedPrompt {
    // Failed spawn (error detected)
    if (errorDetected) {
      return this.generateSpawnFailedPrompt(spawn, errorDetected);
    }

    // Stalled spawn (no output for 15+ minutes)
    if (minutesSinceLastOutput !== undefined && minutesSinceLastOutput >= 15) {
      return this.generateSpawnStalledPrompt(spawn, minutesSinceLastOutput);
    }

    // Normal status update
    return this.generateSpawnUpdatePrompt(spawn);
  }

  /**
   * Format prompt for tmux send-keys
   * Escapes special characters and adds proper quoting
   *
   * @param generatedPrompt - Generated prompt object
   * @returns Formatted prompt string ready for tmux send-keys
   */
  formatForTmux(generatedPrompt: GeneratedPrompt): string {
    // Escape double quotes and backslashes
    const escaped = generatedPrompt.prompt
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

    return `"${escaped}"`;
  }

  /**
   * Get tmux send-keys command for a prompt
   * Generates the full bash command to execute
   *
   * @param generatedPrompt - Generated prompt object
   * @returns Full tmux send-keys command
   */
  getTmuxCommand(generatedPrompt: GeneratedPrompt): string {
    const sessionName = `${generatedPrompt.context.project}-ps`;
    const formattedPrompt = this.formatForTmux(generatedPrompt);

    return `tmux send-keys -t "${sessionName}" ${formattedPrompt} Enter`;
  }
}
