/**
 * Codex/ChatGPT CLI Adapter
 *
 * Adapter for executing tasks using OpenAI Codex/ChatGPT CLI.
 * Best for: Refactoring, debugging, testing, API implementation.
 */

import { CLIAdapter } from './CLIAdapter.js';
import type { AgentRequest, AdapterConfig } from './types.js';

/**
 * Default configuration for Codex CLI
 */
const DEFAULT_CONFIG: AdapterConfig = {
  enabled: true,
  cliCommand: 'codex',
  defaultTimeout: 240000, // 4 minutes
  quotaLimit: 150, // Conservative estimate (30-150 messages per 5hr for ChatGPT Plus)
  quotaResetHours: 5, // ChatGPT Plus resets every 5 hours
};

/**
 * Codex/ChatGPT CLI adapter
 */
export class CodexCLIAdapter extends CLIAdapter {
  constructor(config: Partial<AdapterConfig> = {}) {
    super('codex', { ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Build Codex CLI command
   *
   * Format: codex exec "<prompt>" --json
   */
  protected buildCommand(request: AgentRequest): string {
    const parts = [this.config.cliCommand];

    // Codex CLI uses "exec" subcommand
    parts.push('exec');

    // Add prompt
    parts.push(this.escapeShellArg(request.prompt));

    // Add output format if JSON requested
    if (request.outputFormat === 'json') {
      parts.push('--json');
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
   * Parse Codex output
   * May include metadata or wrapped responses
   */
  protected parseOutput(
    output: string,
    format: 'json' | 'text' | 'markdown'
  ): any {
    if (format === 'json') {
      // Try to extract JSON from output
      // Codex might wrap it or include metadata
      const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          // Fall through
        }
      }

      // Try to find standalone JSON
      const objectMatch = output.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch {
          // Fall through
        }
      }
    }

    return super.parseOutput(output, format);
  }

  /**
   * Codex error detection
   */
  protected isErrorOutput(stderr: string): boolean {
    const errorMarkers = [
      'Error:',
      'Failed:',
      'Exception:',
      'API error',
      'Rate limit',
      'Quota exceeded',
      'Authentication failed',
    ];
    return errorMarkers.some((marker) => stderr.includes(marker));
  }

  /**
   * Estimate cost for Codex execution
   * ChatGPT Plus subscription is prepaid, so cost = 0 for quota-included usage
   */
  protected estimateCost(request: AgentRequest, duration: number): number {
    // Subscription-included
    return 0;
  }
}
