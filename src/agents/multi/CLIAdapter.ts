/**
 * Base CLI Adapter
 *
 * Abstract base class for all CLI agent adapters.
 * Provides common functionality for executing CLI commands,
 * parsing outputs, and handling errors.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  AgentType,
  AgentRequest,
  AgentResult,
  AdapterConfig,
} from './types.js';

const execAsync = promisify(exec);

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
    try {
      const { stdout } = await execAsync(`which ${this.config.cliCommand}`);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
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
   * Execute command with proper error handling
   */
  protected async executeCommand(
    command: string,
    options: { cwd?: string; timeout?: number; env?: Record<string, string> }
  ): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execAsync(command, {
        cwd: options.cwd,
        timeout: options.timeout,
        env: options.env,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
    } catch (error: any) {
      // Handle timeout errors
      if (error.killed && error.signal === 'SIGTERM') {
        throw new Error(`Command timed out after ${options.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Check if stderr output indicates an error
   * Can be overridden by subclasses
   */
  protected isErrorOutput(stderr: string): boolean {
    const errorIndicators = [
      'error:',
      'error',
      'failed',
      'exception',
      'fatal',
    ];
    const lowerStderr = stderr.toLowerCase();
    return errorIndicators.some((indicator) => lowerStderr.includes(indicator));
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
