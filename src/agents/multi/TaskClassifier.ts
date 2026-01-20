/**
 * Task Classifier
 *
 * Classifies tasks by complexity and type to determine
 * the most appropriate AI agent for execution.
 */

import type { TaskClassification, TaskType, ComplexityLevel } from './types.js';

/**
 * Task information for classification
 */
export interface TaskInfo {
  /** Task description/prompt */
  description: string;
  /** Files that will be modified */
  files?: string[];
  /** Estimated lines of code to change */
  estimatedLines?: number;
  /** Whether task involves security-critical code */
  securityCritical?: boolean;
  /** Explicit task type hint */
  typeHint?: TaskType;
}

/**
 * Keyword patterns for task type detection
 */
const TASK_TYPE_PATTERNS: Record<TaskType, string[]> = {
  documentation: [
    'document',
    'readme',
    'comment',
    'jsdoc',
    'docs',
    'docstring',
    'guide',
    'tutorial',
  ],
  'test-generation': [
    'test',
    'unit test',
    'integration test',
    'e2e test',
    'spec',
    'jest',
    'vitest',
    'cypress',
  ],
  boilerplate: [
    'scaffold',
    'template',
    'boilerplate',
    'generate',
    'create new',
    'setup',
    'init',
  ],
  'bug-fix': [
    'bug',
    'fix',
    'error',
    'issue',
    'broken',
    'not working',
    'crash',
    'debug',
  ],
  'api-implementation': [
    'api',
    'endpoint',
    'route',
    'handler',
    'controller',
    'rest',
    'graphql',
  ],
  refactoring: [
    'refactor',
    'restructure',
    'reorganize',
    'clean up',
    'improve',
    'optimize',
    'rename',
  ],
  architecture: [
    'architecture',
    'design',
    'system',
    'structure',
    'framework',
    'pattern',
    'adr',
  ],
  security: [
    'security',
    'auth',
    'authentication',
    'authorization',
    'permission',
    'encrypt',
    'token',
    'vulnerability',
  ],
  algorithm: [
    'algorithm',
    'sorting',
    'search',
    'optimization',
    'complexity',
    'data structure',
  ],
  research: [
    'research',
    'investigate',
    'analyze',
    'explore',
    'study',
    'learn',
    'understand',
  ],
  unknown: [],
};

/**
 * Security-critical keywords
 */
const SECURITY_KEYWORDS = [
  'auth',
  'password',
  'token',
  'secret',
  'key',
  'encrypt',
  'decrypt',
  'permission',
  'security',
  'vulnerability',
  'injection',
  'xss',
  'csrf',
];

/**
 * Task classifier
 */
export class TaskClassifier {
  /**
   * Classify a task
   */
  classify(task: TaskInfo): TaskClassification {
    // Determine task type
    const type = this.classifyType(task);

    // Count files and lines
    const filesAffected = task.files?.length ?? this.estimateFiles(task);
    const linesOfCode = task.estimatedLines ?? this.estimateLines(task);

    // Check if security-critical
    const securityCritical =
      task.securityCritical ?? this.isSecurityCritical(task);

    // Determine complexity
    const complexity = this.classifyComplexity({
      type,
      filesAffected,
      linesOfCode,
      securityCritical,
    });

    // Calculate confidence
    const confidence = this.calculateConfidence(task, type);

    return {
      complexity,
      type,
      filesAffected,
      linesOfCode,
      securityCritical,
      confidence,
    };
  }

  /**
   * Classify task type based on description
   */
  private classifyType(task: TaskInfo): TaskType {
    // Use explicit hint if provided
    if (task.typeHint) {
      return task.typeHint;
    }

    const description = task.description.toLowerCase();
    let bestMatch: TaskType = 'unknown';
    let maxMatches = 0;

    // Count keyword matches for each type
    for (const [type, keywords] of Object.entries(TASK_TYPE_PATTERNS)) {
      const matches = keywords.filter((keyword) =>
        description.includes(keyword.toLowerCase())
      ).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = type as TaskType;
      }
    }

