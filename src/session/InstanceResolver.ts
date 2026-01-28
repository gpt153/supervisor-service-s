/**
 * Instance Resolver Service (Epic 007-E)
 * Resolves instance IDs from various hint formats (exact, partial, project, epic, newest)
 *
 * Responsibilities:
 * - Parse resume hints (ID, project name, epic ID, etc.)
 * - Match instances using 5 resolution strategies
 * - Handle disambiguation when multiple matches found
 * - Validate instance exists and is stale (resumable)
 */

import { pool } from '../db/client.js';
import {
  ResolutionStrategy,
  ResolutionResult,
  ResolutionResultSingle,
  ResolutionResultMultiple,
  ResolutionResultNotFound,
  InstanceMatch,
} from '../types/resume.js';
import { InstanceType, InstanceStatus } from '../types/session.js';

/**
 * Error class for active instance (cannot resume)
 */
export class ActiveInstanceError extends Error {
  constructor(instanceId: string, lastHeartbeatAgo: number) {
    super(
      `Cannot resume active instance ${instanceId}. Last heartbeat: ${lastHeartbeatAgo}s ago`
    );
    this.name = 'ActiveInstanceError';
  }
}

/**
 * Resolve instance from hint using multiple strategies
 *
 * Strategy priority:
 * 1. Exact ID match (e.g., "odin-PS-8f4a2b")
 * 2. Partial ID match (e.g., "8f4a" or "8f4a2b")
 * 3. Project latest (e.g., "odin")
 * 4. Epic match (e.g., "epic-003")
 * 5. Newest (no hint provided)
 *
 * @param hint Instance ID hint (can be full ID, partial, project, or epic)
 * @returns Resolution result (single match, multiple matches, or not found)
 *
 * @example
 * // Exact match
 * const result = await resolveInstance('odin-PS-8f4a2b');
 * // Returns: { success: true, instance_id: 'odin-PS-8f4a2b', strategy: 'exact' }
 *
 * @example
 * // Partial match
 * const result = await resolveInstance('8f4a');
 * // Returns: { success: true, instance_id: 'odin-PS-8f4a2b', strategy: 'partial' }
 *
 * @example
 * // Multiple matches (disambiguation needed)
 * const result = await resolveInstance('odin');
 * // Returns: { success: false, matches: [...], hint: "Use: 'resume 8f4a2b' or specify epic" }
 */
export async function resolveInstance(
  hint?: string
): Promise<ResolutionResult> {
  // Strategy 5: Newest (no hint)
  if (!hint) {
    return resolveNewest();
  }

  const normalizedHint = hint.trim().toLowerCase();

  // Strategy 1: Exact ID match
  if (normalizedHint.match(/^[a-z0-9-]+-(PS|MS|ps|ms)-[a-z0-9]{6}$/i)) {
    const result = await resolveExact(normalizedHint);
    if (result.success) {
      return result;
    }
  }

  // Strategy 2: Partial ID match (6-char hash or prefix)
  if (normalizedHint.match(/^[a-z0-9]{4,6}$/)) {
    const result = await resolvePartial(normalizedHint);
    if (result.success || (result as ResolutionResultMultiple).matches) {
      return result;
    }
  }

  // Strategy 4: Epic match
  if (normalizedHint.match(/^epic-\d{3}$/)) {
    const result = await resolveEpic(normalizedHint);
    if (result.success || (result as ResolutionResultMultiple).matches) {
      return result;
    }
  }

  // Strategy 3: Project latest
  const result = await resolveProject(normalizedHint);
  if (result.success || (result as ResolutionResultMultiple).matches) {
    return result;
  }

  // Not found
  return {
    success: false,
    error: `No instance found matching '${hint}'`,
    searched_for: hint,
  } as ResolutionResultNotFound;
}

/**
 * Strategy 1: Exact ID match
 */
async function resolveExact(
  instanceId: string
): Promise<ResolutionResult> {
  try {
    const result = await pool.query<InstanceMatch>(
      `SELECT
        instance_id,
        project,
        instance_type,
        status,
        last_heartbeat,
        current_epic,
        EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int / 60 as age_minutes
      FROM supervisor_sessions
      WHERE LOWER(instance_id) = LOWER($1)
      AND status != 'closed'
      ORDER BY last_heartbeat DESC
      LIMIT 1`,
      [instanceId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: `Instance not found: ${instanceId}`,
        searched_for: instanceId,
      } as ResolutionResultNotFound;
    }

    const row = result.rows[0];

    // Check if instance is active (cannot resume)
    const ageSeconds = row.age_minutes * 60;
    if (ageSeconds < 120) {
      throw new ActiveInstanceError(row.instance_id, ageSeconds);
    }

    return {
      success: true,
      instance_id: row.instance_id,
      strategy: ResolutionStrategy.EXACT,
    } as ResolutionResultSingle;
  } catch (error) {
    throw error;
  }
}

/**
 * Strategy 2: Partial ID match (6-char hash or prefix)
 */
