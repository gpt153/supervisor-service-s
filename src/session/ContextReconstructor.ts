/**
 * Context Reconstructor Service (Epic 007-E)
 * Rebuilds instance state from checkpoint, events, or commands
 *
 * Responsibilities:
 * - Load checkpoint if available and recent (<1 hour)
 * - Replay events from event_store
 * - Analyze commands from command_log
 * - Fall back to basic state from supervisor_sessions
 * - Return reconstructed context with confidence score
 */

import { pool } from '../db/client.js';
import {
  ReconstructedContext,
  ReconstructionSource,
  ResumeSummary,
} from '../types/resume.js';

/**
 * Reconstruct context for an instance
 *
 * Priority:
 * 1. Load checkpoint (if exists and <1 hour old)
 * 2. Replay events (from event_store)
 * 3. Analyze commands (from command_log)
 * 4. Fallback to basic state (from supervisor_sessions)
 *
 * @param instanceId Instance ID to reconstruct
 * @returns Reconstructed context with confidence score
 *
 * @example
 * const context = await reconstructContext('odin-PS-8f4a2b');
 * // Returns: {
 * //   source: 'checkpoint',
 * //   confidence_score: 99,
 * //   work_state: { epic: 'epic-003', status: 'completed' },
 * //   summary: { ... }
 * // }
 */
export async function reconstructContext(
  instanceId: string
): Promise<ReconstructedContext> {
  // Priority 1: Try loading checkpoint
  const checkpointContext = await tryLoadCheckpoint(instanceId);
  if (checkpointContext) {
    return checkpointContext;
  }

  // Priority 2: Try replaying events
  const eventContext = await tryReplayEvents(instanceId);
  if (eventContext) {
    return eventContext;
  }

  // Priority 3: Try analyzing commands
  const commandContext = await tryAnalyzeCommands(instanceId);
  if (commandContext) {
    return commandContext;
  }

  // Priority 4: Fallback to basic state
  return await loadBasicState(instanceId);
}

/**
 * Priority 1: Try loading checkpoint (if exists and <1 hour old)
 */
