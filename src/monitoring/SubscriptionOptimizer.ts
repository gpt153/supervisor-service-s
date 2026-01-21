/**
 * SubscriptionOptimizer - Analyzes usage and generates tier change recommendations
 */

import { pool } from '../db/client.js';
import { UsageMonitor } from './UsageMonitor.js';
import { CostCalculator } from './CostCalculator.js';
import { SubscriptionTierManager } from './SubscriptionTierManager.js';
import {
  OptimizationRecommendation,
  CreateOptimizationParams,
  CostOptimization,
} from '../types/monitoring.js';

export class SubscriptionOptimizer {
  private usageMonitor: UsageMonitor;
  private costCalculator: CostCalculator;
  private tierManager: SubscriptionTierManager;

  constructor() {
    this.usageMonitor = new UsageMonitor();
    this.costCalculator = new CostCalculator();
    this.tierManager = new SubscriptionTierManager();
  }

  /**
   * Generate optimization recommendation for a service
   */
  async generateRecommendation(service: string, days: number = 30): Promise<OptimizationRecommendation> {
    // Get usage stats for the period
    const since = new Date();
    since.setDate(since.getDate() - days);
    const stats = await this.usageMonitor.getUsageStats(service, since);

    // Get current tier
    const currentTier = await this.tierManager.getCurrentTier(service);
    if (!currentTier) {
      throw new Error(`No active tier found for ${service}`);
    }

    // Get all available tiers
    const comparisons = await this.costCalculator.compareTierCosts(
      service,
      stats.avg_daily_tokens,
      stats.peak_day_tokens
    );

    // Find optimal tier (lowest cost that still fits usage)
    const fittingTiers = comparisons.filter(t => t.fits_usage);

    if (fittingTiers.length === 0) {
      // No tier fits - recommend staying or upgrading
      return {
        service,
        current_tier: currentTier.tier,
        current_cost: currentTier.monthly_cost,
        recommended_tier: null,
        recommended_cost: null,
        potential_savings: 0,
        confidence: 0,
        reasoning: `Your usage exceeds all available tier limits. Consider staying on ${currentTier.tier} or contact support for enterprise options.`,
        auto_executable: false,
        usage_analysis: {
          period_days: days,
          total_tokens: stats.total_tokens,
          avg_daily_tokens: stats.avg_daily_tokens,
          peak_day_tokens: stats.peak_day_tokens,
          quota_usage_pct: stats.avg_quota_percentage,
          days_with_zero_usage: stats.days_with_zero_usage,
        },
      };
    }

    // Sort by cost (cheapest first)
    fittingTiers.sort((a, b) => a.estimated_cost - b.estimated_cost);
    const best = fittingTiers[0];

    // Check if it's the same as current tier
    if (best.tier === currentTier.tier) {
      return {
        service,
        current_tier: currentTier.tier,
        current_cost: currentTier.monthly_cost,
        recommended_tier: null,
        recommended_cost: null,
        potential_savings: 0,
        confidence: 1.0,
        reasoning: `Your current tier (${currentTier.tier}) is already optimal for your usage pattern.`,
        auto_executable: false,
        usage_analysis: {
          period_days: days,
          total_tokens: stats.total_tokens,
          avg_daily_tokens: stats.avg_daily_tokens,
          peak_day_tokens: stats.peak_day_tokens,
          quota_usage_pct: stats.avg_quota_percentage,
          days_with_zero_usage: stats.days_with_zero_usage,
        },
      };
    }

    // Calculate savings
    const savings = currentTier.monthly_cost - best.estimated_cost;

    // Calculate confidence score
    const confidence = this.calculateConfidence(stats, best);

    // Generate reasoning
    const reasoning = this.generateReasoning(service, currentTier.tier, best.tier, stats, best, confidence);

    return {
      service,
      current_tier: currentTier.tier,
      current_cost: currentTier.monthly_cost,
      recommended_tier: best.tier,
      recommended_cost: best.estimated_cost,
      potential_savings: savings,
      confidence,
      reasoning,
      auto_executable: confidence >= 0.95 && savings > 0,
      usage_analysis: {
        period_days: days,
        total_tokens: stats.total_tokens,
        avg_daily_tokens: stats.avg_daily_tokens,
        peak_day_tokens: stats.peak_day_tokens,
        quota_usage_pct: stats.avg_quota_percentage,
        days_with_zero_usage: stats.days_with_zero_usage,
      },
    };
  }

