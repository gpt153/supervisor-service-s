/**
 * Agent Router
 *
 * Routes tasks to the optimal AI agent based on:
 * - Task complexity classification
 * - Agent quota availability
 * - Agent specialization
 * - Fallback logic
 */

import { TaskClassifier, type TaskInfo } from './TaskClassifier.js';
import { QuotaManager } from './QuotaManager.js';
import { pool } from '../../db/client.js';
import type {
  AgentType,
  ComplexityLevel,
  TaskType,
  RoutingDecision,
  QuotaStatus,
} from './types.js';

/**
 * Agent routing preferences by task type
 */
const TASK_TYPE_PREFERENCES: Record<TaskType, AgentType[]> = {
  documentation: ['gemini', 'codex', 'claude'],
  'test-generation': ['gemini', 'codex', 'claude'],
  boilerplate: ['gemini', 'codex', 'claude'],
  'bug-fix': ['codex', 'gemini', 'claude'],
  'api-implementation': ['codex', 'claude', 'gemini'],
  refactoring: ['codex', 'claude', 'gemini'],
  architecture: ['claude', 'codex', 'gemini'],
  security: ['claude'], // No fallback for security-critical
  algorithm: ['claude', 'codex', 'gemini'],
  research: ['gemini', 'claude', 'codex'],
  unknown: ['claude', 'codex', 'gemini'],
};

/**
 * Agent preferences by complexity
 */
const COMPLEXITY_PREFERENCES: Record<ComplexityLevel, AgentType[]> = {
  simple: ['gemini', 'codex', 'claude'],
  medium: ['codex', 'claude', 'gemini'],
  complex: ['claude', 'codex', 'gemini'],
};

/**
 * Agent router
 */
export class AgentRouter {
  private classifier: TaskClassifier;
  private quotaManager: QuotaManager;

  constructor() {
    this.classifier = new TaskClassifier();
    this.quotaManager = new QuotaManager();
  }

  /**
   * Route a task to the best available agent
   */
  async route(task: TaskInfo): Promise<RoutingDecision> {
    // Classify the task
    const classification = this.classifier.classify(task);

    // Get quota status for all agents
    const quotaStatus = await this.quotaManager.getAllQuotas();

    // Select best agent
    const { selectedAgent, reason, fallbackAgents } = await this.selectAgent(
      classification,
      quotaStatus
    );

    // Log routing decision
    await this.logRoutingDecision({
      selectedAgent,
      reason,
      classification,
      quotaStatus,
      fallbackAgents,
    });

    return {
      selectedAgent,
      reason,
      classification,
      quotaStatus,
      fallbackAgents,
    };
  }

  /**
   * Select the best agent for a classified task
   */
  private async selectAgent(
    classification: {
      complexity: ComplexityLevel;
      type: TaskType;
      securityCritical: boolean;
    },
    quotaStatus: QuotaStatus[]
  ): Promise<{
    selectedAgent: AgentType;
    reason: string;
    fallbackAgents: AgentType[];
  }> {
    const { complexity, type, securityCritical } = classification;

    // Security-critical tasks MUST use Claude
    if (securityCritical) {
      const claudeAvailable = await this.quotaManager.hasQuota('claude');
      if (!claudeAvailable) {
        return {
          selectedAgent: 'claude',
          reason:
            'Security-critical task requires Claude (forced despite quota)',
          fallbackAgents: [],
        };
      }
      return {
        selectedAgent: 'claude',
        reason: 'Security-critical task requires Claude',
        fallbackAgents: [],
      };
    }

    // Get preferred agents for this task type
    const typePreferences = TASK_TYPE_PREFERENCES[type] || ['claude'];

    // Get preferred agents for this complexity
    const complexityPreferences = COMPLEXITY_PREFERENCES[complexity];

    // Merge preferences (type takes priority)
    const preferences = this.mergePreferences(
      typePreferences,
      complexityPreferences
    );

    // Try each preference in order
    for (const agent of preferences) {
      const hasQuota = await this.quotaManager.hasQuota(agent);
      if (hasQuota) {
        // Found available agent
        const fallbackAgents = preferences
          .slice(preferences.indexOf(agent) + 1)
          .filter(async (a) => await this.quotaManager.hasQuota(a));

        return {
          selectedAgent: agent,
          reason: `Best match for ${type} (${complexity}) with quota available`,
          fallbackAgents,
        };
      }
    }

    // No preferred agents available - try any available agent
    const availableAgents = await this.quotaManager.getAvailableAgents();
    if (availableAgents.length > 0) {
      const agent = availableAgents[0];
      return {
        selectedAgent: agent,
        reason: `Fallback: ${agent} is available (preferred agents exhausted)`,
        fallbackAgents: availableAgents.slice(1),
      };
    }

    // No agents available - default to Claude (will use quota anyway)
    return {
      selectedAgent: 'claude',
      reason: 'No agents have quota - using Claude as fallback',
      fallbackAgents: [],
    };
  }

