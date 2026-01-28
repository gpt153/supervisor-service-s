/**
 * Event Store Type Definitions (Epic 007-C)
 * Comprehensive TypeScript interfaces for all 12 event types in the session continuity system
 *
 * Event Categories:
 * 1. Instance lifecycle: instance_registered, instance_heartbeat, instance_stale
 * 2. Epic lifecycle: epic_started, epic_completed, epic_failed
 * 3. Testing: test_started, test_passed, test_failed, validation_passed, validation_failed
 * 4. Git operations: commit_created, pr_created, pr_merged
 * 5. Deployment: deployment_started, deployment_completed, deployment_failed
 * 6. Work state: context_window_updated, checkpoint_created, checkpoint_loaded
 * 7. Planning: epic_planned, feature_requested, task_spawned
 */

import { z } from 'zod';

/**
 * Event categories for classification and filtering
 */
export enum EventCategory {
  INSTANCE = 'instance',
  EPIC = 'epic',
  TESTING = 'testing',
  GIT = 'git',
  DEPLOYMENT = 'deployment',
  WORK_STATE = 'work_state',
  PLANNING = 'planning',
}

/**
 * All available event types (12 core types)
 */
export enum EventType {
  // Instance lifecycle (3)
  INSTANCE_REGISTERED = 'instance_registered',
  INSTANCE_HEARTBEAT = 'instance_heartbeat',
  INSTANCE_STALE = 'instance_stale',

  // Epic lifecycle (3)
  EPIC_STARTED = 'epic_started',
  EPIC_COMPLETED = 'epic_completed',
  EPIC_FAILED = 'epic_failed',

  // Testing (5)
  TEST_STARTED = 'test_started',
  TEST_PASSED = 'test_passed',
  TEST_FAILED = 'test_failed',
  VALIDATION_PASSED = 'validation_passed',
  VALIDATION_FAILED = 'validation_failed',

  // Git operations (3)
  COMMIT_CREATED = 'commit_created',
  PR_CREATED = 'pr_created',
  PR_MERGED = 'pr_merged',

  // Deployment (3)
  DEPLOYMENT_STARTED = 'deployment_started',
  DEPLOYMENT_COMPLETED = 'deployment_completed',
  DEPLOYMENT_FAILED = 'deployment_failed',

  // Work state (3)
  CONTEXT_WINDOW_UPDATED = 'context_window_updated',
  CHECKPOINT_CREATED = 'checkpoint_created',
  CHECKPOINT_LOADED = 'checkpoint_loaded',

  // Planning (3)
  EPIC_PLANNED = 'epic_planned',
  FEATURE_REQUESTED = 'feature_requested',
  TASK_SPAWNED = 'task_spawned',
}

/**
 * Base event interface (all events have these)
 */
