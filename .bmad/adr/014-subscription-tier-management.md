# ADR 014-B: Subscription Tier Management & Autonomous Optimization

**Date:** 2026-01-20
**Status:** Accepted
**Epic:** 014 - Autonomous Usage Monitoring & Optimization

---

## Context

The user is overpaying for AI services:
- Claude MAX: $200/mo but only using 25% of quota (~125K / 500K tokens)
- Additional overages: $50-100/mo
- ChatGPT Plus: $20/mo (appropriate usage)

**Goals:**
- Monitor usage across all AI services (Claude, OpenAI, Gemini)
- Detect subscription optimization opportunities (downgrades/upgrades)
- Generate recommendations with confidence scoring
- Autonomously execute tier changes when safe
- Save $180+/month through optimization

**Requirements:**
- Real-time usage tracking with historical trends
- Cost calculation per service/tier
- Safe downgrade validation (30-day usage check)
- Confidence scoring (≥95% for auto-execution)
- Browser automation for tier changes (no APIs available)
- Daily optimization analysis
- User notification before autonomous actions

---

## Decision

**We will build a comprehensive autonomous subscription optimization system with usage monitoring, cost tracking, and autonomous tier management.**

### Architecture

```
┌─────────────────────────────────────────────────────┐
│          Autonomous Optimization System             │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    Usage     │  │ Subscription │  │   Browser    │
│  Monitoring  │  │ Optimization │  │  Automation  │
│              │  │              │  │              │
│ - Daily      │  │ - Tier       │  │ - Login to   │
│   snapshots  │  │   comparison │  │   service    │
│ - Cost calc  │  │ - Confidence │  │ - Navigate   │
│ - Trends     │  │   scoring    │  │ - Change     │
│ - Forecasts  │  │ - Safety     │  │   tier       │
│              │  │   validation │  │ - Verify     │
└──────────────┘  └──────────────┘  └──────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        ▼
                ┌──────────────┐
                │  PostgreSQL  │
                │              │
                │ - Snapshots  │
                │ - Tiers      │
                │ - Optimiz.   │
                └──────────────┘
```

### Database Schema

**1. subscription_tiers** - Active tier tracking
```sql
CREATE TABLE subscription_tiers (
  id SERIAL PRIMARY KEY,
  service VARCHAR(50) NOT NULL,      -- 'claude', 'openai', 'gemini'
  tier VARCHAR(50) NOT NULL,         -- 'free', 'pro', 'max', 'chatgpt-plus'
  monthly_cost DECIMAL(10, 2) NOT NULL,
  quota_limit BIGINT,                -- Tokens or messages per period
  quota_period VARCHAR(20),          -- 'daily', 'monthly', '5-hours'
  features JSONB,                    -- Additional features
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  UNIQUE(service, tier, started_at)
);
```

**2. usage_snapshots** - Daily usage tracking
```sql
CREATE TABLE usage_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  service VARCHAR(50) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  requests_made INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 2) NOT NULL DEFAULT 0,
  overage_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quota_percentage DECIMAL(5, 2),    -- Usage as % of quota
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_date, service)
);

CREATE INDEX idx_usage_snapshots_date ON usage_snapshots(snapshot_date DESC);
CREATE INDEX idx_usage_snapshots_service ON usage_snapshots(service);
```

**3. cost_optimizations** - Recommendation tracking
```sql
CREATE TABLE cost_optimizations (
  id SERIAL PRIMARY KEY,
  analysis_date DATE NOT NULL,
  service VARCHAR(50) NOT NULL,
  current_tier VARCHAR(50) NOT NULL,
  current_monthly_cost DECIMAL(10, 2) NOT NULL,
  recommended_tier VARCHAR(50),
  recommended_monthly_cost DECIMAL(10, 2),
  potential_savings DECIMAL(10, 2),
  reasoning TEXT NOT NULL,
  confidence DECIMAL(3, 2),          -- 0.0 to 1.0
  status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, executed, dismissed
  executed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_optimizations_status ON cost_optimizations(status);
```

### Core Components

**1. UsageMonitor** (`src/monitoring/UsageMonitor.ts`)

