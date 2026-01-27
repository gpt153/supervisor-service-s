/**
 * Epic 006-G: Test Orchestrator Type Definitions
 *
 * Types for workflow orchestration, state management, and test coordination
 */

import type { UITestDefinition } from './ui-testing.js';
import type { RedFlag } from './red-flags.js';
import type { VerificationReport, VerificationResult } from './verification.js';
import type { FixResult } from './fixing.js';

// Re-export for convenience
export type { VerificationReport, FixResult };

// ============================================================================
// Workflow State Types
// ============================================================================

/**
 * Valid workflow stages
 */
export type WorkflowStage =
  | 'pending'
  | 'execution'
  | 'detection'
  | 'verification'
  | 'fixing'
  | 'learning'
  | 'completed'
  | 'failed';

/**
 * Workflow status
 */
export type WorkflowStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

/**
 * Test workflow record from database
 */
export interface TestWorkflow {
  id: number;
  test_id: string;
  epic_id: string;
  test_type: 'ui' | 'api' | 'unit' | 'integration';

  // State
  current_stage: WorkflowStage;
  status: WorkflowStatus;

  // Results
  execution_result?: TestExecutionResult;
  detection_result?: DetectionResult;
  verification_result?: VerificationReport;
  fixing_result?: FixResult;
  learning_result?: LearningResult;

  // Timing
  started_at: Date;
  completed_at?: Date;
  duration_ms?: number;

  // Metadata
  retry_count: number;
  error_message?: string;
  escalated: boolean;

  created_at: Date;
  updated_at: Date;
}

/**
 * Red flag detection result
 */
export interface DetectionResult {
  testId: string;
  redFlags: RedFlag[];
  detectedAt: Date;
  totalChecks: number;
  flaggedChecks: number;
}

/**
 * Learning extraction result
 */
export interface LearningResult {
  testId: string;
  patterns: Array<{
    type: 'success' | 'failure' | 'fix';
    description: string;
    confidence: number;
  }>;
  extractedAt: Date;
}

// ============================================================================
// Workflow Execution Types
// ============================================================================

/**
 * Test execution result (unified)
 */
export interface TestExecutionResult {
  testId: string;
  passed: boolean;
  durationMs: number;
  evidence: {
    screenshots: string[];
    logs: string[];
    traces: string[];
  };
  error?: string;
}

/**
 * Test definition for orchestration
 */
export interface OrchestrationTestDefinition {
  id: string;
  epic_id: string;
  type: 'ui' | 'api' | 'unit' | 'integration';
  priority: 'critical' | 'high' | 'medium' | 'low';
  steps: Array<{
    action: string;
    target?: string;
    expected?: string;
  }>;
}

/**
 * Stage execution context
 */
export interface StageContext {
  workflow: TestWorkflow;
  testDefinition: OrchestrationTestDefinition;
  previousResults?: {
    execution?: TestExecutionResult;
    detection?: DetectionResult;
    verification?: VerificationReport;
    fixing?: FixResult;
  };
}

/**
 * Stage execution result
 */
export interface StageExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  retriesUsed: number;
  duration: number;
}

// ============================================================================
// Workflow Result Types
// ============================================================================

/**
 * Unified test report
 */
export interface TestReport {
  testId: string;
  epicId: string;
  testType: 'ui' | 'api' | 'unit' | 'integration';

  // Overall result
  passed: boolean;
  confidence: number;

  // Summary
  summary: string;
  recommendation: 'accept' | 'manual_review' | 'reject';

  // Evidence
  evidencePaths: {
    screenshots: string[];
    logs: string[];
    traces: string[];
  };

  // Stage results
  redFlags: RedFlag[];
  fixesApplied: number;
  learningsExtracted: number;

  // Performance
  duration: number;
  stages: Array<{
    stage: WorkflowStage;
    duration: number;
    success: boolean;
  }>;
}

/**
 * Workflow orchestration result
 */
export interface TestWorkflowResult {
  success: boolean;
  workflow: TestWorkflow;
  report: TestReport;
  error?: string;
}

/**
 * Epic-level test report (aggregated)
 */
export interface EpicTestReport {
  epicId: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  avgConfidence: number;

  summary: string;
  recommendation: 'accept' | 'manual_review' | 'reject';

  testReports: TestReport[];

  totalDuration: number;
  completedAt: Date;
}

// ============================================================================
// State Machine Types
// ============================================================================

/**
 * Valid state transitions
 */
export const WORKFLOW_TRANSITIONS: Record<WorkflowStage, WorkflowStage[]> = {
  pending: ['execution'],
  execution: ['detection', 'failed'],
  detection: ['verification', 'failed'],
  verification: ['fixing', 'learning', 'failed'],
  fixing: ['verification', 'learning', 'failed'],
  learning: ['completed', 'failed'],
  completed: [],
  failed: []
};

/**
 * State transition event
 */
export interface StateTransitionEvent {
  workflowId: number;
  fromStage: WorkflowStage;
  toStage: WorkflowStage;
  timestamp: Date;
  reason?: string;
}

// ============================================================================
// Scheduling Types
// ============================================================================

/**
 * Test schedule entry
 */
export interface TestScheduleEntry {
  testDefinition: OrchestrationTestDefinition;
  priority: number;
  scheduledAt: Date;
  estimatedDuration: number;
}

/**
 * Resource limits
 */
export interface ResourceLimits {
  maxConcurrentTests: number;
  maxTestDuration: number; // milliseconds
  maxStageDuration: number; // milliseconds
  maxRetries: number;
}

/**
 * Test execution metrics
 */
export interface ExecutionMetrics {
  totalTests: number;
  completedTests: number;
  failedTests: number;
  avgDuration: number;
  maxDuration: number;
  successRate: number;
}

// ============================================================================
// Error Handling Types
// ============================================================================

/**
 * Workflow error
 */
export interface WorkflowError {
  workflowId: number;
  stage: WorkflowStage;
  error: string;
  retryable: boolean;
  retriesUsed: number;
  timestamp: Date;
}

/**
 * Escalation request
 */
export interface EscalationRequest {
  workflowId: number;
  reason: string;
  context: {
    testId: string;
    epicId: string;
    stage: WorkflowStage;
    error: string;
    retriesUsed: number;
  };
  handoffPath?: string;
  createdAt: Date;
}

// ============================================================================
// PIV Integration Types
// ============================================================================

/**
 * PIV completion event
 */
export interface PIVCompletionEvent {
  epicId: string;
  prUrl: string;
  completedAt: Date;
}

/**
 * PIV test extraction result
 */
export interface PIVTestExtraction {
  epicId: string;
  tests: OrchestrationTestDefinition[];
  extractedAt: Date;
}

/**
 * PIV orchestration result
 */
export interface PIVOrchestrationResult {
  epicId: string;
  workflows: TestWorkflowResult[];
  epicReport: EpicTestReport;
  prUpdated: boolean;
  epicStatusUpdated: boolean;
}

// ============================================================================
// Timeout Types
// ============================================================================

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  execution: number; // milliseconds
  detection: number;
  verification: number;
  fixing: number;
  learning: number;
  total: number;
}

/**
 * Timeout event
 */
export interface TimeoutEvent {
  workflowId: number;
  stage: WorkflowStage;
  timeoutMs: number;
  elapsedMs: number;
  timestamp: Date;
}
