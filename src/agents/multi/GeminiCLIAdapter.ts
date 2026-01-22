/**
 * Gemini CLI Adapter
 *
 * Adapter for executing tasks using Gemini CLI with automatic key rotation.
 * Best for: Documentation, simple tasks, research, high-volume quota (1M tokens/day per key).
 */

import { CLIAdapter } from './CLIAdapter.js';
import type { AgentRequest, AdapterConfig, AgentResult } from './types.js';
import { GeminiKeyManager } from './GeminiKeyManager.js';

/**
 * Default configuration for Gemini CLI
 */
const DEFAULT_CONFIG: AdapterConfig = {
  enabled: true,
  cliCommand: 'gemini',
  defaultTimeout: 180000, // 3 minutes
  quotaLimit: 1000000, // 1M tokens per day per key
  quotaResetHours: 24,
};

/**
 * Gemini CLI adapter with automatic key rotation
 */
export class GeminiCLIAdapter extends CLIAdapter {
  private keyManager: GeminiKeyManager;
  private currentKeyId: number | null = null;

  constructor(config: Partial<AdapterConfig> = {}) {
    super('gemini', { ...DEFAULT_CONFIG, ...config });
    this.keyManager = new GeminiKeyManager();
  }

  /**
   * Initialize (check for API key in environment)
   */
  async initialize(): Promise<void> {
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      console.log(`[GeminiCLIAdapter] ✅ Gemini API key found in environment`);
    } else {
      console.log(`[GeminiCLIAdapter] ⚠️  No Gemini API key in environment`);
    }
  }

  /**
   * Execute using API key from environment variables
   */
  async execute(request: AgentRequest): Promise<AgentResult> {
    // Check if API key is available in environment
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      return {
        success: false,
        agent: this.agentType,
        output: null,
        error: 'No Gemini API key found in environment (set GEMINI_API_KEY or GOOGLE_API_KEY)',
        duration: 0,
        tokensUsed: 0,
        cost: 0,
        timestamp: new Date(),
      };
    }

    // Execute with environment API key
    return await super.execute(request);
  }

  /**
   * Build Gemini CLI command with API key
   *
   * Format: GEMINI_API_KEY=xxx gemini -p "<prompt>" --output-format json
   */
  protected buildCommand(request: AgentRequest): string {
    const parts = [this.config.cliCommand];

    // Add prompt
    parts.push('-p', this.escapeShellArg(request.prompt));

    // Add model (use gemini-2.5-flash - has quota on paid accounts)
    parts.push('--model', 'gemini-2.5-flash');

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

    // Disable gcloud Application Default Credentials
    // Gemini CLI checks gcloud first, we want it to use API key instead
    delete env.GOOGLE_APPLICATION_CREDENTIALS;
    delete env.CLOUDSDK_CONFIG;
    // Disable gcloud auth by pointing to non-existent config
    env.CLOUDSDK_ACTIVE_CONFIG_NAME = 'nonexistent-to-disable-gcloud';

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
   * Gemini may include thinking process or metadata
   * Extract clean output
   */
  protected parseOutput(
    output: string,
    format: 'json' | 'text' | 'markdown'
  ): any {
    if (format === 'json') {
      // Try to find JSON in output
      // Gemini might wrap it in markdown or include extra text
      const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          // Fall through
        }
      }

      // Try to find standalone JSON object
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
   * Gemini error detection
   */
  protected isErrorOutput(stderr: string): boolean {
    const errorMarkers = [
      'Error:',
      'Failed:',
      'Exception:',
      'API error',
      'Rate limit',
      'Quota exceeded',
    ];
    return errorMarkers.some((marker) => stderr.includes(marker));
  }

  /**
   * Estimate cost for Gemini execution
   * Gemini Pro subscription is prepaid, so cost = 0 for quota-included usage
   */
  protected estimateCost(request: AgentRequest, duration: number): number {
    // Subscription-included
    return 0;
  }
}