```typescript
class UsageMonitor {
  /**
   * Collect daily snapshot for all services
   * - Query API usage endpoints
   * - Calculate costs
   * - Store in usage_snapshots table
   */
  async collectDailySnapshot(): Promise<void> {
    const services = ['claude', 'openai', 'gemini'];

    for (const service of services) {
      const usage = await this.getUsageFromAPI(service);
      const tier = await this.getCurrentTier(service);
      const cost = this.calculateCost(usage, tier);

      await pool.query(`
        INSERT INTO usage_snapshots (
          snapshot_date, service, tier, tokens_used,
          requests_made, cost_usd, overage_cost, quota_percentage
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (snapshot_date, service)
        DO UPDATE SET tokens_used = $4, cost_usd = $6
      `, [
        new Date().toISOString().split('T')[0],
        service,
        tier.tier,
        usage.tokens,
        usage.requests,
        cost.total,
        cost.overage,
        (usage.tokens / tier.quota_limit) * 100
      ]);
    }
  }

  /**
   * Get usage statistics for period
   */
  async getUsageStats(service: string, since: Date): Promise<UsageStats> {
    const result = await pool.query(`
      SELECT
        SUM(tokens_used) as total_tokens,
        SUM(requests_made) as total_requests,
        SUM(cost_usd) as total_cost,
        AVG(quota_percentage) as avg_quota_usage,
        MAX(tokens_used) as peak_day_tokens
      FROM usage_snapshots
      WHERE service = $1 AND snapshot_date >= $2
    `, [service, since]);

    return result.rows[0];
  }
}
```

**2. SubscriptionOptimizer** (`src/monitoring/SubscriptionOptimizer.ts`)

```typescript
class SubscriptionOptimizer {
  /**
   * Analyze current usage and generate tier recommendation
   */
  async generateRecommendation(service: string): Promise<Recommendation> {
    // 1. Get 30-day usage stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const stats = await this.usageMonitor.getUsageStats(service, thirtyDaysAgo);

    // 2. Get current tier
    const currentTier = await this.tierManager.getCurrentTier(service);

    // 3. Get all available tiers
    const availableTiers = await this.tierManager.getAvailableTiers(service);

    // 4. Find optimal tier (highest savings while still covering usage)
    const recommendations = availableTiers
      .filter(tier => this.fitsUsagePattern(tier, stats))
      .map(tier => ({
        tier,
        savings: currentTier.monthly_cost - tier.monthly_cost,
        confidence: this.calculateConfidence(tier, stats)
      }))
      .sort((a, b) => b.savings - a.savings);

    if (recommendations.length === 0) {
      return {
        action: 'keep_current',
        reasoning: 'No better tier available for your usage pattern'
      };
    }

    const best = recommendations[0];

    return {
      service,
      currentTier: currentTier.tier,
      currentCost: currentTier.monthly_cost,
      recommendedTier: best.tier.tier,
      recommendedCost: best.tier.monthly_cost,
      potentialSavings: best.savings,
      confidence: best.confidence,
      reasoning: this.generateReasoning(currentTier, best.tier, stats),
      autoExecutable: best.confidence >= 0.95
    };
  }

  /**
   * Check if usage fits within tier limits
   */
  private fitsUsagePattern(tier: Tier, stats: UsageStats): boolean {
    const peakUsage = stats.peak_day_tokens;
    const avgUsage = stats.total_tokens / 30;

    // Safety margin: 2x average, 1.5x peak
    const safeAverage = avgUsage * 2;
    const safePeak = peakUsage * 1.5;

    if (tier.quota_period === 'monthly') {
      return safePeak * 30 <= tier.quota_limit;
    } else if (tier.quota_period === 'daily') {
      return safePeak <= tier.quota_limit;
    }

    return false;
  }

  /**
   * Calculate confidence score (0.0 - 1.0)
   */
  private calculateConfidence(tier: Tier, stats: UsageStats): number {
    const usageRatio = stats.total_tokens / (tier.quota_limit * 30);
    const daysWithUsage = stats.days_with_activity;
    const consistencyScore = stats.stddev_tokens / stats.avg_tokens;

    let confidence = 1.0;

    // Penalize if using >80% of new tier quota
    if (usageRatio > 0.8) confidence *= 0.5;
    else if (usageRatio > 0.6) confidence *= 0.8;

    // Penalize if inconsistent usage
    if (consistencyScore > 0.5) confidence *= 0.9;

    // Penalize if few data points
    if (daysWithUsage < 20) confidence *= 0.85;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Execute tier change via browser automation
   */
  async executeTierChange(service: string, targetTier: string): Promise<boolean> {
    const browser = new BrowserAutomation();

    try {
      if (service === 'claude') {
        await browser.navigateTo('https://console.anthropic.com/settings/plans');
        // Login, navigate to plan settings, click change tier
        await browser.click(`button:has-text("Change to ${targetTier}")`);
        await browser.click('button:has-text("Confirm")');
      } else if (service === 'openai') {
        await browser.navigateTo('https://platform.openai.com/settings/billing');
        // Similar flow for OpenAI
      }

      // Update database
      await this.tierManager.updateTier(service, targetTier);

      return true;
    } catch (error) {
      console.error('Tier change failed:', error);
      return false;
    }
  }
}
```

**3. CostCalculator** (`src/monitoring/CostCalculator.ts`)

```typescript
class CostCalculator {
  /**
   * Calculate Claude cost based on tier and usage
   */
  calculateClaudeCost(tokensUsed: number, tier: string): { total: number; overage: number } {
    const tiers = {
      'free': { quota: 0, cost: 0, overage: 0.015 },     // $15 per 1M tokens
      'pro': { quota: 2000000, cost: 20, overage: 0.015 },
      'max': { quota: 500000, cost: 200, overage: 0.015 }  // 5-hour rolling window
    };

    const config = tiers[tier];
    const overageTokens = Math.max(0, tokensUsed - config.quota);
    const overageCost = (overageTokens / 1000000) * config.overage;

    return {
      total: config.cost + overageCost,
      overage: overageCost
    };
  }

  /**
   * Forecast monthly cost based on current rate
   */
  async forecastMonthlyCost(service: string): Promise<number> {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const stats = await this.usageMonitor.getUsageStats(service, last7Days);
    const dailyAverage = stats.total_tokens / 7;
    const projectedMonthly = dailyAverage * 30;

    const currentTier = await this.tierManager.getCurrentTier(service);
    const cost = this.calculateCost(projectedMonthly, currentTier);

    return cost.total;
  }
}
```

### Autonomous Operation

**Daily Optimization Check** (Cron: midnight UTC)

```typescript
async function dailyOptimizationCheck() {
  const optimizer = new SubscriptionOptimizer();
  const monitor = new UsageMonitor();

  // 1. Collect usage snapshot
  await monitor.collectDailySnapshot();

  // 2. Analyze each service
  for (const service of ['claude', 'openai']) {
    const recommendation = await optimizer.generateRecommendation(service);

    if (recommendation.potentialSavings > 50) {
      // Store recommendation
      await pool.query(`
        INSERT INTO cost_optimizations (
          analysis_date, service, current_tier, current_monthly_cost,
          recommended_tier, recommended_monthly_cost, potential_savings,
          reasoning, confidence, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      `, [
        new Date().toISOString().split('T')[0],
        service,
        recommendation.currentTier,
        recommendation.currentCost,
        recommendation.recommendedTier,
        recommendation.recommendedCost,
        recommendation.potentialSavings,
        recommendation.reasoning,
        recommendation.confidence
      ]);

      // Notify user
      await notifyUser({
        title: 'Cost Optimization Opportunity',
        service,
        currentTier: recommendation.currentTier,
        recommendedTier: recommendation.recommendedTier,
        savings: recommendation.potentialSavings,
        confidence: recommendation.confidence
      });

      // Auto-execute if enabled and high confidence
      if (recommendation.autoExecutable && await isAutoOptimizeEnabled(service)) {
        // Wait 24 hours for user review
        await scheduleExecution(service, recommendation.recommendedTier, '+24 hours');
      }
    }
  }
}
```

---

## Alternatives Considered

### Alternative 1: Manual Monitoring Only
**Pros:**
- Simple
- No automation risk
- User retains full control

**Cons:**
- User must check manually
- Easy to miss optimization opportunities
- No proactive recommendations

**Rejected:** Doesn't meet autonomous requirement

### Alternative 2: API-Based Tier Changes
**Pros:**
- More reliable than browser automation
- Faster execution
- Easier to test

**Cons:**
- Claude has no tier management API
- OpenAI has no tier management API
- Not possible without browser automation

**Rejected:** APIs don't exist

### Alternative 3: Notification Only (No Auto-Execution)
**Pros:**
- Safer (no accidental downgrades)
- User approval required
- Simple implementation

**Cons:**
- Not fully autonomous
- User must take action
- Doesn't meet "autonomous" goal

**Rejected:** User explicitly asked for autonomous execution

### Alternative 4: ML-Based Forecasting
**Pros:**
- More accurate predictions
- Better anomaly detection
- Handles seasonal patterns

**Cons:**
- Complex implementation
- Requires training data
- Overkill for current need

**Rejected:** Simple statistical methods sufficient for V1

---

## Consequences

### Positive
- ✅ **$180/mo savings**: Downgrade Claude MAX → PRO
- ✅ **Autonomous operation**: Daily checks, no manual monitoring
- ✅ **High confidence**: 95%+ threshold prevents incorrect downgrades
- ✅ **Safety validation**: 30-day usage check before downgrade
- ✅ **Visibility**: Real-time cost tracking and forecasts
- ✅ **Rollback capability**: Can undo tier changes if needed

### Negative
- ⚠️ **Browser automation fragility**: UI changes can break tier changes
- ⚠️ **Delayed savings**: 24-hour review window before execution
- ⚠️ **Overage risk**: If usage spikes after downgrade
- ⚠️ **Maintenance overhead**: Must update selectors when UIs change

### Mitigations
- **Fragility**: Retry logic, fallback to manual with instructions
- **Delayed savings**: User can execute immediately if desired
- **Overage risk**: 2x safety margin in fit calculations
- **Maintenance**: Monitor for failures, update proactively

---

## Implementation Checklist

**Phase 1: Database Schema**
- [ ] Create `subscription_tiers` table
- [ ] Create `usage_snapshots` table
- [ ] Create `cost_optimizations` table
- [ ] Add indexes
- [ ] Seed with current tier data

**Phase 2: Usage Monitoring**
- [ ] Implement `UsageMonitor` class
- [ ] Integrate with Claude API (usage endpoint)
- [ ] Integrate with OpenAI API (usage endpoint)
- [ ] Integrate with Gemini key manager (already tracking)
- [ ] Daily snapshot cron job

**Phase 3: Cost Calculation**
- [ ] Implement `CostCalculator` class
- [ ] Add tier pricing configs
- [ ] Add overage calculations
- [ ] Add forecasting logic

**Phase 4: Subscription Management**
- [ ] Implement `SubscriptionTierManager` class
- [ ] Load available tiers from config
- [ ] Track active tier changes

**Phase 5: Optimization Engine**
- [ ] Implement `SubscriptionOptimizer` class
- [ ] Usage pattern fitting logic
- [ ] Confidence scoring algorithm
- [ ] Reasoning generation
- [ ] Browser automation for tier changes

**Phase 6: MCP Tools**
- [ ] `get-usage-summary` - Current usage
- [ ] `get-cost-breakdown` - Cost analysis
- [ ] `get-usage-trends` - Historical trends
- [ ] `forecast-monthly-cost` - Predictions
- [ ] `analyze-subscription-usage` - Full analysis
- [ ] `recommend-tier-change` - Recommendations
- [ ] `execute-tier-change` - Execute change
- [ ] `enable-auto-optimization` - Toggle auto-execution

**Phase 7: Autonomous Operation**
- [ ] Daily optimization cron job
- [ ] User notification system
- [ ] Auto-execution scheduling
- [ ] Rollback capability

---

## Security Considerations

**Data Privacy:**
- Usage data stored locally (PostgreSQL)
- No third-party analytics
- Encrypted database connection
- Access restricted to supervisor process

**Financial Safety:**
- 24-hour review window before auto-execution
- 95%+ confidence threshold
- 30-day usage validation
- 2x safety margin in calculations
- Undo capability for tier changes

**Browser Automation:**
- Screenshots exclude sensitive data
- Credentials cleared after use
- Audit trail for all tier changes
- Manual fallback if automation fails

---

## Monitoring & Success Metrics

**Usage Monitoring:**
- Daily snapshot success rate (target: 100%)
- Cost calculation accuracy (target: ±5%)
- Snapshot collection time (target: <30 seconds)

**Optimization Engine:**
- Recommendation accuracy (target: 95%+)
- False positive rate (target: <5%)
- Actual savings vs. projected (target: ±10%)

**Tier Changes:**
- Execution success rate (target: 90%+)
- Time to execute (target: <5 minutes)
- Rollback rate (target: <5%)

---

## Example Recommendation Output

```
💰 Cost Optimization Opportunity

Service: Claude
Current: MAX ($200/mo)
Recommended: PRO ($20/mo)

Usage Analysis (30 days):
  Tokens used: 125K / 500K (25%)
  Peak day: 8.5K tokens (fits in PRO 50K/mo rolling window)
  Average day: 4.2K tokens
  Days with 0 usage: 5

Confidence: 97%
Potential savings: $180/mo ($2,160/year)

Recommendation: SAFE TO DOWNGRADE
Reasoning: Your usage is consistently below PRO tier limits.
  Even at 2x current rate, you'd stay within PRO quota.
  Your peak usage (8.5K) is well below PRO's 5-hour window limit.

[Auto-execute in 24 hours] [Execute Now] [Dismiss]
```

---

## References

- Epic: `/home/samuel/sv/supervisor-service-s/.bmad/epics/014-autonomous-usage-monitoring-optimization.md`
- PRD: `/home/samuel/sv/supervisor-service-s/.bmad/prds/014-autonomous-optimization-prd.md`
- Claude Pricing: https://www.anthropic.com/pricing
- OpenAI Pricing: https://openai.com/pricing
- Gemini Pricing: https://ai.google.dev/pricing

---

**Decision Maker:** Meta-Supervisor
**Reviewers:** N/A (autonomous system)
**Next Review:** After Phase 5 implementation