  /**
   * Calculate confidence score for a recommendation
   */
  private calculateConfidence(stats: any, targetTier: any): number {
    let confidence = 1.0;

    if (!targetTier.quota_limit) {
      // Unlimited tier - high confidence
      return 0.99;
    }

    // Factor 1: Margin
    const margin_ratio = targetTier.margin / targetTier.quota_limit;
    if (margin_ratio < 0.2) confidence *= 0.7; // < 20% headroom
    else if (margin_ratio < 0.5) confidence *= 0.9; // < 50% headroom

    // Factor 2: Data points
    if (stats.days_with_usage < 20) confidence *= 0.85; // Less than 20 days of data

    // Factor 3: Usage consistency (check variance)
    const usage_ratio = stats.avg_quota_percentage ? stats.avg_quota_percentage / 100 : 0;
    if (usage_ratio > 0.8) confidence *= 0.8; // Using >80% of quota is risky

    // Factor 4: Zero usage days (indicates inconsistent usage)
    if (stats.days_with_zero_usage > 10) confidence *= 0.9;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate human-readable reasoning for recommendation
   */
  private generateReasoning(
    service: string,
    currentTier: string,
    recommendedTier: string,
    stats: any,
    targetTier: any,
    confidence: number
  ): string {
    const parts: string[] = [];

    // Main recommendation
    const savings = targetTier.monthly_cost - targetTier.estimated_cost;
    if (savings > 0) {
      parts.push(`💰 Downgrade from ${currentTier} to ${recommendedTier} to save $${Math.abs(savings).toFixed(2)}/month.`);
    } else {
      parts.push(`⬆️ Upgrade to ${recommendedTier} recommended.`);
    }

    // Usage analysis
    const monthly_tokens = stats.avg_daily_tokens * 30;
    if (targetTier.quota_limit) {
      const usage_pct = (monthly_tokens / targetTier.quota_limit) * 100;
      parts.push(`Your average usage (${Math.round(stats.avg_daily_tokens).toLocaleString()} tokens/day) fits comfortably in ${recommendedTier} tier.`);
      parts.push(`Projected monthly usage: ${Math.round(monthly_tokens).toLocaleString()} tokens (${usage_pct.toFixed(1)}% of ${targetTier.quota_limit.toLocaleString()} quota).`);
    }

    // Peak usage
    if (stats.peak_day_tokens > 0) {
      parts.push(`Peak day usage: ${stats.peak_day_tokens.toLocaleString()} tokens.`);
    }

    // Zero usage days
    if (stats.days_with_zero_usage > 5) {
      parts.push(`Note: ${stats.days_with_zero_usage} days with zero usage in last ${stats.period_days} days.`);
    }

    // Confidence explanation
    if (confidence < 0.95) {
      if (stats.days_with_usage < 20) {
        parts.push(`⚠️ Limited data (${stats.days_with_usage} days of usage). Recommend collecting more data before downgrading.`);
      }
      if (stats.avg_quota_percentage && stats.avg_quota_percentage > 80) {
        parts.push(`⚠️ High quota usage (${stats.avg_quota_percentage.toFixed(1)}%). Monitor closely if downgrading.`);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Save optimization recommendation to database
   */
  async saveRecommendation(params: CreateOptimizationParams): Promise<number> {
    const result = await pool.query(
      `INSERT INTO cost_optimizations (
        analysis_date, service, current_tier, current_monthly_cost,
        recommended_tier, recommended_monthly_cost, potential_savings,
        reasoning, confidence, usage_period_days, status
      ) VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING id`,
      [
        params.service,
        params.current_tier,
        params.current_monthly_cost,
        params.recommended_tier,
        params.recommended_monthly_cost,
        params.potential_savings,
        params.reasoning,
        params.confidence,
        params.usage_period_days || 30,
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Get pending optimization recommendations
   */
  async getPendingRecommendations(): Promise<CostOptimization[]> {
    const result = await pool.query(
      `SELECT * FROM cost_optimizations
       WHERE status = 'pending'
       ORDER BY potential_savings DESC, created_at DESC`
    );

    return result.rows.map(row => this.mapRowToOptimization(row));
  }

  /**
   * Get all optimization history
   */
  async getOptimizationHistory(service?: string, limit: number = 10): Promise<CostOptimization[]> {
    const params: any[] = [];
    let query = 'SELECT * FROM cost_optimizations';

    if (service) {
      params.push(service);
      query += ' WHERE service = $1';
    }

    params.push(limit);
    query += ` ORDER BY analysis_date DESC, created_at DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    return result.rows.map(row => this.mapRowToOptimization(row));
  }

  /**
   * Mark recommendation as executed
   */
  async markAsExecuted(id: number, success: boolean, error?: string): Promise<void> {
    await pool.query(
      `UPDATE cost_optimizations
       SET status = $1, executed_at = NOW(), execution_error = $2, updated_at = NOW()
       WHERE id = $3`,
      [success ? 'executed' : 'failed', error || null, id]
    );
  }

  /**
   * Mark recommendation as dismissed
   */
  async markAsDismissed(id: number): Promise<void> {
    await pool.query(
      `UPDATE cost_optimizations
       SET status = 'dismissed', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Execute tier change (placeholder for browser automation)
   */
  async executeTierChange(service: string, targetTier: string): Promise<{ success: boolean; error?: string }> {
    try {
      // For now, just update the database tier
      // In the future, this will integrate with browser automation
      await this.tierManager.updateTier(service, targetTier);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Analyze all services and generate recommendations
   */
  async analyzeAllServices(days: number = 30): Promise<OptimizationRecommendation[]> {
    const services = ['claude', 'openai', 'gemini'];
    const recommendations: OptimizationRecommendation[] = [];

    for (const service of services) {
      try {
        const rec = await this.generateRecommendation(service, days);
        recommendations.push(rec);

        // Save significant recommendations
        if (rec.potential_savings > 10) {
          await this.saveRecommendation({
            service: rec.service,
            current_tier: rec.current_tier,
            current_monthly_cost: rec.current_cost,
            recommended_tier: rec.recommended_tier,
            recommended_monthly_cost: rec.recommended_cost,
            potential_savings: rec.potential_savings,
            reasoning: rec.reasoning,
            confidence: rec.confidence,
            usage_period_days: days,
          });
        }
      } catch (error) {
        console.error(`Failed to analyze ${service}:`, error);
      }
    }

    return recommendations;
  }

  /**
   * Map database row to CostOptimization object
   */
  private mapRowToOptimization(row: any): CostOptimization {
    return {
      id: row.id,
      analysis_date: new Date(row.analysis_date),
      service: row.service,
      current_tier: row.current_tier,
      current_monthly_cost: parseFloat(row.current_monthly_cost),
      recommended_tier: row.recommended_tier,
      recommended_monthly_cost: row.recommended_monthly_cost ? parseFloat(row.recommended_monthly_cost) : null,
      potential_savings: row.potential_savings ? parseFloat(row.potential_savings) : null,
      reasoning: row.reasoning,
      confidence: row.confidence ? parseFloat(row.confidence) : null,
      usage_period_days: row.usage_period_days,
      status: row.status,
      executed_at: row.executed_at ? new Date(row.executed_at) : null,
      execution_error: row.execution_error,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
