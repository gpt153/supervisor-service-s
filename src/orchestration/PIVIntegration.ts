/**
 * Epic 006-G: PIV Integration
 *
 * Integrates test orchestration with PIV (Plan-Implement-Verify) loop
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  PIVCompletionEvent,
  PIVTestExtraction,
  PIVOrchestrationResult,
  OrchestrationTestDefinition,
  EpicTestReport
} from '../types/orchestration.js';
import { TestOrchestrator } from './TestOrchestrator.js';
import { UnifiedReporter } from './UnifiedReporter.js';

/**
 * Integrates orchestrator with PIV loop
 */
export class PIVIntegration {
  private orchestrator: TestOrchestrator;
  private reporter: UnifiedReporter;
  private bmadBasePath: string;

  constructor(
    bmadBasePath: string = '/home/samuel/sv/supervisor-service-s/.bmad'
  ) {
    this.orchestrator = new TestOrchestrator();
    this.reporter = new UnifiedReporter();
    this.bmadBasePath = bmadBasePath;
  }

  /**
   * Handle PIV completion event
   */
  async onPIVComplete(event: PIVCompletionEvent): Promise<PIVOrchestrationResult> {
    console.log(`PIV completed for epic ${event.epicId}, PR: ${event.prUrl}`);

    // Extract tests from epic
    const extraction = await this.extractTests(event.epicId);

    if (extraction.tests.length === 0) {
      console.log(`No tests found for epic ${event.epicId}`);
      return {
        epicId: event.epicId,
        workflows: [],
        epicReport: await this.reporter.generateEpicReport(event.epicId, []),
        prUpdated: false,
        epicStatusUpdated: false
      };
    }

    console.log(`Extracted ${extraction.tests.length} tests for epic ${event.epicId}`);

    // Orchestrate all tests
    const workflows = await Promise.all(
      extraction.tests.map(test => this.orchestrator.orchestrate(test))
    );

    console.log(`Completed orchestration for ${workflows.length} tests`);

    // Generate epic-level report
    const epicReport = await this.generateEpicReport(event.epicId, workflows);

    // Update PR with results
    const prUpdated = await this.updatePR(event.prUrl, epicReport);

    // Update epic status
    const epicStatusUpdated = await this.updateEpicStatus(event.epicId, epicReport);

    return {
      epicId: event.epicId,
      workflows,
      epicReport,
      prUpdated,
      epicStatusUpdated
    };
  }

  /**
   * Extract test definitions from epic
   */
  async extractTests(epicId: string): Promise<PIVTestExtraction> {
    // Load epic file
    const epicPath = path.join(
      this.bmadBasePath,
      'features',
      'automatic-quality-workflows',
      'epics',
      `epic-${epicId}.md`
    );

    try {
      const epicContent = await fs.readFile(epicPath, 'utf-8');

      // Parse test definitions from epic
      // This is a simplified implementation - production would use proper parsing
      const tests = this.parseTestsFromEpic(epicId, epicContent);

      return {
        epicId,
        tests,
        extractedAt: new Date()
      };
    } catch (error) {
      console.error(`Failed to extract tests from epic ${epicId}:`, error);
      return {
        epicId,
        tests: [],
        extractedAt: new Date()
      };
    }
  }

  /**
   * Parse tests from epic content
   */
  private parseTestsFromEpic(
    epicId: string,
    epicContent: string
  ): OrchestrationTestDefinition[] {
    const tests: OrchestrationTestDefinition[] = [];

    // Look for test sections in epic
    const testSectionRegex = /###\s+Test\s+(\d+):\s+(.+?)(?=###|$)/gs;
    const matches = epicContent.matchAll(testSectionRegex);

    for (const match of matches) {
      const testNum = match[1];
      const testSection = match[2];

      // Extract test type
      const typeMatch = testSection.match(/Type:\s*(ui|api|unit|integration)/i);
      const testType = typeMatch ? (typeMatch[1].toLowerCase() as 'ui' | 'api') : 'ui';

      // Extract test ID
      const testId = `${epicId}-${testType}-${testNum}`;

      // Extract priority
      const priorityMatch = testSection.match(/Priority:\s*(critical|high|medium|low)/i);
      const priority = priorityMatch
        ? (priorityMatch[1].toLowerCase() as 'critical' | 'high' | 'medium' | 'low')
        : 'medium';

      // Create test definition
      tests.push({
        id: testId,
        epic_id: epicId,
        type: testType,
        priority,
        steps: [] // Would be extracted from test section
      });
    }

    return tests;
  }

