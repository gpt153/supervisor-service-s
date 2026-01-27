/**
 * Timing Anomaly Detector
 * Epic 006-B: Detect tests that completed suspiciously fast
 *
 * MEDIUM severity: Tests may not have actually run
 */

import { Pool } from 'pg';
import { CreateRedFlagInput, TestType, RedFlagProof } from '../types/red-flags.js';
import { EvidenceArtifact, TestResult } from './MissingEvidenceDetector.js';
import { getTestTimingAverages } from '../db/queries/red-flags.js';

/**
 * Minimum duration thresholds by test type (milliseconds)
 */
const MIN_DURATION_THRESHOLDS: Record<TestType, number> = {
  ui: 500,          // UI tests need browser interaction (min 500ms)
  api: 100,         // API tests need HTTP round-trip (min 100ms)
  unit: 50,         // Unit tests can be fast (min 50ms)
  integration: 200, // Integration tests need setup (min 200ms)
};

/**
 * Statistical thresholds for anomaly detection
 */
const ANOMALY_THRESHOLDS = {
  DEVIATION_MULTIPLIER: 2.0,    // Flag if >2x faster than average
  MIN_SAMPLES: 3,                // Need at least 3 historical samples
  STDDEV_MULTIPLIER: 2.5,        // Flag if >2.5 standard deviations faster
};

/**
 * Detect timing anomalies in test execution
 */
export class TimingAnomalyDetector {
  constructor(private pool: Pool) {}

  /**
   * Detect timing anomalies for a test
   */
  async detect(
    epicId: string,
    test: TestResult,
    evidence: EvidenceArtifact[]
  ): Promise<CreateRedFlagInput[]> {
    const flags: CreateRedFlagInput[] = [];

    // Only check tests that passed
    if (test.passFail !== 'pass') {
      return flags;
    }

    // Get duration from evidence
    const duration = this.extractDuration(evidence);
    if (duration === null) {
      return flags; // No duration data
    }

    // Check minimum duration threshold
    const minThreshold = MIN_DURATION_THRESHOLDS[test.type];
    if (duration < minThreshold) {
      flags.push(this.createTooFastFlag(epicId, test, duration, minThreshold));
    }

    // Check against historical averages
    const historicalFlag = await this.checkHistoricalAverage(epicId, test, duration);
    if (historicalFlag) {
      flags.push(historicalFlag);
    }

    // Check for zero network activity (UI tests should have requests)
    if (test.type === 'ui') {
      const networkFlag = this.checkNetworkActivity(epicId, test, evidence, duration);
      if (networkFlag) flags.push(networkFlag);
    }

    // Check for zero DOM changes (UI tests should modify page)
    if (test.type === 'ui') {
      const domFlag = this.checkDomChanges(epicId, test, evidence, duration);
      if (domFlag) flags.push(domFlag);
    }

    return flags;
  }

  /**
   * Extract test duration from evidence
   */
  private extractDuration(evidence: EvidenceArtifact[]): number | null {
    // Check for explicit duration evidence
    const durationEvidence = evidence.find((e) => e.artifactType === 'test_duration');
    if (durationEvidence?.metadata?.durationMs !== undefined) {
      return durationEvidence.metadata.durationMs;
    }

    // Check for duration in any evidence metadata
    for (const e of evidence) {
      if (e.metadata?.durationMs !== undefined) {
        return e.metadata.durationMs;
      }
      if (e.metadata?.duration !== undefined) {
        return e.metadata.duration;
      }
    }

    return null;
  }

  /**
   * Create flag for test that completed too fast
   */
  private createTooFastFlag(
    epicId: string,
    test: TestResult,
    duration: number,
    minThreshold: number
  ): CreateRedFlagInput {
    const proof: RedFlagProof = {
      testId: test.id,
      testType: test.type,
      duration,
      expectedMinDuration: minThreshold,
      deviation: ((minThreshold - duration) / minThreshold) * 100,
      timestamp: test.executedAt.toISOString(),
    };

    return {
      epicId,
      testId: test.id,
      flagType: 'timing',
      severity: 'medium',
      description: `Test "${test.name}" completed in ${duration}ms (expected min ${minThreshold}ms) - likely not run`,
      proof,
    };
  }

