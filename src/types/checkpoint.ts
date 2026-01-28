/**
 * Checkpoint Type Definitions (Epic 007-D)
 * TypeScript interfaces and Zod schemas for checkpoint system
 *
 * Checkpoint Types:
 * 1. context_window - Triggered at 80% context usage
 * 2. epic_completion - Triggered when epic completes
 * 3. manual - Explicit checkpoint creation by PS
 */

import { z } from 'zod';

/**
 * Checkpoint type enumeration
 */
export enum CheckpointType {
  CONTEXT_WINDOW = 'context_window',
  EPIC_COMPLETION = 'epic_completion',
  MANUAL = 'manual',
}

/**
 * File modification record
 */
export interface FileModificationRecord {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  lines_changed: number;
  last_modified: string; // ISO timestamp
}

/**
 * Git status snapshot
 */
export interface GitStatusSnapshot {
  branch: string;
  staged_files: number;
  unstaged_files: number;
  untracked_files: number;
  commit_count: number;
}

/**
 * Command summary (last N commands)
 */
export interface CommandSummary {
  command_id: string;
  type: string;
  action?: string;
  target?: string;
  timestamp: string; // ISO timestamp
}

/**
 * Epic status record
 */
export interface EpicStatusRecord {
  epic_id: string;
  feature_name?: string;
  status: 'planning' | 'implementation' | 'validation' | 'complete' | 'failed';
  duration_hours?: number;
  test_results?: {
    passed: number;
    failed: number;
    coverage?: number;
  };
}

/**
 * PRD status snapshot
 */
export interface PRDStatusSnapshot {
  version?: string;
  current_epic?: string;
  next_epic?: string;
  last_updated?: string; // ISO timestamp
  status_summary?: string;
}

/**
 * Work environment
 */
export interface WorkEnvironment {
  project: string;
  working_directory: string;
  hostname: string;
}

/**
 * Work state serialization
 * Captures the complete state of work at checkpoint time
 */
export interface WorkState {
  current_epic: EpicStatusRecord | null;
  files_modified: FileModificationRecord[];
  git_status: GitStatusSnapshot;
  last_commands: CommandSummary[];
  prd_status: PRDStatusSnapshot;
  environment: WorkEnvironment;
  pending_tasks?: string[];
  important_context?: string[];
  snapshot_at: string; // ISO timestamp
}

/**
 * Checkpoint metadata
 */
export interface CheckpointMetadata {
  trigger: 'event_context_window' | 'event_epic_completed' | 'manual' | string;
  event_id?: string;
  manual_note?: string;
  size_bytes: number;
}

/**
 * Full checkpoint record
 */
export interface Checkpoint {
  checkpoint_id: string;
  instance_id: string;
  checkpoint_type: CheckpointType;
  sequence_num: number;
  context_window_percent?: number;
  timestamp: Date;
  work_state: WorkState;
  metadata: CheckpointMetadata;
  created_at: Date;
  updated_at: Date;
}

/**
 * Checkpoint creation input
 */
export interface CreateCheckpointInput {
  instance_id: string;
  checkpoint_type: CheckpointType;
  context_window_percent?: number;
  work_state: WorkState;
  metadata?: Partial<CheckpointMetadata>;
}

/**
 * Checkpoint creation output
 */
export interface CreateCheckpointOutput {
  checkpoint_id: string;
  instance_id: string;
  checkpoint_type: CheckpointType;
  sequence_num: number;
  size_bytes: number;
  created_at: string; // ISO timestamp
}

/**
 * Checkpoint retrieval output
 */
export interface GetCheckpointOutput {
  checkpoint: Checkpoint;
  recovery_instructions: string;
}

/**
 * Checkpoint list item
 */
export interface CheckpointListItem {
  checkpoint_id: string;
  instance_id: string;
  checkpoint_type: CheckpointType;
  sequence_num: number;
  timestamp: string; // ISO timestamp
  context_window_percent?: number;
  epic_id?: string;
  size_bytes: number;
}

/**
 * List checkpoints output
 */
export interface ListCheckpointsOutput {
  checkpoints: CheckpointListItem[];
  total_count: number;
  instance_id: string;
}

/**
 * Cleanup output
 */
export interface CleanupCheckpointsOutput {
  deleted_count: number;
  freed_bytes: number;
  retention_days: number;
}

/**
 * Zod schemas for validation
 */

export const FileModificationRecordSchema = z.object({
  path: z.string(),
  status: z.enum(['modified', 'added', 'deleted']),
  lines_changed: z.number().int().min(0),
  last_modified: z.string().datetime(),
});

export const GitStatusSnapshotSchema = z.object({
  branch: z.string(),
  staged_files: z.number().int().min(0),
  unstaged_files: z.number().int().min(0),
  untracked_files: z.number().int().min(0),
  commit_count: z.number().int().min(0),
});

export const CommandSummarySchema = z.object({
  command_id: z.string(),
  type: z.string(),
  action: z.string().optional(),
  target: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const EpicStatusRecordSchema = z.object({
  epic_id: z.string(),
  feature_name: z.string().optional(),
  status: z.enum(['planning', 'implementation', 'validation', 'complete', 'failed']),
  duration_hours: z.number().optional(),
  test_results: z
    .object({
      passed: z.number().int().min(0),
      failed: z.number().int().min(0),
      coverage: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
});

export const PRDStatusSnapshotSchema = z.object({
  version: z.string().optional(),
  current_epic: z.string().optional(),
  next_epic: z.string().optional(),
  last_updated: z.string().datetime().optional(),
  status_summary: z.string().optional(),
});

export const WorkEnvironmentSchema = z.object({
  project: z.string(),
  working_directory: z.string(),
  hostname: z.string(),
});

export const WorkStateSchema = z.object({
  current_epic: EpicStatusRecordSchema.nullable(),
  files_modified: z.array(FileModificationRecordSchema),
  git_status: GitStatusSnapshotSchema,
  last_commands: z.array(CommandSummarySchema),
  prd_status: PRDStatusSnapshotSchema,
  environment: WorkEnvironmentSchema,
  pending_tasks: z.array(z.string()).optional(),
  important_context: z.array(z.string()).optional(),
  snapshot_at: z.string().datetime(),
});

export const CheckpointTypeSchema = z.enum(['context_window', 'epic_completion', 'manual']);

export const CheckpointMetadataSchema = z.object({
  trigger: z.string(),
  event_id: z.string().optional(),
  manual_note: z.string().optional(),
  size_bytes: z.number().int().min(0),
});

export const CreateCheckpointInputSchema = z.object({
  instance_id: z.string(),
  checkpoint_type: CheckpointTypeSchema,
  context_window_percent: z.number().int().min(0).max(100).optional(),
  work_state: WorkStateSchema,
  metadata: CheckpointMetadataSchema.partial().optional(),
});
