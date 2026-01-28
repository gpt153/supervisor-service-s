/**
 * Resume Engine Service (Epic 007-E)
 * Main orchestrator for instance resume operations
 *
 * Responsibilities:
 * - Coordinate instance resolution, context reconstruction, confidence scoring
 * - Generate resume summaries and handoff documents
 * - Handle disambiguation and error cases
 * - Provide complete resume workflow
 */

import { pool } from '../db/client.js';
import { resolveInstance, validateInstanceIsStale } from './InstanceResolver.js';
import { reconstructContext } from './ContextReconstructor.js';
import { calculateConfidence } from './ConfidenceScorer.js';
import { generateNextSteps } from './NextStepGenerator.js';
import {
  ResumeInstanceResponse,
  ResumeInstanceResponseSuccess,
  ResumeInstanceResponseDisambiguation,
  ResumeInstanceResponseError,
  GetInstanceDetailsResponse,
  ListStaleInstancesResponse,
  StaleInstanceItem,
  ResolutionResultSingle,
  ResolutionResultMultiple,
  ResolutionResultNotFound,
} from '../types/resume.js';
import { InstanceType, InstanceStatus } from '../types/session.js';

/**
 * Resume an instance by ID, project, epic, or newest
 *
 * Main entry point for resume operations. Handles:
 * - Instance resolution (exact, partial, project, epic, newest)
 * - Disambiguation (if multiple matches)
 * - Context reconstruction (checkpoint/events/commands/basic)
 * - Confidence scoring
 * - Summary generation
 * - Handoff document creation (optional)
 *
 * @param instanceIdHint Instance ID hint (can be full ID, partial, project, or epic)
 * @param userChoice User's choice when disambiguating (1, 2, 3, etc.)
 * @returns Resume response (success, disambiguation, or error)
 *
 * @example
 * // Exact ID
 * const result = await resumeInstance('odin-PS-8f4a2b');
 * // Returns: { success: true, instance_id: '...', summary: {...}, confidence_score: 95 }
 *
 * @example
 * // Project (multiple matches)
 * const result = await resumeInstance('odin');
 * // Returns: { success: false, matches: [...], user_hint: "Use: 'resume 8f4a2b'" }
 *
 * @example
 * // Disambiguate
 * const result = await resumeInstance('odin', 1);
 * // Returns: { success: true, ... } (first match selected)
 */
export async function resumeInstance(
  instanceIdHint?: string,
  userChoice?: number
): Promise<ResumeInstanceResponse> {
  try {
    // Step 1: Resolve instance
    const resolution = await resolveInstance(instanceIdHint);

    // Handle disambiguation
    if (!resolution.success) {
      const multipleResult = resolution as
        | ResolutionResultMultiple
        | ResolutionResultNotFound;

      if ('matches' in multipleResult) {
        // Multiple matches - check if user provided choice
        if (userChoice !== undefined) {
          if (
            userChoice < 1 ||
            userChoice > multipleResult.matches.length
          ) {
            return {
              success: false,
              error: `Invalid choice ${userChoice}. Must be between 1 and ${multipleResult.matches.length}`,
            } as ResumeInstanceResponseError;
          }

          // Use user's choice
          const chosenInstance =
            multipleResult.matches[userChoice - 1];
          return await performResume(chosenInstance.instance_id);
        }

        // Return disambiguation response
        return {
          success: false,
          matches: multipleResult.matches,
          user_hint: multipleResult.hint,
        } as ResumeInstanceResponseDisambiguation;
      }

      // Not found
      const notFoundResult = resolution as ResolutionResultNotFound;
      return {
        success: false,
        error: notFoundResult.error,
      } as ResumeInstanceResponseError;
    }

    // Single match found
    const singleResult = resolution as ResolutionResultSingle;
    return await performResume(singleResult.instance_id);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Resume operation failed',
    } as ResumeInstanceResponseError;
  }
}

/**
 * Perform resume operation for a specific instance
 */
