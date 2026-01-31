/**
 * Instance Registry Database Service (Epic 007-A)
 * Manages instance registration, heartbeat tracking, and instance queries in PostgreSQL
 *
 * Responsibilities:
 * - Register new instances on startup
 * - Update heartbeat and context tracking
 * - List instances with filtering and sorting
 * - Query instances by ID (full or prefix match)
 * - Mark instances as stale (120s timeout)
 */

import { pool } from '../db/client.js';
import { generateInstanceId } from './InstanceIdGenerator.js';
import {
  Instance,
  InstanceStatus,
  InstanceType,
  STALE_TIMEOUT_SECONDS,
} from '../types/session.js';

/**
 * Error class for duplicate instance ID
 */
export class DuplicateInstanceError extends Error {
  constructor(instanceId: string) {
    super(`Instance with ID ${instanceId} already exists`);
    this.name = 'DuplicateInstanceError';
  }
}

/**
 * Error class for instance not found
 */
export class InstanceNotFoundError extends Error {
  constructor(instanceId: string) {
    super(`Instance not found: ${instanceId}`);
    this.name = 'InstanceNotFoundError';
  }
}

/**
 * Register a new instance in the supervisor_sessions table
 *
 * @param project Project name
 * @param instanceType Instance type ('PS' or 'MS')
 * @param initialContext Optional initial context (reserved for future use)
 * @param hostMachine Optional machine name (defaults to 'odin3' or env HOST_MACHINE)
 * @returns Instance record
 * @throws DuplicateInstanceError if collision occurs
 *
 * @example
 * const instance = await registerInstance('odin', 'PS', {}, 'odin3');
 * // Returns: { instance_id: 'odin-PS-8f4a2b', project: 'odin', ..., status: 'active', host_machine: 'odin3' }
 */
export async function registerInstance(
  project: string,
  instanceType: InstanceType,
  initialContext?: Record<string, any>,
  hostMachine?: string
): Promise<Instance> {
  const instanceId = generateInstanceId(project, instanceType);

  // Determine host machine: parameter > env var > default
  let machine = hostMachine;
  if (!machine) {
    machine = process.env.HOST_MACHINE || 'odin3';
  }

  try {
    const result = await pool.query<Instance>(
      `INSERT INTO supervisor_sessions (
        instance_id, project, instance_type, status, context_percent, host_machine, created_at, last_heartbeat
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING instance_id, project, instance_type, status, context_percent, current_epic,
                host_machine, last_heartbeat, created_at, closed_at`,
      [instanceId, project, instanceType, 'active', 0, machine]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to insert instance record');
    }

    const row = result.rows[0];
    return {
      instance_id: row.instance_id,
      project: row.project,
      instance_type: row.instance_type as InstanceType,
      status: row.status as InstanceStatus,
      context_percent: row.context_percent,
      current_epic: row.current_epic,
      host_machine: row.host_machine,
      last_heartbeat: new Date(row.last_heartbeat),
      created_at: new Date(row.created_at),
      closed_at: row.closed_at ? new Date(row.closed_at) : undefined,
    };
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique constraint violation
      throw new DuplicateInstanceError(instanceId);
    }
    throw error;
  }
}

/**
 * Update heartbeat and context for an instance
 *
 * @param instanceId Instance ID to update
 * @param contextPercent Context usage percentage (0-100)
 * @param currentEpic Optional current epic ID
 * @returns Updated instance record
 * @throws InstanceNotFoundError if instance doesn't exist
 *
 * @example
 * const updated = await updateHeartbeat('odin-PS-8f4a2b', 50, 'epic-007-A');
 */
