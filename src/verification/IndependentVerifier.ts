/**
 * Independent Verifier
 * Main orchestrator for verification workflow
 * Epic 006-E: Independent Verification Agent
 *
 * CRITICAL: This verifier NEVER executes tests. It ONLY analyzes evidence.
 * Uses different model (Sonnet) than test executors (Haiku) to prevent bias.
 */

import { Logger } from 'pino';
import { Pool } from 'pg';
import {
  VerificationResult,
  VerificationConfig,
  DEFAULT_VERIFICATION_CONFIG,
  VerificationRequest,
  EvidenceNotFoundError,
  IntegrityCheckFailedError,
  CriticalRedFlagError,
  ConfidenceFactors,
  ConfidenceCalculation,
  EvidenceReviewedSummary,
  RedFlagSummary,
} from '../types/verification.js';
import { EvidenceArtifact } from '../types/evidence.js';
import { RedFlag } from '../types/red-flags.js';
import { EvidenceRetriever } from '../evidence/EvidenceRetriever.js';
import { IntegrityChecker } from './IntegrityChecker.js';
import { EvidenceAnalyzer } from './EvidenceAnalyzer.js';
import { CrossValidator } from './CrossValidator.js';
import { SkepticalAnalyzer } from './SkepticalAnalyzer.js';
import { VerificationReporter } from './VerificationReporter.js';
import { queryRedFlags } from '../db/queries/red-flags.js';

export class IndependentVerifier {
  private config: VerificationConfig;

  constructor(
    private evidenceRetriever: EvidenceRetriever,
    private integrityChecker: IntegrityChecker,
    private evidenceAnalyzer: EvidenceAnalyzer,
    private crossValidator: CrossValidator,
    private skepticalAnalyzer: SkepticalAnalyzer,
    private verificationReporter: VerificationReporter,
    private pool: Pool,
    private logger: Logger,
    config?: Partial<VerificationConfig>
  ) {
    this.config = { ...DEFAULT_VERIFICATION_CONFIG, ...config };

    // CRITICAL: Ensure verifier model is NOT Haiku
    if (this.config.verifierModel === 'haiku' as any) {
      throw new Error(
        'CRITICAL ERROR: Verifier model cannot be Haiku. Must use Sonnet or Opus for independent verification.'
      );
    }
  }

  /**
   * Verify test evidence independently
   * This is the main entry point for verification
   */
  async verify(request: VerificationRequest): Promise<VerificationResult> {
    const startTime = Date.now();
    const { testId, epicId } = request;

    this.logger.info({ testId, epicId }, 'Starting independent verification');

    try {
      // Override config if provided in request
      if (request.config) {
        this.config = { ...this.config, ...request.config };
      }

      // 1. Load evidence (NEVER execute anything)
      const evidence = await this.loadEvidence(testId, epicId);

      // 2. Load red flags
      const redFlags = await this.loadRedFlags(testId, epicId);

      // 3. Check integrity
      const integrityChecks = await this.checkIntegrity(evidence);

      // 4. Review red flags (auto-fail on critical)
      this.reviewRedFlags(redFlags, testId, epicId);

      // 5. Cross-validate evidence sources
      const crossValidation = await this.crossValidate(evidence);

      // 6. Skeptical analysis
      const skepticalAnalysis = await this.analyzeSkeptically(evidence, redFlags);

      // 7. Summarize evidence reviewed
      const evidenceReview = this.summarizeEvidence(evidence);

      // 8. Summarize red flags
      const redFlagSummary = this.summarizeRedFlags(redFlags);

      // 9. Calculate confidence score
      const confidenceCalculation = this.calculateConfidence(
        evidence,
        evidenceReview,
        redFlags,
        crossValidation,
        skepticalAnalysis,
        integrityChecks
      );

      // 10. Determine verification outcome
      const verified = this.determineVerified(confidenceCalculation, redFlags);
      const recommendation = this.determineRecommendation(
        confidenceCalculation,
        verified
      );

      // 11. Generate plain language summary and reasoning
      const summary = this.verificationReporter.generateSummary(
        verified,
        confidenceCalculation.finalScore,
        skepticalAnalysis.concerns
      );

      const reasoning = this.verificationReporter.generateReasoning(
        evidenceReview,
        crossValidation,
        redFlagSummary,
        skepticalAnalysis,
        integrityChecks,
        confidenceCalculation
      );

      const recommendations = this.verificationReporter.generateRecommendations(
        verified,
        confidenceCalculation.finalScore,
        skepticalAnalysis.concerns,
        redFlagSummary,
        skepticalAnalysis
      );

      // 12. Create verification result
      const result: VerificationResult = {
        verified,
        confidenceScore: confidenceCalculation.finalScore,
        recommendation,
        evidenceReview,
        crossValidation,
        redFlags: redFlagSummary,
        integrityChecks,
        skepticalAnalysis,
        confidenceCalculation,
        summary,
        reasoning,
        concerns: skepticalAnalysis.concerns,
        recommendations,
        testId,
        epicId,
        verifierModel: this.config.verifierModel,
        verifiedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
      };

      // 13. Generate and save report
      await this.verificationReporter.generate(result);

      this.logger.info(
        {
          testId,
          verified,
          confidence: confidenceCalculation.finalScore,
          executionTime: result.executionTimeMs,
        },
        'Verification completed'
      );

      return result;
    } catch (error) {
      this.logger.error({ error, testId, epicId }, 'Verification failed');
      throw error;
    }
  }