export interface BaseEvent {
  event_id: string;
  instance_id: string;
  event_type: EventType;
  sequence_num: number;
  timestamp: Date;
  event_data: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * EVENT TYPE 1: Instance Registered
 * Emitted when a new PS/MS instance starts
 */
export interface InstanceRegisteredEventData {
  instance_type: 'PS' | 'MS';
  project: string;
  created_at: string;
}

/**
 * EVENT TYPE 2: Instance Heartbeat
 * Emitted periodically or on every response to track liveness
 */
export interface InstanceHeartbeatEventData {
  context_percent: number;
  current_epic?: string;
  age_seconds: number;
}

/**
 * EVENT TYPE 3: Instance Stale
 * Emitted when instance goes without heartbeat for 120s
 */
export interface InstanceStaleEventData {
  last_heartbeat: string;
  age_seconds: number;
  reason: string; // e.g., "timeout", "manual_close"
}

/**
 * EVENT TYPE 4: Epic Started
 * Emitted when implementation of an epic begins
 */
export interface EpicStartedEventData {
  epic_id: string;
  feature_name: string;
  estimated_hours: number;
  spawned_by: string; // e.g., "plan-feature-interactive"
  acceptance_criteria_count: number;
  description?: string;
}

/**
 * EVENT TYPE 5: Epic Completed
 * Emitted when epic implementation finishes successfully
 */
export interface EpicCompletedEventData {
  epic_id: string;
  duration_hours: number;
  files_changed: number;
  tests_passed: number;
  pr_url?: string;
  validation_confidence: number; // 0-1
  issues_encountered: string[]; // e.g., ["cors_headers", "token_refresh"]
  commits: number;
  lines_added: number;
  lines_removed: number;
}

/**
 * EVENT TYPE 6: Epic Failed
 * Emitted when epic implementation fails
 */
export interface EpicFailedEventData {
  epic_id: string;
  duration_hours: number;
  failure_reason: string;
  error_message?: string;
  attempts: number;
  last_error_type?: string; // e.g., "test_failure", "compilation_error"
}

/**
 * EVENT TYPE 7: Test Started
 * Emitted when test execution begins
 */
export interface TestStartedEventData {
  epic_id?: string;
  test_type: 'unit' | 'integration' | 'e2e' | 'validation';
  test_count: number;
  description?: string;
}

/**
 * EVENT TYPE 8: Test Passed
 * Emitted when tests pass successfully
 */
export interface TestPassedEventData {
  epic_id?: string;
  test_type: 'unit' | 'integration' | 'e2e' | 'validation';
  passed_count: number;
  failed_count: number;
  skipped_count?: number;
  coverage_percent?: number;
  duration_seconds: number;
  test_names?: string[];
}

/**
 * EVENT TYPE 9: Test Failed
 * Emitted when tests fail
 */
export interface TestFailedEventData {
  epic_id?: string;
  test_type: 'unit' | 'integration' | 'e2e' | 'validation';
  passed_count: number;
  failed_count: number;
  skipped_count?: number;
  duration_seconds: number;
  failed_tests: string[];
  error_summary?: string;
}

/**
 * EVENT TYPE 10: Validation Passed
 * Emitted when quality/validation checks pass
 */
export interface ValidationPassedEventData {
  epic_id?: string;
  validation_type: string; // e.g., "automatic_quality_workflow", "acceptance_criteria"
  confidence_score: number; // 0-1
  checks_passed: number;
  checks_total: number;
  duration_seconds: number;
}

/**
 * EVENT TYPE 11: Validation Failed
 * Emitted when quality/validation checks fail
 */
export interface ValidationFailedEventData {
  epic_id?: string;
  validation_type: string;
  confidence_score: number;
  failed_checks: string[];
  failure_reason: string;
  recommendation?: string;
}

/**
 * EVENT TYPE 12: Commit Created
 * Emitted when code is committed
 */
export interface CommitCreatedEventData {
  epic_id?: string;
  commit_hash: string;
  branch: string;
  message: string;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  author?: string;
}

/**
 * EVENT TYPE 13: PR Created
 * Emitted when pull request is created
 */
export interface PRCreatedEventData {
  epic_id?: string;
  pr_url: string;
  pr_number: number;
  branch: string;
  title: string;
  description?: string;
  files_changed: number;
  commits: number;
}

/**
 * EVENT TYPE 14: PR Merged
 * Emitted when pull request is merged
 */
export interface PRMergedEventData {
  epic_id?: string;
  pr_url: string;
  pr_number: number;
  merge_commit: string;
  merged_at: string;
  duration_hours: number; // Time from creation to merge
}

/**
 * EVENT TYPE 15: Deployment Started
 * Emitted when deployment begins
 */
export interface DeploymentStartedEventData {
  service: string;
  environment: 'local' | 'staging' | 'production';
  port?: number;
  version?: string;
  deployment_type: 'docker' | 'native' | 'other';
}

/**
 * EVENT TYPE 16: Deployment Completed
 * Emitted when deployment succeeds
 */
export interface DeploymentCompletedEventData {
  service: string;
  environment: 'local' | 'staging' | 'production';
  port?: number;
  health_status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms: number;
  git_commit?: string;
  docker_image?: string;
  duration_seconds: number;
}

/**
 * EVENT TYPE 17: Deployment Failed
 * Emitted when deployment fails
 */
export interface DeploymentFailedEventData {
  service: string;
  environment: 'local' | 'staging' | 'production';
  error_message: string;
  error_type?: string; // e.g., "health_check_failed", "build_error"
  duration_seconds: number;
  rollback_performed?: boolean;
}

/**
 * EVENT TYPE 18: Context Window Updated
 * Emitted when context window usage changes significantly
 */
export interface ContextWindowUpdatedEventData {
  context_percent: number;
  tokens_used: number;
  tokens_available: number;
  checkpoint_triggered?: boolean;
}

/**
 * EVENT TYPE 19: Checkpoint Created
 * Emitted when a checkpoint is created for context recovery
 */
export interface CheckpointCreatedEventData {
  checkpoint_id: string;
  context_percent: number;
  reason: string; // e.g., "automatic_threshold", "manual_request"
  state_keys: string[]; // What was saved
  size_bytes: number;
}

/**
 * EVENT TYPE 20: Checkpoint Loaded
 * Emitted when a checkpoint is restored
 */
export interface CheckpointLoadedEventData {
  checkpoint_id: string;
  context_percent: number;
  reason: string; // e.g., "resume_requested", "recovery"
  state_keys: string[];
  duration_seconds: number;
}

/**
 * EVENT TYPE 21: Epic Planned
 * Emitted when epic planning is complete
 */
export interface EpicPlannedEventData {
  epic_id: string;
  feature_name: string;
  complexity: number; // 1-5
  estimated_hours: number;
  acceptance_criteria_count: number;
  dependencies: string[];
  created_by: string;
}

/**
 * EVENT TYPE 22: Feature Requested
 * Emitted when a new feature is requested
 */
export interface FeatureRequestedEventData {
  feature_name: string;
  description: string;
  requested_by: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimated_hours?: number;
}

/**
 * EVENT TYPE 23: Task Spawned
 * Emitted when a subagent is spawned for a task
 */
export interface TaskSpawnedEventData {
  task_id?: string;
  task_type: string; // e.g., "implementation", "testing", "review"
  subagent_type: string; // e.g., "general-purpose", "Explore", "Plan"
  epic_id?: string;
  model: string; // e.g., "haiku", "sonnet", "opus"
  expected_duration_seconds?: number;
}

/**
 * Union type of all event data types
 */
export type EventData =
  | InstanceRegisteredEventData
  | InstanceHeartbeatEventData
  | InstanceStaleEventData
  | EpicStartedEventData
  | EpicCompletedEventData
  | EpicFailedEventData
  | TestStartedEventData
  | TestPassedEventData
  | TestFailedEventData
  | ValidationPassedEventData
  | ValidationFailedEventData
  | CommitCreatedEventData
  | PRCreatedEventData
  | PRMergedEventData
  | DeploymentStartedEventData
  | DeploymentCompletedEventData
  | DeploymentFailedEventData
  | ContextWindowUpdatedEventData
  | CheckpointCreatedEventData
  | CheckpointLoadedEventData
  | EpicPlannedEventData
  | FeatureRequestedEventData
  | TaskSpawnedEventData;

/**
 * MCP Tool input/output types
 */

/**
 * Input for emit_event tool
 */
export interface EmitEventInput {
  instance_id: string;
  event_type: string;
  event_data: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Output from emit_event tool
 */
export interface EmitEventOutput {
  success: boolean;
  event_id?: string;
  sequence_num?: number;
  timestamp?: string;
  error?: string;
}

/**
 * Input for query_events tool
 */
export interface QueryEventsInput {
  instance_id: string;
  filters?: {
    event_type?: string | string[];
    start_date?: string; // ISO8601
    end_date?: string;
    keyword?: string;
  };
  limit?: number; // default 100, max 1000
  offset?: number; // default 0
}

/**
 * Event item in query response
 */
export interface EventItem {
  event_id: string;
  event_type: string;
  sequence_num: number;
  timestamp: string;
  event_data: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Output from query_events tool
 */
export interface QueryEventsOutput {
  success: boolean;
  events?: EventItem[];
  total_count?: number;
  has_more?: boolean;
  error?: string;
}

/**
 * Input for replay_events tool
 */
export interface ReplayEventsInput {
  instance_id: string;
  to_sequence_num?: number;
}

/**
 * Output from replay_events tool
 */
export interface ReplayEventsOutput {
  success: boolean;
  final_state?: {
    last_epic?: string;
    last_event_type?: string;
    latest_timestamp?: string;
    total_events_replayed: number;
    checkpoint_state?: Record<string, any>;
  };
  events_replayed?: number;
  duration_ms?: number;
  error?: string;
}

/**
 * Event type definition for tool listing
 */
export interface EventTypeDefinition {
  type: string;
  category: EventCategory;
  description: string;
  required_fields: string[];
  optional_fields: string[];
}

/**
 * Output from list_event_types tool
 */
export interface ListEventTypesOutput {
  success: boolean;
  event_types?: EventTypeDefinition[];
  total_count?: number;
  error?: string;
}

/**
 * Zod validation schemas
 */

export const EventTypeSchema = z.enum([
  'instance_registered',
  'instance_heartbeat',
  'instance_stale',
  'epic_started',
  'epic_completed',
  'epic_failed',
  'test_started',
  'test_passed',
  'test_failed',
  'validation_passed',
  'validation_failed',
  'commit_created',
  'pr_created',
  'pr_merged',
  'deployment_started',
  'deployment_completed',
  'deployment_failed',
  'context_window_updated',
  'checkpoint_created',
  'checkpoint_loaded',
  'epic_planned',
  'feature_requested',
  'task_spawned',
]);

export const EmitEventInputSchema = z.object({
  instance_id: z.string().min(1),
  event_type: EventTypeSchema,
  event_data: z.record(z.string(), z.any()),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const QueryEventsInputSchema = z.object({
  instance_id: z.string().min(1),
  filters: z
    .object({
      event_type: z
        .union([EventTypeSchema, z.array(EventTypeSchema)])
        .optional(),
      start_date: z.string().datetime().optional(),
      end_date: z.string().datetime().optional(),
      keyword: z.string().optional(),
    })
    .optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});

export const ReplayEventsInputSchema = z.object({
  instance_id: z.string().min(1),
  to_sequence_num: z.number().int().min(0).optional(),
});
