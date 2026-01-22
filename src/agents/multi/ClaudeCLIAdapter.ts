/**
 * Claude Code CLI Adapter
 *
 * Adapter for executing tasks using Claude Code CLI with automatic key rotation.
 * Best for: Complex tasks, architecture decisions, security-critical code.
 */

import { CLIAdapter } from './CLIAdapter.js';
import type { AgentRequest, AdapterConfig, AgentResult } from './types.js';
import { ClaudeKeyManager } from './ClaudeKeyManager.js';

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
 * Claude Code CLI adapter with automatic key rotation
 */
export class ClaudeCLIAdapter extends CLIAdapter {
  private keyManager: ClaudeKeyManager;
  private currentKeyId: number | null = null;

  constructor(config: Partial<AdapterConfig> = {}) {
    super('claude', { ...DEFAULT_CONFIG, ...config });
    this.keyManager = new ClaudeKeyManager();
  }

  /**
   * Initialize (Claude Code uses user's logged-in token, no API key needed)
   */
  async initialize(): Promise<void> {
    console.log(`[ClaudeCLIAdapter] ✅ Claude Code CLI ready (uses user token)`);
  }

  /**
   * Execute using Claude Code CLI (uses user's logged-in session token)
   */
  async execute(request: AgentRequest): Promise<AgentResult> {
    // Claude Code CLI uses the user's authentication token from ~/.claude/
    // No API key needed - just execute
    return await super.execute(request);
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
   * Get environment variables including API key
   */
  protected async getEnvironment(): Promise<Record<string, string>> {
    const env: Record<string, string> = {};

    // Copy all defined environment variables
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    return env;
  }

  /**
   * Override executeCommand to inject API key into environment
   */
  protected async executeCommand(
    command: string,
    options: { cwd?: string; timeout?: number; env?: Record<string, string> }
  ): Promise<{ stdout: string; stderr: string }> {
    const env = await this.getEnvironment();
    return super.executeCommand(command, { ...options, env });
  }

  /**
   * Estimate tokens from request (rough approximation)
   */
  private estimateTokens(request: AgentRequest): number {
    // Rough estimate: 1 token ≈ 4 characters
    const promptTokens = Math.ceil(request.prompt.length / 4);
    // Assume response is similar length to prompt (conservative)
    return promptTokens * 2;
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
