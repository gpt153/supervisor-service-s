/**
 * CostCalculator - Calculates costs for AI service usage
 */

import { pool } from '../db/client.js';
import { ServiceCostBreakdown, TotalCostBreakdown, TierComparison } from '../types/monitoring.js';

export class CostCalculator {
  /**
   * Tier pricing configurations
   * Source: Actual pricing from service websites
   */
  private readonly TIER_CONFIGS = {
    claude: {
      free: {
        monthly_cost: 0,
        quota_limit: 50000, // 50K tokens per month
        quota_period: 'monthly',
        overage_rate: 0.015, // $15 per 1M tokens
      },
      pro: {
        monthly_cost: 20,
        quota_limit: 2000000, // 2M tokens per month
        quota_period: 'monthly',
        overage_rate: 0.015,
      },
      max: {
        monthly_cost: 200,
        quota_limit: 500000, // 500K tokens per 5-hour rolling window
        quota_period: '5-hours',
        overage_rate: 0.015,
      },
    },
    openai: {
      free: {
        monthly_cost: 0,
        quota_limit: null, // Limited by message count, not tokens
        quota_period: 'monthly',
        overage_rate: 0,
      },
      'chatgpt-plus': {
        monthly_cost: 20,
        quota_limit: null, // Unlimited within reasonable use
        quota_period: 'monthly',
        overage_rate: 0,
      },
    },
    gemini: {
      free: {
        monthly_cost: 0,
        quota_limit: 1000000, // 1M tokens per day
        quota_period: 'daily',
        overage_rate: 0, // Hard limit, no overages
      },
    },
  };

  /**
   * Calculate Claude cost based on tier and usage
   */
  calculateClaudeCost(
    tokensUsed: number,
    tier: 'free' | 'pro' | 'max'
  ): { total: number; base: number; overage: number } {
    const config = this.TIER_CONFIGS.claude[tier];

    const base = config.monthly_cost;
    const overageTokens = Math.max(0, tokensUsed - config.quota_limit);
    const overage = (overageTokens / 1000000) * config.overage_rate * 1000000; // $15 per 1M tokens

    return {
      total: base + overage,
      base,
      overage,
    };
  }

  /**
   * Calculate OpenAI cost
   */
  calculateOpenAICost(
    tokensUsed: number,
    tier: 'free' | 'chatgpt-plus'
  ): { total: number; base: number; overage: number } {
    const config = this.TIER_CONFIGS.openai[tier];

    return {
      total: config.monthly_cost,
      base: config.monthly_cost,
      overage: 0, // No token-based overages for ChatGPT Plus
    };
  }

  /**
   * Calculate Gemini cost (always free in current implementation)
   */
  calculateGeminiCost(tokensUsed: number): { total: number; base: number; overage: number } {
    return {
      total: 0,
      base: 0,
      overage: 0, // Gemini free tier has hard limits, no overages
    };
  }

  /**
   * Calculate cost for any service
   */
  calculateCost(
    service: string,
    tier: string,
    tokensUsed: number
  ): { total: number; base: number; overage: number } {
    switch (service) {
      case 'claude':
        return this.calculateClaudeCost(tokensUsed, tier as 'free' | 'pro' | 'max');
      case 'openai':
        return this.calculateOpenAICost(tokensUsed, tier as 'free' | 'chatgpt-plus');
      case 'gemini':
        return this.calculateGeminiCost(tokensUsed);
      default:
        return { total: 0, base: 0, overage: 0 };
    }
  }

  /**
   * Get cost breakdown for a service over a period
   */
  async getServiceCostBreakdown(
    service: string,
    startDate: Date,
    endDate: Date
  ): Promise<ServiceCostBreakdown> {
    const result = await pool.query(
      `SELECT
        service,
        tier,
        SUM(tokens_used) as total_tokens,
        SUM(cost_usd) as total_cost,
        SUM(overage_cost) as overage_cost,
        AVG(quota_percentage) as avg_quota_pct
      FROM usage_snapshots
      WHERE service = $1
        AND snapshot_date >= $2::date
        AND snapshot_date <= $3::date
      GROUP BY service, tier`,
      [service, startDate, endDate]
    );

    if (result.rows.length === 0) {
      // No data, return zero breakdown
      const tierResult = await pool.query(
        `SELECT tier, quota_limit FROM subscription_tiers
         WHERE service = $1 AND is_active = true
         ORDER BY started_at DESC LIMIT 1`,
        [service]
      );

      return {
        service,
        tier: tierResult.rows[0]?.tier || 'unknown',
        period_start: startDate,
        period_end: endDate,
        base_cost: 0,
        overage_cost: 0,
        total_cost: 0,
        tokens_used: 0,
        quota_limit: tierResult.rows[0]?.quota_limit || null,
        quota_used_pct: 0,
      };
    }

    const row = result.rows[0];
    const total_cost = parseFloat(row.total_cost);
    const overage_cost = parseFloat(row.overage_cost);
    const base_cost = total_cost - overage_cost;

    return {
      service: row.service,
      tier: row.tier,
      period_start: startDate,
      period_end: endDate,
      base_cost,
      overage_cost,
      total_cost,
      tokens_used: parseInt(row.total_tokens),
      quota_limit: row.quota_limit,
      quota_used_pct: row.avg_quota_pct ? parseFloat(row.avg_quota_pct) : null,
    };
  }

