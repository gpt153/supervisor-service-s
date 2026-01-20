# PRD: Autonomous Usage Monitoring & Optimization System

**Product:** Autonomous Cost Optimization & API Key Management
**Version:** 1.0
**Date:** 2026-01-20
**Author:** Meta-Supervisor
**Status:** Planning

---

## Executive Summary

Build a fully autonomous system that monitors AI service usage, optimizes subscription costs, and manages API key rotation with minimal user intervention. The system will save $180+/month by detecting subscription optimization opportunities and expanding free-tier API key rotation from 2 to 13+ accounts across Gemini and Claude.

**Key Features:**
- Real-time usage monitoring across Claude, OpenAI, Gemini
- Autonomous subscription tier recommendations (95%+ confidence)
- Multi-account API key rotation (Claude + Gemini)
- Browser automation for API key creation
- Self-healing quota management

**Target ROI:** $2,160/year in cost savings, immediate break-even

---

## Problem Statement

### Current Pain Points

**1. Overpaying for Subscriptions**
- User has Claude MAX ($200/mo) but only uses 25% of quota
- Additional $50-100/mo in overage charges
- No visibility into whether tier is appropriate

**2. Manual API Key Management**
- User must manually create Gmail accounts
- Must manually navigate to AI Studio to get API keys
- Must manually copy/paste keys into rotation system
- Time-consuming: 15 minutes per account

**3. Limited Free Tier Utilization**
- Only 2 Gemini accounts (2M tokens/day)
- No Claude free tier rotation (potential 6M+ tokens/month unused)
- Inefficient use of free quota available

**4. Reactive Quota Management**
- User discovers quota exhaustion after tasks fail
- No proactive monitoring or alerting
- Manual intervention required to add more capacity

---

## User Personas

### Primary: Cost-Conscious Power User

**Profile:**
- Heavy AI usage (1M+ tokens/month)
- Multiple subscriptions (Claude MAX, ChatGPT Plus, Gemini)
- Technical expertise (can create accounts, provide credentials)
- Values: Cost optimization, automation, minimal manual work

**Goals:**
- Pay only for capacity actually used
- Never run out of quota during critical work
- Minimize time spent on account management
- Visibility into costs and usage trends

**Pain Points:**
- Overpaying for underutilized subscriptions
- Manual quota monitoring is tedious
- API key creation is repetitive
- Uncertain about when to upgrade/downgrade

---

## Product Vision

### North Star

**"Zero-touch AI service optimization that saves money and eliminates quota anxiety"**

### 6-Month Vision

User provides credentials once, system handles everything:
- Autonomous subscription tier management (downgrade when safe, upgrade when needed)
- Self-healing quota (creates new API keys before exhaustion)
- 10+ Gemini accounts + 3+ Claude accounts rotating automatically
- Real-time cost visibility and forecasting
- $200+/month in sustained savings

### What Success Looks Like

**User workflow:**
1. Create Gmail accounts manually (on phone) - 5 min each
2. Provide credentials via MCP tool - 30 seconds
3. System creates API keys automatically - 2 minutes
4. System monitors and optimizes autonomously - forever

**System behavior:**
- Daily: Collects usage snapshots, analyzes costs
- Hourly: Checks quota thresholds, creates keys if needed
- Weekly: Reports savings and optimization opportunities
- Monthly: Validates subscription tiers, recommends changes

**Outcome:**
- User saves $180/mo (Claude MAX → PRO)
- User has 13M tokens/day free capacity (10 Gemini + 3 Claude)
- User spends 0 hours/month on quota management (vs 2-3 hours currently)

---

## Core Features

### Feature 1: Usage Monitoring & Cost Tracking

**User Story:**
"As a user, I want real-time visibility into my AI usage and costs across all services so I can make informed decisions about subscriptions."

**Capabilities:**
- Daily snapshot collection (tokens used, requests made, costs)
- Historical trend analysis (7-day, 30-day, 90-day views)
- Cost breakdown by service and tier
- Usage forecasting (predict monthly costs based on current rate)
- MCP tools for querying data

**Acceptance Criteria:**
- [ ] Snapshots collected daily at midnight UTC
- [ ] Cost calculations accurate within ±5% of actual billing
- [ ] MCP tool returns usage data within 200ms
- [ ] Historical trends visible for 90+ days

