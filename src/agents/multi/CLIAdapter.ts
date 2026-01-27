/**
 * Base CLI Adapter
 *
 * Abstract base class for all CLI agent adapters.
 * Provides common functionality for executing CLI commands,
 * parsing outputs, and handling errors.
 */

import { spawn } from 'child_process';
import type {
  AgentType,
  AgentRequest,
  AgentResult,
  AdapterConfig,
} from './types.js';

/**
 * Abstract base class for CLI adapters
 */
export abstract class CLIAdapter {
  protected config: AdapterConfig;
  protected agentType: AgentType;

  constructor(agentType: AgentType, config: AdapterConfig) {
    this.agentType = agentType;
    this.config = config;
  }

  /**
   * Execute a request with this CLI adapter
   */
  async execute(request: AgentRequest): Promise<AgentResult> {
    if (!this.config.enabled) {
      return this.createErrorResult(
        `${this.agentType} adapter is disabled`,
        0
      );
    }

    const startTime = Date.now();

    try {
      // Build CLI command
      const command = this.buildCommand(request);

      // Execute with timeout
      const timeout = request.timeout ?? this.config.defaultTimeout;
      const { stdout, stderr } = await this.executeCommand(command, {
        cwd: request.cwd,
        timeout,
      });

      const duration = Date.now() - startTime;

      // Parse output
      const output = this.parseOutput(stdout, request.outputFormat ?? 'json');

      // Check for errors in stderr
      if (stderr && this.isErrorOutput(stderr)) {
        return this.createErrorResult(stderr, duration);
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResult(errorMessage, duration);
    }
  }

  /**
   * Check if CLI is installed and available
   */
  async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('which', [this.config.cliCommand]);
      child.on('exit', (code) => {
        resolve(code === 0);
      });
      child.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): AdapterConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AdapterConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Build CLI command for execution
   * Must be implemented by subclasses
   */
  protected abstract buildCommand(request: AgentRequest): string;

  /**
   * Parse output from CLI
   * Can be overridden by subclasses for custom parsing
   */
  protected parseOutput(
    output: string,
    format: 'json' | 'text' | 'markdown'
  ): any {
    if (format === 'json') {
      try {
        return JSON.parse(output);
      } catch (error) {
        // Try to extract JSON from output
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch {
            throw new Error('Failed to parse JSON from output');
          }
        }
        throw new Error('No valid JSON found in output');
      }
    }
    return output;
  }

  /**
   * Execute command with proper error handling using spawn() instead of exec()
   * This provides better control over child processes and prevents orphaned processes
   */
  protected async executeCommand(
    command: string,
    options: { cwd?: string; timeout?: number; env?: Record<string, string>; stdin?: string }
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // Parse command into program and args
      const parts = this.parseCommand(command);
      const program = parts[0];
      const args = parts.slice(1);

      // Spawn child process
      const child = spawn(program, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: options.stdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
        detached: true, // Create new process group for proper cleanup
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let timeoutHandle: NodeJS.Timeout | null = null;

      // Collect stdout (null check for TypeScript)
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      // Collect stderr (null check for TypeScript)
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      // Handle timeout with SIGKILL
      if (options.timeout) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          // Use SIGKILL to ensure process dies immediately
          // Also kill entire process group to prevent orphaned processes
          if (child.pid) {
            try {
              // Kill entire process group (negative PID)
              process.kill(-child.pid, 'SIGKILL');
            } catch (err) {
              // Process group kill failed, try killing just the child
              try {
                child.kill('SIGKILL');
              } catch {
                // Process already dead or cannot be killed
                console.warn('[CLIAdapter] Failed to kill process:', err);
              }
            }
          } else {
            // PID not available, try killing the child directly
            try {
              child.kill('SIGKILL');
            } catch {
              console.warn('[CLIAdapter] Failed to kill process (no PID)');
            }
          }
        }, options.timeout);
      }

      // Handle process exit
      child.on('exit', (code, signal) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        if (timedOut) {
          reject(new Error(`Command timed out after ${options.timeout}ms`));
        } else if (code !== 0 && code !== null) {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      // Handle spawn errors
      child.on('error', (error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        reject(error);
      });

      // Write stdin if provided
      if (options.stdin && child.stdin) {
        child.stdin.write(options.stdin);
        child.stdin.end();
      }
    });
  }

  /**
   * Parse command string into program and arguments
   * Handles quoted strings and escaping
   */
  private parseCommand(command: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    let escaping = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (escaping) {
        current += char;
        escaping = false;
        continue;
      }

      if (char === '\\') {
        escaping = true;
        continue;
      }

      if (char === '"' || char === "'") {
        if (!inQuote) {
          inQuote = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuote = false;
          quoteChar = '';
        } else {
          current += char;
        }
        continue;
      }

      if (char === ' ' && !inQuote) {
        if (current) {
          parts.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Check if stderr output indicates an error
   * Can be overridden by subclasses
   *
   * NOTE: Only treat stderr as error if it contains specific error patterns.
   * Many CLI tools write informational messages or warnings to stderr
   * that don't indicate task failure.
   */
  protected isErrorOutput(stderr: string): boolean {
    // Only treat as error if stderr contains these specific patterns
    // (not just the words "error" or "failed" which could be in warnings)
    const errorPatterns = [
      /^Error:/im,           // Lines starting with "Error:"
      /fatal error/i,        // Fatal errors
      /exception:/i,         // Exception messages with colon
      /command not found/i,  // Command execution failures
      /permission denied/i,  // Permission errors
      /cannot /i,            // "Cannot execute", "Cannot access", etc.
    ];

    return errorPatterns.some((pattern) => pattern.test(stderr));
  }

  /**
   * Estimate cost for execution
   * Can be overridden by subclasses with actual cost calculation
   */
  protected estimateCost(request: AgentRequest, duration: number): number {
    // Default: subscription-included = $0
    // Subclasses can override if they use paid APIs
    return 0;
  }

  /**
   * Escape string for shell command
   */
  protected escapeShellArg(arg: string): string {
    // Replace single quotes with '\'' and wrap in single quotes
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Create error result
   */
  protected createErrorResult(error: string, duration: number): AgentResult {
    return {
      success: false,
      agent: this.agentType,
      output: null,
      rawOutput: '',
      error,
      duration,
      timestamp: new Date(),
    };
  }
}
