/**
 * Claude Code CLI Adapter
 *
 * Adapter for executing tasks using Claude Code CLI.
 * Best for: Complex tasks, architecture decisions, security-critical code.
 */

import { CLIAdapter } from './CLIAdapter.js';
import type { AgentRequest, AdapterConfig } from './types.js';

/**
 * Default configuration for Claude CLI
 */
const DEFAULT_CONFIG: AdapterConfig = {
  enabled: true,
  cliCommand: 'claude',
  defaultTimeout: 300000, // 5 minutes
  quotaLimit: 1000, // Conservative estimate (Claude Pro subscription)
  quotaResetHours: 24,
};

/**
 * Claude Code CLI adapter
 */
export class ClaudeCLIAdapter extends CLIAdapter {
  constructor(config: Partial<AdapterConfig> = {}) {
    super('claude', { ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Build Claude CLI command
   *
   * Format: claude -p "<prompt>" --output-format json
   */
  protected buildCommand(request: AgentRequest): string {
    const parts = [this.config.cliCommand];

    // Add prompt
    parts.push('-p', this.escapeShellArg(request.prompt));

    // Add output format if JSON requested
    if (request.outputFormat === 'json') {
      parts.push('--output-format', 'json');
    }

    // Add context files if provided
    if (request.contextFiles && request.contextFiles.length > 0) {
      for (const file of request.contextFiles) {
        parts.push('--file', this.escapeShellArg(file));
      }
    }

    return parts.join(' ');
  }

  /**
   * Claude CLI may output additional metadata
   * Extract the actual response
   */
  protected parseOutput(
    output: string,
    format: 'json' | 'text' | 'markdown'
  ): any {
    if (format === 'json') {
      // Claude Code may wrap JSON in markdown code blocks
      const codeBlockMatch = output.match(/```json\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        try {
          return JSON.parse(codeBlockMatch[1]);
        } catch {
          // Fall through to parent parsing
        }
      }
    }

    return super.parseOutput(output, format);
  }

  /**
   * Claude stderr is often informational (progress updates)
   * Only treat as error if it contains specific error markers
   */
  protected isErrorOutput(stderr: string): boolean {
    const errorMarkers = ['Error:', 'Failed:', 'Exception:', 'Fatal:'];
    return errorMarkers.some((marker) => stderr.includes(marker));
  }

  /**
   * Estimate cost for Claude execution
   * Claude Pro subscription is prepaid, so cost = 0 for quota-included usage
   */
  protected estimateCost(request: AgentRequest, duration: number): number {
    // Subscription-included
    return 0;
  }
}