**MCP Tools:**
- `get-usage-summary` - Current usage across all services
- `get-cost-breakdown` - Detailed cost analysis
- `get-usage-trends` - Historical trends (charts)
- `forecast-monthly-cost` - Predicted costs

---

### Feature 2: Subscription Optimization

**User Story:**
"As a user, I want autonomous recommendations for subscription changes so I'm never overpaying for capacity I don't use."

**Capabilities:**
- Daily analysis of usage vs subscription tier
- Downgrade safety validation (30-day historical check)
- Confidence scoring (0-100%) for recommendations
- Reasoning explanation (why downgrade is safe/unsafe)
- Automated tier change execution (browser automation if needed)
- Rollback capability

**Acceptance Criteria:**
- [ ] Detects Claude MAX @ 25% usage → recommends PRO
- [ ] Confidence score ≥95% for safe downgrades
- [ ] Reasoning includes 30 days of usage data
- [ ] Tier change executes successfully via browser automation
- [ ] User notified before auto-execution (24-hour window)

**MCP Tools:**
- `analyze-subscription-usage` - Full optimization analysis
- `recommend-tier-change` - Get recommendation for service
- `execute-tier-change` - Change subscription tier
- `enable-auto-optimization` - Toggle autonomous execution

**Example Recommendation:**
```
💰 Cost Optimization Opportunity

Service: Claude
Current: MAX ($200/mo)
Recommended: PRO ($20/mo)

Usage Analysis (30 days):
  Tokens used: 125K / 500K (25%)
  Peak day: 8.5K tokens (fits in PRO 50K/mo)
  Days with 0 usage: 5

Confidence: 97%
Potential savings: $180/mo ($2,160/year)

Recommendation: SAFE TO DOWNGRADE
Reasoning: Your usage is consistently below PRO tier limits.
  Even at 2x current rate, you'd stay within PRO quota.

[Auto-execute in 24 hours] [Execute Now] [Dismiss]
```

---

### Feature 3: Claude API Key Rotation

**User Story:**
"As a user, I want automatic Claude API key rotation (like Gemini) so I can use 3+ free tier accounts for 6M tokens/month."

**Capabilities:**
- Multi-key storage in database
- Priority-based key selection
- Automatic rotation on quota exhaustion
- Per-key usage logging
- Quota reset at 30-day boundaries
- MCP tools for key management

**Acceptance Criteria:**
- [ ] 3+ Claude API keys rotate automatically
- [ ] Usage logged per key in database
- [ ] Quota resets when `quota_resets_at` passes
- [ ] MCP tools mirror Gemini functionality exactly

**MCP Tools:**
- `get-claude-keys` - List all Claude API keys
- `add-claude-key` - Add new key
- `remove-claude-key` - Remove key
- `toggle-claude-key` - Enable/disable
- `get-claude-key-stats` - Usage statistics
- `init-claude-keys` - Load from environment

**Database Schema:**
- `claude_api_keys` table (same structure as `gemini_api_keys`)
- `claude_key_usage_log` table (per-key request logging)
- `claude_available_keys` view (auto-calculated availability)

---

### Feature 4: API Key Creation Automation

**User Story:**
"As a user, I want to provide credentials once and have the system create all future API keys automatically so I don't waste time on manual key copying."

**Capabilities:**
- Secure credential storage (encrypted in secrets manager)
- Browser automation for Gemini AI Studio
- Browser automation for Anthropic Console
- Automatic key extraction from web pages
- Immediate storage in rotation database
- Error handling and retry logic

**Acceptance Criteria:**
- [ ] Given Gmail credentials, creates Gemini API key in <5 minutes
- [ ] Given Anthropic credentials, creates Claude API key in <5 minutes
- [ ] Keys stored in secrets + rotation database
- [ ] Errors logged and user notified
- [ ] Works with CAPTCHA (pauses for user input)

**MCP Tools:**
- `store-account-credentials` - Store login credentials
- `create-gemini-api-key` - Automate Gemini key creation
- `create-claude-api-key` - Automate Claude key creation
- `list-stored-accounts` - View accounts available

**User Workflow:**
```
1. User creates Gmail account manually (phone)
2. User calls: store-account-credentials
   Parameters: {
     service: 'google',
     email: 'supervisor-153-003@gmail.com',
     password: 'secure-password'
   }
3. User calls: create-gemini-api-key
   Parameters: {
     accountEmail: 'supervisor-153-003@gmail.com'
   }
4. System:
   - Opens browser to AI Studio
   - Logs in with stored credentials
   - Clicks "Create API Key"
   - Extracts key from page
   - Stores in secrets (meta/gemini/supervisor-153-003)
   - Adds to rotation (gemini_api_keys table)
5. User receives: "✅ Created Gemini API key: AIzaSy..."
```

