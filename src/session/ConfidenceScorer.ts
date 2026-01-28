/**
 * Confidence Scorer Service (Epic 007-E)
 * Calculates confidence score (0-100%) for resumed context accuracy
 *
 * Responsibilities:
 * - Score checkpoint age (fresher = higher confidence)
 * - Validate state (files exist, branch exists)
 * - Score event freshness
 * - Calculate final confidence with reasoning
 */

import { ReconstructionSource } from '../types/resume.js';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Confidence scoring factors
 */
interface ConfidenceFactors {
  source: ReconstructionSource;
  age_minutes: number;
  files_exist: boolean;
  branch_exists: boolean;
  work_state: Record<string, any>;
}

/**
 * Confidence score result
 */
export interface ConfidenceScoreResult {
  score: number;
  reason: string;
  warnings: string[];
}

/**
 * Calculate confidence score for reconstructed context
 *
 * Scoring rules:
 * - Checkpoint age: 100% if <5 min, 90% if <1 hour, 70% if >1 hour
 * - State validity: -10% if files deleted, -5% if branch deleted
 * - Event freshness: -5% per 30 min since last event
 * - Source priority: checkpoint (100%) > events (85%) > commands (70%) > basic (40%)
 *
 * @param factors Confidence scoring factors
 * @returns Confidence score (0-100) with reasoning
 *
 * @example
 * const score = await calculateConfidence({
 *   source: 'checkpoint',
 *   age_minutes: 10,
 *   files_exist: true,
 *   branch_exists: true,
 *   work_state: { branch: 'feat/epic-003' }
 * });
 * // Returns: { score: 95, reason: 'Recent checkpoint (10 min), all state valid' }
 */
export async function calculateConfidence(
  factors: ConfidenceFactors
): Promise<ConfidenceScoreResult> {
  const warnings: string[] = [];

  // Base score from source
  let score = getBaseScoreForSource(factors.source);

  // Adjust for age
  const ageAdjustment = calculateAgeAdjustment(
    factors.source,
    factors.age_minutes
  );
  score += ageAdjustment.adjustment;
  if (ageAdjustment.warning) {
    warnings.push(ageAdjustment.warning);
  }

  // Validate state and adjust
  const stateValidation = await validateState(factors.work_state);
  score += stateValidation.adjustment;
  warnings.push(...stateValidation.warnings);

  // Ensure score stays in valid range
  score = Math.max(0, Math.min(100, score));

  // Generate reason
  const reason = generateReason(factors, score, warnings);

  return {
    score: Math.round(score),
    reason,
    warnings,
  };
}

/**
 * Get base score for reconstruction source
 */
function getBaseScoreForSource(source: ReconstructionSource): number {
  switch (source) {
    case ReconstructionSource.CHECKPOINT:
      return 100;
    case ReconstructionSource.EVENTS:
      return 85;
    case ReconstructionSource.COMMANDS:
      return 70;
    case ReconstructionSource.BASIC:
      return 40;
    default:
      return 0;
  }
}

/**
 * Calculate age-based adjustment
 */
function calculateAgeAdjustment(
  source: ReconstructionSource,
  ageMinutes: number
): { adjustment: number; warning?: string } {
  // Checkpoint age scoring
  if (source === ReconstructionSource.CHECKPOINT) {
    if (ageMinutes <= 5) {
      return { adjustment: 0 }; // Keep 100%
    }
    if (ageMinutes <= 30) {
      return { adjustment: -10 }; // 90%
    }
    if (ageMinutes <= 60) {
      return { adjustment: -20, warning: 'Checkpoint is 30-60 minutes old' };
    }
    return {
      adjustment: -30,
      warning: 'Checkpoint is over 1 hour old. Verify state manually.',
    };
  }

  // Event/command freshness scoring
  if (
    source === ReconstructionSource.EVENTS ||
    source === ReconstructionSource.COMMANDS
  ) {
    const periods = Math.floor(ageMinutes / 30);
    const adjustment = periods * -5;
    if (periods > 2) {
      return {
        adjustment,
        warning: `Last ${source} over ${ageMinutes} minutes old`,
      };
    }
    return { adjustment };
  }

  // Basic state age
  if (source === ReconstructionSource.BASIC) {
    if (ageMinutes > 60) {
      return {
        adjustment: -10,
        warning: 'Instance has been stale for over 1 hour',
      };
    }
  }

  return { adjustment: 0 };
}

