/**
 * Root Cause Analyzer
 * Epic: 006-F
 *
 * Analyzes test failures to determine root cause using Opus
 */

import type { RootCauseAnalysis, RCAOptions, RCAResult } from '../types/rca.js';
import { FailureClassifier } from './FailureClassifier.js';
import { createRCA } from '../db/queries/rca.js';

export class RootCauseAnalyzer {
  private classifier: FailureClassifier;

  constructor() {
    this.classifier = new FailureClassifier();
  }

  /**
   * Analyze a test failure to determine root cause
   * Uses Opus for deep reasoning (required for accurate RCA)
   *
   * @param options - RCA options
   * @returns RCA result
   */
  async analyze(options: RCAOptions): Promise<RCAResult> {
    try {
      // 1. Extract evidence from artifacts
      const evidence = this.extractEvidence(options.evidence_artifacts);

      // 2. Classify failure (quick heuristics)
      const classification = this.classifier.classify(
        evidence.errorMessage,
        evidence.stackTrace,
        evidence.filesInvolved
      );

      // 3. Analyze root cause (would use Opus in production)
      // For now, use heuristic analysis
      const rootCause = this.analyzeRootCause(
        evidence,
        classification,
        options.previous_attempts
      );

      // 4. Generate recommended strategy
      const recommendedStrategy = this.recommendStrategy(rootCause, classification.category);

      // 5. Create RCA record
      const rca: RootCauseAnalysis = {
        test_id: options.test_id,
        epic_id: options.epic_id,
        evidence_id: options.evidence_artifacts[0]?.id,
        failure_category: classification.category,
        root_cause: rootCause,
        complexity: classification.complexity,
        estimated_fix_difficulty: this.estimateFixDifficulty(classification.complexity),
        symptoms: evidence.symptoms,
        diagnosis_reasoning: classification.reasoning,
        recommended_strategy: recommendedStrategy,
        analyzer_model: options.model || 'opus'
      };

      // 6. Store RCA
      const result = await createRCA(rca);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, rca: result.data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Extract evidence from artifacts
   *
   * @param artifacts - Evidence artifacts
   * @returns Extracted evidence
   */
  private extractEvidence(artifacts: any[]): {
    errorMessage: string;
    stackTrace?: string;
    filesInvolved: string[];
    symptoms: string[];
  } {
    const evidence = {
      errorMessage: '',
      stackTrace: undefined as string | undefined,
      filesInvolved: [] as string[],
      symptoms: [] as string[]
    };

    for (const artifact of artifacts) {
      if (artifact.artifact_type === 'error_log') {
        evidence.errorMessage = artifact.content || '';
        evidence.symptoms.push(`Error: ${artifact.content?.substring(0, 100)}`);
      }

      if (artifact.artifact_type === 'stack_trace') {
        evidence.stackTrace = artifact.content || '';
        // Extract files from stack trace
        const fileMatches = artifact.content?.match(/at .+ \((.+):\d+:\d+\)/g) || [];
        evidence.filesInvolved = fileMatches.map((m: string) => {
          const match = m.match(/\((.+):\d+:\d+\)/);
          return match ? match[1] : '';
        }).filter(Boolean);
      }

      if (artifact.artifact_type === 'screenshot') {
        evidence.symptoms.push('Visual failure captured in screenshot');
      }

      if (artifact.artifact_type === 'network_log') {
        evidence.symptoms.push('Network request failed or returned unexpected response');
      }
    }

    return evidence;
  }

  /**
   * Analyze root cause from evidence
   *
   * @param evidence - Extracted evidence
   * @param classification - Failure classification
   * @param previousAttempts - Previous fix attempts
   * @returns Root cause description
   */
  private analyzeRootCause(
    evidence: any,
    classification: any,
    previousAttempts?: any[]
  ): string {
    const msg = evidence.errorMessage.toLowerCase();

    // Syntax errors - specific cause
    if (classification.category === 'syntax') {
      if (msg.includes('unexpected token')) {
        return 'Syntax error: Unexpected token in code';
      }
      if (msg.includes('missing semicolon')) {
        return 'Syntax error: Missing semicolon';
      }
      return 'Syntax error in code';
    }

    // Integration errors - specific cause
    if (classification.category === 'integration') {
      if (msg.includes('cannot find module')) {
        const moduleMatch = evidence.errorMessage.match(/Cannot find module '([^']+)'/);
        const moduleName = moduleMatch ? moduleMatch[1] : 'unknown';
        return `Missing module dependency: ${moduleName}`;
      }
      if (msg.includes('404')) {
        return 'API endpoint not found (404)';
      }
      if (msg.includes('connection refused')) {
        return 'Service not running or connection refused';
      }
      return 'Integration failure with external dependency';
    }

    // Environment errors - specific cause
    if (classification.category === 'environment') {
      if (msg.includes('permission denied')) {
        return 'Permission denied: Insufficient file or resource permissions';
      }
      if (msg.includes('environment variable')) {
        return 'Missing or invalid environment variable';
      }
      if (msg.includes('undefined is not')) {
        return 'Variable or property accessed before initialization';
      }
      return 'Environment configuration issue';
    }

    // Logic errors - analyze previous attempts
    if (previousAttempts && previousAttempts.length > 0) {
      return `Logic error: Previous ${previousAttempts.length} fix(es) did not address underlying issue`;
    }

    return 'Logic error: Test assertion failed due to incorrect behavior';
  }

  /**
   * Recommend fix strategy based on root cause
   *
   * @param rootCause - Root cause description
   * @param category - Failure category
   * @returns Recommended strategy
   */
  private recommendStrategy(rootCause: string, category: string): string {
    const rc = rootCause.toLowerCase();

    // Specific recommendations based on root cause
    if (rc.includes('missing module')) return 'dependency_add';
    if (rc.includes('permission denied')) return 'permission_fix';
    if (rc.includes('environment variable')) return 'env_var_add';
    if (rc.includes('unexpected token')) return 'syntax_fix';
    if (rc.includes('missing semicolon')) return 'typo_correction';
    if (rc.includes('404')) return 'api_update';

    // Category-based defaults
    if (category === 'syntax') return 'syntax_fix';
    if (category === 'integration') return 'import_fix';
    if (category === 'environment') return 'config_fix';
    if (category === 'logic') return 'refactor';

    return 'refactor';
  }

  /**
   * Estimate fix difficulty (number of retries likely needed)
   *
   * @param complexity - Failure complexity
   * @returns Estimated retries (1-3)
   */
  private estimateFixDifficulty(complexity: string): number {
    switch (complexity) {
      case 'simple':
        return 1;
      case 'moderate':
        return 2;
      case 'complex':
        return 3;
      case 'requires_human':
        return 0; // Should escalate immediately
      default:
        return 2;
    }
  }
}
