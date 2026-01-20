/**
 * Quota Manager
 *
 * Tracks and manages quota usage for each AI agent.
 * Handles quota refresh, availability checks, and usage updates.
 * For Gemini, integrates with per-key quota tracking.
 */

import { pool } from '../../db/client.js';
import type { AgentType, QuotaStatus } from './types.js';
import { GeminiKeyManager } from './GeminiKeyManager.js';

/**
 * Quota manager
 */
export class QuotaManager {
  private geminiKeyManager: GeminiKeyManager;

  constructor() {
    this.geminiKeyManager = new GeminiKeyManager();
  }
  /**
   * Get quota status for all agents
   */
  async getAllQuotas(): Promise<QuotaStatus[]> {
    const result = await pool.query(`
      SELECT
        agent_type as "agentType",
        remaining,
        "limit",
        resets_at as "resetsAt",
        available,
        last_updated as "lastUpdated"
      FROM agent_quota_status
      ORDER BY agent_type
    `);

    return result.rows.map((row) => ({
      agent: row.agentType as AgentType,
      remaining: row.remaining,
      limit: row.limit,
      resetsAt: new Date(row.resetsAt),
      available: row.available,
      lastUpdated: new Date(row.lastUpdated),
    }));
  }

  /**
   * Get quota status for specific agent
   */
  async getQuota(agent: AgentType): Promise<QuotaStatus | null> {
    const result = await pool.query(
      `
      SELECT
        agent_type as "agentType",
        remaining,
        "limit",
        resets_at as "resetsAt",
        available,
        last_updated as "lastUpdated"
      FROM agent_quota_status
      WHERE agent_type = $1
    `,
      [agent]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      agent: row.agentType as AgentType,
      remaining: row.remaining,
      limit: row.limit,
      resetsAt: new Date(row.resetsAt),
      available: row.available,
      lastUpdated: new Date(row.lastUpdated),
    };
  }

  /**
   * Check if agent has available quota
   * For Gemini, checks if ANY API key has remaining quota
   */
  async hasQuota(agent: AgentType): Promise<boolean> {
    // For Gemini, check per-key quotas
    if (agent === 'gemini') {
      const availableKey = await this.geminiKeyManager.getNextAvailableKey();
      return availableKey !== null;
    }

    // For other agents, check global quota
    await this.refreshQuotaIfNeeded(agent);

    const quota = await this.getQuota(agent);
    if (!quota) {
      return false;
    }

    return quota.available && quota.remaining > 0;
  }

  /**
   * Decrement quota for agent
   */
  async decrementQuota(agent: AgentType, amount: number = 1): Promise<void> {
    await pool.query(
      `
      UPDATE agent_quota_status
      SET
        remaining = GREATEST(0, remaining - $2),
        last_updated = NOW()
      WHERE agent_type = $1
    `,
      [agent, amount]
    );
  }

  /**
   * Increment quota for agent (for refunds/corrections)
   */
  async incrementQuota(agent: AgentType, amount: number = 1): Promise<void> {
    await pool.query(
      `
      UPDATE agent_quota_status
      SET
        remaining = LEAST("limit", remaining + $2),
        last_updated = NOW()
      WHERE agent_type = $1
    `,
      [agent, amount]
    );
  }

  /**
   * Refresh quota if reset time has passed
   */
  async refreshQuotaIfNeeded(agent: AgentType): Promise<boolean> {
    const quota = await this.getQuota(agent);
    if (!quota) {
      return false;
    }

    const now = new Date();
    if (now < quota.resetsAt) {
      return false; // Not time to refresh yet
    }

    // Calculate next reset time
    const resetHours = this.getResetHours(agent);
    const nextReset = new Date(now.getTime() + resetHours * 60 * 60 * 1000);

    // Reset quota to limit
    await pool.query(
      `
      UPDATE agent_quota_status
      SET
        remaining = "limit",
        resets_at = $2,
        last_updated = NOW()
      WHERE agent_type = $1
    `,
      [agent, nextReset]
    );

    return true;
  }

