/**
 * Subscription Optimization MCP Tools
 * Tools for analyzing and optimizing subscription tiers
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { SubscriptionOptimizer } from '../../monitoring/SubscriptionOptimizer.js';
import { SubscriptionTierManager } from '../../monitoring/SubscriptionTierManager.js';

const optimizer = new SubscriptionOptimizer();
const tierManager = new SubscriptionTierManager();

/**
 * Analyze subscription usage and get recommendation
 */
const analyzeSubscriptionUsageTool: ToolDefinition = {
  name: 'analyze-subscription-usage',
  description: 'Analyze subscription usage and generate tier change recommendations for a service',
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
      const recommendation = await optimizer.generateRecommendation(params.service, days);

      const response: any = {
        success: true,
        service: recommendation.service,
        current_tier: recommendation.current_tier,
        current_monthly_cost: `$${recommendation.current_cost.toFixed(2)}`,
        analysis: {
          period_days: recommendation.usage_analysis.period_days,
          total_tokens: recommendation.usage_analysis.total_tokens.toLocaleString(),
          avg_daily_tokens: Math.round(recommendation.usage_analysis.avg_daily_tokens).toLocaleString(),
          peak_day_tokens: recommendation.usage_analysis.peak_day_tokens.toLocaleString(),
          quota_usage_pct: recommendation.usage_analysis.quota_usage_pct
            ? `${recommendation.usage_analysis.quota_usage_pct.toFixed(1)}%`
            : 'N/A',
          days_with_zero_usage: recommendation.usage_analysis.days_with_zero_usage,
        },
      };

      if (recommendation.recommended_tier) {
        response.recommendation = {
          tier: recommendation.recommended_tier,
          monthly_cost: `$${recommendation.recommended_cost?.toFixed(2)}`,
          potential_savings: `$${recommendation.potential_savings.toFixed(2)}/month`,
          annual_savings: `$${(recommendation.potential_savings * 12).toFixed(2)}/year`,
          confidence: `${(recommendation.confidence * 100).toFixed(0)}%`,
          auto_executable: recommendation.auto_executable,
        };
      } else {
        response.recommendation = {
          status: 'keep_current',
          message: 'Current tier is optimal',
        };
      }

      response.reasoning = recommendation.reasoning;

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Analyze all services at once
 */
const analyzeAllServicesTool: ToolDefinition = {
  name: 'analyze-all-services',
  description: 'Analyze subscription usage for all services and generate recommendations',
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
      const recommendations = await optimizer.analyzeAllServices(days);

      const total_savings = recommendations.reduce((sum, r) => sum + r.potential_savings, 0);
      const annual_savings = total_savings * 12;

      return {
        success: true,
        analysis_period_days: days,
        total_potential_savings: `$${total_savings.toFixed(2)}/month`,
        total_annual_savings: `$${annual_savings.toFixed(2)}/year`,
        recommendations: recommendations.map(r => ({
          service: r.service,
          current_tier: r.current_tier,
          current_cost: `$${r.current_cost.toFixed(2)}`,
          recommended_tier: r.recommended_tier || '(keep current)',
          recommended_cost: r.recommended_cost ? `$${r.recommended_cost.toFixed(2)}` : 'N/A',
          savings: r.potential_savings > 0 ? `$${r.potential_savings.toFixed(2)}/month` : '$0.00',
          confidence: r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : 'N/A',
          auto_executable: r.auto_executable,
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
 * Get pending optimization recommendations
 */
const getPendingRecommendationsTool: ToolDefinition = {
  name: 'get-pending-recommendations',
  description: 'Get all pending tier change recommendations',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const pending = await optimizer.getPendingRecommendations();

      return {
        success: true,
        count: pending.length,
        total_potential_savings: pending
          .reduce((sum, p) => sum + (p.potential_savings || 0), 0)
          .toFixed(2),
        recommendations: pending.map(p => ({
          id: p.id,
          service: p.service,
          current_tier: p.current_tier,
          recommended_tier: p.recommended_tier,
          savings: p.potential_savings ? `$${p.potential_savings.toFixed(2)}/month` : '$0.00',
          confidence: p.confidence ? `${(p.confidence * 100).toFixed(0)}%` : 'N/A',
          analysis_date: p.analysis_date.toISOString().split('T')[0],
          status: p.status,
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
 * Execute a tier change
 */
const executeTierChangeTool: ToolDefinition = {
  name: 'execute-tier-change',
  description: 'Execute a subscription tier change for a service',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service name',
        enum: ['claude', 'openai', 'gemini'],
      },
      target_tier: {
        type: 'string',
        description: 'Target tier to switch to',
      },
      recommendation_id: {
        type: 'number',
        description: 'Optional recommendation ID to mark as executed',
      },
    },
    required: ['service', 'target_tier'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const result = await optimizer.executeTierChange(params.service, params.target_tier);

      if (result.success && params.recommendation_id) {
        await optimizer.markAsExecuted(params.recommendation_id, true);
      } else if (!result.success && params.recommendation_id) {
        await optimizer.markAsExecuted(params.recommendation_id, false, result.error);
      }

      return {
        success: result.success,
        service: params.service,
        new_tier: params.target_tier,
        message: result.success
          ? `Successfully changed ${params.service} to ${params.target_tier} tier`
          : `Failed to change tier: ${result.error}`,
        error: result.error,
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
 * Dismiss a recommendation
 */
const dismissRecommendationTool: ToolDefinition = {
  name: 'dismiss-recommendation',
  description: 'Dismiss a tier change recommendation',
  inputSchema: {
    type: 'object',
    properties: {
      recommendation_id: {
        type: 'number',
        description: 'Recommendation ID to dismiss',
      },
    },
    required: ['recommendation_id'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      await optimizer.markAsDismissed(params.recommendation_id);

      return {
        success: true,
        message: `Recommendation #${params.recommendation_id} dismissed`,
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
 * Get optimization history
 */
const getOptimizationHistoryTool: ToolDefinition = {
  name: 'get-optimization-history',
  description: 'Get history of all tier change recommendations and executions',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Optional service filter',
        enum: ['claude', 'openai', 'gemini'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of records (default: 10)',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const limit = params.limit || 10;
      const history = await optimizer.getOptimizationHistory(params.service, limit);

      return {
        success: true,
        count: history.length,
        history: history.map(h => ({
          id: h.id,
          date: h.analysis_date.toISOString().split('T')[0],
          service: h.service,
          current_tier: h.current_tier,
          recommended_tier: h.recommended_tier,
          savings: h.potential_savings ? `$${h.potential_savings.toFixed(2)}/month` : '$0.00',
          confidence: h.confidence ? `${(h.confidence * 100).toFixed(0)}%` : 'N/A',
          status: h.status,
          executed_at: h.executed_at ? h.executed_at.toISOString().split('T')[0] : null,
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
 * Calculate potential savings from a tier change
 */
const calculateSavingsTool: ToolDefinition = {
  name: 'calculate-tier-savings',
  description: 'Calculate potential savings from switching to a different tier',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service name',
        enum: ['claude', 'openai', 'gemini'],
      },
      target_tier: {
        type: 'string',
        description: 'Target tier to compare',
      },
    },
    required: ['service', 'target_tier'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const result = await tierManager.calculateSavings(params.service, params.target_tier);

      return {
        success: true,
        service: params.service,
        current_cost: `$${result.current_cost.toFixed(2)}/month`,
        target_cost: `$${result.target_cost.toFixed(2)}/month`,
        monthly_savings: `$${result.savings.toFixed(2)}`,
        annual_savings: `$${(result.savings * 12).toFixed(2)}`,
        change_type: result.savings > 0 ? 'downgrade' : result.savings < 0 ? 'upgrade' : 'no change',
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
 * Export all subscription optimization tools
 */
export function getSubscriptionOptimizationTools(): ToolDefinition[] {
  return [
    analyzeSubscriptionUsageTool,
    analyzeAllServicesTool,
    getPendingRecommendationsTool,
    executeTierChangeTool,
    dismissRecommendationTool,
    getOptimizationHistoryTool,
    calculateSavingsTool,
  ];
}