async function resolvePartial(
  partialId: string
): Promise<ResolutionResult> {
  try {
    const result = await pool.query<InstanceMatch>(
      `SELECT
        instance_id,
        project,
        instance_type,
        status,
        last_heartbeat,
        current_epic,
        EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int / 60 as age_minutes
      FROM supervisor_sessions
      WHERE instance_id LIKE '%' || $1 || '%'
      AND status != 'closed'
      AND EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) >= 120
      ORDER BY last_heartbeat DESC`,
      [partialId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: `No instance found with ID containing '${partialId}'`,
        searched_for: partialId,
      } as ResolutionResultNotFound;
    }

    if (result.rows.length === 1) {
      return {
        success: true,
        instance_id: result.rows[0].instance_id,
        strategy: ResolutionStrategy.PARTIAL,
      } as ResolutionResultSingle;
    }

    // Multiple matches - disambiguation needed
    const matches: InstanceMatch[] = result.rows.map((row) => ({
      instance_id: row.instance_id,
      project: row.project,
      instance_type: row.instance_type as InstanceType,
      status: row.status as InstanceStatus,
      last_heartbeat: new Date(row.last_heartbeat),
      current_epic: row.current_epic,
      age_minutes: row.age_minutes,
    }));

    return {
      success: false,
      matches,
      hint: `Multiple instances found. Use: 'resume ${matches[0].instance_id}' or specify epic`,
    } as ResolutionResultMultiple;
  } catch (error) {
    throw error;
  }
}

/**
 * Strategy 3: Project latest (most recent for project)
 */
async function resolveProject(
  project: string
): Promise<ResolutionResult> {
  try {
    const result = await pool.query<InstanceMatch>(
      `SELECT
        instance_id,
        project,
        instance_type,
        status,
        last_heartbeat,
        current_epic,
        EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int / 60 as age_minutes
      FROM supervisor_sessions
      WHERE LOWER(project) = LOWER($1)
      AND status != 'closed'
      AND EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) >= 120
      ORDER BY last_heartbeat DESC`,
      [project]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: `No stale instances found for project '${project}'`,
        searched_for: project,
      } as ResolutionResultNotFound;
    }

    if (result.rows.length === 1) {
      return {
        success: true,
        instance_id: result.rows[0].instance_id,
        strategy: ResolutionStrategy.PROJECT,
      } as ResolutionResultSingle;
    }

    // Multiple matches - disambiguation needed
    const matches: InstanceMatch[] = result.rows.map((row) => ({
      instance_id: row.instance_id,
      project: row.project,
      instance_type: row.instance_type as InstanceType,
      status: row.status as InstanceStatus,
      last_heartbeat: new Date(row.last_heartbeat),
      current_epic: row.current_epic,
      age_minutes: row.age_minutes,
    }));

    return {
      success: false,
      matches,
      hint: `Multiple ${project} instances found. Use: 'resume ${matches[0].instance_id}' or specify epic`,
    } as ResolutionResultMultiple;
  } catch (error) {
    throw error;
  }
}

/**
 * Strategy 4: Epic match (instance working on specific epic)
 */
async function resolveEpic(epicId: string): Promise<ResolutionResult> {
  try {
    const result = await pool.query<InstanceMatch>(
      `SELECT
        instance_id,
        project,
        instance_type,
        status,
        last_heartbeat,
        current_epic,
        EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int / 60 as age_minutes
      FROM supervisor_sessions
      WHERE current_epic = $1
      AND status != 'closed'
      AND EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) >= 120
      ORDER BY last_heartbeat DESC
      LIMIT 1`,
      [epicId]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: `No stale instance found working on ${epicId}`,
        searched_for: epicId,
      } as ResolutionResultNotFound;
    }

    return {
      success: true,
      instance_id: result.rows[0].instance_id,
      strategy: ResolutionStrategy.EPIC,
    } as ResolutionResultSingle;
  } catch (error) {
    throw error;
  }
}

/**
 * Strategy 5: Newest (most recent stale instance overall)
 */
async function resolveNewest(): Promise<ResolutionResult> {
  try {
    const result = await pool.query<InstanceMatch>(
      `SELECT
        instance_id,
        project,
        instance_type,
        status,
        last_heartbeat,
        current_epic,
        EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int / 60 as age_minutes
      FROM supervisor_sessions
      WHERE status != 'closed'
      AND EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) >= 120
      ORDER BY last_heartbeat DESC
      LIMIT 1`
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'No stale instances found',
        searched_for: '(newest)',
      } as ResolutionResultNotFound;
    }

    return {
      success: true,
      instance_id: result.rows[0].instance_id,
      strategy: ResolutionStrategy.NEWEST,
    } as ResolutionResultSingle;
  } catch (error) {
    throw error;
  }
}

/**
 * Validate instance is stale and resumable
 *
 * @param instanceId Instance ID to validate
 * @returns True if instance is stale (last heartbeat >120s ago)
 * @throws ActiveInstanceError if instance is still active
 */
export async function validateInstanceIsStale(
  instanceId: string
): Promise<boolean> {
  const result = await pool.query<{ age_seconds: number }>(
    `SELECT EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::int as age_seconds
    FROM supervisor_sessions
    WHERE instance_id = $1`,
    [instanceId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Instance not found: ${instanceId}`);
  }

  const ageSeconds = result.rows[0].age_seconds;

  if (ageSeconds < 120) {
    throw new ActiveInstanceError(instanceId, ageSeconds);
  }

  return true;
}