/**
 * Validate work state and calculate adjustment
 */
async function validateState(
  workState: Record<string, any>
): Promise<{ adjustment: number; warnings: string[] }> {
  let adjustment = 0;
  const warnings: string[] = [];

  // Check if project directory exists
  if (workState.project_path) {
    try {
      await fs.access(workState.project_path);
    } catch (error) {
      adjustment -= 10;
      warnings.push(`Project directory not found: ${workState.project_path}`);
    }
  }

  // Check if git branch exists
  if (workState.branch && workState.project_path) {
    try {
      const { stdout } = await execAsync(
        `cd "${workState.project_path}" && git rev-parse --verify ${workState.branch}`,
        { timeout: 5000 }
      );
      // Branch exists
    } catch (error) {
      adjustment -= 5;
      warnings.push(`Git branch not found: ${workState.branch}`);
    }
  }

  // Check if files from work state exist
  if (workState.modified_files && Array.isArray(workState.modified_files)) {
    const missingFiles: string[] = [];
    for (const file of workState.modified_files.slice(0, 5)) {
      // Check first 5 files only
      try {
        await fs.access(file);
      } catch (error) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      adjustment -= 5;
      warnings.push(
        `${missingFiles.length} files from work state not found`
      );
    }
  }

  return { adjustment, warnings };
}

/**
 * Generate human-readable confidence reason
 */
function generateReason(
  factors: ConfidenceFactors,
  finalScore: number,
  warnings: string[]
): string {
  const parts: string[] = [];

  // Source description
  switch (factors.source) {
    case ReconstructionSource.CHECKPOINT:
      parts.push(`Checkpoint loaded (age: ${factors.age_minutes} min)`);
      break;
    case ReconstructionSource.EVENTS:
      parts.push(`Reconstructed from events (age: ${factors.age_minutes} min)`);
      break;
    case ReconstructionSource.COMMANDS:
      parts.push(
        `Inferred from commands (age: ${factors.age_minutes} min)`
      );
      break;
    case ReconstructionSource.BASIC:
      parts.push(
        `Basic state only (age: ${factors.age_minutes} min, no detailed history)`
      );
      break;
  }

  // Add validation status
  if (warnings.length === 0) {
    parts.push('all state valid');
  } else {
    parts.push(`${warnings.length} validation warnings`);
  }

  // Add confidence level assessment
  if (finalScore >= 90) {
    parts.push('HIGH confidence');
  } else if (finalScore >= 70) {
    parts.push('MODERATE confidence');
  } else if (finalScore >= 50) {
    parts.push('LOW confidence - verify manually');
  } else {
    parts.push('VERY LOW confidence - manual verification required');
  }

  return parts.join(', ');
}

/**
 * Check if confidence score meets threshold for auto-resume
 *
 * @param score Confidence score (0-100)
 * @returns True if score meets threshold (>=80%)
 */
export function meetsConfidenceThreshold(score: number): boolean {
  return score >= 80;
}

/**
 * Get confidence level label
 *
 * @param score Confidence score (0-100)
 * @returns Confidence level label
 */
export function getConfidenceLevel(
  score: number
): 'high' | 'moderate' | 'low' | 'very-low' {
  if (score >= 90) return 'high';
  if (score >= 70) return 'moderate';
  if (score >= 50) return 'low';
  return 'very-low';
}
