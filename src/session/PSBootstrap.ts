/**
 * PS Bootstrap Helper (Epic 007-F)
 * Provides convenient methods for PSes to initialize and use session continuity
 *
 * Responsibilities:
 * - Initialize PS session on first response
 * - Auto-register instance with session continuity system
 * - Provide convenient methods for logging, heartbeat, checkpoints
 * - Handle resume command detection and processing
 * - Maintain session state throughout PS lifecycle
 */

import { registerInstance, markInstanceClosed } from './InstanceRegistry.js';
import { sendHeartbeatAsync } from './HeartbeatManager.js';
import { InstanceType } from '../types/session.js';
import { renderFooter, formatFooterComplete, FooterConfig } from './FooterRenderer.js';
import { getCommandLogger } from './CommandLogger.js';
import { Instance } from '../types/session.js';
import { EventLogger } from './EventLogger.js';

/**
 * PS session state
 */
export interface PSSessionState {
  instanceId: string;
  project: string;
  sessionStartTime: Date;
  currentEpic?: string;
  contextPercent: number;
  registered: boolean;
  logger?: EventLogger;
  currentUserMessageId?: string;
  currentProcessingId?: string;
}

/**
 * PS Bootstrap class - simplified API for PSes
 *
 * Usage in PS:
 * ```
 * const bootstrap = new PSBootstrap('odin-s');
 * const instanceId = await bootstrap.initialize();
 * // ... later ...
 * await bootstrap.logSpawn('task', 'Implement feature');
 * bootstrap.appendFooter(response);
 * ```
 */
export class PSBootstrap {
  private project: string;
  private state: PSSessionState | null = null;

  constructor(project: string) {
    this.project = project;
  }

  /**
   * Initialize PS session on startup
   * Registers instance and stores session state
   * Initializes EventLogger for event lineage tracking
   *
   * @returns Instance ID
   * @throws Error if registration fails
   *
   * @example
   * const instanceId = await bootstrap.initialize();
   * // Returns: 'odin-PS-8f4a2b'
   */
  async initialize(): Promise<string> {
    if (this.state?.registered) {
      // Already initialized
      return this.state.instanceId;
    }

    try {
      const instance = await registerInstance(this.project, InstanceType.PS);

      // Initialize EventLogger for event lineage tracking (Epic 008-C)
      const logger = new EventLogger(instance.instance_id);

      this.state = {
        instanceId: instance.instance_id,
        project: instance.project,
        sessionStartTime: instance.created_at,
        currentEpic: instance.current_epic,
        contextPercent: instance.context_percent,
        registered: true,
        logger,
      };

      console.log(`PS initialized: ${instance.instance_id}`);
      return instance.instance_id;
    } catch (error) {
      console.error('Failed to initialize PS:', error);
      throw error;
    }
  }

  /**
   * Get current instance ID
   *
   * @returns Instance ID or null if not initialized
   */
  getInstanceId(): string | null {
    return this.state?.instanceId || null;
  }

  /**
   * Get session state
   *
   * @returns Current session state
   * @throws Error if not initialized
   */
  getState(): PSSessionState {
    if (!this.state) {
      throw new Error('PS not initialized. Call initialize() first.');
    }
    return this.state;
  }

  /**
   * Get EventLogger instance for event lineage tracking
   *
   * @returns EventLogger instance
   * @throws Error if not initialized
   */
  getLogger(): EventLogger {
    if (!this.state?.logger) {
      throw new Error('PS not initialized or logger not available');
    }
    return this.state.logger;
  }

  /**
   * Update context percent (e.g., every N responses)
   *
   * @param contextPercent Context usage 0-100
   * @param currentEpic Optional current epic ID
   */
  updateContext(contextPercent: number, currentEpic?: string): void {
    if (!this.state) {
      console.warn('PS not initialized for context update');
      return;
    }

    this.state.contextPercent = contextPercent;
    if (currentEpic) {
      this.state.currentEpic = currentEpic;
    }

    // Heartbeat async (non-blocking)
    this.sendHeartbeatAsync();
  }

  /**
   * Send heartbeat (async, non-blocking)
   * Called automatically from updateContext(), can also be called manually
   */
  private sendHeartbeatAsync(): void {
    if (!this.state) {
      return;
    }

    sendHeartbeatAsync(this.state.instanceId, this.state.contextPercent, this.state.currentEpic);
  }

