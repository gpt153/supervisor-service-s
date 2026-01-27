/**
 * Verification System Type Definitions
 * Epic 006-E: Independent Verification Agent
 *
 * Provides types for evidence verification, cross-validation,
 * skeptical analysis, and verification reporting.
 */

import { EvidenceArtifact, TestType } from './evidence.js';
import { RedFlag } from './red-flags.js';

// ============================================================================
// Verification Report (Database)
// ============================================================================

export interface VerificationReport {
  id: number;
  testId: string;
  epicId: string;
  evidenceId: number | null;

  // Verification outcome
  verified: boolean;
  confidenceScore: number; // 0-100
  recommendation: 'accept' | 'reject' | 'manual_review';

  // Analysis
  evidenceReviewed: EvidenceReviewedSummary;
  crossValidationResults: CrossValidationResult[];
  redFlagsFound: RedFlagSummary;

  // Reasoning
  summary: string; // Plain language summary
  reasoning: string; // Why did verification pass/fail
  concerns: string[]; // Array of concerns raised

  // Metadata
  verifiedAt: Date;
  verifierModel: string; // 'sonnet', 'opus', etc.

  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationReportInput {
  testId: string;
  epicId: string;
  evidenceId?: number;
  verified: boolean;
  confidenceScore: number;
  recommendation: 'accept' | 'reject' | 'manual_review';
  evidenceReviewed: EvidenceReviewedSummary;
  crossValidationResults: CrossValidationResult[];
  redFlagsFound: RedFlagSummary;
  summary: string;
  reasoning: string;
  concerns: string[];
  verifierModel: string;
}

// ============================================================================
// Evidence Review Summary
// ============================================================================

export interface EvidenceReviewedSummary {
  screenshots: number; // Count of screenshots reviewed
  logs: number; // Count of log files reviewed
  traces: number; // Count of HTTP traces reviewed
  coverage: boolean; // Was coverage report reviewed
  dom: boolean; // Was DOM snapshot reviewed
  totalArtifacts: number;
  missingArtifacts: string[]; // List of expected but missing artifacts
}

// ============================================================================
// Red Flag Summary
// ============================================================================

export interface RedFlagSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalFlags: number;
  descriptions: string[]; // Brief descriptions of each flag
}

// ============================================================================
// Cross-Validation
// ============================================================================

export type CrossValidationType =
  | 'screenshot_vs_console'     // Screenshot shows errors vs console has errors
  | 'http_vs_schema'            // HTTP response matches expected schema
  | 'duration_vs_historical'    // Test duration vs historical average
  | 'coverage_vs_scope'         // Coverage change proportional to test scope
  | 'network_vs_ui'             // Network activity matches UI changes
  | 'dom_vs_screenshot'         // DOM changes match screenshot differences
  | 'error_vs_result';          // Error logs vs test pass/fail result

export interface CrossValidationResult {
  type: CrossValidationType;
  matched: boolean; // Did the evidence sources agree?
  description: string; // What was compared and what was found
  evidence: Record<string, any>; // Relevant evidence for this comparison
  severity?: 'low' | 'medium' | 'high'; // If mismatch, how severe
}

// ============================================================================
// Integrity Checks
// ============================================================================

export interface IntegrityCheckResult {
  passed: boolean;
  checks: {
    filesExist: boolean;
    timestampsSequential: boolean;
    sizesReasonable: boolean;
    formatsCorrect: boolean;
  };
  errors: string[]; // Descriptions of failed checks
  warnings: string[]; // Non-critical issues found
}

export interface FileIntegrityCheck {
  path: string;
  exists: boolean;
  size?: number;
  expectedMinSize?: number;
  expectedMaxSize?: number;
  format?: string;
  expectedFormat?: string;
  timestamp?: Date;
}

// ============================================================================
// Skeptical Analysis
// ============================================================================

export interface SkepticalAnalysisResult {
  suspicious: boolean; // Is something suspicious about this test?
  concerns: string[]; // List of concerns identified
  recommendManualReview: boolean; // Should user review manually
  suspiciousPatterns: SuspiciousPattern[];
}

export type SuspiciousPatternType =
  | 'too_perfect'           // No errors, no warnings, 100% coverage
  | 'too_fast'              // Completed impossibly quickly
  | 'missing_artifacts'     // Expected artifacts not collected
  | 'zero_network'          // UI test with no network activity
  | 'zero_dom_changes'      // UI test with no DOM changes
  | 'red_flags_ignored'     // High/critical red flags but test passed
  | 'inconsistent_timing'   // Duration doesn't match work done
  | 'empty_logs';           // No console output when expected

export interface SuspiciousPattern {
  type: SuspiciousPatternType;
  description: string;
  severity: 'low' | 'medium' | 'high';
  evidence: Record<string, any>;
}

// ============================================================================
// Evidence Analysis
// ============================================================================

export interface ScreenshotAnalysisResult {
  hasErrorUI: boolean; // Error messages visible in UI
  hasSuccessUI: boolean; // Success indicators visible
  hasLoadingUI: boolean; // Loading indicators present
  uiElements: string[]; // Notable UI elements detected
  errors: string[]; // Error messages extracted from screenshot
}

export interface ConsoleLogAnalysis {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hasUncaughtErrors: boolean;
  criticalErrors: string[]; // Most severe errors found
  patterns: string[]; // Repeated patterns in logs
}

