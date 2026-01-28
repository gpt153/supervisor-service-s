/**
 * Footer Renderer (Epic 007-F)
 * Generates and formats footer information for PS responses
 *
 * Format: Instance: {instance_id} | Epic: {epic_id} | Context: {%}% | Active: {hours}h
 *
 * Responsibilities:
 * - Format footer with instance ID, epic, context, and active time
 * - Generate resume hint when context >30%
 * - Ensure consistent formatting across all PSes
 * - Performance: <5ms per render
 */

import { STALE_TIMEOUT_SECONDS } from '../types/session.js';

/**
 * Configuration for footer rendering
 */
export interface FooterConfig {
  instanceId: string;
  currentEpic?: string;
  contextPercent: number;
  sessionStartTime: Date;
  showResumeHint?: boolean;
}

/**
 * Render footer for PS response
 *
 * @param config Footer configuration
 * @returns Formatted footer string with newline prefix
 *
 * @example
 * const footer = renderFooter({
 *   instanceId: 'odin-PS-8f4a2b',
 *   currentEpic: '003',
 *   contextPercent: 42,
 *   sessionStartTime: new Date('2026-01-28T10:00:00Z')
 * });
 * // Returns: "\n---\nInstance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h"
 */
export function renderFooter(config: FooterConfig): string {
  const start = Date.now();

  try {
    // Calculate session duration in hours
    const durationMs = Date.now() - config.sessionStartTime.getTime();
    const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10;

    // Format epic display
    const epicDisplay = config.currentEpic ? config.currentEpic : '—';

    // Build footer line
    const footer = `Instance: ${config.instanceId} | Epic: ${epicDisplay} | Context: ${config.contextPercent}% | Active: ${durationHours}h`;

    // Check performance
    const duration = Date.now() - start;
    if (duration > 5) {
      console.warn(`Footer render slow: ${duration}ms for ${config.instanceId}`);
    }

    return footer;
  } catch (error) {
    console.error('Footer render error:', error);
    // Return minimal footer on error
    return `Instance: ${config.instanceId} | Error rendering footer`;
  }
}

/**
 * Render footer with separator line
 *
 * @param config Footer configuration
 * @returns Formatted footer with separator (newline before, newline after)
 *
 * @example
 * response += renderFooterWithSeparator(config);
 */
export function renderFooterWithSeparator(config: FooterConfig): string {
  const footer = renderFooter(config);
  return `\n---\n${footer}`;
}

/**
 * Generate resume hint when appropriate
 *
 * @param instanceId Instance ID
 * @param contextPercent Context usage percentage
 * @param showHint Optional override to show/hide hint
 * @returns Resume hint string or empty string
 *
 * @example
 * const hint = getResumeHint('odin-PS-8f4a2b', 42);
 * // Returns: "[Use \"resume odin-PS-8f4a2b\" to restore this session]"
 */
export function getResumeHint(
  instanceId: string,
  contextPercent: number,
  showHint?: boolean
): string {
  // Show hint if context >30% or explicitly requested
  const shouldShow = showHint !== undefined ? showHint : contextPercent > 30;

  if (!shouldShow) {
    return '';
  }

  return `[Use "resume ${instanceId}" to restore this session]`;
}

/**
 * Format footer and resume hint together
 *
 * @param config Footer configuration with optional hint flag
 * @returns Complete footer with optional hint
 *
 * @example
 * response += formatFooterComplete({
 *   instanceId: 'odin-PS-8f4a2b',
 *   currentEpic: '003',
 *   contextPercent: 42,
 *   sessionStartTime: startTime,
 *   showResumeHint: true
 * });
 */
export function formatFooterComplete(config: FooterConfig & { showResumeHint?: boolean }): string {
  const footer = renderFooter(config);
  const hint = getResumeHint(config.instanceId, config.contextPercent, config.showResumeHint);

  if (hint) {
    return `\n---\n${footer}\n${hint}`;
  }

  return `\n---\n${footer}`;
}

/**
 * Parse footer to extract instance ID
 * Useful for resume command handling
 *
 * @param footerText Footer text to parse
 * @returns Instance ID or null if not found
 *
 * @example
 * const id = parseInstanceIdFromFooter(
 *   "Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h"
 * );
 * // Returns: "odin-PS-8f4a2b"
 */
export function parseInstanceIdFromFooter(footerText: string): string | null {
  const match = footerText.match(/Instance:\s+([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

/**
 * Validate footer format
 *
 * @param footer Footer string to validate
 * @returns true if footer has expected format
 */
export function isValidFooterFormat(footer: string): boolean {
  // Check for required components
  const hasInstance = /Instance:\s+[a-z0-9-]+/i.test(footer);
  const hasEpic = /Epic:\s+[0-9a-z—-]+/i.test(footer);
  const hasContext = /Context:\s+\d+%/i.test(footer);
  const hasActive = /Active:\s+[\d.]+h/i.test(footer);

  return hasInstance && hasEpic && hasContext && hasActive;
}

/**
 * Example footer outputs for documentation
 */
export const FOOTER_EXAMPLES = {
  minimal: 'Instance: odin-PS-8f4a2b | Epic: — | Context: 0% | Active: 0.1h',
  working: 'Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h',
  complete: 'Instance: odin-PS-8f4a2b | Epic: 003 | Context: 92% | Active: 4.5h',
  withHint:
    'Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h\n[Use "resume odin-PS-8f4a2b" to restore this session]',
};
