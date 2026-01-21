/**
 * UsageMonitor - Collects and tracks usage across all AI services
 */

import { pool } from '../db/client.js';
import {
  UsageSnapshot,
  CreateUsageSnapshotParams,
  UsageStats,
} from '../types/monitoring.js';

export class UsageMonitor {
  /**
   * Collect daily usage snapshot for all services
   * This should be called at midnight UTC each day
   */
  async collectDailySnapshot(): Promise<void> {
    const services = ['claude', 'openai', 'gemini'];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    for (const service of services) {
      try {
        // Get current tier for the service
        const tierResult = await pool.query(
          `SELECT tier, quota_limit, quota_period FROM subscription_tiers
           WHERE service = $1 AND is_active = true
           ORDER BY started_at DESC LIMIT 1`,
          [service]
        );

        if (tierResult.rows.length === 0) {
          console.warn(`No active tier found for service: ${service}`);
          continue;
        }

        const { tier, quota_limit, quota_period } = tierResult.rows[0];

        // Get usage from service (stub for now - will integrate with actual APIs)
        const usage = await this.getUsageFromService(service);

        // Calculate cost
        const cost = this.calculateCost(service, tier, usage.tokens_used);

        // Calculate quota percentage
        const quota_percentage = quota_limit
          ? (usage.tokens_used / quota_limit) * 100
          : null;

        // Insert or update snapshot
        await pool.query(
          `INSERT INTO usage_snapshots (
            snapshot_date, service, tier, tokens_used, requests_made,
            cost_usd, overage_cost, quota_percentage, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (snapshot_date, service)
          DO UPDATE SET
            tokens_used = $4,
            requests_made = $5,
            cost_usd = $6,
            overage_cost = $7,
            quota_percentage = $8,
            metadata = $9`,
          [
            today,
            service,
            tier,
            usage.tokens_used,
            usage.requests_made,
            cost.total,
            cost.overage,
            quota_percentage,
            JSON.stringify(usage.metadata || {}),
          ]
        );

        console.log(`✅ Snapshot collected for ${service}: ${usage.tokens_used} tokens, $${cost.total.toFixed(2)}`);
      } catch (error) {
        console.error(`Failed to collect snapshot for ${service}:`, error);
      }
    }
  }

  /**
   * Get usage data from external service API
   * This is a stub - will be implemented with actual API integrations
   */
  private async getUsageFromService(service: string): Promise<{
    tokens_used: number;
    requests_made: number;
    metadata?: Record<string, any>;
  }> {
    // TODO: Integrate with actual service APIs
    // For now, return stub data or get from database logs

    switch (service) {
      case 'claude':
        return this.getClaudeUsage();
      case 'openai':
        return this.getOpenAIUsage();
      case 'gemini':
        return this.getGeminiUsage();
      default:
        return { tokens_used: 0, requests_made: 0 };
    }
  }

  /**
   * Get Claude usage from API or database logs
   */
  private async getClaudeUsage(): Promise<{
    tokens_used: number;
    requests_made: number;
    metadata?: Record<string, any>;
  }> {
    // Stub: Could integrate with Claude API usage endpoint
    // Or aggregate from agent_executions table if available
    const result = await pool.query(
      `SELECT
        COUNT(*) as requests_made,
        COALESCE(SUM(CAST(metadata->>'tokens' AS INTEGER)), 0) as tokens_used
       FROM agent_executions
       WHERE agent_type = 'claude'
       AND created_at >= CURRENT_DATE
       AND created_at < CURRENT_DATE + INTERVAL '1 day'`
    );

    return {
      tokens_used: parseInt(result.rows[0]?.tokens_used || '0'),
      requests_made: parseInt(result.rows[0]?.requests_made || '0'),
    };
  }

  /**
   * Get OpenAI usage
   */
  private async getOpenAIUsage(): Promise<{
    tokens_used: number;
    requests_made: number;
  }> {
    // Stub: Would integrate with OpenAI usage API
    return { tokens_used: 0, requests_made: 0 };
  }

  /**
   * Get Gemini usage from key rotation logs
   */
  private async getGeminiUsage(): Promise<{
    tokens_used: number;
    requests_made: number;
  }> {
    const result = await pool.query(
      `SELECT
        COUNT(*) as requests_made,
        COALESCE(SUM(tokens_used), 0) as total_tokens
       FROM gemini_key_usage_log
       WHERE created_at >= CURRENT_DATE
       AND created_at < CURRENT_DATE + INTERVAL '1 day'`
    );

    return {
      tokens_used: parseInt(result.rows[0]?.total_tokens || '0'),
      requests_made: parseInt(result.rows[0]?.requests_made || '0'),
    };
  }

