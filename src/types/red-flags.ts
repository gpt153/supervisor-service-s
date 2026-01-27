/**
 * Red Flag Detection System Types
 * Epic 006-B: Catch agent lies by analyzing evidence for deception patterns
 */

/**
 * Category of red flag detected
 */
export type FlagType =
  | 'missing_evidence'   // Required artifact not collected
  | 'inconsistent'       // Evidence contradicts test result
  | 'tool_execution'     // Expected tool not called
  | 'timing'             // Test completed suspiciously fast
  | 'coverage';          // Coverage data indicates test didn't run

/**
 * Severity level determines action taken
 */
export type Severity =
  | 'critical'  // Auto-fail verification (test must have evidence)
  | 'high'      // Alert user for manual review (likely deception)
  | 'medium'    // Log for analysis (suspicious but not conclusive)
  | 'low';      // Informational (edge case)

/**
 * Test type requiring specific evidence
 */
export type TestType =
  | 'ui'           // UI/integration tests
  | 'api'          // API/backend tests
  | 'unit'         // Unit tests
  | 'integration'; // Full integration tests

/**
 * Proof structure for different red flag types
 */
export interface RedFlagProof {
  // Common fields
  testId?: string;
  testType?: TestType;
  timestamp?: string;

  // Missing evidence
  expectedArtifacts?: string[];
  actualArtifacts?: string[];
  missingArtifacts?: string[];

  // Inconsistent evidence
  screenshot?: string;
  detectedError?: string;
  httpStatus?: number;
  httpResponse?: string;
  consoleErrors?: string[];
  expectedElements?: string[];
  missingElements?: string[];
  testResult?: 'pass' | 'fail';

  // Tool execution
  expectedTools?: string[];
  actualTools?: string[];
  missingTools?: string[];
  wrongToolCalled?: {
    expected: string;
    actual: string;
  };

  // Timing anomalies
  duration?: number;
  expectedMinDuration?: number;
  historicalAvg?: number;
  deviation?: number;
  networkRequests?: number;
  domChanges?: number;

  // Coverage
  coverageBefore?: CoverageData;
  coverageAfter?: CoverageData;
  diff?: number;
  expectedCoverageIncrease?: boolean;

  // Additional context
  [key: string]: any;
}

/**
 * Coverage data structure
 */
export interface CoverageData {
  linesCovered: number;
  linesTotal: number;
  branchesCovered: number;
  branchesTotal: number;
  functionsCovered: number;
  functionsTotal: number;
  percentage: number;
}

/**
 * Red flag record
 */
export interface RedFlag {
  id: number;
  epicId: string;
  testId: string;
  evidenceId: number | null;

  // Classification
  flagType: FlagType;
  severity: Severity;
  description: string;

  // Evidence
  proof: RedFlagProof;

  // Lifecycle
  detectedAt: Date;
  resolved: boolean;
  resolutionNotes?: string;
  resolvedAt?: Date;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Red flag creation input
 */
export interface CreateRedFlagInput {
  epicId: string;
  testId: string;
  evidenceId?: number;
  flagType: FlagType;
  severity: Severity;
  description: string;
  proof: RedFlagProof;
}

/**
 * Red flag resolution input
 */
export interface ResolveRedFlagInput {
  id: number;
  resolutionNotes: string;
}

/**
 * Red flag query filters
 */
export interface RedFlagQueryFilters {
  epicId?: string;
  testId?: string;
  flagType?: FlagType;
  severity?: Severity;
  resolved?: boolean;
  detectedAfter?: Date;
  detectedBefore?: Date;
}

/**
 * Red flag statistics
 */
export interface RedFlagStatistics {
  epicId: string;
  flagType: FlagType;
  severity: Severity;
  flagCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
}

/**
 * Red flag report
 */
export interface RedFlagReport {
  epicId: string;
  testId: string;
  summary: {
    totalFlags: number;
    criticalFlags: number;
    highFlags: number;
    mediumFlags: number;
    lowFlags: number;
  };
  verdict: 'pass' | 'fail' | 'review';
  recommendation: string;
  flags: RedFlag[];
  generatedAt: Date;
}

/**
 * Test timing history record
 */
export interface TestTimingHistory {
  id: number;
  testName: string;
  testType: TestType;
  durationMs: number;
  networkRequests: number;
  domChanges: number;
  executedAt: Date;
  epicId?: string;
  createdAt: Date;
}

/**
 * Test timing averages (from view)
 */
export interface TestTimingAverages {
  testName: string;
  testType: TestType;
  avgDurationMs: number;
  stddevDurationMs: number;
  avgNetworkRequests: number;
  avgDomChanges: number;
  sampleCount: number;
  lastExecutedAt: Date;
}

/**
 * Detection result from a detector module
 */
export interface DetectionResult {
  flags: RedFlag[];
  detectorType: string;
  executionTimeMs: number;
}

/**
 * Overall detection result
 */
export interface RedFlagDetectionResult {
  epicId: string;
  testId: string;
  verdict: 'pass' | 'fail' | 'review';
  summary: {
    totalFlags: number;
    criticalFlags: number;
    highFlags: number;
    mediumFlags: number;
    lowFlags: number;
  };
  flags: RedFlag[];
  recommendation: string;
  executionTimeMs: number;
}