async function performResume(
  instanceId: string
): Promise<ResumeInstanceResponse> {
  try {
    // Step 1: Validate instance is stale
    await validateInstanceIsStale(instanceId);

    // Step 2: Get instance details
    const instanceResult = await pool.query<{
      project: string;
      instance_type: string;
      current_epic: string | null;
      context_percent: number;
      last_heartbeat: Date;
    }>(
      `SELECT project, instance_type, current_epic, context_percent, last_heartbeat
      FROM supervisor_sessions
      WHERE instance_id = $1`,
      [instanceId]
    );

    if (instanceResult.rows.length === 0) {
      return {
        success: false,
        error: `Instance not found: ${instanceId}`,
      } as ResumeInstanceResponseError;
    }

    const instance = instanceResult.rows[0];

    // Step 3: Reconstruct context
    const context = await reconstructContext(instanceId);

    // Step 4: Calculate confidence
    const confidenceResult = await calculateConfidence({
      source: context.source,
      age_minutes: context.age_minutes,
      files_exist: true, // Already validated in reconstructContext
      branch_exists: true,
      work_state: context.work_state,
    });

    // Step 5: Generate next steps
    const nextSteps = generateNextSteps(context.work_state, context.summary);
    context.summary.next_steps = nextSteps;

    // Step 6: Generate handoff document (optional)
    const handoffDocument = await generateHandoffDocument(
      instanceId,
      instance.project,
      context.summary,
      confidenceResult.score,
      confidenceResult.reason
    );

    // Step 7: Return success response
    return {
      success: true,
      instance_id: instanceId,
      project: instance.project,
      summary: context.summary,
      confidence_score: confidenceResult.score,
      confidence_reason: confidenceResult.reason,
      handoff_document: handoffDocument,
    } as ResumeInstanceResponseSuccess;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Resume operation failed',
    } as ResumeInstanceResponseError;
  }
}

/**
 * Get detailed instance information
 *
 * @param instanceId Instance ID to query
 * @returns Instance details with recent commands
 *
 * @example
 * const details = await getInstanceDetails('odin-PS-8f4a2b');
 * // Returns: {
 * //   instance_id: 'odin-PS-8f4a2b',
 * //   project: 'odin',
 * //   status: 'stale',
 * //   ...
 * // }
 */
