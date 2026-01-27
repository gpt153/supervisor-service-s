/**
 * Evidence type definitions for test verification framework
 * Supports UI, API, and unit/integration test evidence collection
 */

// ============================================================================
// Base Evidence Types
// ============================================================================

export type TestType = 'ui' | 'api' | 'unit' | 'integration';
export type PassFailStatus = 'pass' | 'fail' | 'pending';
export type VerificationLevel = 5 | 6; // 5 for UI, 6 for API

// ============================================================================
// Evidence Artifact (Database)
// ============================================================================

export interface EvidenceArtifact {
  id: number;
  epic_id: string;
  test_id: string;
  test_type: TestType;
  verification_level?: VerificationLevel;
  test_name: string;
  expected_outcome?: string;
  actual_outcome?: string;
  pass_fail: PassFailStatus;

  // Artifact paths
  screenshot_before?: string;
  screenshot_after?: string;
  dom_snapshot?: string;
  console_logs?: string;
  network_trace?: string;
  http_request?: string;
  http_response?: string;
  coverage_report?: string;

  // Metadata
  timestamp: Date;
  duration_ms?: number;
  error_message?: string;
  stack_trace?: string;

  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// UI Test Evidence (Level 5)
// ============================================================================

export interface ConsoleLog {
  level: 'log' | 'error' | 'warning' | 'info' | 'debug';
  message: string;
  timestamp?: Date;
}

export interface NetworkTrace {
  method: string; // GET, POST, PUT, DELETE, etc.
  url: string;
  statusCode: number;
  responseTime?: number; // milliseconds
  requestBody?: any;
  responseBody?: any;
  timestamp?: Date;
}

export interface UITestEvidence {
  testId: string;
  testName: string;
  url: string;
  action: string;

  // Before state
  screenshotBefore: string; // file path
  domBefore: string;

  // After state
  screenshotAfter: string;
  domAfter: string;

  // Activity during test
  consoleLogs: ConsoleLog[];
  networkActivity: NetworkTrace[];

  // Result
  expectedOutcome: string;
  actualOutcome: string;
  passFail: 'pass' | 'fail';
  durationMs?: number;
  errorMessage?: string;
}

// ============================================================================
// API Test Evidence (Level 6)
// ============================================================================

export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  timing: number; // milliseconds
}

export interface MCPToolCall {
  tool: string;
  params: any;
  response: any;
  executionTime?: number; // milliseconds
}

export interface APITestEvidence {
  testId: string;
  testName: string;
  toolName: string;
  operation: string;

  // Request
  httpRequest: HttpRequest;

  // Response
  httpResponse: HttpResponse;

  // Tool execution
  mcpToolCall: MCPToolCall;

  // Result
  expectedOutcome: string;
  actualOutcome: string;
  passFail: 'pass' | 'fail';
  durationMs?: number;
  errorMessage?: string;
}

// ============================================================================
// Unit/Integration Test Evidence
// ============================================================================

export interface TestFrameworkOutput {
  framework: 'jest' | 'mocha' | 'vitest' | 'other';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number; // milliseconds
  reportPath: string;
}

export interface CoverageReport {
  linePercentage: number;
  branchPercentage: number;
  functionPercentage: number;
  statementPercentage: number;
  reportPath: string;
}

export interface AssertionLog {
  assertion: string;
  expected: any;
  actual: any;
  passed: boolean;
  timestamp?: Date;
}

export interface TestFailureInfo {
  testName: string;
  error: string;
  stackTrace: string;
  failedAssertions?: AssertionLog[];
}

export interface UnitTestEvidence {
  testId: string;
  testName: string;
  testSuite: string;

  // Framework output
  frameworkOutput: TestFrameworkOutput;

  // Coverage metrics
  coverage?: CoverageReport;

  // Assertion details
  assertions: AssertionLog[];

  // Failures (if any)
  failures?: TestFailureInfo[];

  // Result
  passFail: 'pass' | 'fail';
  durationMs: number;
  errorMessage?: string;
}

// ============================================================================
// Evidence Collection Parameters
// ============================================================================

export interface EvidenceCollectorConfig {
  epicId: string;
  artifactDir: string;
  compressionEnabled?: boolean; // Enable gzip for large files
  retentionDays?: number; // Default 30 days
}

export interface EvidenceStorageParams {
  epicId: string;
  testId: string;
  testType: TestType;
  testName: string;
  passFail: PassFailStatus;
  expectedOutcome?: string;
  actualOutcome?: string;
  durationMs?: number;
  errorMessage?: string;
  stackTrace?: string;
}

// ============================================================================
// Evidence Retrieval
// ============================================================================

export interface EvidenceQueryOptions {
  epicId?: string;
  testType?: TestType;
  passFail?: PassFailStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface EvidenceQueryResult {
  artifact: EvidenceArtifact;
  artifactPaths: {
    screenshotBefore?: string;
    screenshotAfter?: string;
    domSnapshot?: string;
    consoleLogs?: string;
    networkTrace?: string;
    httpRequest?: string;
    httpResponse?: string;
    coverageReport?: string;
  };
  metadata?: Record<string, any>;
}

// ============================================================================
// Evidence Retention & Cleanup
// ============================================================================

export interface RetentionPolicy {
  retentionDays: number;
  archiveDir: string;
  compressionFormat?: 'gzip' | 'zip';
  deleteOldArchives?: boolean;
  deleteAfterDays?: number; // Optional: permanently delete after this many days
}

export interface ArchiveEntry {
  evidenceId: number;
  epicId: string;
  archiveDate: Date;
  archivePath: string;
  archived: boolean;
}

// ============================================================================
// Evidence Errors
// ============================================================================

export class EvidenceCollectionError extends Error {
  constructor(message: string, public testId: string, public testType: TestType) {
    super(message);
    this.name = 'EvidenceCollectionError';
  }
}

export class ArtifactStorageError extends Error {
  constructor(message: string, public filePath: string) {
    super(message);
    this.name = 'ArtifactStorageError';
  }
}

export class EvidenceRetrievalError extends Error {
  constructor(message: string, public query: EvidenceQueryOptions) {
    super(message);
    this.name = 'EvidenceRetrievalError';
  }
}