  /**
   * Append footer to response text
   *
   * @param responseText Text to append footer to
   * @returns Text with footer appended
   *
   * @example
   * response = bootstrap.appendFooter(response);
   */
  appendFooter(responseText: string): string {
    if (!this.state) {
      console.warn('PS not initialized for footer');
      return responseText;
    }

    const footer = formatFooterComplete({
      instanceId: this.state.instanceId,
      currentEpic: this.state.currentEpic,
      contextPercent: this.state.contextPercent,
      sessionStartTime: this.state.sessionStartTime,
      showResumeHint: this.state.contextPercent > 30,
    });

    return responseText + footer;
  }

  /**
   * Log a user message (root event for event lineage)
   * Call this at the start of processing a user message
   *
   * @param message User message content
   * @returns Event UUID for parent linkage
   */
  async logUserMessage(message: string): Promise<string> {
    if (!this.state) {
      console.warn('PS not initialized for user message log');
      return '';
    }

    try {
      const logger = this.state.logger;
      if (!logger) {
        console.warn('EventLogger not available for user message log');
        return '';
      }

      // Log user message as root event (parent: null)
      const userMsgId = await logger.log('user_message', {
        content: message.substring(0, 500), // Truncate to 500 chars
        timestamp: new Date().toISOString(),
      });

      this.state.currentUserMessageId = userMsgId;
      return userMsgId;
    } catch (error) {
      console.error('Failed to log user message:', error);
      return '';
    }
  }

  /**
   * Log processing start (linked to user message)
   * Call this when PS begins processing a request
   *
   * @returns Event UUID for parent linkage
   */
  async logProcessingStart(): Promise<string> {
    if (!this.state) {
      console.warn('PS not initialized for processing start log');
      return '';
    }

    try {
      const logger = this.state.logger;
      if (!logger || !this.state.currentUserMessageId) {
        console.warn('EventLogger or user message ID not available');
        return '';
      }

      // Log processing start with user message as parent
      let processingId = '';
      await logger.withParent(this.state.currentUserMessageId, async () => {
        processingId = await logger.log('assistant_start', {
          epic: this.state?.currentEpic,
          context_percent: this.state?.contextPercent,
          timestamp: new Date().toISOString(),
        });
      });

      this.state.currentProcessingId = processingId;
      return processingId;
    } catch (error) {
      console.error('Failed to log processing start:', error);
      return '';
    }
  }

  /**
   * Log a spawn decision
   * Call this whenever you decide to spawn a subagent
   *
   * @param subagentType Type of subagent (task, explore, plan, etc.)
   * @param reason Why this spawn is needed
   * @param model Model used (haiku, sonnet, opus)
   * @param epicId Optional epic being worked on
   * @returns Event UUID for parent linkage
   */
  async logSpawnDecision(
    subagentType: string,
    reason: string,
    model?: string,
    epicId?: string
  ): Promise<string> {
    if (!this.state) {
      console.warn('PS not initialized for spawn decision log');
      return '';
    }

    try {
      const logger = this.state.logger;
      if (!logger) {
        console.warn('EventLogger not available for spawn decision log');
        return '';
      }

      // Log spawn decision (will be child of current context if in withParent)
      const spawnId = await logger.log('spawn_decision', {
        reason,
        subagent_type: subagentType,
        model: model || 'haiku',
        epic_id: epicId,
        timestamp: new Date().toISOString(),
      });

      return spawnId;
    } catch (error) {
      console.error('Failed to log spawn decision:', error);
      return '';
    }
  }

  /**
   * Log a tool use (e.g., Task tool invocation)
   * Call this when invoking a tool
   *
   * @param tool Tool name (e.g., 'Task', 'Bash')
   * @param parameters Tool parameters (will be sanitized)
   * @param parentUuid Optional parent event UUID
   * @returns Event UUID for parent linkage
   */
  async logToolUse(
    tool: string,
    parameters: Record<string, any>,
    parentUuid?: string
  ): Promise<string> {
    if (!this.state) {
      console.warn('PS not initialized for tool use log');
      return '';
    }

    try {
      const logger = this.state.logger;
      if (!logger) {
        console.warn('EventLogger not available for tool use log');
        return '';
      }

      // Sanitize parameters (remove sensitive data)
      const sanitized = sanitizeToolParameters(parameters);

      const toolId = await logger.log('tool_use', {
        tool,
        parameters: sanitized,
        timestamp: new Date().toISOString(),
      }, { parentUuid });

      return toolId;
    } catch (error) {
      console.error('Failed to log tool use:', error);
      return '';
    }
  }

