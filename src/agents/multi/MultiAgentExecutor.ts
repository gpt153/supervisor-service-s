/**
 * Multi-Agent Executor
 *
 * High-level executor that coordinates task routing and execution
 * across multiple AI CLI agents.
 */

import { AgentRouter } from './AgentRouter.js';
import { QuotaManager } from './QuotaManager.js';
import { ClaudeCLIAdapter } from './ClaudeCLIAdapter.js';
import { GeminiCLIAdapter } from './GeminiCLIAdapter.js';
import { CodexCLIAdapter } from './CodexCLIAdapter.js';
import type { TaskInfo } from './TaskClassifier.js';
import { pool } from '../../db/client.js';
import type {
  AgentType,
  AgentRequest,
  AgentResult,
  RoutingDecision,
} from './types.js';

/**
 * Multi-agent executor
 */
export class MultiAgentExecutor {
  private router: AgentRouter;
  private quotaManager: QuotaManager;
  private adapters: Map<
    AgentType,
    ClaudeCLIAdapter | GeminiCLIAdapter | CodexCLIAdapter
  >;

  constructor() {
    this.router = new AgentRouter();
    this.quotaManager = new QuotaManager();

    // Initialize adapters
    this.adapters = new Map();
    this.adapters.set('claude', new ClaudeCLIAdapter());
    this.adapters.set('gemini', new GeminiCLIAdapter());
    this.adapters.set('codex', new CodexCLIAdapter());
  }

  /**
   * Initialize all adapters (load API keys from vault)
   * Call this after construction to load keys
   */
  async initialize(): Promise<void> {
    console.log('[MultiAgentExecutor] Initializing CLI adapters...');

    for (const [agentType, adapter] of this.adapters) {
      try {
        await adapter.initialize();
        console.log(`[MultiAgentExecutor] ✅ ${agentType} adapter initialized`);
      } catch (error) {
        console.error(`[MultiAgentExecutor] ⚠️  Failed to initialize ${agentType} adapter:`, error);
      }
    }

    console.log('[MultiAgentExecutor] All adapters initialized');
  }

  /**
   * Execute a task with automatic agent routing
   */
  async execute(request: AgentRequest & TaskInfo): Promise<{
    result: AgentResult;
    routing: RoutingDecision;
  }> {
    // Route the task
    const routing = await this.router.route(request);

    // Execute with selected agent (with fallback)
    const result = await this.executeWithFallback(
      request,
      routing.selectedAgent,
      routing.fallbackAgents
    );

    // Link execution to routing decision
    await this.linkExecutionToRouting(result, routing);

    return { result, routing };
  }

  /**
   * Execute with specific agent (bypass routing)
   */
  async executeWithAgent(
    request: AgentRequest,
    agent: AgentType
  ): Promise<AgentResult> {
    const adapter = this.adapters.get(agent);
    if (!adapter) {
      throw new Error(`No adapter found for agent: ${agent}`);
    }

    // Execute
    const result = await adapter.execute(request);

    // Decrement quota if successful
    if (result.success) {
      await this.quotaManager.decrementQuota(agent);
    }

    // Log execution
    await this.logExecution(result);

    return result;
  }

  /**
   * Execute with fallback on failure
   */
  private async executeWithFallback(
    request: AgentRequest,
    primaryAgent: AgentType,
    fallbackAgents: AgentType[]
  ): Promise<AgentResult> {
    // Try primary agent
    try {
      const result = await this.executeWithAgent(request, primaryAgent);
      if (result.success) {
        return result;
      }

      // Primary failed, try fallbacks
      console.warn(
        `Primary agent ${primaryAgent} failed: ${result.error}. Trying fallbacks...`
      );
    } catch (error) {
      console.error(
        `Primary agent ${primaryAgent} threw error:`,
        error
      );
    }

    // Try each fallback in order
    for (const fallback of fallbackAgents) {
      try {
        const hasQuota = await this.quotaManager.hasQuota(fallback);
        if (!hasQuota) {
          console.warn(`Fallback agent ${fallback} has no quota. Skipping.`);
          continue;
        }

        console.log(`Attempting fallback with ${fallback}...`);
        const result = await this.executeWithAgent(request, fallback);
        if (result.success) {
          return result;
        }

        console.warn(`Fallback agent ${fallback} failed: ${result.error}`);
      } catch (error) {
        console.error(`Fallback agent ${fallback} threw error:`, error);
      }
    }

    // All agents failed
    return {
      success: false,
      agent: primaryAgent,
      output: null,
      rawOutput: '',
      error: 'All agents failed to execute task',
      duration: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Log execution to database
   */
  private async logExecution(result: AgentResult): Promise<number> {
    const queryResult = await pool.query(
      `
      INSERT INTO agent_executions (
        agent_type,
        task_type,
        complexity,
        success,
        duration_ms,
        cost,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `,
      [
        result.agent,
        null, // task_type will be filled from routing decision
        null, // complexity will be filled from routing decision
        result.success,
        result.duration,
        result.cost ?? 0,
        result.error ?? null,
      ]
    );

    return queryResult.rows[0].id;
  }

  /**
   * Link execution to routing decision
   */
  private async linkExecutionToRouting(
    result: AgentResult,
    routing: RoutingDecision
  ): Promise<void> {
    try {
      // First log the execution
      const executionId = await this.logExecution(result);

      // Update the routing decision with execution ID and task details
      await pool.query(
        `
        UPDATE agent_routing_decisions
        SET
          execution_id = $1,
          task_type = $2,
          complexity = $3
        WHERE id = (
          SELECT id
          FROM agent_routing_decisions
          WHERE selected_agent = $4
          ORDER BY created_at DESC
          LIMIT 1
        )
      `,
        [
          executionId,
          routing.classification.type,
          routing.classification.complexity,
          routing.selectedAgent,
        ]
      );
    } catch (error) {
      console.error('Failed to link execution to routing:', error);
    }
  }

  /**
   * Check health of all agents
   */
  async checkAgentHealth(): Promise<
    Record<AgentType, { available: boolean; hasQuota: boolean }>
  > {
    const health: Record<string, { available: boolean; hasQuota: boolean }> =
      {};

    for (const [agent, adapter] of this.adapters) {
      const available = await adapter.checkAvailability();
      const hasQuota = await this.quotaManager.hasQuota(agent as AgentType);

      health[agent] = { available, hasQuota };
    }

    return health as Record<
      AgentType,
      { available: boolean; hasQuota: boolean }
    >;
  }

  /**
   * Get quota manager
   */
  getQuotaManager(): QuotaManager {
    return this.quotaManager;
  }

  /**
   * Get router
   */
  getRouter(): AgentRouter {
    return this.router;
  }
}