  /**
   * Check test duration against historical average
   */
  private async checkHistoricalAverage(
    epicId: string,
    test: TestResult,
    duration: number
  ): Promise<CreateRedFlagInput | null> {
    try {
      const historical = await getTestTimingAverages(this.pool, test.name);
      if (!historical) {
        return null; // No historical data
      }

      if (historical.sampleCount < ANOMALY_THRESHOLDS.MIN_SAMPLES) {
        return null; // Not enough samples
      }

      const avgDuration = historical.avgDurationMs;
      const stddev = historical.stddevDurationMs;

      // Check if significantly faster than average
      if (duration < avgDuration / ANOMALY_THRESHOLDS.DEVIATION_MULTIPLIER) {
        const deviationPercent = ((avgDuration - duration) / avgDuration) * 100;

        // Check if outside standard deviation range
        const isOutlier = duration < avgDuration - ANOMALY_THRESHOLDS.STDDEV_MULTIPLIER * stddev;

        const proof: RedFlagProof = {
          testId: test.id,
          testType: test.type,
          duration,
          historicalAvg: avgDuration,
          deviation: deviationPercent,
          timestamp: test.executedAt.toISOString(),
        };

        return {
          epicId,
          testId: test.id,
          flagType: 'timing',
          severity: isOutlier ? 'medium' : 'low',
          description: `Test "${test.name}" completed ${deviationPercent.toFixed(0)}% faster than ${avgDuration.toFixed(0)}ms average`,
          proof,
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking historical average:', error);
      return null;
    }
  }

  /**
   * Check for zero network activity in UI tests
   */
  private checkNetworkActivity(
    epicId: string,
    test: TestResult,
    evidence: EvidenceArtifact[],
    duration: number
  ): CreateRedFlagInput | null {
    // Get network trace evidence
    const networkTrace = evidence.find(
      (e) => e.artifactType === 'network_trace' || e.artifactType === 'http_request'
    );

    if (!networkTrace) {
      // No network evidence at all
      const proof: RedFlagProof = {
        testId: test.id,
        testType: 'ui',
        duration,
        networkRequests: 0,
        timestamp: test.executedAt.toISOString(),
      };

      return {
        epicId,
        testId: test.id,
        flagType: 'timing',
        severity: 'medium',
        description: `UI test "${test.name}" has zero network activity (UI tests should make requests)`,
        proof,
      };
    }

    // Check if network trace shows zero requests
    const requestCount = networkTrace.metadata?.requestCount || networkTrace.metadata?.requests?.length || 0;
    if (requestCount === 0) {
      const proof: RedFlagProof = {
        testId: test.id,
        testType: 'ui',
        duration,
        networkRequests: 0,
        timestamp: test.executedAt.toISOString(),
      };

      return {
        epicId,
        testId: test.id,
        evidenceId: networkTrace.id,
        flagType: 'timing',
        severity: 'medium',
        description: `UI test "${test.name}" has zero network requests (UI tests should load resources)`,
        proof,
      };
    }

    return null;
  }

  /**
   * Check for zero DOM changes in UI tests
   */
  private checkDomChanges(
    epicId: string,
    test: TestResult,
    evidence: EvidenceArtifact[],
    duration: number
  ): CreateRedFlagInput | null {
    // Get DOM snapshot evidence
    const domSnapshot = evidence.find((e) => e.artifactType === 'dom_snapshot');

    if (!domSnapshot) {
      return null; // No DOM evidence
    }

    // Check if DOM changes recorded
    const domChanges = domSnapshot.metadata?.changes || domSnapshot.metadata?.mutations || 0;
    if (typeof domChanges === 'number' && domChanges === 0) {
      const proof: RedFlagProof = {
        testId: test.id,
        testType: 'ui',
        duration,
        domChanges: 0,
        timestamp: test.executedAt.toISOString(),
      };

      return {
        epicId,
        testId: test.id,
        evidenceId: domSnapshot.id,
        flagType: 'timing',
        severity: 'medium',
        description: `UI test "${test.name}" has zero DOM changes (UI tests should modify page)`,
        proof,
      };
    }

    return null;
  }
}
