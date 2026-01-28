/**
 * Checkpoint Manager Service (Epic 007-D)
 * Manages checkpoint creation, retrieval, and cleanup
 *
 * Core responsibilities:
 * - Create checkpoints with work state serialization
 * - Retrieve checkpoints by ID
 * - List checkpoints for instance
 * - Clean up old checkpoints (retention policy)
 * - Validate instance before operations
 *
 * Performance targets:
 * - Create: <200ms (p99)
 * - Retrieve: <50ms
 * - List: <30ms for 10 items
 */

import { pool } from '../db/client.js';
import { getInstanceDetails } from './InstanceRegistry.js';
import {
  Checkpoint,
  CheckpointType,
  CreateCheckpointInput,
  CreateCheckpointOutput,
  GetCheckpointOutput,
  ListCheckpointsOutput,
  CheckpointListItem,
  CleanupCheckpointsOutput,
  WorkState,
  CheckpointMetadata,
} from '../types/checkpoint.js';
import { getResumeInstructionGenerator } from './ResumeInstructionGenerator.js';

/**
 * Error class for checkpoint not found
 */
export class CheckpointNotFoundError extends Error {
  constructor(checkpointId: string) {
    super(`Checkpoint not found: ${checkpointId}`);
    this.name = 'CheckpointNotFoundError';
  }
}

/**
 * Error class for instance not found
 */
export class CheckpointInstanceNotFoundError extends Error {
  constructor(instanceId: string) {
    super(`Instance not found for checkpoint: ${instanceId}`);
    this.name = 'CheckpointInstanceNotFoundError';
  }
}

/**
 * Error class for checkpoint manager operations
 */
export class CheckpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckpointError';
  }
}

/**
 * Default retention period (days)
 */
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Checkpoint Manager
 */
export class CheckpointManager {
  /**
   * Create a new checkpoint
   * @param input Checkpoint creation input
   * @returns Checkpoint creation output with ID and metadata
   */
  async createCheckpoint(input: CreateCheckpointInput): Promise<CreateCheckpointOutput> {
    const start = Date.now();

    try {
      // Validate instance exists
      const instance = await getInstanceDetails(input.instance_id);
      if (!instance) {
        throw new CheckpointInstanceNotFoundError(input.instance_id);
      }

      // Get next sequence number
      const seqResult = await pool.query<{ nextseq: number }>(
        `SELECT COALESCE(MAX(sequence_num), 0) + 1 as nextseq
         FROM checkpoints
         WHERE instance_id = $1`,
        [input.instance_id]
      );

      const nextSequenceNum = seqResult.rows[0]?.nextseq || 1;

      // Calculate size
      const stateJson = JSON.stringify(input.work_state);
      const size_bytes = Buffer.byteLength(stateJson, 'utf-8');

      // Build metadata
      const metadata: CheckpointMetadata = {
        trigger: input.metadata?.trigger || 'manual',
        event_id: input.metadata?.event_id,
        manual_note: input.metadata?.manual_note,
        size_bytes,
      };

      // Insert checkpoint
      const result = await pool.query<{
        checkpoint_id: string;
        sequence_num: number;
        created_at: string;
      }>(
        `INSERT INTO checkpoints (
          instance_id, checkpoint_type, sequence_num, context_window_percent,
          work_state, metadata, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING checkpoint_id, sequence_num, created_at`,
        [
          input.instance_id,
          input.checkpoint_type,
          nextSequenceNum,
          input.context_window_percent || null,
          stateJson,
          JSON.stringify(metadata),
        ]
      );

      if (result.rows.length === 0) {
        throw new CheckpointError('Failed to insert checkpoint');
      }

      const row = result.rows[0];
      const duration = Date.now() - start;

      if (duration > 200) {
        console.warn(`CheckpointManager.createCheckpoint slow: ${duration}ms`);
      }

      return {
        checkpoint_id: row.checkpoint_id,
        instance_id: input.instance_id,
        checkpoint_type: input.checkpoint_type,
        sequence_num: row.sequence_num,
        size_bytes,
        created_at: row.created_at,
      };
    } catch (error: any) {
      if (
        error instanceof CheckpointInstanceNotFoundError ||
        error instanceof CheckpointError
      ) {
        throw error;
      }
      throw new CheckpointError(`Failed to create checkpoint: ${error.message}`);
    }
  }

