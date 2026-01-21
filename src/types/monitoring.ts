/**
 * Types for usage monitoring and cost optimization system
 */

// ============================================================================
// Subscription Tier Types
// ============================================================================

export interface SubscriptionTier {
  id: number;
  service: string;
  tier: string;
  monthly_cost: number;
  quota_limit: number | null;
  quota_period: string | null;
  features: Record<string, any>;
  is_active: boolean;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
}

export interface TierDefinition {
  service: string;
  tier: string;
  monthly_cost: number;
  quota_limit: number | null;
  quota_period: string | null;
  features: Record<string, any>;
}

// ============================================================================
// Usage Snapshot Types
// ============================================================================

export interface UsageSnapshot {
  id: number;
  snapshot_date: Date;
  service: string;
  tier: string;
  tokens_used: number;
  requests_made: number;
  cost_usd: number;
  overage_cost: number;
  quota_percentage: number | null;
  metadata: Record<string, any> | null;
  created_at: Date;
}

export interface CreateUsageSnapshotParams {
  snapshot_date: Date;
  service: string;
  tier: string;
  tokens_used: number;
  requests_made: number;
  cost_usd: number;
  overage_cost: number;
  quota_percentage?: number | null;
  metadata?: Record<string, any>;
}

// ============================================================================
// Usage Statistics Types
// ============================================================================

export interface UsageStats {
  service: string;
  period_start: Date;
  period_end: Date;
  total_tokens: number;
  total_requests: number;
  total_cost: number;
  total_overage: number;
  avg_daily_tokens: number;
  avg_quota_percentage: number | null;
  peak_day_tokens: number;
  peak_day_date: Date | null;
  days_with_usage: number;
  days_with_zero_usage: number;
}

// ============================================================================
// Cost Optimization Types
// ============================================================================

export interface CostOptimization {
  id: number;
  analysis_date: Date;
  service: string;
  current_tier: string;
  current_monthly_cost: number;
  recommended_tier: string | null;
  recommended_monthly_cost: number | null;
  potential_savings: number | null;
  reasoning: string;
  confidence: number | null;
  usage_period_days: number;
  status: 'pending' | 'approved' | 'executed' | 'dismissed' | 'failed';
  executed_at: Date | null;
  execution_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOptimizationParams {
  service: string;
  current_tier: string;
  current_monthly_cost: number;
  recommended_tier: string | null;
  recommended_monthly_cost: number | null;
  potential_savings: number | null;
  reasoning: string;
  confidence: number | null;
  usage_period_days?: number;
}

export interface OptimizationRecommendation {
  service: string;
  current_tier: string;
  current_cost: number;
  recommended_tier: string | null;
  recommended_cost: number | null;
  potential_savings: number;
  confidence: number;
  reasoning: string;
  auto_executable: boolean;
  usage_analysis: {
    period_days: number;
    total_tokens: number;
    avg_daily_tokens: number;
    peak_day_tokens: number;
    quota_usage_pct: number | null;
    days_with_zero_usage: number;
  };
}

// ============================================================================
// Cost Breakdown Types
// ============================================================================

export interface ServiceCostBreakdown {
  service: string;
  tier: string;
  period_start: Date;
  period_end: Date;
  base_cost: number;
  overage_cost: number;
  total_cost: number;
  tokens_used: number;
  quota_limit: number | null;
  quota_used_pct: number | null;
}

export interface TotalCostBreakdown {
  period_start: Date;
  period_end: Date;
  total_cost: number;
  by_service: ServiceCostBreakdown[];
  monthly_forecast: number;
}

// ============================================================================
// Tier Comparison Types
// ============================================================================

export interface TierComparison {
  service: string;
  tier: string;
  monthly_cost: number;
  quota_limit: number | null;
  quota_period: string | null;
  fits_usage: boolean;
  estimated_cost: number;
  margin: number; // How much headroom (positive) or overage (negative)
  recommended: boolean;
}

// ============================================================================
// Service Usage APIs
// ============================================================================

export interface ClaudeUsageResponse {
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  requests: number;
  timestamp: Date;
}

export interface OpenAIUsageResponse {
  total_tokens: number;
  requests: number;
  timestamp: Date;
}

export interface GeminiUsageResponse {
  total_tokens: number;
  requests: number;
  timestamp: Date;
}
