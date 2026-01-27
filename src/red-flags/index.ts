/**
 * Red Flag Detection System
 * Epic 006-B: Exports for red flag detection modules
 */

// Main detector
export { RedFlagDetector } from './RedFlagDetector.js';

// Individual detectors
export { MissingEvidenceDetector, type EvidenceArtifact, type TestResult } from './MissingEvidenceDetector.js';
export { InconsistentEvidenceDetector } from './InconsistentEvidenceDetector.js';
export { ToolExecutionDetector, type McpToolCall } from './ToolExecutionDetector.js';
export { TimingAnomalyDetector } from './TimingAnomalyDetector.js';
export { CoverageAnalyzer } from './CoverageAnalyzer.js';

// Reporter
export { RedFlagReporter, type ReportFormat } from './RedFlagReporter.js';

// Types
export type {
  FlagType,
  Severity,
  TestType,
  RedFlagProof,
  CoverageData,
  RedFlag,
  CreateRedFlagInput,
  ResolveRedFlagInput,
  RedFlagQueryFilters,
  RedFlagStatistics,
  RedFlagReport,
  TestTimingHistory,
  TestTimingAverages,
  DetectionResult,
  RedFlagDetectionResult,
} from '../types/red-flags.js';

// Database queries
export {
  insertRedFlag,
  queryRedFlags,
  queryRedFlagsByEpic,
  queryRedFlagsBySeverity,
  queryActiveCriticalFlags,
  resolveRedFlag,
  getRedFlagStatistics,
  insertTestTiming,
  getTestTimingAverages,
  deleteOldTestTiming,
} from '../db/queries/red-flags.js';