  /**
   * Log a tool result
   * Call this after a tool completes
   *
   * @param parentUuid Parent tool_use event UUID
   * @param success Whether tool succeeded
   * @param durationMs How long tool took
   * @param errorMessage Optional error message if failed
   */
  async logToolResult(
    parentUuid: string,
    success: boolean,
    durationMs: number,
    errorMessage?: string
  ): Promise<void> {
    if (!this.state) {
      console.warn('PS not initialized for tool result log');
      return;
    }

    try {
      const logger = this.state.logger;
      if (!logger) {
        console.warn('EventLogger not available for tool result log');
        return;
      }

      await logger.log('tool_result', {
        success,
        duration_ms: durationMs,
        error_message: errorMessage,
        timestamp: new Date().toISOString(),
      }, { parentUuid });
    } catch (error) {
      console.error('Failed to log tool result:', error);
    }
  }

  /**
   * Log an error event
   * Call this when an error occurs during processing
   *
   * @param errorType Type of error (e.g., 'spawn_failed', 'test_failure')
   * @param message Error message
   * @param stack Optional stack trace (truncated to 500 chars)
   * @param parentUuid Optional parent event UUID
   */
  async logError(
    errorType: string,
    message: string,
    stack?: string,
    parentUuid?: string
  ): Promise<void> {
    if (!this.state) {
      console.warn('PS not initialized for error log');
      return;
    }

    try {
      const logger = this.state.logger;
      if (!logger) {
        console.warn('EventLogger not available for error log');
        return;
      }

      await logger.log('error', {
        error_type: errorType,
        message,
        stack: stack?.substring(0, 500),
        timestamp: new Date().toISOString(),
      }, { parentUuid });
    } catch (error) {
      console.error('Failed to log error:', error);
    }
  }

  /**
   * Log a spawn command
   * Call this whenever you spawn a Task/Explore/Plan subagent
   *
   * @param subagentType Type of subagent (task, explore, plan, etc.)
   * @param description What the subagent is doing
   * @param model Model used (haiku, sonnet, opus)
   */
  async logSpawn(subagentType: string, description: string, model?: string): Promise<void> {
    if (!this.state) {
      console.warn('PS not initialized for spawn log');
      return;
    }

    try {
      const logger = getCommandLogger();
      await logger.logExplicit({
        instance_id: this.state.instanceId,
        action: 'spawn',
        details: {
          description,
          parameters: {
            subagent_type: subagentType,
            model: model || 'haiku',
          },
          tags: ['spawn', 'subagent'],
        },
      });
    } catch (error) {
      console.error('Failed to log spawn:', error);
    }
  }

  /**
   * Log a git commit
   * Call this whenever you commit code
   *
   * @param message Commit message
   * @param filesChanged Number of files changed
   * @param commitHash Git hash (optional)
   */
  async logCommit(message: string, filesChanged: number, commitHash?: string): Promise<void> {
    if (!this.state) {
      console.warn('PS not initialized for commit log');
      return;
    }

    try {
      const logger = getCommandLogger();
      await logger.logExplicit({
        instance_id: this.state.instanceId,
        action: 'commit',
        details: {
          description: message,
          parameters: {
            message,
            files_changed: filesChanged,
            commit_hash: commitHash,
          },
          tags: ['git', 'commit'],
        },
      });
    } catch (error) {
      console.error('Failed to log commit:', error);
    }
  }

  /**
   * Log a deployment
   * Call this whenever you deploy a service
   *
   * @param service Service name
   * @param port Port number
   * @param status Deployment status (success/failure)
   * @param details Additional details
   */
  async logDeploy(
    service: string,
    port: number,
    status: 'success' | 'failure',
    details?: Record<string, any>
  ): Promise<void> {
    if (!this.state) {
      console.warn('PS not initialized for deploy log');
      return;
    }

    try {
      const logger = getCommandLogger();
      await logger.logExplicit({
        instance_id: this.state.instanceId,
        action: 'deploy',
        details: {
          description: `Deploy ${service} to port ${port}`,
          parameters: {
            service,
            port,
            status,
            ...details,
          },
          tags: ['deploy', status],
        },
      });
    } catch (error) {
      console.error('Failed to log deploy:', error);
    }
  }

