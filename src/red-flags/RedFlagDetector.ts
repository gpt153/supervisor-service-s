/**
 * Red Flag Detector Orchestrator
 * Epic 006-B: Main detector that coordinates all detection modules
 *
 * Detects agent lies by analyzing evidence for deception patterns
 */

import { Pool } from 'pg';
import {
  RedFlag,
  CreateRedFlagInput,
  RedFlagDetectionResult,
  Severity,
} from '../types/red-flags.js';
import { insertRedFlag } from '../db/queries/red-flags.js';
import { MissingEvidenceDetector, EvidenceArtifact, TestResult } from './MissingEvidenceDetector.js';
import { InconsistentEvidenceDetector } from './InconsistentEvidenceDetector.js';
import { ToolExecutionDetector } from './ToolExecutionDetector.js';
import { TimingAnomalyDetector } from './TimingAnomalyDetector.js';
import { CoverageAnalyzer } from './CoverageAnalyzer.js';

/**
 * Detection configuration
 */
export interface DetectionConfig {
  enableMissingEvidence?: boolean;
  enableInconsistentEvidence?: boolean;
  enableToolExecution?: boolean;
  enableTimingAnomalies?: boolean;
  enableCoverageAnalysis?: boolean;
}

/**
 * Default detection configuration (all enabled)
 */
const DEFAULT_CONFIG: DetectionConfig = {
  enableMissingEvidence: true,
  enableInconsistentEvidence: true,
  enableToolExecution: true,
  enableTimingAnomalies: true,
  enableCoverageAnalysis: true,
};

/**
 * Main red flag detection orchestrator
 */
export class RedFlagDetector {
  private missingEvidenceDetector: MissingEvidenceDetector;
  private inconsistentEvidenceDetector: InconsistentEvidenceDetector;
  private toolExecutionDetector: ToolExecutionDetector;
  private timingAnomalyDetector: TimingAnomalyDetector;
  private coverageAnalyzer: CoverageAnalyzer;

  constructor(private pool: Pool) {
    this.missingEvidenceDetector = new MissingEvidenceDetector(pool);
    this.inconsistentEvidenceDetector = new InconsistentEvidenceDetector(pool);
    this.toolExecutionDetector = new ToolExecutionDetector(pool);
    this.timingAnomalyDetector = new TimingAnomalyDetector(pool);
    this.coverageAnalyzer = new CoverageAnalyzer(pool);
  }

  /**
   * Detect red flags for a test
   */
  async detect(
    epicId: string,
    test: TestResult,
    evidence: EvidenceArtifact[],
    config: DetectionConfig = DEFAULT_CONFIG
  ): Promise<RedFlagDetectionResult> {
    const startTime = Date.now();
    const allFlags: CreateRedFlagInput[] = [];

    // Run all detection modules in parallel
    const detectionPromises: Promise<CreateRedFlagInput[]>[] = [];

    if (config.enableMissingEvidence !== false) {
      detectionPromises.push(
        this.missingEvidenceDetector.detect(epicId, test, evidence)
      );
    }

    if (config.enableInconsistentEvidence !== false) {
      detectionPromises.push(
        this.inconsistentEvidenceDetector.detect(epicId, test, evidence)
      );
    }

    if (config.enableToolExecution !== false) {
      detectionPromises.push(
        this.toolExecutionDetector.detect(epicId, test, evidence)
      );
    }

    if (config.enableTimingAnomalies !== false) {
      detectionPromises.push(
        this.timingAnomalyDetector.detect(epicId, test, evidence)
      );
    }

    if (config.enableCoverageAnalysis !== false) {
      detectionPromises.push(
        this.coverageAnalyzer.detect(epicId, test, evidence)
      );
    }

    // Wait for all detections to complete
    const results = await Promise.all(detectionPromises);

    // Flatten results
    for (const flags of results) {
      allFlags.push(...flags);
    }

    // Insert flags into database
    const insertedFlags: RedFlag[] = [];
    for (const flagInput of allFlags) {
      try {
        const flag = await insertRedFlag(this.pool, flagInput);
        insertedFlags.push(flag);
      } catch (error) {
        console.error('Error inserting red flag:', error);
      }
    }

    // Aggregate flags by severity
    const summary = this.aggregateFlags(insertedFlags);

    // Determine verdict
    const verdict = this.determineVerdict(summary);

    // Generate recommendation
    const recommendation = this.generateRecommendation(verdict, summary, insertedFlags);

    const executionTimeMs = Date.now() - startTime;

    return {
      epicId,
      testId: test.id,
      verdict,
      summary,
      flags: insertedFlags,
      recommendation,
      executionTimeMs,
    };
  }