  /**
   * Load evidence for test (NEVER execute tests)
   */
  private async loadEvidence(
    testId: string,
    epicId: string
  ): Promise<EvidenceArtifact> {
    const results = await this.evidenceRetriever.getTestArtifacts(testId);

    if (results.length === 0) {
      throw new EvidenceNotFoundError(testId, epicId);
    }

    // Get most recent evidence
    return results[0].artifact;
  }

  /**
   * Load red flags for test
   */
  private async loadRedFlags(testId: string, epicId: string): Promise<RedFlag[]> {
    return await queryRedFlags(this.pool, { testId, epicId, resolved: false });
  }

  /**
   * Check evidence integrity
   */
  private async checkIntegrity(evidence: EvidenceArtifact) {
    const integrityChecks = await this.integrityChecker.check(evidence);

    if (!integrityChecks.passed) {
      const errors = integrityChecks.errors.join(', ');
      throw new IntegrityCheckFailedError(evidence.test_id, evidence.epic_id, errors);
    }

    return integrityChecks;
  }

  /**
   * Review red flags (auto-fail on critical)
   */
  private reviewRedFlags(redFlags: RedFlag[], testId: string, epicId: string): void {
    const criticalFlags = redFlags.filter((f) => f.severity === 'critical');

    if (criticalFlags.length > 0 && this.config.redFlagRules.criticalAutoFail) {
      throw new CriticalRedFlagError(testId, epicId, criticalFlags.length);
    }
  }

  /**
   * Cross-validate evidence sources
   */
  private async crossValidate(evidence: EvidenceArtifact) {
    if (!this.config.crossValidation.enabled) {
      return [];
    }

    return await this.crossValidator.validate(evidence);
  }

  /**
   * Analyze evidence skeptically
   */
  private async analyzeSkeptically(evidence: EvidenceArtifact, redFlags: RedFlag[]) {
    if (!this.config.skepticalAnalysis.enabled) {
      return {
        suspicious: false,
        concerns: [],
        recommendManualReview: false,
        suspiciousPatterns: [],
      };
    }

    return await this.skepticalAnalyzer.analyze(evidence, redFlags);
  }

  /**
   * Summarize evidence reviewed
   */
  private summarizeEvidence(evidence: EvidenceArtifact): EvidenceReviewedSummary {
    let screenshots = 0;
    if (evidence.screenshot_before) screenshots++;
    if (evidence.screenshot_after) screenshots++;

    let logs = 0;
    if (evidence.console_logs) logs++;

    let traces = 0;
    if (evidence.network_trace) traces++;
    if (evidence.http_request) traces++;
    if (evidence.http_response) traces++;

    const coverage = !!evidence.coverage_report;
    const dom = !!evidence.dom_snapshot;

    const totalArtifacts = screenshots + logs + traces + (coverage ? 1 : 0) + (dom ? 1 : 0);

    // Determine missing artifacts based on test type
    const missingArtifacts: string[] = [];
    if (evidence.test_type === 'ui') {
      if (!evidence.screenshot_before) missingArtifacts.push('screenshot_before');
      if (!evidence.screenshot_after) missingArtifacts.push('screenshot_after');
      if (!evidence.console_logs) missingArtifacts.push('console_logs');
    } else if (evidence.test_type === 'api') {
      if (!evidence.http_request) missingArtifacts.push('http_request');
      if (!evidence.http_response) missingArtifacts.push('http_response');
    }

    return {
      screenshots,
      logs,
      traces,
      coverage,
      dom,
      totalArtifacts,
      missingArtifacts,
    };
  }