export async function getInstanceDetails(
  instanceId: string
): Promise<GetInstanceDetailsResponse> {
  // Get instance info
  const instanceResult = await pool.query<{
    project: string;
    instance_type: string;
    status: string;
    created_at: Date;
    last_heartbeat: Date;
    context_percent: number;
    current_epic: string | null;
  }>(
    `SELECT
      project,
      instance_type,
      status,
      created_at,
      last_heartbeat,
      context_percent,
      current_epic
    FROM supervisor_sessions
    WHERE instance_id = $1`,
    [instanceId]
  );

  if (instanceResult.rows.length === 0) {
    throw new Error(`Instance not found: ${instanceId}`);
  }

  const instance = instanceResult.rows[0];

  // Calculate age
  const ageMinutes = Math.floor(
    (Date.now() - new Date(instance.last_heartbeat).getTime()) / 60000
  );

  // Get recent commands
  const commandsResult = await pool.query<{
    command_type: string;
    created_at: Date;
    command_args: any;
  }>(
    `SELECT command_type, created_at, command_args
    FROM command_log
    WHERE instance_id = $1
    ORDER BY created_at DESC
    LIMIT 10`,
    [instanceId]
  );

  const recentCommands = commandsResult.rows.map((row) => ({
    command_type: row.command_type,
    timestamp: row.created_at.toISOString(),
    summary: row.command_args
      ? JSON.stringify(row.command_args).substring(0, 100)
      : 'No args',
  }));

  // Try to get checkpoint info
  let checkpointInfo: any = undefined;
  try {
    const checkpointResult = await pool.query<{
      checkpoint_id: string;
      checkpoint_type: string;
      created_at: Date;
    }>(
      `SELECT checkpoint_id, checkpoint_type, created_at
      FROM checkpoints
      WHERE instance_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
      [instanceId]
    );

    if (checkpointResult.rows.length > 0) {
      const checkpoint = checkpointResult.rows[0];
      checkpointInfo = {
        checkpoint_id: checkpoint.checkpoint_id,
        timestamp: checkpoint.created_at.toISOString(),
        type: checkpoint.checkpoint_type,
      };
    }
  } catch (error) {
    // Checkpoints table might not exist
  }

  return {
    instance_id: instanceId,
    project: instance.project,
    instance_type: instance.instance_type as InstanceType,
    status: instance.status as InstanceStatus,
    registration_time: instance.created_at.toISOString(),
    last_heartbeat: instance.last_heartbeat.toISOString(),
    last_heartbeat_ago_minutes: ageMinutes,
    context_window_percent: instance.context_percent,
    current_epic: instance.current_epic || undefined,
    checkpoint_info: checkpointInfo,
    recent_commands: recentCommands,
  };
}

/**
 * List all stale instances (last heartbeat >2 min ago)
 *
 * @returns List of stale instances
 *
 * @example
 * const staleInstances = await listStaleInstances();
 * // Returns: {
 * //   instances: [{ instance_id: '...', project: 'odin', ... }],
 * //   total_count: 3
 * // }
 */
export async function listStaleInstances(): Promise<ListStaleInstancesResponse> {
  const result = await pool.query<{
    instance_id: string;
    project: string;
    instance_type: string;
    last_heartbeat: Date;
    current_epic: string | null;
  }>(
    `SELECT
      instance_id,
      project,
      instance_type,
      last_heartbeat,
      current_epic
    FROM supervisor_sessions
    WHERE status != 'closed'
    AND EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) >= 120
    ORDER BY last_heartbeat DESC`
  );

  const instances: StaleInstanceItem[] = result.rows.map((row) => {
    const minutesStale = Math.floor(
      (Date.now() - new Date(row.last_heartbeat).getTime()) / 60000
    );

    return {
      instance_id: row.instance_id,
      project: row.project,
      instance_type: row.instance_type as InstanceType,
      last_heartbeat: row.last_heartbeat.toISOString(),
      minutes_stale: minutesStale,
      last_epic: row.current_epic || undefined,
    };
  });

  return {
    instances,
    total_count: instances.length,
  };
}

/**
 * Generate handoff document in markdown format
 */
async function generateHandoffDocument(
  instanceId: string,
  project: string,
  summary: any,
  confidenceScore: number,
  confidenceReason: string
): Promise<string> {
  const timestamp = new Date().toISOString().split('T')[0];
  const epicId = summary.current_epic?.epic_id || 'unknown';

  let doc = `# Resume Handoff: ${instanceId}\n\n`;
  doc += `**Generated**: ${timestamp}\n`;
  doc += `**Instance**: ${instanceId}\n`;
  doc += `**Project**: ${project}\n`;
  doc += `**Confidence**: ${confidenceScore}% - ${confidenceReason}\n\n`;
  doc += `---\n\n`;

  if (summary.current_epic) {
    doc += `## Current Epic\n\n`;
    doc += `**Epic**: ${summary.current_epic.epic_id} - ${summary.current_epic.name}\n`;
    doc += `**Status**: ${summary.current_epic.status}\n`;
    if (summary.current_epic.progress) {
      doc += `**Progress**: ${summary.current_epic.progress.tests_passed}/${summary.current_epic.progress.tests_total} tests passing\n`;
    }
    doc += `\n`;
  }

  if (summary.git_status) {
    doc += `## Git Status\n\n`;
    doc += `**Branch**: ${summary.git_status.branch}\n`;
    doc += `**Commits Ahead**: ${summary.git_status.commits_ahead}\n`;
    doc += `**Changed Files**: ${summary.git_status.changed_files}\n`;
    doc += `\n`;
  }

  if (summary.recent_actions && summary.recent_actions.length > 0) {
    doc += `## Recent Actions\n\n`;
    summary.recent_actions.forEach((action: string) => {
      doc += `- ${action}\n`;
    });
    doc += `\n`;
  }

  if (summary.next_steps && summary.next_steps.length > 0) {
    doc += `## Next Steps\n\n`;
    summary.next_steps.forEach((step: string, index: number) => {
      doc += `${index + 1}. ${step}\n`;
    });
    doc += `\n`;
  }

  doc += `---\n\n`;
  doc += `**To continue work**: Say "continue building"\n`;

  return doc;
}