---

### Feature 5: Autonomous Quota Management

**User Story:**
"As a user, I want the system to detect quota exhaustion and create new API keys automatically so I never run out of capacity."

**Capabilities:**
- Hourly quota threshold monitoring
- Automatic detection when >80% quota used
- New API key creation using stored credentials
- Immediate addition to rotation
- User notification of autonomous actions
- Override/disable capability

**Acceptance Criteria:**
- [ ] Detects >80% quota usage within 1 hour
- [ ] Creates new API key within 5 minutes of detection
- [ ] Key added to rotation and immediately available
- [ ] User notified: "Created account 5 due to high usage"
- [ ] Can be disabled via `enable-auto-account-creation` tool

**Logic:**
```typescript
// Run hourly
async function checkQuotaThresholds() {
  const geminiKeys = await geminiKeyManager.getAllKeys();
  const totalRemaining = sum(geminiKeys, k => k.remaining);
  const totalQuota = sum(geminiKeys, k => k.dailyQuota);
  const usagePercent = ((totalQuota - totalRemaining) / totalQuota) * 100;

  if (usagePercent > 80) {
    // High usage detected
    const nextAccountIndex = await getNextAccountIndex('gemini');
    const credentials = await getStoredCredentials('google', nextAccountIndex);

    if (credentials) {
      // Create new API key automatically
      const apiKey = await createGeminiAPIKey(credentials);
      await notifyUser(`✅ Created Gemini account ${nextAccountIndex} (quota: ${usagePercent}%)`);
    } else {
      // No credentials stored
      await notifyUser(`⚠️ High quota usage (${usagePercent}%) but no credentials for account ${nextAccountIndex}`);
    }
  }
}
```

---

## Non-Functional Requirements

### Performance
- MCP tool response times: <500ms for queries, <5 minutes for automation
- Usage snapshot collection: <30 seconds
- Browser automation: <5 minutes per key creation
- Hourly quota checks: <10 seconds

### Reliability
- Uptime: 99.9% for monitoring (tolerant of short outages)
- Browser automation: 90%+ success rate (CAPTCHA fallback to manual)
- Data accuracy: ±5% cost calculations vs actual billing
- Retry logic: 3 attempts for browser automation failures

### Security
- Credentials: AES-256-GCM encryption at rest
- API keys: Never logged in plain text
- Audit trail: All tier changes and key creations logged
- Browser automation: Screenshots exclude credential fields
- Access control: Secrets only accessible to supervisor process

### Scalability
- Support: 50+ API keys per service
- Database: Efficient queries with indexes
- Snapshots: 5-year retention (daily rollups)
- MCP tools: Handle 1000+ requests/day

---

## Out of Scope (V1)

**Not included in this release:**

1. **Full account creation automation**
   - Reason: Gmail ToS risk, phone verification complexity
   - Alternative: User creates accounts, system creates keys

2. **Cross-service cost comparison**
   - Example: "Claude vs OpenAI for same task"
   - Reason: Complex benchmarking, low ROI for V1

3. **Budget constraints / spending limits**
   - Example: "Stop when spend > $100/mo"
   - Reason: Subscription-based (predictable costs), not pay-per-token

4. **Invoice reconciliation**
   - Example: Compare system estimates to actual bills
   - Reason: Manual process, low automation potential

5. **Voice mode / multimodal integration**
   - Reason: Out of scope for cost optimization

6. **Custom fine-tuned models**
   - Reason: Using subscription-included CLIs only

---

## Success Metrics (KPIs)

### Financial Impact

| Metric | Baseline | 1-Month | 3-Month | 6-Month |
|--------|----------|---------|---------|---------|
| Monthly AI spend | $270-320 | $60-80 | $40-60 | $40-60 |
| Overage charges | $50-100 | $0 | $0 | $0 |
| Subscription costs | $240 | $60 | $40 | $40 |
| Free tier utilization | 3% | 60% | 80% | 85% |
| **Total savings/mo** | - | **$210** | **$230** | **$240** |

### Operational Efficiency