    return bestMatch;
  }

  /**
   * Classify complexity based on task characteristics
   */
  private classifyComplexity(params: {
    type: TaskType;
    filesAffected: number;
    linesOfCode: number;
    securityCritical: boolean;
  }): ComplexityLevel {
    const { type, filesAffected, linesOfCode, securityCritical } = params;

    // Security-critical tasks are always complex
    if (securityCritical) {
      return 'complex';
    }

    // Architecture and algorithm tasks are always complex
    if (type === 'architecture' || type === 'algorithm') {
      return 'complex';
    }

    // Simple tasks (documentation, boilerplate, small fixes)
    if (
      type === 'documentation' ||
      type === 'test-generation' ||
      type === 'boilerplate'
    ) {
      if (filesAffected <= 2 && linesOfCode <= 100) {
        return 'simple';
      }
    }

    // Bug fixes
    if (type === 'bug-fix') {
      if (filesAffected <= 1 && linesOfCode <= 50) {
        return 'simple';
      }
      if (filesAffected <= 3 && linesOfCode <= 150) {
        return 'medium';
      }
      return 'complex';
    }

    // Refactoring
    if (type === 'refactoring') {
      if (filesAffected <= 2 && linesOfCode <= 100) {
        return 'medium';
      }
      return 'complex';
    }

    // API implementation
    if (type === 'api-implementation') {
      if (filesAffected <= 3 && linesOfCode <= 200) {
        return 'medium';
      }
      return 'complex';
    }

    // Research tasks
    if (type === 'research') {
      return 'simple'; // Research is fast but low complexity for code generation
    }

    // Default classification based on size
    if (filesAffected <= 1 && linesOfCode <= 50) {
      return 'simple';
    }
    if (filesAffected <= 3 && linesOfCode <= 200) {
      return 'medium';
    }
    return 'complex';
  }

  /**
   * Check if task is security-critical
   */
  private isSecurityCritical(task: TaskInfo): boolean {
    const description = task.description.toLowerCase();
    return SECURITY_KEYWORDS.some((keyword) => description.includes(keyword));
  }

  /**
   * Estimate number of files affected
   */
  private estimateFiles(task: TaskInfo): number {
    const description = task.description.toLowerCase();

    // Multiple files indicators
    if (
      description.includes('across') ||
      description.includes('multiple') ||
      description.includes('all files')
    ) {
      return 5;
    }

    // Single file indicators
    if (
      description.includes('file') ||
      description.includes('component') ||
      description.includes('module')
    ) {
      return 1;
    }

    // Default: assume 2 files
    return 2;
  }

  /**
   * Estimate lines of code
   */
  private estimateLines(task: TaskInfo): number {
    const description = task.description.toLowerCase();

    // Large change indicators
    if (
      description.includes('complete') ||
      description.includes('entire') ||
      description.includes('full')
    ) {
      return 300;
    }

    // Medium change indicators
    if (
      description.includes('add') ||
      description.includes('implement') ||
      description.includes('create')
    ) {
      return 150;
    }

    // Small change indicators
    if (
      description.includes('fix') ||
      description.includes('update') ||
      description.includes('modify')
    ) {
      return 50;
    }

    // Default: medium-sized change
    return 100;
  }

  /**
   * Calculate confidence in classification
   */
  private calculateConfidence(task: TaskInfo, type: TaskType): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence if type hint provided
    if (task.typeHint) {
      confidence += 0.3;
    }

    // Higher confidence if files explicitly provided
    if (task.files && task.files.length > 0) {
      confidence += 0.1;
    }

    // Higher confidence if lines explicitly provided
    if (task.estimatedLines !== undefined) {
      confidence += 0.1;
    }

    // Higher confidence if task type has strong keyword matches
    const description = task.description.toLowerCase();
    const keywords = TASK_TYPE_PATTERNS[type];
    const matches = keywords.filter((keyword) =>
      description.includes(keyword.toLowerCase())
    ).length;

    if (matches >= 2) {
      confidence += 0.2;
    } else if (matches >= 1) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }
}