  /**
   * Log a PR creation
   * Call this whenever you create a pull request
   *
   * @param prUrl PR URL
   * @param epicId Related epic ID
   * @param title PR title
   */
  async logPRCreated(prUrl: string, epicId: string, title: string): Promise<void> {
    if (!this.state) {
      console.warn('PS not initialized for PR log');
      return;
    }

    try {
      const logger = getCommandLogger();
      await logger.logExplicit({
        instance_id: this.state.instanceId,
        action: 'pr_created',
        details: {
          description: `Created PR: ${title}`,
          parameters: {
            pr_url: prUrl,
            epic_id: epicId,
            title,
          },
          tags: ['github', 'pr'],
        },
      });
    } catch (error) {
      console.error('Failed to log PR:', error);
    }
  }

  /**
   * Log an epic completion
   * Call this when an epic is complete
   *
   * @param epicId Epic ID
   * @param testResults Test results summary
   * @param prUrl Related PR URL
   */
  async logEpicComplete(epicId: string, testResults?: string, prUrl?: string): Promise<void> {
    if (!this.state) {
      console.warn('PS not initialized for epic complete log');
      return;
    }

    this.state.currentEpic = undefined;

    try {
      const logger = getCommandLogger();
      await logger.logExplicit({
        instance_id: this.state.instanceId,
        action: 'epic_completed',
        details: {
          description: `Epic ${epicId} completed`,
          parameters: {
            epic_id: epicId,
            test_results: testResults,
            pr_url: prUrl,
          },
          tags: ['epic', 'complete'],
        },
      });
    } catch (error) {
      console.error('Failed to log epic complete:', error);
    }
  }

  /**
   * Check if response contains a resume command
   *
   * @param userMessage User message to check
   * @returns Extracted instance ID if resume command detected, null otherwise
   *
   * @example
   * const resumeId = bootstrap.detectResumeCommand('resume odin-PS-8f4a2b');
   * // Returns: 'odin-PS-8f4a2b'
   */
  detectResumeCommand(userMessage: string): string | null {
    const trimmed = userMessage.trim();

    if (!trimmed.toLowerCase().startsWith('resume ')) {
      return null;
    }

    const resumeId = trimmed.slice(7).trim();
    return resumeId || null;
  }

  /**
   * Close session (call on shutdown)
   */
  async close(): Promise<void> {
    if (!this.state?.registered) {
      return;
    }

    try {
      await markInstanceClosed(this.state.instanceId);
      console.log(`PS closed: ${this.state.instanceId}`);
    } catch (error) {
      console.error('Failed to close PS session:', error);
    }
  }

  /**
   * Execute callback within processing context
   * Ensures all logs within callback are properly linked to processing start
   *
   * @param callback Async function to execute
   * @returns Callback result
   */
  async withProcessingContext<T>(
    callback: () => Promise<T>
  ): Promise<T> {
    if (!this.state?.logger || !this.state?.currentProcessingId) {
      return callback();
    }

    return this.state.logger.withParent(
      this.state.currentProcessingId,
      callback
    );
  }
}

/**
 * Sanitize tool parameters to remove sensitive data
 * Removes API keys, passwords, tokens, etc.
 */
function sanitizeToolParameters(params: Record<string, any>): Record<string, any> {
  const sensitive = ['password', 'token', 'api_key', 'apiKey', 'secret', 'authorization', 'auth'];
  const result = { ...params };

  for (const key of Object.keys(result)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      result[key] = '[REDACTED]';
    }
  }

  return result;
}

/**
 * Create a PS bootstrap instance for a project
 *
 * @param project Project name (e.g., 'odin-s')
 * @returns New PSBootstrap instance
 *
 * @example
 * const bootstrap = createPSBootstrap('odin-s');
 * const instanceId = await bootstrap.initialize();
 */
export function createPSBootstrap(project: string): PSBootstrap {
  return new PSBootstrap(project);
}

/**
 * Example usage code for PSes to integrate session continuity
 */
export const INTEGRATION_EXAMPLE = `
// In your PS handler
import { createPSBootstrap } from './session/PSBootstrap.js';

const bootstrap = createPSBootstrap('odin-s');

async function handlePSRequest(userMessage: string): Promise<string> {
  // Initialize on first request
  if (!bootstrap.getInstanceId()) {
    await bootstrap.initialize();
  }

  // Check for resume command
  const resumeId = bootstrap.detectResumeCommand(userMessage);
  if (resumeId) {
    // Handle resume (call resume engine)
    return handleResume(resumeId);
  }

  // Your PS logic here
  let response = 'Working on epic-003...';

  // Update context (every N responses or periodically)
  bootstrap.updateContext(42, 'epic-003');

  // Log important actions
  await bootstrap.logSpawn('general-purpose', 'Implementing feature');

  // Append footer (EVERY response)
  response = bootstrap.appendFooter(response);

  return response;
}
`;