| Metric | Baseline | Target |
|--------|----------|--------|
| Time to add API key | 15 min | 2 min |
| Manual interventions/mo | 10-15 | 0-2 |
| Quota exhaustion incidents | 2-3/mo | 0 |
| Account management hours/mo | 2-3 hrs | 0.1 hrs |

### System Performance

| Metric | Target |
|--------|--------|
| Optimization accuracy | 95%+ safe recommendations |
| Browser automation success | 90%+ |
| Self-healing uptime | 99%+ |
| Recommendation confidence | ≥95% for auto-execution |

---

## Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Incorrect downgrade → service disruption | High | Low | 30-day validation, 95% confidence threshold, 24-hour review window |
| Browser automation blocked by CAPTCHA | Medium | High | Pause for user input, fallback to manual with clear instructions |
| Credential compromise | High | Low | AES-256-GCM encryption, audit logging, immediate rotation if detected |
| Over-creation of accounts | Low | Medium | 80% threshold, user notification, disable override available |
| Cost calculation errors | Medium | Low | Weekly reconciliation with actual bills, ±5% tolerance |
| Subscription tier change fails | Medium | Low | Browser automation retry (3x), rollback on failure, manual fallback |

---

## Dependencies

### Internal
- Multi-Agent CLI Integration (Epic 013) - Gemini rotation pattern
- Secrets Manager - Credential storage
- PostgreSQL - Usage tracking
- MCP Tools - User interface

### External
- Playwright MCP - Browser automation
- Google AI Studio - Gemini API key creation endpoint
- Anthropic Console - Claude API key creation endpoint
- Service APIs - Usage data (Claude, OpenAI)

---

## Launch Plan

### Alpha (Week 1-2)
- Usage monitoring live
- Cost tracking functional
- MCP tools available
- User testing with real data

### Beta (Week 3)
- Claude rotation enabled
- API key automation functional
- User tests with 2-3 new accounts
- Optimization recommendations generated

### GA (Week 4)
- Autonomous operation live
- All features enabled
- Documentation complete
- User achieves cost savings

### Post-Launch (Week 5+)
- Monitor cost savings
- Tune thresholds
- Expand to 10 Gemini + 3 Claude accounts
- Validate $180/mo savings sustained

---

## Open Questions

1. **Auto-execution default:** Should tier changes auto-execute by default, or require explicit opt-in?
   - **Recommendation:** Require opt-in for safety

2. **Notification method:** How should user be notified of autonomous actions?
   - **Options:** MCP tool output, log file, Slack webhook, email
   - **Recommendation:** MCP tool + log file (V1), Slack/email (V2)

3. **Credential rotation:** How often should stored credentials be re-verified?
   - **Recommendation:** Every 30 days with password re-entry prompt

4. **Quota threshold:** Is 80% the right trigger point for new account creation?
   - **Recommendation:** 80% with user-configurable override

---

## Appendix

### Related Documents
- Epic: `/home/samuel/sv/supervisor-service-s/.bmad/epics/014-autonomous-usage-monitoring-optimization.md`
- Implementation Plan: `/home/samuel/.claude/plans/eager-forging-charm.md`
- ADRs: `/home/samuel/sv/supervisor-service-s/.bmad/adr/014-*.md`

### Cost Breakdown (Current State)
```
Claude MAX: $200/mo
  Usage: 125K / 500K tokens (25%)
  Overages: ~$50-100/mo
  ROI of MAX: Poor (4x overpaying)

ChatGPT Plus: $20/mo
  Usage: ~450 / unlimited messages (moderate)
  ROI: Good (sufficient utilization)

Gemini (Free): $0
  Accounts: 2
  Usage: 2.1M / 60M tokens/month (3.5%)
  ROI: Excellent (massive headroom)

Total: $270-320/mo
```

### Cost Breakdown (Optimized State)
```
Claude PRO: $20/mo
  Usage: 125K / 2M tokens/month (6%)
  ROI: Excellent (fits comfortably)

ChatGPT Plus: $20/mo
  (unchanged)

Gemini (Free): $0
  Accounts: 10
  Usage: 5-8M / 300M tokens/month (2-3%)
  ROI: Excellent

Claude Free Tier: $0
  Accounts: 3
  Usage: ~150K / 6M tokens/month (2.5%)
  ROI: Excellent

Total: $40/mo
Savings: $230/mo (72% reduction)
```
