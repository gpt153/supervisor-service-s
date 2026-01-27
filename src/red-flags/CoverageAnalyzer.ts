/**
 * Coverage Analyzer
 * Epic 006-B: Detect when code coverage indicates tests didn't run
 *
 * HIGH severity: Coverage unchanged = tests didn't execute
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import { CreateRedFlagInput, TestType, RedFlagProof, CoverageData } from '../types/red-flags.js';
import { EvidenceArtifact, TestResult } from './MissingEvidenceDetector.js';

/**
 * Analyze code coverage to detect test execution issues
 */
export class CoverageAnalyzer {
  constructor(private pool: Pool) {}

  /**
   * Analyze coverage for a test
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

    // Only check unit and integration tests (coverage not expected for UI/API tests)
    if (test.type !== 'unit' && test.type !== 'integration') {
      return flags;
    }

    // Get coverage reports
    const coverageBefore = evidence.find((e) => e.artifactType === 'coverage_before');
    const coverageAfter = evidence.find((e) => e.artifactType === 'coverage_after');

    if (!coverageBefore || !coverageAfter) {
      // Coverage reports missing - handled by MissingEvidenceDetector
      return flags;
    }

    // Parse coverage data
    const beforeData = await this.parseCoverageReport(coverageBefore);
    const afterData = await this.parseCoverageReport(coverageAfter);

    if (!beforeData || !afterData) {
      return flags; // Couldn't parse coverage
    }

    // Check for unchanged coverage
    const unchangedFlag = this.checkUnchangedCoverage(
      epicId,
      test,
      beforeData,
      afterData,
      coverageAfter.id
    );
    if (unchangedFlag) flags.push(unchangedFlag);

    // Check for decreased coverage (impossible, indicates error)
    const decreasedFlag = this.checkDecreasedCoverage(
      epicId,
      test,
      beforeData,
      afterData,
      coverageAfter.id
    );
    if (decreasedFlag) flags.push(decreasedFlag);

    // Check if coverage increase matches test scope
    const scopeFlag = this.checkCoverageScope(
      epicId,
      test,
      beforeData,
      afterData,
      coverageAfter.id
    );
    if (scopeFlag) flags.push(scopeFlag);

    return flags;
  }

  /**
   * Parse coverage report (lcov format or JSON)
   */
  private async parseCoverageReport(
    coverageEvidence: EvidenceArtifact
  ): Promise<CoverageData | null> {
    try {
      // Check if metadata already has parsed coverage
      if (coverageEvidence.metadata?.coverage) {
        return this.normalizeCoverageData(coverageEvidence.metadata.coverage);
      }

      // Try to read and parse file
      if (!coverageEvidence.artifactPath) {
        return null;
      }

      const content = await fs.readFile(coverageEvidence.artifactPath, 'utf-8');

      // Try JSON format first
      if (coverageEvidence.artifactPath.endsWith('.json')) {
        const json = JSON.parse(content);
        return this.parseCoverageJson(json);
      }

      // Try lcov format
      if (content.includes('TN:') || content.includes('SF:')) {
        return this.parseLcovFormat(content);
      }

      return null;
    } catch (error) {
      console.error('Error parsing coverage report:', error);
      return null;
    }
  }

  /**
   * Parse coverage JSON (Istanbul/NYC format)
   */
  private parseCoverageJson(json: any): CoverageData | null {
    try {
      let linesCovered = 0;
      let linesTotal = 0;
      let branchesCovered = 0;
      let branchesTotal = 0;
      let functionsCovered = 0;
      let functionsTotal = 0;

      // Istanbul format: object with file paths as keys
      Object.values(json).forEach((file: any) => {
        if (file.lines) {
          linesCovered += Object.values(file.lines).filter((v) => v > 0).length;
          linesTotal += Object.keys(file.lines).length;
        }
        if (file.b) {
          Object.values(file.b).forEach((branch: any) => {
            branchesTotal++;
            if (Array.isArray(branch) && branch.some((v) => v > 0)) {
              branchesCovered++;
            }
          });
        }
        if (file.f) {
          functionsCovered += Object.values(file.f).filter((v) => v > 0).length;
          functionsTotal += Object.keys(file.f).length;
        }
      });

      const percentage = linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0;

      return {
        linesCovered,
        linesTotal,
        branchesCovered,
        branchesTotal,
        functionsCovered,
        functionsTotal,
        percentage,
      };
    } catch (error) {
      console.error('Error parsing coverage JSON:', error);
      return null;
    }
  }