  /**
   * Aggregate flags by severity
   */
  private aggregateFlags(flags: RedFlag[]): {
    totalFlags: number;
    criticalFlags: number;
    highFlags: number;
    mediumFlags: number;
    lowFlags: number;
  } {
    return {
      totalFlags: flags.length,
      criticalFlags: flags.filter((f) => f.severity === 'critical').length,
      highFlags: flags.filter((f) => f.severity === 'high').length,
      mediumFlags: flags.filter((f) => f.severity === 'medium').length,
      lowFlags: flags.filter((f) => f.severity === 'low').length,
    };
  }

  /**
   * Determine overall verdict based on flags
   */
  private determineVerdict(summary: {
    criticalFlags: number;
    highFlags: number;
    mediumFlags: number;
    lowFlags: number;
  }): 'pass' | 'fail' | 'review' {
    // CRITICAL flags = auto-fail
    if (summary.criticalFlags > 0) {
      return 'fail';
    }

    // HIGH flags = manual review required
    if (summary.highFlags > 0) {
      return 'review';
    }

    // MEDIUM/LOW flags = pass with notes
    return 'pass';
  }

  /**
   * Generate recommendation based on verdict and flags
   */
  private generateRecommendation(
    verdict: 'pass' | 'fail' | 'review',
    summary: {
      totalFlags: number;
      criticalFlags: number;
      highFlags: number;
      mediumFlags: number;
      lowFlags: number;
    },
    flags: RedFlag[]
  ): string {
    if (verdict === 'fail') {
      const criticalFlag = flags.find((f) => f.severity === 'critical');
      return `❌ VERIFICATION FAILED: ${summary.criticalFlags} critical red flag(s) detected. ${criticalFlag?.description || 'Test must have evidence to be trusted.'}`;
    }

    if (verdict === 'review') {
      const highFlag = flags.find((f) => f.severity === 'high');
      return `⚠️  MANUAL REVIEW REQUIRED: ${summary.highFlags} high-severity red flag(s) detected. ${highFlag?.description || 'Evidence contradicts test result.'}`;
    }

    if (summary.mediumFlags > 0 || summary.lowFlags > 0) {
      return `✅ VERIFICATION PASSED (with ${summary.mediumFlags + summary.lowFlags} minor flag(s)). Review logs for suspicious patterns.`;
    }

    return '✅ VERIFICATION PASSED: No red flags detected.';
  }

  /**
   * Batch detect for multiple tests
   */
  async detectBatch(
    epicId: string,
    tests: TestResult[],
    evidenceByTest: Map<string, EvidenceArtifact[]>,
    config: DetectionConfig = DEFAULT_CONFIG
  ): Promise<RedFlagDetectionResult[]> {
    const results: RedFlagDetectionResult[] = [];

    // Run detection for all tests in parallel
    const detectionPromises = tests.map((test) => {
      const evidence = evidenceByTest.get(test.id) || [];
      return this.detect(epicId, test, evidence, config);
    });

    const batchResults = await Promise.all(detectionPromises);
    results.push(...batchResults);

    return results;
  }

  /**
   * Get summary across multiple tests
   */
  aggregateBatchResults(results: RedFlagDetectionResult[]): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    reviewTests: number;
    totalFlags: number;
    criticalFlags: number;
    highFlags: number;
    mediumFlags: number;
    lowFlags: number;
  } {
    return {
      totalTests: results.length,
      passedTests: results.filter((r) => r.verdict === 'pass').length,
      failedTests: results.filter((r) => r.verdict === 'fail').length,
      reviewTests: results.filter((r) => r.verdict === 'review').length,
      totalFlags: results.reduce((sum, r) => sum + r.summary.totalFlags, 0),
      criticalFlags: results.reduce((sum, r) => sum + r.summary.criticalFlags, 0),
      highFlags: results.reduce((sum, r) => sum + r.summary.highFlags, 0),
      mediumFlags: results.reduce((sum, r) => sum + r.summary.mediumFlags, 0),
      lowFlags: results.reduce((sum, r) => sum + r.summary.lowFlags, 0),
    };
  }
}
