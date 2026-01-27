/**
 * Epic 006-G: Unified Reporter
 *
 * Generates consolidated test reports from workflow state
 */

import type {
  TestWorkflow,
  TestReport,
  EpicTestReport,
  WorkflowStage
} from '../types/orchestration.js';
import type { RedFlag } from '../types/red-flags.js';

/**
 * Generates unified test reports
 */
export class UnifiedReporter {
  /**
   * Generate report from workflow
   */
  async generate(workflow: TestWorkflow): Promise<TestReport> {
    // Extract results
    const executionResult = workflow.execution_result;
    const detectionResult = workflow.detection_result;
    const verificationResult = workflow.verification_result;
    const fixingResult = workflow.fixing_result;
    const learningResult = workflow.learning_result;

    // Calculate overall pass/fail
    const passed = verificationResult?.verified || false;
    const confidence = verificationResult?.confidenceScore || 0;

    // Generate summary
    const summary = this.generateSummary(workflow);

    // Extract evidence paths
    const evidencePaths = {
      screenshots: executionResult?.evidence?.screenshots || [],
      logs: executionResult?.evidence?.logs || [],
      traces: executionResult?.evidence?.traces || []
    };

    // Get red flags
    const redFlags = detectionResult?.redFlags || [];

    // Count fixes applied
    const fixesApplied = fixingResult?.retriesUsed || 0;

    // Count learnings extracted
    const learningsExtracted = learningResult?.patterns?.length || 0;

    // Determine recommendation
    const recommendation = this.determineRecommendation(passed, redFlags, confidence);

    // Calculate stage durations
    const stages = this.calculateStageDurations(workflow);

    return {
      testId: workflow.test_id,
      epicId: workflow.epic_id,
      testType: workflow.test_type,
      passed,
      confidence,
      summary,
      recommendation,
      evidencePaths,
      redFlags,
      fixesApplied,
      learningsExtracted,
      duration: workflow.duration_ms || 0,
      stages
    };
  }

  /**
   * Generate plain language summary
   */
  private generateSummary(workflow: TestWorkflow): string {
    const verified = workflow.verification_result?.verified || false;
    const redFlagCount = workflow.detection_result?.redFlags?.length || 0;
    const fixAttempts = workflow.fixing_result?.retriesUsed || 0;
    const confidence = workflow.verification_result?.confidenceScore || 0;

    // All good - high confidence pass
    if (verified && redFlagCount === 0 && confidence >= 90) {
      return `✅ Test passed with high confidence (${confidence}%). All evidence verified, no red flags detected.`;
    }

    // Pass with warnings
    if (verified && redFlagCount > 0) {
      return `⚠️ Test passed but ${redFlagCount} red flag(s) detected (confidence: ${confidence}%). Manual review recommended.`;
    }

    // Pass with low confidence
    if (verified && confidence < 90) {
      return `⚠️ Test passed with moderate confidence (${confidence}%). Consider additional verification.`;
    }

    // Failed after fix attempts
    if (!verified && fixAttempts > 0) {
      const fixResult = workflow.fixing_result;
      return `❌ Test failed. Fix attempted ${fixAttempts} time(s) using "${fixResult?.fixStrategy}" but verification still failing. Requires manual intervention.`;
    }

    // Failed without fix attempts
    if (!verified && redFlagCount > 0) {
      return `❌ Test failed. ${redFlagCount} red flag(s) detected (confidence: ${confidence}%). See evidence for details.`;
    }

    // Generic failure
    return `❌ Test failed (confidence: ${confidence}%). Review evidence and verification concerns.`;
  }

  /**
   * Determine recommendation
   */
  private determineRecommendation(
    verified: boolean,
    redFlags: RedFlag[],
    confidence: number
  ): 'accept' | 'manual_review' | 'reject' {
    // High confidence pass with no red flags - accept
    if (verified && redFlags.length === 0 && confidence >= 90) {
      return 'accept';
    }

    // Pass but with warnings - review
    if (verified && (redFlags.length > 0 || confidence < 90)) {
      return 'manual_review';
    }

    // Failed - reject
    if (!verified) {
      return 'reject';
    }

    // Default to review
    return 'manual_review';
  }

  /**
   * Calculate stage durations from workflow
   */
  private calculateStageDurations(workflow: TestWorkflow): Array<{
    stage: WorkflowStage;
    duration: number;
    success: boolean;
  }> {
    const stages: Array<{
      stage: WorkflowStage;
      duration: number;
      success: boolean;
    }> = [];

    // Estimate durations based on results presence
    // In production, these would be tracked in real-time

    if (workflow.execution_result) {
      stages.push({
        stage: 'execution',
        duration: 0, // Would be tracked during execution
        success: true
      });
    }

    if (workflow.detection_result) {
      stages.push({
        stage: 'detection',
        duration: 0,
        success: true
      });
    }

    if (workflow.verification_result) {
      stages.push({
        stage: 'verification',
        duration: 0,
        success: workflow.verification_result.verified
      });
    }

    if (workflow.fixing_result) {
      stages.push({
        stage: 'fixing',
        duration: 0,
        success: workflow.fixing_result.success
      });
    }

    if (workflow.learning_result) {
      stages.push({
        stage: 'learning',
        duration: 0,
        success: true
      });
    }

    return stages;
  }

  /**
   * Generate epic-level report
   */
  async generateEpicReport(
    epicId: string,
    workflows: TestWorkflow[]
  ): Promise<EpicTestReport> {
    // Generate individual test reports
    const testReports = await Promise.all(
      workflows.map(workflow => this.generate(workflow))
    );

    // Calculate aggregates
    const totalTests = testReports.length;
    const passedTests = testReports.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    const avgConfidence = totalTests > 0
      ? testReports.reduce((sum, r) => sum + r.confidence, 0) / totalTests
      : 0;

    const totalDuration = testReports.reduce((sum, r) => sum + r.duration, 0);

    // Generate summary
    const summary = this.generateEpicSummary(totalTests, passedTests, avgConfidence);

    // Determine recommendation
    const recommendation = this.determineEpicRecommendation(
      passedTests,
      totalTests,
      avgConfidence
    );

    return {
      epicId,
      totalTests,
      passedTests,
      failedTests,
      avgConfidence,
      summary,
      recommendation,
      testReports,
      totalDuration,
      completedAt: new Date()
    };
  }

  /**
   * Generate epic-level summary
   */
  private generateEpicSummary(
    totalTests: number,
    passedTests: number,
    avgConfidence: number
  ): string {
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    if (passRate === 100 && avgConfidence >= 90) {
      return `✅ All ${totalTests} tests passed with high confidence (avg: ${avgConfidence.toFixed(1)}%).`;
    }

    if (passRate === 100) {
      return `⚠️ All ${totalTests} tests passed but with moderate confidence (avg: ${avgConfidence.toFixed(1)}%).`;
    }

    if (passRate >= 80) {
      return `⚠️ ${passedTests}/${totalTests} tests passed (${passRate.toFixed(1)}%). ${failedTests} test(s) failed.`;
    }

    return `❌ Only ${passedTests}/${totalTests} tests passed (${passRate.toFixed(1)}%). ${failedTests} test(s) failed. Manual review required.`;
  }

  /**
   * Determine epic-level recommendation
   */
  private determineEpicRecommendation(
    passedTests: number,
    totalTests: number,
    avgConfidence: number
  ): 'accept' | 'manual_review' | 'reject' {
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    if (passRate === 100 && avgConfidence >= 90) {
      return 'accept';
    }

    if (passRate >= 80) {
      return 'manual_review';
    }

    return 'reject';
  }
}