  /**
   * Summarize red flags
   */
  private summarizeRedFlags(redFlags: RedFlag[]): RedFlagSummary {
    const critical = redFlags.filter((f) => f.severity === 'critical').length;
    const high = redFlags.filter((f) => f.severity === 'high').length;
    const medium = redFlags.filter((f) => f.severity === 'medium').length;
    const low = redFlags.filter((f) => f.severity === 'low').length;

    const descriptions = redFlags.map((f) => `[${f.severity.toUpperCase()}] ${f.description}`);

    return {
      critical,
      high,
      medium,
      low,
      totalFlags: redFlags.length,
      descriptions,
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    evidence: EvidenceArtifact,
    evidenceReview: EvidenceReviewedSummary,
    redFlags: RedFlag[],
    crossValidation: any[],
    skepticalAnalysis: any,
    integrityChecks: any
  ): ConfidenceCalculation {
    let confidence = 100; // Start at 100%, deduct for issues

    // Evidence completeness (0-100)
    const expectedArtifacts = this.getExpectedArtifactCount(evidence.test_type);
    const evidenceCompleteness =
      (evidenceReview.totalArtifacts / expectedArtifacts) * 100;

    // Evidence consistency (0-100)
    const mismatches = crossValidation.filter((cv) => !cv.matched);
    const evidenceConsistency = Math.max(0, 100 - mismatches.length * 15);

    // Red flag penalty
    const criticalFlags = redFlags.filter((f) => f.severity === 'critical').length;
    const highFlags = redFlags.filter((f) => f.severity === 'high').length;
    const mediumFlags = redFlags.filter((f) => f.severity === 'medium').length;

    const redFlagPenalty =
      criticalFlags * 50 + // -50 per critical
      highFlags * 20 + // -20 per high
      mediumFlags * 10; // -10 per medium

    confidence -= redFlagPenalty;

    // Deduct for cross-validation mismatches
    confidence -= mismatches.length * 15;

    // Deduct for missing artifacts
    confidence -= evidenceReview.missingArtifacts.length * 25;

    // Deduct for suspicious patterns
    if (skepticalAnalysis.suspicious) {
      const highSeverityPatterns = skepticalAnalysis.suspiciousPatterns.filter(
        (p: any) => p.severity === 'high'
      ).length;
      confidence -= highSeverityPatterns * 20;
      confidence -= (skepticalAnalysis.suspiciousPatterns.length - highSeverityPatterns) * 10;
    }

    // Integrity checks penalty
    if (!integrityChecks.passed) {
      confidence -= 30;
    }

    // Bonus for comprehensive evidence
    if (
      evidence.screenshot_before &&
      evidence.screenshot_after &&
      evidence.console_logs
    ) {
      confidence += 10;
    }

    // Clamp to 0-100
    const finalScore = Math.max(0, Math.min(100, Math.round(confidence)));

    const factors: ConfidenceFactors = {
      evidenceCompleteness,
      evidenceConsistency,
      redFlagPenalty,
      historicalSuccess: 0, // Not implemented yet
      integrityScore: integrityChecks.passed ? 100 : 70,
      skepticalScore: skepticalAnalysis.suspicious ? 50 : 100,
    };

    const explanation = this.generateConfidenceExplanation(factors, finalScore);

    return {
      finalScore,
      factors,
      explanation,
      threshold: {
        autoPass: this.config.confidenceThresholds.autoPass,
        manualReview: this.config.confidenceThresholds.manualReview,
        autoFail: this.config.confidenceThresholds.manualReview,
      },
    };
  }

  /**
   * Generate confidence explanation
   */
  private generateConfidenceExplanation(
    factors: ConfidenceFactors,
    finalScore: number
  ): string {
    const parts: string[] = [];

    parts.push(
      `Evidence completeness: ${Math.round(factors.evidenceCompleteness)}%`
    );
    parts.push(`Evidence consistency: ${Math.round(factors.evidenceConsistency)}%`);

    if (factors.redFlagPenalty > 0) {
      parts.push(`Red flag penalty: -${factors.redFlagPenalty}`);
    }

    if (factors.integrityScore < 100) {
      parts.push(`Integrity issues detected: ${100 - factors.integrityScore} point penalty`);
    }

    if (factors.skepticalScore < 100) {
      parts.push(`Suspicious patterns detected: ${100 - factors.skepticalScore} point penalty`);
    }

    return parts.join('; ');
  }

  /**
   * Determine if verification passed
   */
  private determineVerified(
    confidenceCalculation: ConfidenceCalculation,
    redFlags: RedFlag[]
  ): boolean {
    // Critical red flags = auto-fail
    const criticalFlags = redFlags.filter((f) => f.severity === 'critical');
    if (criticalFlags.length > 0) {
      return false;
    }

    // Check confidence threshold
    return confidenceCalculation.finalScore >= this.config.confidenceThresholds.autoPass;
  }

  /**
   * Determine recommendation
   */
  private determineRecommendation(
    confidenceCalculation: ConfidenceCalculation,
    verified: boolean
  ): 'accept' | 'reject' | 'manual_review' {
    const { finalScore } = confidenceCalculation;
    const { autoPass, manualReview } = this.config.confidenceThresholds;

    if (finalScore >= autoPass && verified) {
      return 'accept';
    } else if (finalScore >= manualReview) {
      return 'manual_review';
    } else {
      return 'reject';
    }
  }

  /**
   * Get expected artifact count for test type
   */
  private getExpectedArtifactCount(testType: string): number {
    switch (testType) {
      case 'ui':
        return 5; // screenshots (2), logs, dom, network
      case 'api':
        return 2; // request, response
      case 'unit':
      case 'integration':
        return 1; // coverage
      default:
        return 1;
    }
  }
}
