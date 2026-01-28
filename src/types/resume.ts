/**
 * Resume Engine types for Epic 007-E
 * Defines types for instance resolution, context reconstruction, and resume operations
 */

import { z } from 'zod';
import { InstanceType, InstanceStatus } from './session.js';

/**
 * Resolution strategy enum
 */
export enum ResolutionStrategy {
  EXACT = 'exact',           // Exact instance ID match
  PARTIAL = 'partial',       // Partial ID prefix match
  PROJECT = 'project',       // Most recent for project
  EPIC = 'epic',            // Instance working on specific epic
  NEWEST = 'newest',        // Most recent overall
}

/**
 * Reconstruction source enum
 */
export enum ReconstructionSource {
  CHECKPOINT = 'checkpoint',
  EVENTS = 'events',
  COMMANDS = 'commands',
  BASIC = 'basic',
}

/**
 * Instance match for disambiguation (resume-specific with age_minutes)
 */
export interface InstanceMatchResume {
  instance_id: string;
  project: string;
  instance_type: InstanceType;
  status: InstanceStatus;
  last_heartbeat: Date;
  current_epic?: string;
  age_minutes: number;
}

/**
 * Resolution result (single match)
 */
export interface ResolutionResultSingle {
  success: true;
  instance_id: string;
  strategy: ResolutionStrategy;
}

/**
 * Resolution result (multiple matches requiring disambiguation)
 */
export interface ResolutionResultMultiple {
  success: false;
  matches: InstanceMatchResume[];
  hint: string;
}

/**
 * Resolution result (not found)
 */
export interface ResolutionResultNotFound {
  success: false;
  error: string;
  searched_for: string;
}

/**
 * Union of all resolution results
 */
export type ResolutionResult =
  | ResolutionResultSingle
  | ResolutionResultMultiple
  | ResolutionResultNotFound;

/**
 * Epic progress information
 */
export interface EpicProgress {
  epic_id: string;
  name: string;
  status: string;
  time_hours: number;
  tests_passed: number;
  tests_total: number;
  coverage_percent: number;
}

/**
 * Git status information
 */
export interface GitStatus {
  branch: string;
  commits_ahead: number;
  staged_files: number;
  changed_files: number;
}

/**
 * Checkpoint information
 */
export interface CheckpointInfo {
  checkpoint_id: string;
  type: 'context_window' | 'epic_completion' | 'manual';
  age_minutes: number;
}

/**
 * Resume summary
 */
export interface ResumeSummary {
  current_epic?: EpicProgress;
  git_status?: GitStatus;
  checkpoint?: CheckpointInfo;
  recent_actions: string[];
  next_steps: string[];
}

/**
 * Reconstructed context
 */
export interface ReconstructedContext {
  source: ReconstructionSource;
  confidence_score: number;
  confidence_reason: string;
  work_state: Record<string, any>;
  summary: ResumeSummary;
  age_minutes: number;
}

/**
 * Resume instance response (success)
 */
export interface ResumeInstanceResponseSuccess {
  success: true;
  instance_id: string;
  project: string;
  summary: ResumeSummary;
  confidence_score: number;
  confidence_reason: string;
  handoff_document?: string;
}

/**
 * Resume instance response (disambiguation)
 */
export interface ResumeInstanceResponseDisambiguation {
  success: false;
  matches: InstanceMatchResume[];
  user_hint: string;
}

/**
 * Resume instance response (error)
 */
export interface ResumeInstanceResponseError {
  success: false;
  error: string;
}

/**
 * Union of all resume responses
 */
export type ResumeInstanceResponse =
  | ResumeInstanceResponseSuccess
  | ResumeInstanceResponseDisambiguation
  | ResumeInstanceResponseError;

/**
 * Get instance details response
 */
export interface GetInstanceDetailsResponse {
  instance_id: string;
  project: string;
  instance_type: InstanceType;
  status: InstanceStatus;
  registration_time: string;
  last_heartbeat: string;
  last_heartbeat_ago_minutes: number;
  context_window_percent: number;
  current_epic?: string;
  checkpoint_info?: {
    checkpoint_id: string;
    timestamp: string;
    type: string;
  };
  recent_commands: Array<{
    command_type: string;
    timestamp: string;
    summary: string;
  }>;
}

/**
 * Stale instance item
 */
export interface StaleInstanceItem {
  instance_id: string;
  project: string;
  instance_type: InstanceType;
  last_heartbeat: string;
  minutes_stale: number;
  last_epic?: string;
}

/**
 * List stale instances response
 */
export interface ListStaleInstancesResponse {
  instances: StaleInstanceItem[];
  total_count: number;
}

/**
 * Zod validation schemas
 */

export const ResolutionStrategySchema = z.enum([
  'exact',
  'partial',
  'project',
  'epic',
  'newest',
]);

export const ReconstructionSourceSchema = z.enum([
  'checkpoint',
  'events',
  'commands',
  'basic',
]);

export const ResumeInstanceInputSchema = z.object({
  instance_id_hint: z.string().optional(),
  user_choice: z.number().int().positive().optional(),
});

// Note: GetInstanceDetailsInputSchema already exported from session.ts, reusing that