async function tryLoadCheckpoint(
  instanceId: string
): Promise<ReconstructedContext | null> {
  try {
    // Check if checkpoints table exists
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'checkpoints'
      )`
    );

    if (!tableCheck.rows[0]?.exists) {
      // Checkpoints not implemented yet
      return null;
    }

    const result = await pool.query<{
      checkpoint_id: string;
      checkpoint_type: string;
      work_state: any;
      created_at: Date;
    }>(
      `SELECT
        checkpoint_id,
        checkpoint_type,
        work_state,
        created_at
      FROM checkpoints
      WHERE instance_id = $1
      AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 1`,
      [instanceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const checkpoint = result.rows[0];
    const ageMinutes = Math.floor(
      (Date.now() - new Date(checkpoint.created_at).getTime()) / 60000
    );

    // Calculate confidence based on age
    let confidence = 100;
    if (ageMinutes > 5) confidence = 90;
    if (ageMinutes > 30) confidence = 80;
    if (ageMinutes > 60) confidence = 70;

    const summary = await generateSummaryFromWorkState(
      checkpoint.work_state,
      instanceId
    );

    return {
      source: ReconstructionSource.CHECKPOINT,
      confidence_score: confidence,
      confidence_reason: `Checkpoint loaded (age: ${ageMinutes} min)`,
      work_state: checkpoint.work_state,
      summary,
      age_minutes: ageMinutes,
    };
  } catch (error) {
    // Checkpoint system not available or error
    return null;
  }
}

/**
 * Priority 2: Try replaying events from event_store
 * Uses parent chains for smarter reconstruction (Epic 008-C)
 */
async function tryReplayEvents(
  instanceId: string
): Promise<ReconstructedContext | null> {
  try {
    // Import EventLogger for parent chain support
    const { EventLogger } = await import('./EventLogger.js');
    const logger = new EventLogger(instanceId);

    // Get last 50 events (memory safe)
    const recentEvents = await logger.getRecentEvents(50);

    if (recentEvents.length === 0) {
      return null;
    }

    // Find last user message (root of current chain)
    const lastUserMsg = recentEvents
      .slice()
      .reverse()
      .find(e => e.event_type === 'user_message');

    const workState: Record<string, any> = {};
    const recentActions: string[] = [];

    if (lastUserMsg) {
      // Walk parent chain of most recent event for context
      try {
        const mostRecent = recentEvents[recentEvents.length - 1];
        const chain = await logger.getParentChain(mostRecent.event_id);

        // Extract state from chain
        for (const event of chain) {
          const action = `${event.event_type}: ${JSON.stringify(event.event_data).substring(0, 50)}...`;
          recentActions.push(action);

          // Extract work state from events
          if (event.event_type === 'epic_started' && event.event_data?.epic_id) {
            workState.current_epic = event.event_data.epic_id;
          }
          if (event.event_type === 'epic_completed' && event.event_data?.epic_id) {
            workState.last_completed_epic = event.event_data.epic_id;
          }
          if (event.event_type === 'test_passed') {
            workState.tests_passed = (workState.tests_passed || 0) + 1;
          }
          if (event.event_type === 'error') {
            workState.last_error = event.event_data?.message;
          }
        }
      } catch (error) {
        console.warn('Failed to walk parent chain, falling back to recent events');

        // Fallback: just use recent events without chain
        for (const event of recentEvents.slice(0, 10)) {
          const action = `${event.event_type}: ${JSON.stringify(event.event_data).substring(0, 50)}...`;
          recentActions.push(action);

          if (event.event_type === 'epic_started' && event.event_data?.epic_id) {
            workState.current_epic = event.event_data.epic_id;
          }
          if (event.event_type === 'test_passed') {
            workState.tests_passed = (workState.tests_passed || 0) + 1;
          }
        }
      }
    } else {
      // No user message found, just use recent events
      for (const event of recentEvents.slice(0, 10)) {
        const action = `${event.event_type}: ${JSON.stringify(event.event_data).substring(0, 50)}...`;
        recentActions.push(action);

        if (event.event_type === 'epic_started' && event.event_data?.epic_id) {
          workState.current_epic = event.event_data.epic_id;
        }
        if (event.event_type === 'test_passed') {
          workState.tests_passed = (workState.tests_passed || 0) + 1;
        }
      }
    }

    const ageMinutes = Math.floor(
      (Date.now() - new Date(recentEvents[0].timestamp).getTime()) / 60000
    );

    // Calculate confidence (events provide good confidence with parent chains)
    let confidence = 85;
    if (ageMinutes > 30) confidence = 75;
    if (ageMinutes > 60) confidence = 65;

    const summary = await generateSummaryFromWorkState(workState, instanceId);
    summary.recent_actions = recentActions;

    return {
      source: ReconstructionSource.EVENTS,
      confidence_score: confidence,
      confidence_reason: `Reconstructed from ${recentEvents.length} events with parent chain analysis (age: ${ageMinutes} min)`,
      work_state: workState,
      summary,
      age_minutes: ageMinutes,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Priority 3: Try analyzing commands from command_log
 */
async function tryAnalyzeCommands(
  instanceId: string
): Promise<ReconstructedContext | null> {
  try {
    const result = await pool.query<{
      command_type: string;
      command_args: any;
      created_at: Date;
    }>(
      `SELECT command_type, command_args, created_at
      FROM command_log
      WHERE instance_id = $1
      ORDER BY created_at DESC
      LIMIT 20`,
      [instanceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Analyze commands to infer state
    const workState: Record<string, any> = {};
    const recentActions: string[] = [];

    for (const cmd of result.rows.slice(0, 10)) {
      recentActions.push(`${cmd.command_type}`);

      // Infer state from command patterns
      if (cmd.command_type === 'spawn_subagent' && cmd.command_args?.epic_id) {
        workState.current_epic = cmd.command_args.epic_id;
      }
    }

    const ageMinutes = Math.floor(
      (Date.now() - new Date(result.rows[0].created_at).getTime()) / 60000
    );

    // Calculate confidence (commands provide lower confidence)
    let confidence = 70;
    if (ageMinutes > 30) confidence = 60;
    if (ageMinutes > 60) confidence = 50;

    const summary = await generateSummaryFromWorkState(workState, instanceId);
    summary.recent_actions = recentActions;

    return {
      source: ReconstructionSource.COMMANDS,
      confidence_score: confidence,
      confidence_reason: `Inferred from ${result.rows.length} commands (age: ${ageMinutes} min)`,
      work_state: workState,
      summary,
      age_minutes: ageMinutes,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Priority 4: Fallback to basic state from supervisor_sessions
 */
async function loadBasicState(
  instanceId: string
): Promise<ReconstructedContext> {
  const result = await pool.query<{
    project: string;
    instance_type: string;
    context_percent: number;
    current_epic: string | null;
    host_machine: string | null;
    last_heartbeat: Date;
  }>(
    `SELECT project, instance_type, context_percent, current_epic, host_machine, last_heartbeat
    FROM supervisor_sessions
    WHERE instance_id = $1`,
    [instanceId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Instance not found: ${instanceId}`);
  }

  const row = result.rows[0];
  const ageMinutes = Math.floor(
    (Date.now() - new Date(row.last_heartbeat).getTime()) / 60000
  );

  const workState: Record<string, any> = {
    project: row.project,
    current_epic: row.current_epic,
    context_percent: row.context_percent,
  };

  const summary: ResumeSummary = {
    recent_actions: ['No detailed history available'],
    next_steps: [
      'Review current epic status',
      'Check git status',
      'Run tests to verify state',
    ],
  };

  if (row.current_epic) {
    summary.current_epic = {
      epic_id: row.current_epic,
      name: 'Unknown',
      status: 'Unknown',
      time_hours: 0,
      tests_passed: 0,
      tests_total: 0,
      coverage_percent: 0,
    };
  }

  return {
    source: ReconstructionSource.BASIC,
    confidence_score: 40,
    confidence_reason: `Basic state only (age: ${ageMinutes} min). No checkpoint/events/commands available.`,
    work_state: workState,
    summary,
    age_minutes: ageMinutes,
  };
}

