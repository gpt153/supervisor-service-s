/**
 * Claude Code CLI Adapter
 *
 * Adapter for executing tasks using Claude Code CLI with automatic key rotation.
 * Best for: Complex tasks, architecture decisions, security-critical code.
 */

import { CLIAdapter } from './CLIAdapter.js';
import type { AgentRequest, AdapterConfig, AgentResult } from './types.js';
import { ClaudeKeyManager } from './ClaudeKeyManager.js';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Default configuration for Claude CLI
 */
const DEFAULT_CONFIG: AdapterConfig = {
  enabled: true,
  cliCommand: '/home/samuel/.local/bin/claude',
  defaultTimeout: 120000, // 120 seconds (Claude agents take 60-90s typically)
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
   * For large prompts, uses stdin to avoid command line limits
   */
  async execute(request: AgentRequest): Promise<AgentResult> {
    // Check if API key is available in environment
    if (!process.env.ANTHROPIC_API_KEY && request.prompt.length > 10000) {
      // Only warn for very large prompts that might fail
      console.warn('[ClaudeCLIAdapter] Large prompt without API key - may hit CLI limits');
    }

    // For large prompts, use stdin instead of -p to avoid command line limits
    if (request.prompt.length > 2048) {
      return this.executeWithStdin(request);
    }

    // Small prompts - use parent's execute
    return await super.execute(request);
  }

  /**
   * Execute Claude CLI with stdin for large prompts
   * Uses spawn() instead of shell pipes to prevent orphaned processes
   */
  private async executeWithStdin(request: AgentRequest): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const timeout = request.timeout ?? this.config.defaultTimeout;
      const env = await this.getEnvironment();

      // Spawn Claude process directly (no shell pipes)
      const proc = spawn(this.config.cliCommand, ['--dangerously-skip-permissions'], {
        cwd: request.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true, // Create new process group for proper cleanup
      });

      // Set up timeout with SIGKILL (force kill)
      let timeoutId: NodeJS.Timeout | null = null;
      let timedOut = false;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          // Kill entire process group to ensure all child processes die
          if (proc.pid) {
            try {
              // Kill entire process group (negative PID)
              process.kill(-proc.pid, 'SIGKILL');
            } catch (err) {
              // Process group kill failed, try killing just the child
              try {
                proc.kill('SIGKILL');
              } catch {
                console.warn('[ClaudeCLIAdapter] Failed to kill process:', err);
              }
            }
          } else {
            // PID not available, try killing the process directly
            try {
              proc.kill('SIGKILL');
            } catch {
              console.warn('[ClaudeCLIAdapter] Failed to kill process (no PID)');
            }
          }
          reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);
      });

      // Write prompt to stdin and close
      proc.stdin.write(request.prompt);
      proc.stdin.end();

      // Collect output
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Wait for process to exit or timeout
      const exitPromise = new Promise<number>((resolve, reject) => {
        proc.on('exit', (code) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(code ?? 0);
        });
        proc.on('error', (err) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(err);
        });
      });

      // Race between completion and timeout
      const exitCode = await Promise.race([exitPromise, timeoutPromise]);

      if (timedOut) {
        throw new Error(`Command timed out after ${timeout}ms`);
      }

      const duration = Date.now() - startTime;
      const output = this.parseOutput(stdout, request.outputFormat ?? 'json');

      if (stderr && this.isErrorOutput(stderr)) {
        return this.createErrorResult(stderr, duration);
      }

      if (exitCode !== 0) {
        return this.createErrorResult(`Process exited with code ${exitCode}`, duration);
      }

      return {
        success: true,
        agent: this.agentType,
        output,
        rawOutput: stdout,
        duration,
        cost: this.estimateCost(request, duration),
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResult(errorMessage, duration);
    }
  }

  /**
   * Build Claude CLI command (for small prompts only)
   */
  protected buildCommand(request: AgentRequest): string {
    const parts = [this.config.cliCommand];

    // Add dangerously-skip-permissions for automated execution
    parts.push('--dangerously-skip-permissions');

    // Add prompt (only for small prompts - large ones use stdin)
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
