/**
 * Types for Task Timing and Estimation System
 * EPIC-007: Task Timing & Estimation
 */

/**
 * Task execution data
 */
export interface TaskExecution {
  taskId: string;
  taskType: string;
  taskDescription: string;
  projectName: string;
  agentType: string;
  agentModel: string;
  parentTaskId?: string;
  estimatedSeconds?: number;
  complexity?: 'simple' | 'medium' | 'complex';
  startedAt: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

/**
 * Task completion metrics
 */
export interface TaskMetrics {
  taskId: string;
  durationSeconds: number;
  estimatedSeconds?: number;
  estimationError?: number;
  success: boolean;
}

/**
 * Task estimation result
 */
export interface TaskEstimate {
  estimatedSeconds: number;
  confidenceIntervalLow: number;
  confidenceIntervalHigh: number;
  medianSeconds: number;
  p95Seconds: number;
  sampleSize: number;
  similarTasks: Array<{
    description: string;
    duration: number;
  }>;
  note?: string;
}

/**
 * Parallel execution metrics
 */
export interface ParallelMetrics {
  sequentialEstimate: number;
  parallelActual: number;
  timeSaved: number;
  efficiency: number;
  agentCount: number;
}

/**
 * Options for starting a task timer
 */
export interface StartTaskOptions {
  taskId: string;
  taskType: string;
  taskDescription: string;
  projectName: string;
  agentType: string;
  agentModel?: string;
  parentTaskId?: string;
  estimatedSeconds?: number;
  complexity?: 'simple' | 'medium' | 'complex';
  metadata?: Record<string, any>;
}

/**
 * Options for completing a task timer
 */
export interface CompleteTaskOptions {
  taskId: string;
  success: boolean;
  linesOfCodeChanged?: number;
  filesChanged?: number;
  testsWritten?: number;
  tokensUsed?: number;
  errorMessage?: string;
  outputSummary?: string;
  metadata?: Record<string, any>;
}

/**
 * Options for estimating a task
 */
export interface EstimateTaskOptions {
  taskDescription: string;
  taskType: string;
  projectName: string;
  complexity?: 'simple' | 'medium' | 'complex';
}

/**
 * Options for parallel execution tracking
 */
export interface ParallelExecutionOptions {
  parentTaskId: string;
  childTaskIds: string[];
  sequentialEstimate: number;
}

/**
 * Project statistics
 */
export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  averageDuration: number;
  byType: Record<string, TaskTypeStats>;
  estimationAccuracy: EstimationAccuracy;
  parallelism: ParallelismStats;
}

/**
 * Task type statistics
 */
export interface TaskTypeStats {
  count: number;
  avgDuration: number;
  successRate: number;
  medianDuration: number;
  p95Duration: number;
}

/**
 * Estimation accuracy metrics
 */
export interface EstimationAccuracy {
  avgError: number;
  within20Percent: number;
  improving: boolean;
}

/**
 * Parallelism statistics
 */
export interface ParallelismStats {
  avgAgents: number;
  avgEfficiency: number;
  avgTimeSaved: number;
}

/**
 * Database row types (matching migration schema)
 */

export interface TaskExecutionRow {
  id: string;
  task_id: string;
  project_id: string;
  execution_number: number;
  started_at: Date;
  completed_at?: Date;
  duration_minutes?: number;
  estimated_minutes?: number;
  variance_minutes?: number;
  variance_percent?: number;
  status: string;
  complexity?: string;
  context_switches: number;
  interruptions: number;
  blockers?: string[];
  notes?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface EstimationPatternRow {
  id: string;
  project_id: string;
  pattern_name: string;
  task_type: string;
  complexity: string;
  avg_duration_minutes: number;
  std_deviation: number;
  sample_count: number;
  confidence_score: number;
  factors: Record<string, any>;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface TimeTrackingSessionRow {
  id: string;
  task_execution_id: string;
  session_number: number;
  started_at: Date;
  ended_at?: Date;
  duration_minutes?: number;
  activity_type?: string;
  productivity_rating?: number;
  notes?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ParallelExecutionRow {
  id: string;
  parent_task_id: string;
  child_task_ids: string[];
  started_at: Date;
  completed_at?: Date;
  sequential_estimate: number;
  parallel_actual?: number;
  time_saved_seconds?: number;
  parallelism_efficiency?: number;
  agent_count: number;
  completion_order?: string[];
  created_at: Date;
}