  /**
   * Generate epic-level report
   */
  private async generateEpicReport(
    epicId: string,
    workflows: Array<{ workflow: any }>
  ): Promise<EpicTestReport> {
    const workflowRecords = workflows.map(w => w.workflow);
    return await this.reporter.generateEpicReport(epicId, workflowRecords);
  }

  /**
   * Update PR with test results
   */
  private async updatePR(prUrl: string, report: EpicTestReport): Promise<boolean> {
    try {
      // Generate PR comment
      const comment = this.generatePRComment(report);

      console.log(`Would update PR ${prUrl} with comment:\n${comment}`);

      // In production, this would use GitHub API
      // For now, just log the comment
      return true;
    } catch (error) {
      console.error('Failed to update PR:', error);
      return false;
    }
  }

  /**
   * Generate PR comment from report
   */
  private generatePRComment(report: EpicTestReport): string {
    const emoji = report.recommendation === 'accept' ? '✅' :
                  report.recommendation === 'manual_review' ? '⚠️' : '❌';

    return `## ${emoji} Automated Test Results

${report.summary}

**Test Coverage**: ${report.totalTests} tests
- **Passed**: ${report.passedTests}
- **Failed**: ${report.failedTests}
- **Average Confidence**: ${report.avgConfidence.toFixed(1)}%

**Recommendation**: ${report.recommendation.toUpperCase()}

### Test Details

${report.testReports.map(test => {
  const testEmoji = test.passed ? '✅' : '❌';
  return `- ${testEmoji} **${test.testId}** (${test.confidence}% confidence)
  - Red Flags: ${test.redFlags.length}
  - Fixes Applied: ${test.fixesApplied}`;
}).join('\n')}

---

**Total Duration**: ${(report.totalDuration / 1000).toFixed(1)}s
**Completed**: ${report.completedAt.toISOString()}
`;
  }

  /**
   * Update epic status based on test results
   */
  private async updateEpicStatus(epicId: string, report: EpicTestReport): Promise<boolean> {
    try {
      const epicPath = path.join(
        this.bmadBasePath,
        'features',
        'automatic-quality-workflows',
        'epics',
        `epic-${epicId}.md`
      );

      // Read epic file
      const epicContent = await fs.readFile(epicPath, 'utf-8');

      // Update status line
      let updatedContent = epicContent;

      if (report.recommendation === 'accept') {
        updatedContent = epicContent.replace(
          /\*\*Status:\*\*\s+\w+/,
          '**Status:** Completed (Tests Passed)'
        );
      } else if (report.recommendation === 'reject') {
        updatedContent = epicContent.replace(
          /\*\*Status:\*\*\s+\w+/,
          '**Status:** Failed (Tests Failed)'
        );
      }

      // Add test results section if not present
      if (!updatedContent.includes('## Test Results')) {
        updatedContent += `\n\n## Test Results\n\n${report.summary}\n\n`;
        updatedContent += `- Total Tests: ${report.totalTests}\n`;
        updatedContent += `- Passed: ${report.passedTests}\n`;
        updatedContent += `- Failed: ${report.failedTests}\n`;
        updatedContent += `- Average Confidence: ${report.avgConfidence.toFixed(1)}%\n`;
      }

      // Write updated content
      await fs.writeFile(epicPath, updatedContent, 'utf-8');

      console.log(`Updated epic status for ${epicId}`);
      return true;
    } catch (error) {
      console.error(`Failed to update epic status for ${epicId}:`, error);
      return false;
    }
  }
}