  /**
   * Get total cost breakdown across all services
   */
  async getTotalCostBreakdown(
    startDate: Date,
    endDate: Date
  ): Promise<TotalCostBreakdown> {
    const services = ['claude', 'openai', 'gemini'];
    const breakdowns = await Promise.all(
      services.map(service => this.getServiceCostBreakdown(service, startDate, endDate))
    );

    const total_cost = breakdowns.reduce((sum, b) => sum + b.total_cost, 0);

    // Calculate monthly forecast based on daily average
    const daysDiff = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daily_avg = total_cost / daysDiff;
    const monthly_forecast = daily_avg * 30;

    return {
      period_start: startDate,
      period_end: endDate,
      total_cost,
      by_service: breakdowns,
      monthly_forecast,
    };
  }

  /**
   * Compare tier costs for a service at given usage levels
   */
  async compareTierCosts(
    service: string,
    avgDailyTokens: number,
    peakDayTokens: number
  ): Promise<TierComparison[]> {
    // Get all available tiers for the service
    const tierResult = await pool.query(
      `SELECT tier, monthly_cost, quota_limit, quota_period
       FROM subscription_tiers
       WHERE service = $1
       ORDER BY monthly_cost ASC`,
      [service]
    );

    const comparisons: TierComparison[] = [];

    for (const row of tierResult.rows) {
      const { tier, monthly_cost, quota_limit, quota_period } = row;

      // Calculate if usage fits
      let fits_usage = true;
      let estimated_cost = monthly_cost;
      let margin = 0;

      if (quota_limit) {
        if (quota_period === 'daily') {
          // Check if peak day fits
          fits_usage = peakDayTokens <= quota_limit;
          margin = quota_limit - peakDayTokens;
        } else if (quota_period === 'monthly') {
          const monthly_tokens = avgDailyTokens * 30;
          fits_usage = monthly_tokens <= quota_limit;
          margin = quota_limit - monthly_tokens;

          // Calculate overage cost if doesn't fit
          if (!fits_usage) {
            const overage = monthly_tokens - quota_limit;
            const cost_per_token = this.TIER_CONFIGS[service]?.[tier]?.overage_rate || 0;
            estimated_cost += (overage / 1000000) * cost_per_token * 1000000;
            margin = -overage;
          }
        } else if (quota_period === '5-hours') {
          // For Claude MAX rolling window
          fits_usage = peakDayTokens <= quota_limit;
          margin = quota_limit - peakDayTokens;
        }
      }

      comparisons.push({
        service,
        tier,
        monthly_cost,
        quota_limit,
        quota_period,
        fits_usage,
        estimated_cost,
        margin,
        recommended: false, // Will be set by optimizer
      });
    }

    return comparisons;
  }

  /**
   * Forecast monthly cost based on current usage rate
   */
  async forecastMonthlyCost(service: string, days: number = 7): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const result = await pool.query(
      `SELECT
        AVG(tokens_used) as avg_daily_tokens,
        AVG(cost_usd) as avg_daily_cost
      FROM usage_snapshots
      WHERE service = $1
        AND snapshot_date >= $2::date
        AND tokens_used > 0`,
      [service, since]
    );

    if (result.rows.length === 0 || !result.rows[0].avg_daily_cost) {
      return 0;
    }

    const avg_daily_cost = parseFloat(result.rows[0].avg_daily_cost);
    return avg_daily_cost * 30;
  }

  /**
   * Get tier configuration for a service
   */
  getTierConfig(service: string, tier: string) {
    return this.TIER_CONFIGS[service]?.[tier] || null;
  }
}