export interface HTTPTraceAnalysis {
  requestCount: number;
  failedRequests: number; // 4xx, 5xx responses
  averageResponseTime: number;
  slowRequests: number; // Requests over 1s
  authFailures: number; // 401, 403 responses
  serverErrors: number; // 5xx responses
}

export interface DOMAnalysis {
  changeCount: number; // Number of DOM mutations
  nodesAdded: number;
  nodesRemoved: number;
  attributeChanges: number;
  significantChanges: boolean; // Were changes substantial
}

export interface CoverageAnalysis {
  before: number; // Coverage percentage before
  after: number; // Coverage percentage after
  change: number; // Percentage point change
  linesAdded: number; // New lines covered
  proportional: boolean; // Change proportional to test scope
}

// ============================================================================
// Confidence Scoring
// ============================================================================

export interface ConfidenceFactors {
  evidenceCompleteness: number; // 0-100, all required artifacts present
  evidenceConsistency: number; // 0-100, artifacts agree with each other
  redFlagPenalty: number; // 0-100, deduction for red flags
  historicalSuccess: number; // 0-100, based on past test reliability
  integrityScore: number; // 0-100, based on artifact integrity checks
  skepticalScore: number; // 0-100, deduction for suspicious patterns
}

export interface ConfidenceCalculation {
  finalScore: number; // 0-100
  factors: ConfidenceFactors;
  explanation: string; // Why this score was assigned
  threshold: {
    autoPass: number; // Score needed for auto-pass (e.g., 90)
    manualReview: number; // Score needed for manual review (e.g., 60)
    autoFail: number; // Below this is auto-fail (e.g., 60)
  };
}

// ============================================================================
// Verification Configuration
// ============================================================================

export interface VerificationConfig {
  // Model to use for verification (MUST be different from executor)
  verifierModel: 'sonnet' | 'opus'; // Never 'haiku'

  // Confidence thresholds
  confidenceThresholds: {
    autoPass: number; // Default: 90
    manualReview: number; // Default: 60
  };

  // Red flag handling
  redFlagRules: {
    criticalAutoFail: boolean; // Auto-fail on critical flags (default: true)
    highRequiresReview: boolean; // Require manual review for high flags (default: true)
  };

  // Cross-validation settings
  crossValidation: {
    enabled: boolean; // Default: true
    requiredChecks: CrossValidationType[]; // Checks that must pass
  };

  // Skeptical analysis settings
  skepticalAnalysis: {
    enabled: boolean; // Default: true
    strictMode: boolean; // More aggressive pattern detection (default: false)
  };
}

export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  verifierModel: 'sonnet',
  confidenceThresholds: {
    autoPass: 90,
    manualReview: 60,
  },
  redFlagRules: {
    criticalAutoFail: true,
    highRequiresReview: true,
  },
  crossValidation: {
    enabled: true,
    requiredChecks: [
      'screenshot_vs_console',
      'http_vs_schema',
      'error_vs_result',
    ],
  },
  skepticalAnalysis: {
    enabled: true,
    strictMode: false,
  },
};

// ============================================================================
// Verification Request
// ============================================================================

export interface VerificationRequest {
  testId: string;
  epicId: string;
  config?: Partial<VerificationConfig>; // Override defaults if needed
}

// ============================================================================
// Verification Result (Complete)
// ============================================================================

export interface VerificationResult {
  // Basic outcome
  verified: boolean;
  confidenceScore: number;
  recommendation: 'accept' | 'reject' | 'manual_review';

  // Detailed analysis
  evidenceReview: EvidenceReviewedSummary;
  crossValidation: CrossValidationResult[];
  redFlags: RedFlagSummary;
  integrityChecks: IntegrityCheckResult;
  skepticalAnalysis: SkepticalAnalysisResult;
  confidenceCalculation: ConfidenceCalculation;

  // Report
  summary: string;
  reasoning: string;
  concerns: string[];
  recommendations: string[]; // Actions to take

  // Metadata
  testId: string;
  epicId: string;
  verifierModel: string;
  verifiedAt: Date;
  executionTimeMs: number;
}

// ============================================================================
// Verification Statistics
// ============================================================================

export interface VerificationStatistics {
  epicId: string;
  totalVerifications: number;
  passedVerifications: number;
  failedVerifications: number;
  manualReviewRequired: number;
  averageConfidenceScore: number;
  averageExecutionTimeMs: number;
  mostCommonConcerns: Array<{ concern: string; count: number }>;
  redFlagDistribution: RedFlagSummary;
  lastVerifiedAt: Date;
}

// ============================================================================
// Verification Errors
// ============================================================================

export class VerificationError extends Error {
  constructor(
    message: string,
    public testId: string,
    public epicId: string,
    public phase: 'load_evidence' | 'integrity' | 'cross_validation' | 'analysis' | 'report'
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

export class EvidenceNotFoundError extends VerificationError {
  constructor(testId: string, epicId: string) {
    super(`No evidence found for test ${testId}`, testId, epicId, 'load_evidence');
    this.name = 'EvidenceNotFoundError';
  }
}

export class IntegrityCheckFailedError extends VerificationError {
  constructor(testId: string, epicId: string, reason: string) {
    super(`Evidence integrity check failed: ${reason}`, testId, epicId, 'integrity');
    this.name = 'IntegrityCheckFailedError';
  }
}

export class CriticalRedFlagError extends VerificationError {
  constructor(testId: string, epicId: string, flagCount: number) {
    super(
      `Test has ${flagCount} critical red flag(s) - auto-failed`,
      testId,
      epicId,
      'analysis'
    );
    this.name = 'CriticalRedFlagError';
  }
}
