/**
 * AI Router MCP Tools
 * Tools for tracking AI service usage and costs
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { UsageMonitor } from '../../monitoring/UsageMonitor.js';
import { CostCalculator } from '../../monitoring/CostCalculator.js';
import { SubscriptionTierManager } from '../../monitoring/SubscriptionTierManager.js';

const usageMonitor = new UsageMonitor();
const costCalculator = new CostCalculator();
const tierManager = new SubscriptionTierManager();

/**
 * Get usage summary across all services
 */
const getUsageSummaryTool: ToolDefinition = {
  name: 'get-usage-summary',
  description: 'Get usage summary across all AI services for a time period',
  inputSchema: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: 'Number of days to look back (default: 30)',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const days = params.days || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const summary = await usageMonitor.getUsageSummary(since);

      return {
        success: true,
        period: {
          start: summary.period_start.toISOString().split('T')[0],
          end: summary.period_end.toISOString().split('T')[0],
          days,
        },
        total_cost: summary.total_cost.toFixed(2),
        services: summary.by_service.map(s => ({
          service: s.service,
          tokens: s.total_tokens.toLocaleString(),
          requests: s.total_requests.toLocaleString(),
          cost: s.total_cost.toFixed(2),
          avg_daily: Math.round(s.avg_daily_tokens).toLocaleString(),
          peak_day: s.peak_day_tokens.toLocaleString(),
          quota_usage: s.avg_quota_percentage ? `${s.avg_quota_percentage.toFixed(1)}%` : 'N/A',
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Get detailed cost breakdown by service
 */
const getCostBreakdownTool: ToolDefinition = {
  name: 'get-cost-breakdown',
  description: 'Get detailed cost breakdown by service for a time period',
  inputSchema: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: 'Number of days to analyze (default: 30)',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const days = params.days || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const endDate = new Date();

      const breakdown = await costCalculator.getTotalCostBreakdown(startDate, endDate);

      return {
        success: true,
        period: {
          start: breakdown.period_start.toISOString().split('T')[0],
          end: breakdown.period_end.toISOString().split('T')[0],
          days,
        },
        total_cost: breakdown.total_cost.toFixed(2),
        monthly_forecast: breakdown.monthly_forecast.toFixed(2),
        by_service: breakdown.by_service.map(s => ({
          service: s.service,
          tier: s.tier,
          base_cost: s.base_cost.toFixed(2),
          overage_cost: s.overage_cost.toFixed(2),
          total_cost: s.total_cost.toFixed(2),
          tokens_used: s.tokens_used.toLocaleString(),
          quota_limit: s.quota_limit ? s.quota_limit.toLocaleString() : 'Unlimited',
          quota_used_pct: s.quota_used_pct ? `${s.quota_used_pct.toFixed(1)}%` : 'N/A',
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Get usage trends for a specific service
 */
const getUsageTrendsTool: ToolDefinition = {
  name: 'get-usage-trends',
  description: 'Get usage trends and historical data for a specific service',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service name (claude, openai, gemini)',
        enum: ['claude', 'openai', 'gemini'],
      },
      days: {
        type: 'number',
        description: 'Number of days to analyze (default: 30)',
      },
    },
    required: ['service'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const days = params.days || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const stats = await usageMonitor.getUsageStats(params.service, since);
      const snapshots = await usageMonitor.getSnapshots(params.service, since, 30);

      return {
        success: true,
        service: stats.service,
        period: {
          start: stats.period_start.toISOString().split('T')[0],
          end: stats.period_end.toISOString().split('T')[0],
          days,
        },
        totals: {
          tokens: stats.total_tokens.toLocaleString(),
          requests: stats.total_requests.toLocaleString(),
          cost: stats.total_cost.toFixed(2),
          overage: stats.total_overage.toFixed(2),
        },
        averages: {
          daily_tokens: Math.round(stats.avg_daily_tokens).toLocaleString(),
          quota_usage: stats.avg_quota_percentage ? `${stats.avg_quota_percentage.toFixed(1)}%` : 'N/A',
        },
        peaks: {
          tokens: stats.peak_day_tokens.toLocaleString(),
          date: stats.peak_day_date?.toISOString().split('T')[0] || 'N/A',
        },
        activity: {
          days_with_usage: stats.days_with_usage,
          days_with_zero: stats.days_with_zero_usage,
        },
        recent_snapshots: snapshots.slice(0, 7).map(s => ({
          date: s.snapshot_date.toISOString().split('T')[0],
          tokens: s.tokens_used.toLocaleString(),
          cost: s.cost_usd.toFixed(2),
          quota_pct: s.quota_percentage ? `${s.quota_percentage.toFixed(1)}%` : 'N/A',
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Forecast monthly cost based on current usage
 */
const forecastMonthlyCostTool: ToolDefinition = {
  name: 'forecast-monthly-cost',
  description: 'Forecast monthly cost for a service based on recent usage',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service name (claude, openai, gemini)',
        enum: ['claude', 'openai', 'gemini'],
      },
      days: {
        type: 'number',
        description: 'Number of recent days to base forecast on (default: 7)',
      },
    },
    required: ['service'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const days = params.days || 7;
      const forecast = await costCalculator.forecastMonthlyCost(params.service, days);

      const currentTier = await tierManager.getCurrentTier(params.service);

      return {
        success: true,
        service: params.service,
        current_tier: currentTier?.tier || 'unknown',
        current_monthly_cost: currentTier?.monthly_cost.toFixed(2) || '0.00',
        forecasted_monthly_cost: forecast.toFixed(2),
        based_on_last_n_days: days,
        potential_overage: Math.max(0, forecast - (currentTier?.monthly_cost || 0)).toFixed(2),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Compare subscription tiers for a service
 */
const compareSubscriptionTiersTool: ToolDefinition = {
  name: 'compare-subscription-tiers',
  description: 'Compare available subscription tiers for a service based on current usage',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service name (claude, openai, gemini)',
        enum: ['claude', 'openai', 'gemini'],
      },
      days: {
        type: 'number',
        description: 'Number of days to analyze usage (default: 30)',
      },
    },
    required: ['service'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const days = params.days || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const stats = await usageMonitor.getUsageStats(params.service, since);
      const comparisons = await costCalculator.compareTierCosts(
        params.service,
        stats.avg_daily_tokens,
        stats.peak_day_tokens
      );

      const currentTier = await tierManager.getCurrentTier(params.service);

      return {
        success: true,
        service: params.service,
        current_tier: currentTier?.tier || 'unknown',
        usage_analysis: {
          avg_daily_tokens: Math.round(stats.avg_daily_tokens).toLocaleString(),
          peak_day_tokens: stats.peak_day_tokens.toLocaleString(),
          analysis_period_days: days,
        },
        tiers: comparisons.map(t => ({
          tier: t.tier,
          monthly_cost: t.monthly_cost.toFixed(2),
          quota_limit: t.quota_limit ? t.quota_limit.toLocaleString() : 'Unlimited',
          quota_period: t.quota_period || 'N/A',
          fits_usage: t.fits_usage ? '✅ Yes' : '❌ No',
          estimated_cost: t.estimated_cost.toFixed(2),
          margin: t.margin > 0
            ? `+${Math.round(t.margin).toLocaleString()} tokens headroom`
            : t.margin < 0
            ? `${Math.round(Math.abs(t.margin)).toLocaleString()} tokens over`
            : 'Exact fit',
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Get current active subscriptions
 */
const getCurrentSubscriptionsTool: ToolDefinition = {
  name: 'get-current-subscriptions',
  description: 'Get all currently active subscription tiers',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const subscriptions = await tierManager.getActiveSubscriptions();
      const totalCost = await tierManager.getCurrentMonthlyCost();

      return {
        success: true,
        total_monthly_cost: totalCost.toFixed(2),
        subscriptions: subscriptions.map(s => ({
          service: s.service,
          tier: s.tier,
          monthly_cost: s.monthly_cost.toFixed(2),
          quota_limit: s.quota_limit ? s.quota_limit.toLocaleString() : 'Unlimited',
          quota_period: s.quota_period || 'N/A',
          started_at: s.started_at.toISOString().split('T')[0],
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Collect daily usage snapshot manually
 */
const collectUsageSnapshotTool: ToolDefinition = {
  name: 'collect-usage-snapshot',
  description: 'Manually trigger collection of daily usage snapshot for all services',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    try {
      await usageMonitor.collectDailySnapshot();

      return {
        success: true,
        message: 'Daily usage snapshot collected for all services',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Export all usage monitoring tools
 */
export function getUsageMonitoringTools(): ToolDefinition[] {
  return [
    getUsageSummaryTool,
    getCostBreakdownTool,
    getUsageTrendsTool,
    forecastMonthlyCostTool,
    compareSubscriptionTiersTool,
    getCurrentSubscriptionsTool,
    collectUsageSnapshotTool,
  ];
}