/**
 * Generate summary from work state
 */
async function generateSummaryFromWorkState(
  workState: Record<string, any>,
  instanceId: string
): Promise<ResumeSummary> {
  const summary: ResumeSummary = {
    recent_actions: [],
    next_steps: [],
  };

  // Try to get recent commands for actions
  try {
    const commandResult = await pool.query<{
      command_type: string;
      created_at: Date;
    }>(
      `SELECT command_type, created_at
      FROM command_log
      WHERE instance_id = $1
      ORDER BY created_at DESC
      LIMIT 5`,
      [instanceId]
    );

    summary.recent_actions = commandResult.rows.map(
      (row) => row.command_type
    );
  } catch (error) {
    summary.recent_actions = ['No command history available'];
  }

  // Generate next steps based on work state
  if (workState.current_epic) {
    summary.next_steps = [
      `Continue working on ${workState.current_epic}`,
      'Run tests to verify current state',
      'Check git status',
    ];

    summary.current_epic = {
      epic_id: workState.current_epic,
      name: workState.epic_name || 'Unknown',
      status: workState.epic_status || 'In Progress',
      time_hours: workState.time_hours || 0,
      tests_passed: workState.tests_passed || 0,
      tests_total: workState.tests_total || 0,
      coverage_percent: workState.coverage_percent || 0,
    };
  } else {
    summary.next_steps = [
      'Review project status',
      'Check for active epics',
      'Run tests',
    ];
  }

  // Try to get git status
  if (workState.branch) {
    summary.git_status = {
      branch: workState.branch,
      commits_ahead: workState.commits_ahead || 0,
      staged_files: workState.staged_files || 0,
      changed_files: workState.changed_files || 0,
    };
  }

  // Try to get checkpoint info
  if (workState.checkpoint_id) {
    summary.checkpoint = {
      checkpoint_id: workState.checkpoint_id,
      type: workState.checkpoint_type || 'manual',
      age_minutes: workState.checkpoint_age_minutes || 0,
    };
  }

  return summary;
}
