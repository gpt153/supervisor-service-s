/**
 * Task Timing & Estimation System
 * EPIC-007: Task Timing & Estimation
 *
 * Exports all timing functionality for use throughout the system
 */

export { TaskTimer } from './TaskTimer.js';

export type {
  TaskExecution,
  TaskMetrics,
  TaskEstimate,
  ParallelMetrics,
  StartTaskOptions,
  CompleteTaskOptions,
  EstimateTaskOptions,
  ParallelExecutionOptions,
  ProjectStats,
  TaskTypeStats,
  EstimationAccuracy,
  ParallelismStats,
  TaskExecutionRow,
  EstimationPatternRow,
  TimeTrackingSessionRow,
  ParallelExecutionRow,
} from '../types/timing.js';
