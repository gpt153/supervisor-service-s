/**
 * PS Health Monitor Service
 *
 * External health monitoring service that runs every 10 minutes to:
 * 1. Check active spawns for stalls/failures
 * 2. Prompt PS for context usage reports
 * 3. Track context window usage
 * 4. Trigger automated handoff cycle when context > 85%
 *
 * Phase 1: CLI Support (tmux-based prompting)
 * Phase 2: SDK/Browser Support (TBD)
 */

import { pool } from '../db/client.js';
import { PromptGenerator } from './prompt-generator.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type {
  PSSession,
  ActiveSpawn,
  HealthCheck,
  GeneratedPrompt,
} from '../types/monitoring.js';

const execFileAsync = promisify(execFile);

/**
 * Configuration for health monitor
 */
interface HealthMonitorConfig {
  /**
   * Check interval in milliseconds (default: 10 minutes)
   */
  checkInterval: number;

  /**
   * Stall threshold in minutes (default: 15)
   */
  stallThresholdMinutes: number;

  /**
   * Context thresholds
   */
  contextThresholds: {
    warning: number; // 0.70
    critical: number; // 0.85
  };

  /**
   * Enable automated handoff cycle (default: true for CLI)
   */
  enableAutoHandoff: boolean;

  /**
   * Handoff poll interval in milliseconds (default: 30 seconds)
   */
  handoffPollInterval: number;

  /**
   * Maximum time to wait for handoff in milliseconds (default: 5 minutes)
   */
  handoffMaxWait: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: HealthMonitorConfig = {
  checkInterval: 10 * 60 * 1000, // 10 minutes
  stallThresholdMinutes: 15,
  contextThresholds: {
    warning: 0.70,
    critical: 0.85,
  },
  enableAutoHandoff: true,
  handoffPollInterval: 30 * 1000, // 30 seconds
  handoffMaxWait: 5 * 60 * 1000, // 5 minutes
};

/**
 * PS Health Monitor
 *
 * Runs periodic health checks on all active project-supervisor sessions
 */
export class PSHealthMonitor {
  private config: HealthMonitorConfig;
  private promptGenerator: PromptGenerator;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.promptGenerator = new PromptGenerator();
  }