  /**
   * Merge preference lists, prioritizing the first list
   */
  private mergePreferences(
    primary: AgentType[],
    secondary: AgentType[]
  ): AgentType[] {
    const merged = [...primary];
    for (const agent of secondary) {
      if (!merged.includes(agent)) {
        merged.push(agent);
      }
    }
    return merged;
  }

  /**
   * Log routing decision to database
   */
  private async logRoutingDecision(
    decision: RoutingDecision
  ): Promise<void> {
    try {
      await pool.query(
        `
        INSERT INTO agent_routing_decisions (
          selected_agent,
          reason,
          task_type,
          complexity,
          confidence,
          fallback_agents
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          decision.selectedAgent,
          decision.reason,
          decision.classification.type,
          decision.classification.complexity,
          decision.classification.confidence,
          decision.fallbackAgents,
        ]
      );
    } catch (error) {
      console.error('Failed to log routing decision:', error);
    }
  }

  /**
   * Get routing statistics
   */
  async getRoutingStats(since?: Date): Promise<{
    totalDecisions: number;
    decisionsByAgent: Record<AgentType, number>;
    decisionsByComplexity: Record<ComplexityLevel, number>;
    averageConfidence: number;
  }> {
    const sinceClause = since ? 'WHERE created_at >= $1' : '';
    const params = since ? [since] : [];

    // Total decisions
    const totalResult = await pool.query(
      `SELECT COUNT(*) as count FROM agent_routing_decisions ${sinceClause}`,
      params
    );
    const totalDecisions = parseInt(totalResult.rows[0]?.count || '0');

    // Decisions by agent
    const agentResult = await pool.query(
      `
      SELECT selected_agent, COUNT(*) as count
      FROM agent_routing_decisions ${sinceClause}
      GROUP BY selected_agent
    `,
      params
    );
    const decisionsByAgent: Record<string, number> = {};
    for (const row of agentResult.rows) {
      decisionsByAgent[row.selected_agent] = parseInt(row.count);
    }

    // Decisions by complexity
    const complexityResult = await pool.query(
      `
      SELECT complexity, COUNT(*) as count
      FROM agent_routing_decisions ${sinceClause}
      GROUP BY complexity
    `,
      params
    );
    const decisionsByComplexity: Record<string, number> = {};
    for (const row of complexityResult.rows) {
      decisionsByComplexity[row.complexity] = parseInt(row.count);
    }

    // Average confidence
    const confidenceResult = await pool.query(
      `SELECT AVG(confidence) as avg FROM agent_routing_decisions ${sinceClause}`,
      params
    );
    const averageConfidence = parseFloat(
      confidenceResult.rows[0]?.avg || '0'
    );

    return {
      totalDecisions,
      decisionsByAgent: decisionsByAgent as Record<AgentType, number>,
      decisionsByComplexity: decisionsByComplexity as Record<
        ComplexityLevel,
        number
      >,
      averageConfidence,
    };
  }

  /**
   * Force specific agent selection (bypass routing logic)
   */
  async forceAgent(agent: AgentType, task: TaskInfo): Promise<RoutingDecision> {
    const classification = this.classifier.classify(task);
    const quotaStatus = await this.quotaManager.getAllQuotas();

    const decision: RoutingDecision = {
      selectedAgent: agent,
      reason: 'Forced agent selection (manual override)',
      classification,
      quotaStatus,
      fallbackAgents: [],
    };

    await this.logRoutingDecision(decision);
    return decision;
  }
}
