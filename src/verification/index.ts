/**
 * Verification System Exports
 * Epic 006-E: Independent Verification Agent
 */

export { IndependentVerifier } from './IndependentVerifier.js';
export { IntegrityChecker } from './IntegrityChecker.js';
export { EvidenceAnalyzer } from './EvidenceAnalyzer.js';
export { CrossValidator } from './CrossValidator.js';
export { SkepticalAnalyzer } from './SkepticalAnalyzer.js';
export { VerificationReporter } from './VerificationReporter.js';

// Re-export verification types
export type {
  VerificationReport,
  VerificationReportInput,
  VerificationResult,
  VerificationRequest,
  VerificationConfig,
  VerificationStatistics,
  EvidenceReviewedSummary,
  RedFlagSummary,
  CrossValidationResult,
  CrossValidationType,
  IntegrityCheckResult,
  FileIntegrityCheck,
  SkepticalAnalysisResult,
  SuspiciousPattern,
  SuspiciousPatternType,
  ScreenshotAnalysisResult,
  ConsoleLogAnalysis,
  HTTPTraceAnalysis,
  DOMAnalysis,
  CoverageAnalysis,
  ConfidenceFactors,
  ConfidenceCalculation,
} from '../types/verification.js';

export {
  DEFAULT_VERIFICATION_CONFIG,
  VerificationError,
  EvidenceNotFoundError,
  IntegrityCheckFailedError,
  CriticalRedFlagError,
} from '../types/verification.js';