  /**
   * Calculate cost for a service based on usage
   */
  private calculateCost(
    service: string,
    tier: string,
    tokensUsed: number
  ): { total: number; overage: number } {
    // Stub - will be moved to CostCalculator class
    // For now, return basic calculation
    return { total: 0, overage: 0 };
  }

  /**
   * Get usage statistics for a service over a period
   */
  async getUsageStats(service: string, since: Date): Promise<UsageStats> {
    const result = await pool.query(
      `SELECT
        $1 as service,
        MIN(snapshot_date) as period_start,
        MAX(snapshot_date) as period_end,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        COALESCE(SUM(requests_made), 0) as total_requests,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COALESCE(SUM(overage_cost), 0) as total_overage,
        COALESCE(AVG(tokens_used), 0) as avg_daily_tokens,
        COALESCE(AVG(quota_percentage), 0) as avg_quota_percentage,
        COALESCE(MAX(tokens_used), 0) as peak_day_tokens,
        (
          SELECT snapshot_date
          FROM usage_snapshots
          WHERE service = $1 AND snapshot_date >= $2
          ORDER BY tokens_used DESC
          LIMIT 1
        ) as peak_day_date,
        COUNT(*) FILTER (WHERE tokens_used > 0) as days_with_usage,
        COUNT(*) FILTER (WHERE tokens_used = 0) as days_with_zero_usage
      FROM usage_snapshots
      WHERE service = $1 AND snapshot_date >= $2`,
      [service, since]
    );

    const row = result.rows[0];

    return {
      service: row.service,
      period_start: new Date(row.period_start),
      period_end: new Date(row.period_end),
      total_tokens: parseInt(row.total_tokens),
      total_requests: parseInt(row.total_requests),
      total_cost: parseFloat(row.total_cost),
      total_overage: parseFloat(row.total_overage),
      avg_daily_tokens: parseFloat(row.avg_daily_tokens),
      avg_quota_percentage: row.avg_quota_percentage ? parseFloat(row.avg_quota_percentage) : null,
      peak_day_tokens: parseInt(row.peak_day_tokens),
      peak_day_date: row.peak_day_date ? new Date(row.peak_day_date) : null,
      days_with_usage: parseInt(row.days_with_usage),
      days_with_zero_usage: parseInt(row.days_with_zero_usage),
    };
  }

  /**
   * Get all usage snapshots for a service
   */
  async getSnapshots(
    service: string,
    since?: Date,
    limit?: number
  ): Promise<UsageSnapshot[]> {
    const params: any[] = [service];
    let query = `
      SELECT * FROM usage_snapshots
      WHERE service = $1
    `;

    if (since) {
      params.push(since);
      query += ` AND snapshot_date >= $${params.length}`;
    }

    query += ` ORDER BY snapshot_date DESC`;

    if (limit) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      snapshot_date: new Date(row.snapshot_date),
      service: row.service,
      tier: row.tier,
      tokens_used: parseInt(row.tokens_used),
      requests_made: row.requests_made,
      cost_usd: parseFloat(row.cost_usd),
      overage_cost: parseFloat(row.overage_cost),
      quota_percentage: row.quota_percentage ? parseFloat(row.quota_percentage) : null,
      metadata: row.metadata,
      created_at: new Date(row.created_at),
    }));
  }

  /**
   * Manually create a usage snapshot
   */
  async createSnapshot(params: CreateUsageSnapshotParams): Promise<number> {
    const result = await pool.query(
      `INSERT INTO usage_snapshots (
        snapshot_date, service, tier, tokens_used, requests_made,
        cost_usd, overage_cost, quota_percentage, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        params.snapshot_date,
        params.service,
        params.tier,
        params.tokens_used,
        params.requests_made,
        params.cost_usd,
        params.overage_cost,
        params.quota_percentage || null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Get usage summary across all services for a period
   */
  async getUsageSummary(since: Date): Promise<{
    period_start: Date;
    period_end: Date;
    total_cost: number;
    by_service: UsageStats[];
  }> {
    const services = ['claude', 'openai', 'gemini'];
    const stats = await Promise.all(
      services.map(service => this.getUsageStats(service, since))
    );

    const total_cost = stats.reduce((sum, s) => sum + s.total_cost, 0);

    return {
      period_start: since,
      period_end: new Date(),
      total_cost,
      by_service: stats,
    };
  }
}