  /**
   * Start health monitoring loop
   */
  start(): void {
    if (this.isRunning) {
      console.log('[PS Health Monitor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[PS Health Monitor] 🚀 Starting health monitor');
    console.log(`[PS Health Monitor]    Check interval: ${this.config.checkInterval / 1000}s`);
    console.log(`[PS Health Monitor]    Stall threshold: ${this.config.stallThresholdMinutes}m`);

    // Run first check immediately
    this.runHealthChecks().catch((error) => {
      console.error('[PS Health Monitor] ❌ Error in first health check:', error);
    });

    // Schedule periodic checks
    this.intervalHandle = setInterval(() => {
      this.runHealthChecks().catch((error) => {
        console.error('[PS Health Monitor] ❌ Error in periodic health check:', error);
      });
    }, this.config.checkInterval);
  }

  /**
   * Stop health monitoring loop
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[PS Health Monitor] Not running');
      return;
    }

    console.log('[PS Health Monitor] 🛑 Stopping health monitor');
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
  }

  /**
   * Main health check loop
   * Runs every N minutes to check all active projects
   */
  async runHealthChecks(): Promise<void> {
    console.log('\n=== PS Health Check Cycle ===');
    console.log(`Time: ${new Date().toISOString()}`);

    try {
      // Get all projects with active sessions or spawns
      const projects = await this.getActiveProjects();

      if (projects.length === 0) {
        console.log('[PS Health Monitor] No active projects to monitor');
        return;
      }

      console.log(`[PS Health Monitor] Monitoring ${projects.length} projects: ${projects.join(', ')}`);

      // Check each project
      for (const project of projects) {
        await this.checkProject(project);
      }

      console.log('=== Health Check Cycle Complete ===\n');
    } catch (error) {
      console.error('[PS Health Monitor] ❌ Error in health check cycle:', error);
    }
  }

  /**
   * Get all projects that need monitoring
   * Returns projects with either active sessions or active spawns
   */
  private async getActiveProjects(): Promise<string[]> {
    const result = await pool.query<{ project: string }>(`
      SELECT DISTINCT project
      FROM active_monitoring_targets
      ORDER BY project
    `);

    return result.rows.map((row) => row.project);
  }

  /**
   * Check a single project
   * Performs spawn checks, context checks, and handoff triggers
   */
  private async checkProject(project: string): Promise<void> {
    console.log(`\n[${project}] Starting health checks`);

    try {
      // Step 1: Check active spawns
      await this.checkSpawns(project);

      // Step 2: Check context usage
      await this.checkContext(project);

      console.log(`[${project}] ✅ Health checks complete`);
    } catch (error) {
      console.error(`[${project}] ❌ Error in health checks:`, error);
      await this.recordHealthCheck(
        project,
        'error',
        'critical',
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Health check failed'
      );
    }
  }

  /**
   * Check all active spawns for a project
   * Detects stalled or failed spawns and prompts PS
   */
  private async checkSpawns(project: string): Promise<void> {
    const spawns = await this.getActiveSpawns(project);

    if (spawns.length === 0) {
      console.log(`[${project}] No active spawns`);
      return;
    }

    console.log(`[${project}] Checking ${spawns.length} active spawn(s)`);

    for (const spawn of spawns) {
      try {
        // Check if spawn output file exists and when it was last modified
        const minutesSinceOutput = await this.getMinutesSinceLastOutput(spawn);

        // Detect errors in output
        const errorMessage = await this.detectSpawnError(spawn);

        // Generate appropriate prompt
        const prompt = this.promptGenerator.generateSpawnPrompt(
          spawn,
          minutesSinceOutput,
          errorMessage
        );

        // Determine status
        let status: 'ok' | 'warning' | 'critical' = 'ok';
        if (errorMessage) {
          status = 'critical';
        } else if (minutesSinceOutput >= this.config.stallThresholdMinutes) {
          status = 'warning';
        }

        // Send prompt to PS
        await this.sendPromptToPS(prompt);

        // Record health check
        await this.recordHealthCheck(
          project,
          'spawn',
          status,
          {
            task_id: spawn.task_id,
            task_type: spawn.task_type,
            minutes_since_output: minutesSinceOutput,
            error_message: errorMessage,
          },
          `Prompted PS: ${prompt.type}`
        );

        console.log(`[${project}] Spawn ${spawn.task_id}: ${status} (${minutesSinceOutput}m since output)`);
      } catch (error) {
        console.error(`[${project}] ❌ Error checking spawn ${spawn.task_id}:`, error);
      }
    }
  }

  /**
   * Check context usage for a project
   * Prompts PS to report context, parses response, and triggers handoff if needed
   */
  private async checkContext(project: string): Promise<void> {
    console.log(`[${project}] Checking context usage`);

    try {
      // Get current session
      const session = await this.getSession(project);

      if (!session) {
        console.log(`[${project}] No active session found`);
        return;
      }

      // Only support CLI sessions for now (Phase 1)
      if (session.session_type !== 'cli') {
        console.log(`[${project}] SDK sessions not yet supported (Phase 2)`);
        return;
      }

      // Generate context check prompt
      const currentUsage = session.context_usage || 0;
      const contextPrompt = this.promptGenerator.generateContextPrompt(project, currentUsage);

      if (!contextPrompt) {
        console.log(`[${project}] No context check needed`);
        return;
      }

      // Send prompt to PS
      await this.sendPromptToPS(contextPrompt);

      // Determine status based on usage
      let status: 'ok' | 'warning' | 'critical' = 'ok';
      if (currentUsage >= this.config.contextThresholds.critical) {
        status = 'critical';
      } else if (currentUsage >= this.config.contextThresholds.warning) {
        status = 'warning';
      }

      // Record health check
      await this.recordHealthCheck(
        project,
        'context',
        status,
        {
          context_usage: currentUsage,
          context_percentage: Math.round(currentUsage * 100),
          prompt_type: contextPrompt.type,
        },
        `Prompted PS: ${contextPrompt.type}`
      );

      console.log(`[${project}] Context: ${Math.round(currentUsage * 100)}% - ${status}`);

      // If critical context and auto-handoff enabled, trigger handoff cycle
      if (
        status === 'critical' &&
        this.config.enableAutoHandoff &&
        contextPrompt.type === 'handoff_trigger'
      ) {
        console.log(`[${project}] 🔴 Triggering automated handoff cycle`);
        await this.triggerHandoffCycle(project);
      }
    } catch (error) {
      console.error(`[${project}] ❌ Error checking context:`, error);
    }
  }

  /**
   * Get active spawns for a project
   */
  private async getActiveSpawns(project: string): Promise<ActiveSpawn[]> {
    const result = await pool.query<ActiveSpawn>(
      `SELECT * FROM active_spawns
       WHERE project = $1 AND status = 'running'
       ORDER BY spawn_time ASC`,
      [project]
    );

    return result.rows;
  }

  /**
   * Get session for a project
   */
  private async getSession(project: string): Promise<PSSession | null> {
    const result = await pool.query<PSSession>(
      `SELECT * FROM ps_sessions WHERE project = $1`,
      [project]
    );

    return result.rows[0] || null;
  }

  /**
   * Get minutes since last output change for a spawn
   * Returns 0 if output file doesn't exist or couldn't be checked
   */
  private async getMinutesSinceLastOutput(spawn: ActiveSpawn): Promise<number> {
    if (!spawn.output_file) {
      return 0;
    }

    try {
      const stats = await fs.stat(spawn.output_file);
      const millisSinceChange = Date.now() - stats.mtimeMs;
      return Math.floor(millisSinceChange / 60000);
    } catch (error) {
      // File doesn't exist yet or can't be accessed
      const millisSinceSpawn = Date.now() - spawn.spawn_time.getTime();
      return Math.floor(millisSinceSpawn / 60000);
    }
  }

  /**
   * Detect error in spawn output
   * Returns error message if found, undefined otherwise
   */
  private async detectSpawnError(spawn: ActiveSpawn): Promise<string | undefined> {
    if (!spawn.output_file) {
      return undefined;
    }

    try {
      const content = await fs.readFile(spawn.output_file, 'utf-8');

      // Get last 50 lines for error detection
      const lines = content.split('\n');
      const lastLines = lines.slice(-50).join('\n');

      // Error patterns to detect
      const errorPatterns = [
        { pattern: /Error:/i, message: 'Error detected in output' },
        { pattern: /Failed:/i, message: 'Failure detected in output' },
        { pattern: /Exception:/i, message: 'Exception detected in output' },
        { pattern: /Traceback/i, message: 'Traceback detected in output' },
        { pattern: /fatal:/i, message: 'Fatal error detected' },
      ];

      for (const { pattern, message } of errorPatterns) {
        if (pattern.test(lastLines)) {
          // Extract the actual error line
          const match = lastLines.match(pattern);
          if (match) {
            const errorLine = lastLines.split('\n').find(line => pattern.test(line));
            return errorLine || message;
          }
          return message;
        }
      }

      return undefined;
    } catch (error) {
      // Can't read file yet
      return undefined;
    }
  }

  /**
   * Send prompt to PS via tmux send-keys
   * Only works for CLI sessions (Phase 1)
   */
  private async sendPromptToPS(prompt: GeneratedPrompt): Promise<void> {
    const command = this.promptGenerator.getTmuxCommand(prompt);

    try {
      console.log(`[${prompt.context.project}] Sending prompt via tmux: ${prompt.type}`);
      console.log(`[${prompt.context.project}]    Command: ${command}`);

      // Execute tmux command
      await execFileAsync('bash', ['-c', command]);

      console.log(`[${prompt.context.project}] ✅ Prompt sent`);
    } catch (error) {
      console.error(`[${prompt.context.project}] ❌ Failed to send prompt:`, error);
      throw error;
    }
  }

  /**
   * Record health check in database
   */
  private async recordHealthCheck(
    project: string,
    checkType: string,
    status: 'ok' | 'warning' | 'critical',
    details: Record<string, any>,
    actionTaken: string
  ): Promise<void> {
    await pool.query(
      `SELECT record_health_check($1, $2, $3, $4, $5)`,
      [project, checkType, status, JSON.stringify(details), actionTaken]
    );
  }

  /**
   * Trigger automated handoff cycle (CLI only)
   *
   * Steps:
   * 1. PS creates handoff document (already prompted)
   * 2. Wait for handoff file to appear
   * 3. Clear context with /clear
   * 4. Resume from handoff
   */
  private async triggerHandoffCycle(project: string): Promise<void> {
    console.log(`[${project}] 🔄 Starting automated handoff cycle`);

    try {
      // Step 1: Wait for handoff file to be created
      console.log(`[${project}] Waiting for handoff document...`);
      const handoffFile = await this.waitForHandoff(project);

      if (!handoffFile) {
        console.error(`[${project}] ❌ Handoff file not created within timeout`);
        await this.recordHealthCheck(
          project,
          'handoff',
          'critical',
          { error: 'Handoff timeout' },
          'Handoff cycle failed - timeout'
        );
        return;
      }

      console.log(`[${project}] ✅ Handoff created: ${handoffFile}`);

      // Step 2: Clear context
      console.log(`[${project}] Clearing context...`);
      await this.clearContext(project);

      // Wait a moment for clear to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Resume from handoff
      console.log(`[${project}] Resuming from handoff...`);
      await this.resumeFromHandoff(project, handoffFile);

      console.log(`[${project}] ✅ Handoff cycle complete`);

      // Record successful handoff
      await this.recordHealthCheck(
        project,
        'handoff',
        'ok',
        { handoff_file: handoffFile },
        'Handoff cycle completed successfully'
      );
    } catch (error) {
      console.error(`[${project}] ❌ Error in handoff cycle:`, error);
      await this.recordHealthCheck(
        project,
        'handoff',
        'critical',
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Handoff cycle failed'
      );
    }
  }

  /**
   * Wait for handoff file to appear
   * Polls the handoffs directory for new files
   */
  private async waitForHandoff(project: string): Promise<string | null> {
    const projectPath = `/home/samuel/sv/${project}-s`;
    const handoffsDir = path.join(projectPath, '.bmad', 'handoffs');

    const startTime = Date.now();
    const maxWait = this.config.handoffMaxWait;
    const pollInterval = this.config.handoffPollInterval;

    // Get list of existing handoff files before waiting
    let existingFiles: string[] = [];
    try {
      existingFiles = await fs.readdir(handoffsDir);
    } catch (error) {
      console.log(`[${project}] Handoffs directory doesn't exist yet, will wait for creation`);
    }

    while (Date.now() - startTime < maxWait) {
      try {
        const files = await fs.readdir(handoffsDir);

        // Find new files (not in existing list)
        const newFiles = files.filter(f => !existingFiles.includes(f) && f.startsWith('handoff-'));

        if (newFiles.length > 0) {
          // Return the newest file
          const newestFile = newFiles.sort().reverse()[0];
          return path.join(handoffsDir, newestFile);
        }
      } catch (error) {
        // Directory might not exist yet
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return null; // Timeout
  }

  /**
   * Clear PS context via /clear command
   */
  private async clearContext(project: string): Promise<void> {
    const sessionName = `${project}-ps`;
    const command = `tmux send-keys -t "${sessionName}" "/clear" Enter`;

    try {
      await execFileAsync('bash', ['-c', command]);
      console.log(`[${project}] ✅ Context cleared`);
    } catch (error) {
      console.error(`[${project}] ❌ Failed to clear context:`, error);
      throw error;
    }
  }

  /**
   * Resume PS from handoff document
   */
  private async resumeFromHandoff(project: string, handoffFile: string): Promise<void> {
    const sessionName = `${project}-ps`;
    const prompt = `Read handoff from ${handoffFile} and resume work`;
    const command = `tmux send-keys -t "${sessionName}" "${prompt}" Enter`;

    try {
      await execFileAsync('bash', ['-c', command]);
      console.log(`[${project}] ✅ Resume prompt sent`);
    } catch (error) {
      console.error(`[${project}] ❌ Failed to send resume prompt:`, error);
      throw error;
    }
  }

  /**
   * Get health check statistics
   * Useful for debugging and analytics
   */
  async getHealthStats(project?: string): Promise<any> {
    const query = project
      ? `SELECT * FROM health_check_summary WHERE project = $1 ORDER BY check_date DESC LIMIT 30`
      : `SELECT * FROM health_check_summary ORDER BY check_date DESC LIMIT 30`;

    const params = project ? [project] : [];
    const result = await pool.query(query, params);

    return result.rows;
  }
}