  /**
   * Get checkpoint by ID
   * @param checkpointId Checkpoint ID
   * @returns Checkpoint with recovery instructions
   */
  async getCheckpoint(checkpointId: string): Promise<GetCheckpointOutput> {
    const start = Date.now();

    try {
      const result = await pool.query<{
        checkpoint_id: string;
        instance_id: string;
        checkpoint_type: CheckpointType;
        sequence_num: number;
        context_window_percent: number | null;
        timestamp: string;
        work_state: string;
        metadata: string;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT checkpoint_id, instance_id, checkpoint_type, sequence_num,
                context_window_percent, timestamp, work_state, metadata,
                created_at, updated_at
         FROM checkpoints
         WHERE checkpoint_id = $1`,
        [checkpointId]
      );

      if (result.rows.length === 0) {
        throw new CheckpointNotFoundError(checkpointId);
      }

      const row = result.rows[0];

      // Parse JSON fields
      const workState = JSON.parse(row.work_state) as WorkState;
      const metadata = JSON.parse(row.metadata) as CheckpointMetadata;

      // Build checkpoint object
      const checkpoint: Checkpoint = {
        checkpoint_id: row.checkpoint_id,
        instance_id: row.instance_id,
        checkpoint_type: row.checkpoint_type,
        sequence_num: row.sequence_num,
        context_window_percent: row.context_window_percent || undefined,
        timestamp: new Date(row.timestamp),
        work_state: workState,
        metadata,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
      };

      // Generate recovery instructions
      const generator = getResumeInstructionGenerator();
      const recovery_instructions = generator.generate(workState, row.checkpoint_type);

      const duration = Date.now() - start;

      if (duration > 50) {
        console.warn(`CheckpointManager.getCheckpoint slow: ${duration}ms`);
      }

      return {
        checkpoint,
        recovery_instructions,
      };
    } catch (error: any) {
      if (error instanceof CheckpointNotFoundError) {
        throw error;
      }
      throw new CheckpointError(`Failed to get checkpoint: ${error.message}`);
    }
  }

  /**
   * List checkpoints for an instance
   * @param instanceId Instance ID
   * @param filters Optional filters (checkpoint_type, limit, offset)
   * @returns List of checkpoints
   */
  async listCheckpoints(
    instanceId: string,
    filters?: {
      checkpoint_type?: CheckpointType;
      limit?: number;
      offset?: number;
    }
  ): Promise<ListCheckpointsOutput> {
    const start = Date.now();

    try {
      // Validate instance exists
      const instance = await getInstanceDetails(instanceId);
      if (!instance) {
        throw new CheckpointInstanceNotFoundError(instanceId);
      }

      const limit = Math.min(Math.max(filters?.limit || 50, 1), 1000);
      const offset = Math.max(filters?.offset || 0, 0);

      // Build query
      let query = `
        SELECT checkpoint_id, instance_id, checkpoint_type, sequence_num,
               context_window_percent, timestamp, created_at, work_state, metadata
        FROM checkpoints
        WHERE instance_id = $1
      `;
      const params: any[] = [instanceId];
      let paramCount = 1;

      if (filters?.checkpoint_type) {
        query += ` AND checkpoint_type = $${++paramCount}`;
        params.push(filters.checkpoint_type);
      }

      query += ` ORDER BY timestamp DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      // Execute query
      const result = await pool.query<{
        checkpoint_id: string;
        instance_id: string;
        checkpoint_type: CheckpointType;
        sequence_num: number;
        context_window_percent: number | null;
        timestamp: string;
        created_at: string;
        work_state: string;
        metadata: string;
      }>(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM checkpoints WHERE instance_id = $1`;
      const countParams: any[] = [instanceId];

      if (filters?.checkpoint_type) {
        countQuery += ` AND checkpoint_type = $2`;
        countParams.push(filters.checkpoint_type);
      }

      const countResult = await pool.query<{ total: number }>(countQuery, countParams);
      const total_count = parseInt(countResult.rows[0]?.total || '0', 10);

      // Build response
      const checkpoints: CheckpointListItem[] = result.rows.map((row) => {
        const metadata = JSON.parse(row.metadata) as CheckpointMetadata;
        const workState = JSON.parse(row.work_state) as WorkState;

        return {
          checkpoint_id: row.checkpoint_id,
          instance_id: row.instance_id,
          checkpoint_type: row.checkpoint_type,
          sequence_num: row.sequence_num,
          timestamp: new Date(row.timestamp).toISOString(),
          context_window_percent: row.context_window_percent || undefined,
          epic_id: workState.current_epic?.epic_id,
          size_bytes: metadata.size_bytes,
        };
      });

      const duration = Date.now() - start;

      if (duration > 30) {
        console.warn(`CheckpointManager.listCheckpoints slow: ${duration}ms`);
      }

      return {
        checkpoints,
        total_count,
        instance_id: instanceId,
      };
    } catch (error: any) {
      if (error instanceof CheckpointInstanceNotFoundError) {
        throw error;
      }
      throw new CheckpointError(`Failed to list checkpoints: ${error.message}`);
    }
  }

  /**
   * Clean up old checkpoints (retention policy)
   * @param retentionDays Number of days to retain (default 30)
   * @returns Cleanup statistics
   */
  async cleanupCheckpoints(retentionDays: number = DEFAULT_RETENTION_DAYS): Promise<CleanupCheckpointsOutput> {
    const start = Date.now();

    try {
      // Get checkpoints to delete
      const getResult = await pool.query<{
        checkpoint_id: string;
        metadata: string;
      }>(
        `SELECT checkpoint_id, metadata
         FROM checkpoints
         WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
        [retentionDays]
      );

      let freed_bytes = 0;
      for (const row of getResult.rows) {
        const metadata = JSON.parse(row.metadata) as CheckpointMetadata;
        freed_bytes += metadata.size_bytes;
      }

      // Delete old checkpoints
      const deleteResult = await pool.query(
        `DELETE FROM checkpoints
         WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
        [retentionDays]
      );

      const deleted_count = deleteResult.rowCount || 0;

      const duration = Date.now() - start;

      if (duration > 500) {
        console.warn(`CheckpointManager.cleanupCheckpoints slow: ${duration}ms`);
      }

      return {
        deleted_count,
        freed_bytes,
        retention_days: retentionDays,
      };
    } catch (error: any) {
      throw new CheckpointError(`Failed to cleanup checkpoints: ${error.message}`);
    }
  }

  /**
   * Get size stats for an instance
   * @param instanceId Instance ID
   * @returns Total storage used and checkpoint count
   */
  async getInstanceStats(
    instanceId: string
  ): Promise<{
    total_checkpoints: number;
    total_storage_bytes: number;
    average_checkpoint_size: number;
  }> {
    try {
      const result = await pool.query<{
        count: number;
        total_size: string;
      }>(
        `SELECT COUNT(*) as count,
                COALESCE(SUM((metadata::jsonb->>'size_bytes')::bigint), 0) as total_size
         FROM checkpoints
         WHERE instance_id = $1`,
        [instanceId]
      );

      const row = result.rows[0];
      const count = parseInt(row.count.toString(), 10);
      const total_size = parseInt(row.total_size.toString(), 10);

      return {
        total_checkpoints: count,
        total_storage_bytes: total_size,
        average_checkpoint_size: count > 0 ? Math.floor(total_size / count) : 0,
      };
    } catch (error) {
      console.error('Failed to get instance stats:', error);
      throw new CheckpointError(`Failed to get instance stats: ${error}`);
    }
  }
}

/**
 * Global instance (singleton)
 */
let globalManager: CheckpointManager | null = null;

/**
 * Get or create the global checkpoint manager
 */
export function getCheckpointManager(): CheckpointManager {
  if (!globalManager) {
    globalManager = new CheckpointManager();
  }
  return globalManager;
}

/**
 * Reset the global instance (for testing)
 */
export function resetCheckpointManager(): void {
  globalManager = null;
}
