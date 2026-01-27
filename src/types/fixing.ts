/**
 * Fixing Type Definitions
 * Epic: 006-F
 */

/**
 * Available fix strategies
 */
export type FixStrategy =
  | 'typo_correction'
  | 'syntax_fix'
  | 'formatting'
  | 'refactor'
  | 'algorithm_fix'
  | 'condition_fix'
  | 'import_fix'
  | 'dependency_add'
  | 'api_update'
  | 'env_var_add'
  | 'config_fix'
  | 'permission_fix';

/**
 * Model selection for fixes
 */
export type FixModel = 'haiku' | 'sonnet' | 'opus';

/**
 * Fix attempt record
 */
export interface FixAttempt {
  id?: number;
  test_id: string;
  rca_id?: number;

  // Retry info
  retry_number: number;
  model_used: FixModel;

  // Fix details
  fix_strategy: FixStrategy;
  changes_made: string;
  commit_sha?: string;

  // Outcome
  success: boolean;
  verification_passed?: boolean;
  error_message?: string;

  // Cost tracking
  cost_usd?: number;
  tokens_used?: number;

  attempted_at?: Date;
}

/**
 * Fix learning record
 */
export interface FixLearning {
  id?: number;
  failure_pattern: string;
  fix_strategy: FixStrategy;
  success_rate?: number;
  times_tried: number;
  times_succeeded: number;

  // Pattern matching
  error_regex?: string;
  file_pattern?: string;
  complexity?: string;

  created_at?: Date;
  last_used?: Date;
}

/**
 * Fix execution result
 */
export interface FixResult {
  success: boolean;
  retriesUsed?: number;
  fixStrategy?: FixStrategy;
  totalCost?: number;
  error?: string;
  escalated?: boolean;
  handoffPath?: string;
}

/**
 * Fix execution options
 */
export interface FixOptions {
  test_id: string;
  strategy: FixStrategy;
  model: FixModel;
  dry_run?: boolean;
}

/**
 * Escalation reason
 */
export type EscalationReason =
  | 'Root cause requires human decision'
  | 'Architectural change needed'
  | 'Business logic ambiguity'
  | 'Max retries exhausted'
  | 'Unknown failure pattern';

/**
 * Escalation result
 */
export interface EscalationResult {
  escalated: true;
  reason: EscalationReason;
  handoff_path: string;
  rca_summary: string;
  attempted_fixes: string[];
}