export async function updateHeartbeat(
  instanceId: string,
  contextPercent: number,
  currentEpic?: string
): Promise<Instance> {
  if (contextPercent < 0 || contextPercent > 100) {
    throw new Error('contextPercent must be between 0 and 100');
  }

  const result = await pool.query<Instance>(
    `UPDATE supervisor_sessions
    SET context_percent = $1, current_epic = $2, last_heartbeat = CURRENT_TIMESTAMP
    WHERE instance_id = $3
    RETURNING instance_id, project, instance_type, status, context_percent, current_epic,
              last_heartbeat, created_at, closed_at`,
    [contextPercent, currentEpic || null, instanceId]
  );

  if (result.rows.length === 0) {
    throw new InstanceNotFoundError(instanceId);
  }

  const row = result.rows[0];
  return {
    instance_id: row.instance_id,
    project: row.project,
    instance_type: row.instance_type as InstanceType,
    status: row.status as InstanceStatus,
    context_percent: row.context_percent,
    current_epic: row.current_epic,
    last_heartbeat: new Date(row.last_heartbeat),
    created_at: new Date(row.created_at),
    closed_at: row.closed_at ? new Date(row.closed_at) : undefined,
  };
}

/**
 * List instances with optional filtering
 *
 * @param project Optional project filter
 * @param activeOnly If true, exclude stale/closed instances
 * @returns Array of instances sorted by project, then last_heartbeat DESC
 *
 * @example
 * const instances = await listInstances('odin', true);
 * // Returns: [{ instance_id: 'odin-PS-8f4a2b', status: 'active', ... }, ...]
 */
export async function listInstances(
  project?: string,
  activeOnly: boolean = false
): Promise<Instance[]> {
  let query = `SELECT instance_id, project, instance_type, status, context_percent,
                      current_epic, host_machine, last_heartbeat, created_at, closed_at
               FROM supervisor_sessions
               WHERE 1=1`;

  const params: any[] = [];

  if (project) {
    params.push(project);
    query += ` AND project = $${params.length}`;
  }

  if (activeOnly) {
    query += ` AND status = 'active'`;
  }

  query += ` ORDER BY project ASC, last_heartbeat DESC`;

  const result = await pool.query<Instance>(query, params);

  return result.rows.map((row) => ({
    instance_id: row.instance_id,
    project: row.project,
    instance_type: row.instance_type as InstanceType,
    status: markStaleIfNeeded(row.status, row.last_heartbeat),
    context_percent: row.context_percent,
    current_epic: row.current_epic,
    host_machine: row.host_machine,
    last_heartbeat: new Date(row.last_heartbeat),
    created_at: new Date(row.created_at),
    closed_at: row.closed_at ? new Date(row.closed_at) : undefined,
  }));
}

/**
 * Get instance details by ID (exact or prefix match)
 *
 * @param instanceId Instance ID (full or prefix)
 * @returns Instance record or null if not found
 *
 * @example
 * const instance = await getInstanceDetails('odin-PS-8f4a2b');
 * // or by prefix:
 * const instance = await getInstanceDetails('8f4a2b');
 */
export async function getInstanceDetails(instanceId: string): Promise<Instance | null> {
  // Try exact match first
  const exactResult = await pool.query<Instance>(
    `SELECT instance_id, project, instance_type, status, context_percent, current_epic,
            host_machine, last_heartbeat, created_at, closed_at
     FROM supervisor_sessions
     WHERE instance_id = $1`,
    [instanceId]
  );

  if (exactResult.rows.length > 0) {
    const row = exactResult.rows[0];
    return {
      instance_id: row.instance_id,
      project: row.project,
      instance_type: row.instance_type as InstanceType,
      status: markStaleIfNeeded(row.status, row.last_heartbeat),
      context_percent: row.context_percent,
      current_epic: row.current_epic,
      host_machine: row.host_machine,
      last_heartbeat: new Date(row.last_heartbeat),
      created_at: new Date(row.created_at),
      closed_at: row.closed_at ? new Date(row.closed_at) : undefined,
    };
  }

  // Try prefix match
  const prefixResult = await pool.query<Instance>(
    `SELECT instance_id, project, instance_type, status, context_percent, current_epic,
            host_machine, last_heartbeat, created_at, closed_at
     FROM supervisor_sessions
     WHERE instance_id LIKE $1 || '%'
     LIMIT 2`,
    [instanceId]
  );

  if (prefixResult.rows.length === 1) {
    const row = prefixResult.rows[0];
    return {
      instance_id: row.instance_id,
      project: row.project,
      instance_type: row.instance_type as InstanceType,
      status: markStaleIfNeeded(row.status, row.last_heartbeat),
      context_percent: row.context_percent,
      current_epic: row.current_epic,
      host_machine: row.host_machine,
      last_heartbeat: new Date(row.last_heartbeat),
      created_at: new Date(row.created_at),
      closed_at: row.closed_at ? new Date(row.closed_at) : undefined,
    };
  }

  return null;
}