  /**
   * Parse lcov format coverage report
   */
  private parseLcovFormat(content: string): CoverageData | null {
    try {
      const lines = content.split('\n');
      let linesCovered = 0;
      let linesTotal = 0;
      let branchesCovered = 0;
      let branchesTotal = 0;
      let functionsCovered = 0;
      let functionsTotal = 0;

      for (const line of lines) {
        if (line.startsWith('LH:')) {
          linesCovered += parseInt(line.split(':')[1], 10);
        } else if (line.startsWith('LF:')) {
          linesTotal += parseInt(line.split(':')[1], 10);
        } else if (line.startsWith('BRH:')) {
          branchesCovered += parseInt(line.split(':')[1], 10);
        } else if (line.startsWith('BRF:')) {
          branchesTotal += parseInt(line.split(':')[1], 10);
        } else if (line.startsWith('FNH:')) {
          functionsCovered += parseInt(line.split(':')[1], 10);
        } else if (line.startsWith('FNF:')) {
          functionsTotal += parseInt(line.split(':')[1], 10);
        }
      }

      const percentage = linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0;

      return {
        linesCovered,
        linesTotal,
        branchesCovered,
        branchesTotal,
        functionsCovered,
        functionsTotal,
        percentage,
      };
    } catch (error) {
      console.error('Error parsing lcov format:', error);
      return null;
    }
  }

  /**
   * Normalize coverage data to standard format
   */
  private normalizeCoverageData(data: any): CoverageData {
    return {
      linesCovered: data.linesCovered || data.lines?.covered || 0,
      linesTotal: data.linesTotal || data.lines?.total || 0,
      branchesCovered: data.branchesCovered || data.branches?.covered || 0,
      branchesTotal: data.branchesTotal || data.branches?.total || 0,
      functionsCovered: data.functionsCovered || data.functions?.covered || 0,
      functionsTotal: data.functionsTotal || data.functions?.total || 0,
      percentage: data.percentage || 0,
    };
  }

  /**
   * Check if coverage is unchanged
   */
  private checkUnchangedCoverage(
    epicId: string,
    test: TestResult,
    beforeData: CoverageData,
    afterData: CoverageData,
    evidenceId: number
  ): CreateRedFlagInput | null {
    if (beforeData.linesCovered === afterData.linesCovered) {
      const proof: RedFlagProof = {
        testId: test.id,
        testType: test.type,
        coverageBefore: beforeData,
        coverageAfter: afterData,
        diff: 0,
        timestamp: test.executedAt.toISOString(),
      };

      return {
        epicId,
        testId: test.id,
        evidenceId,
        flagType: 'coverage',
        severity: 'high',
        description: `Test "${test.name}" passed but coverage unchanged (${beforeData.linesCovered}/${beforeData.linesTotal} lines) - tests didn't run`,
        proof,
      };
    }

    return null;
  }

  /**
   * Check if coverage decreased
   */
  private checkDecreasedCoverage(
    epicId: string,
    test: TestResult,
    beforeData: CoverageData,
    afterData: CoverageData,
    evidenceId: number
  ): CreateRedFlagInput | null {
    if (afterData.linesCovered < beforeData.linesCovered) {
      const diff = beforeData.linesCovered - afterData.linesCovered;

      const proof: RedFlagProof = {
        testId: test.id,
        testType: test.type,
        coverageBefore: beforeData,
        coverageAfter: afterData,
        diff: -diff,
        timestamp: test.executedAt.toISOString(),
      };

      return {
        epicId,
        testId: test.id,
        evidenceId,
        flagType: 'coverage',
        severity: 'high',
        description: `Test "${test.name}" passed but coverage decreased by ${diff} lines (impossible, indicates error)`,
        proof,
      };
    }

    return null;
  }

  /**
   * Check if coverage increase matches test scope
   */
  private checkCoverageScope(
    epicId: string,
    test: TestResult,
    beforeData: CoverageData,
    afterData: CoverageData,
    evidenceId: number
  ): CreateRedFlagInput | null {
    const diff = afterData.linesCovered - beforeData.linesCovered;

    // If coverage increased, check if increase is reasonable
    if (diff > 0) {
      // Get test metadata to estimate expected coverage
      // For now, use simple heuristic: unit tests should cover >5 lines
      const minExpectedCoverage = test.type === 'unit' ? 5 : 1;

      if (diff < minExpectedCoverage) {
        const proof: RedFlagProof = {
          testId: test.id,
          testType: test.type,
          coverageBefore: beforeData,
          coverageAfter: afterData,
          diff,
          expectedCoverageIncrease: true,
          timestamp: test.executedAt.toISOString(),
        };

        return {
          epicId,
          testId: test.id,
          evidenceId,
          flagType: 'coverage',
          severity: 'medium',
          description: `Test "${test.name}" coverage increased by only ${diff} lines (expected >${minExpectedCoverage} for ${test.type} test)`,
          proof,
        };
      }
    }

    return null;
  }
}