  /**
   * Force refresh quota for agent
   */
  async forceRefreshQuota(agent: AgentType): Promise<void> {
    const resetHours = this.getResetHours(agent);
    const nextReset = new Date(Date.now() + resetHours * 60 * 60 * 1000);

    await pool.query(
      `
      UPDATE agent_quota_status
      SET
        remaining = "limit",
        resets_at = $2,
        available = true,
        last_updated = NOW()
      WHERE agent_type = $1
    `,
      [agent, nextReset]
    );
  }

  /**
   * Set agent availability
   */
  async setAvailability(agent: AgentType, available: boolean): Promise<void> {
    await pool.query(
      `
      UPDATE agent_quota_status
      SET
        available = $2,
        last_updated = NOW()
      WHERE agent_type = $1
    `,
      [agent, available]
    );
  }

  /**
   * Update quota limit for agent
   */
  async updateLimit(agent: AgentType, newLimit: number): Promise<void> {
    await pool.query(
      `
      UPDATE agent_quota_status
      SET
        "limit" = $2,
        last_updated = NOW()
      WHERE agent_type = $1
    `,
      [agent, newLimit]
    );
  }

  /**
   * Get reset hours for agent type
   */
  private getResetHours(agent: AgentType): number {
    switch (agent) {
      case 'gemini':
        return 24; // Daily reset
      case 'codex':
        return 5; // 5-hour reset for ChatGPT Plus
      case 'claude':
        return 24; // Daily reset
      default:
        return 24;
    }
  }

  /**
   * Get agents with available quota, sorted by remaining quota (descending)
   */
  async getAvailableAgents(): Promise<AgentType[]> {
    // Refresh all quotas first
    await this.refreshAllQuotas();

    const result = await pool.query(`
      SELECT agent_type
      FROM agent_quota_status
      WHERE available = true AND remaining > 0
      ORDER BY remaining DESC
    `);

    return result.rows.map((row) => row.agent_type as AgentType);
  }

  /**
   * Refresh all quotas if needed
   */
  private async refreshAllQuotas(): Promise<void> {
    const agents: AgentType[] = ['gemini', 'codex', 'claude'];
    await Promise.all(agents.map((agent) => this.refreshQuotaIfNeeded(agent)));
  }

  /**
   * Get quota usage statistics
   */
  async getUsageStats(
    since?: Date
  ): Promise<Record<AgentType, { used: number; total: number }>> {
    const sinceClause = since ? 'AND created_at >= $1' : '';
    const params = since ? [since] : [];

    const result = await pool.query(
      `
      SELECT
        agent_type,
        COUNT(*) as used
      FROM agent_executions
      WHERE success = true ${sinceClause}
      GROUP BY agent_type
    `,
      params
    );

    // Get current limits
    const quotas = await this.getAllQuotas();
    const stats: Record<string, { used: number; total: number }> = {};

    for (const quota of quotas) {
      const usageRow = result.rows.find((r) => r.agent_type === quota.agent);
      stats[quota.agent] = {
        used: usageRow ? parseInt(usageRow.used) : 0,
        total: quota.limit,
      };
    }

    return stats as Record<AgentType, { used: number; total: number }>;
  }

  /**
   * Get detailed Gemini key usage statistics
   */
  async getGeminiKeyStats(since?: Date): Promise<{
    totalRequests: number;
    totalTokens: number;
    successRate: number;
    keyStats: Record<string, { requests: number; tokens: number; successRate: number }>;
  }> {
    return await this.geminiKeyManager.getUsageStats(since);
  }

  /**
   * Get all available Gemini keys
   */
  async getAvailableGeminiKeys() {
    return await this.geminiKeyManager.getAvailableKeys();
  }

  /**
   * Get all Gemini keys (including exhausted ones)
   */
  async getAllGeminiKeys() {
    return await this.geminiKeyManager.getAllKeys();
  }

  /**
   * Initialize Gemini keys from environment
   */
  async initializeGeminiKeys(): Promise<number> {
    return await this.geminiKeyManager.loadKeysFromEnv();
  }
}