/**
 * Get prefix matches for disambiguation
 *
 * @param prefix Instance ID prefix
 * @returns Array of matching instances
 */
export async function getPrefixMatches(prefix: string): Promise<Instance[]> {
  const result = await pool.query<Instance>(
    `SELECT instance_id, project, instance_type, status, context_percent, current_epic,
            host_machine, last_heartbeat, created_at, closed_at
     FROM supervisor_sessions
     WHERE instance_id LIKE $1 || '%'
     ORDER BY last_heartbeat DESC
     LIMIT 10`,
    [prefix]
  );

  return result.rows.map((row) => ({
    instance_id: row.instance_id,
    project: row.project,
    instance_type: row.instance_type as InstanceType,
    status: markStaleIfNeeded(row.status, row.last_heartbeat),
    context_percent: row.context_percent,
    current_epic: row.current_epic,
    host_machine: row.host_machine,
    last_heartbeat: new Date(row.last_heartbeat),
    created_at: new Date(row.created_at),
    closed_at: row.closed_at ? new Date(row.closed_at) : undefined,
  }));
}

/**
 * Mark instance as closed
 *
 * @param instanceId Instance ID to close
 * @returns Updated instance record
 * @throws InstanceNotFoundError if instance doesn't exist
 */
export async function markInstanceClosed(instanceId: string): Promise<Instance> {
  const result = await pool.query<Instance>(
    `UPDATE supervisor_sessions
     SET status = 'closed', closed_at = CURRENT_TIMESTAMP
     WHERE instance_id = $1
     RETURNING instance_id, project, instance_type, status, context_percent, current_epic,
               last_heartbeat, created_at, closed_at`,
    [instanceId]
  );

  if (result.rows.length === 0) {
    throw new InstanceNotFoundError(instanceId);
  }

  const row = result.rows[0];
  return {
    instance_id: row.instance_id,
    project: row.project,
    instance_type: row.instance_type as InstanceType,
    status: row.status as InstanceStatus,
    context_percent: row.context_percent,
    current_epic: row.current_epic,
    last_heartbeat: new Date(row.last_heartbeat),
    created_at: new Date(row.created_at),
    closed_at: row.closed_at ? new Date(row.closed_at) : undefined,
  };
}

/**
 * Helper: Determine if instance is stale and mark accordingly
 * Stale if last_heartbeat is more than STALE_TIMEOUT_SECONDS ago
 *
 * @param status Current status
 * @param lastHeartbeat Last heartbeat timestamp
 * @returns Updated status ('stale' if timed out, otherwise current status)
 */
function markStaleIfNeeded(status: string, lastHeartbeat: any): InstanceStatus {
  if (status === 'closed') {
    return InstanceStatus.CLOSED;
  }

  const timestamp = new Date(lastHeartbeat).getTime();
  const now = Date.now();
  const ageSeconds = (now - timestamp) / 1000;

  if (ageSeconds > STALE_TIMEOUT_SECONDS) {
    return InstanceStatus.STALE;
  }

  return status as InstanceStatus;
}

/**
 * Calculate age of instance in seconds
 *
 * @param lastHeartbeat Last heartbeat timestamp
 * @returns Age in seconds
 */
export function calculateInstanceAge(lastHeartbeat: Date): number {
  return Math.floor((Date.now() - lastHeartbeat.getTime()) / 1000);
}

/**
 * Check if instance is stale
 *
 * @param lastHeartbeat Last heartbeat timestamp
 * @returns true if stale, false otherwise
 */
export function isInstanceStale(lastHeartbeat: Date): boolean {
  return calculateInstanceAge(lastHeartbeat) > STALE_TIMEOUT_SECONDS;
}
