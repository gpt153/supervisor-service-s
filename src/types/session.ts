/**
 * Session and Instance Registry types for session continuity system (Epic 007-A)
 * Defines types for instance registration, heartbeat tracking, and session management
 */

import { z } from 'zod';

/**
 * Instance status enumeration
 */
export enum InstanceStatus {
  ACTIVE = 'active',
  STALE = 'stale',
  CLOSED = 'closed',
}

/**
 * Instance type enumeration
 */
export enum InstanceType {
  PS = 'PS',  // Project-Supervisor
  MS = 'MS',  // Meta-Supervisor
}

/**
 * Instance registry record from database
 */
export interface Instance {
  instance_id: string;
  project: string;
  instance_type: InstanceType;
  status: InstanceStatus;
  context_percent: number;
  current_epic?: string;
  last_heartbeat: Date;
  created_at: Date;
  closed_at?: Date;
}

/**
 * Input for registering a new instance
 */
export interface RegisterInstanceInput {
  project: string;
  instance_type: InstanceType;
  initial_context?: Record<string, any>;
}

/**
 * Output from instance registration
 */
export interface RegisterInstanceOutput {
  instance_id: string;
  project: string;
  type: InstanceType;
  status: InstanceStatus;
  created_at: string; // ISO 8601
  context_percent: number;
}

/**
 * Input for heartbeat update
 */
export interface HeartbeatInput {
  instance_id: string;
  context_percent: number;
  current_epic?: string;
}

/**
 * Output from heartbeat update
 */
export interface HeartbeatOutput {
  instance_id: string;
  status: InstanceStatus;
  last_heartbeat: string; // ISO 8601
  age_seconds: number;
  stale: boolean;
  context_percent: number;
}

/**
 * Input for listing instances
 */
export interface ListInstancesInput {
  project?: string;
  active_only?: boolean;
}

/**
 * Instance item in list response
 */
export interface InstanceListItem {
  instance_id: string;
  project: string;
  type: InstanceType;
  status: InstanceStatus;
  last_heartbeat: string; // ISO 8601
  age_seconds: number;
  context_percent: number;
  current_epic?: string;
}

/**
 * Output from list instances
 */
export interface ListInstancesOutput {
  instances: InstanceListItem[];
  total_count: number;
  active_count: number;
  stale_count: number;
}

/**
 * Input for getting instance details
 */
export interface GetInstanceDetailsInput {
  instance_id: string;
}

/**
 * Output from get instance details (exact match)
 */
export interface GetInstanceDetailsOutputExact {
  instance: InstanceListItem & {
    created_at: string;
  };
}

/**
 * Match item for disambiguation
 */
export interface InstanceMatch {
  instance_id: string;
  project: string;
  type: InstanceType;
  status: InstanceStatus;
  age_seconds: number;
}

/**
 * Output from get instance details (multiple matches)
 */
export interface GetInstanceDetailsOutputMultiple {
  matches: InstanceMatch[];
  message: string;
}

/**
 * Output from get instance details (not found)
 */
export interface GetInstanceDetailsOutputNotFound {
  error: string;
  searched_for: string;
}

/**
 * Union of all possible get instance details outputs
 */
export type GetInstanceDetailsOutput =
  | GetInstanceDetailsOutputExact
  | GetInstanceDetailsOutputMultiple
  | GetInstanceDetailsOutputNotFound;

/**
 * Zod validation schemas
 */

export const InstanceTypeSchema = z.enum(['PS', 'MS']);

export const InstanceStatusSchema = z.enum(['active', 'stale', 'closed']);

export const RegisterInstanceInputSchema = z.object({
  project: z.string().min(1).max(64),
  instance_type: InstanceTypeSchema,
  initial_context: z.record(z.string(), z.any()).optional(),
});

export const HeartbeatInputSchema = z.object({
  instance_id: z.string().min(1),
  context_percent: z.number().int().min(0).max(100),
  current_epic: z.string().optional(),
});

export const ListInstancesInputSchema = z.object({
  project: z.string().optional(),
  active_only: z.boolean().optional(),
});

export const GetInstanceDetailsInputSchema = z.object({
  instance_id: z.string().min(1),
});

/**
 * Instance ID regex pattern
 * Format: {project}-{type}-{6-char-hash}
 * Example: odin-PS-8f4a2b
 */
export const INSTANCE_ID_PATTERN = /^[a-z0-9-]+-(PS|MS)-[a-z0-9]{6}$/;

/**
 * Stale timeout in milliseconds (120 seconds)
 */
export const STALE_TIMEOUT_MS = 120000;

/**
 * Stale timeout in seconds (for calculations)
 */
export const STALE_TIMEOUT_SECONDS = 120;
