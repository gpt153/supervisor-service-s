/**
 * Root Cause Analysis Type Definitions
 * Epic: 006-F
 */

/**
 * Failure category classification
 */
export type FailureCategory = 'syntax' | 'logic' | 'integration' | 'environment';

/**
 * Complexity classification for fix estimation
 */
export type Complexity = 'simple' | 'moderate' | 'complex' | 'requires_human';

/**
 * Root cause analysis result
 */
export interface RootCauseAnalysis {
  id?: number;
  test_id: string;
  epic_id: string;
  evidence_id?: number;

  // RCA
  failure_category: FailureCategory;
  root_cause: string;
  complexity: Complexity;
  estimated_fix_difficulty?: number;

  // Analysis
  symptoms: string[];
  diagnosis_reasoning: string;
  recommended_strategy: string;

  analyzed_at?: Date;
  analyzer_model: 'opus' | 'sonnet';
}

/**
 * RCA generation options
 */
export interface RCAOptions {
  test_id: string;
  epic_id: string;
  evidence_artifacts: any[];
  red_flags?: any[];
  previous_attempts?: any[];
  model?: 'opus' | 'sonnet';
}

/**
 * RCA generation result
 */
export interface RCAResult {
  success: boolean;
  rca?: RootCauseAnalysis;
  error?: string;
}

/**
 * Failure classifier result
 */
export interface FailureClassification {
  category: FailureCategory;
  complexity: Complexity;
  confidence: number; // 0-1
  reasoning: string;
}
