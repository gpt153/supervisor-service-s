# Epic: Autonomous Usage Monitoring & Optimization System

**Epic ID:** 014
**Created:** 2026-01-20
**Status:** Planning
**Complexity Level:** 4 (Very Complex)
**Priority:** Critical

---

## Project Context

- **Project:** supervisor-service (meta)
- **Repository:** gpt153/supervisor-service
- **Tech Stack:** TypeScript, Node.js, PostgreSQL, Playwright (browser automation)
- **Related Epics:** EPIC-013 (Multi-Agent CLI Integration)
- **Workspace:** `/home/samuel/sv/supervisor-service-s/`
- **Purpose:** Autonomous cost optimization, API key rotation expansion, and self-healing quota management

---

## Business Context

### Problem Statement

User is currently spending $270-320/month on AI services with suboptimal utilization:
- **Claude MAX:** $200/mo - only using 25% of quota + $50-100/mo overages
- **ChatGPT Plus:** $20/mo - adequate utilization
- **Gemini:** 2 free accounts (2M tokens/day) - room for expansion

**Manual overhead:**
- Creating new Gmail accounts for API key rotation
- Monitoring quota usage across services
- Identifying subscription optimization opportunities
- Managing multiple API keys per service

**Current state:** Reactive management, overpaying for underutilized tiers

**Desired state:** Autonomous system that monitors, optimizes, and self-heals with minimal user intervention

### User Value

**Cost Savings:**
- Downgrade Claude MAX ($200) → PRO ($20) = **$180/mo savings**
- Expand Gemini rotation (2 → 10 accounts) = **10M tokens/day free**
- Add Claude free tier rotation (3 accounts) = **$30/mo additional free capacity**
- **Total potential savings: $200+/month (75% reduction)**

**Automation:**
- No manual quota monitoring
- Automatic API key creation when accounts provided
- Self-healing rotation when quota exhausted
- Proactive subscription tier recommendations

**Visibility:**
- Real-time cost tracking across all services
- Usage trend analysis and forecasting
- ROI dashboard for subscription decisions

### Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Monthly AI spend | $270-320 | $40-60 | Billing dashboards |
| Manual interventions/month | 10-15 | 0-2 | Automation logs |
| Quota utilization | ~30% | 80%+ | Usage monitoring |
| Time to add new API key | 15 min | 2 min | Automation timing |
| Subscription optimization accuracy | N/A | 95%+ | Downgrade safety validation |
| API key rotation uptime | Manual | 99.9% | Self-healing logs |

---

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**
- [ ] Usage monitoring across all AI services (Claude, OpenAI, Gemini)
- [ ] Daily usage snapshots with cost calculation
- [ ] Subscription tier tracking and comparison
- [ ] Cost optimization recommendations with confidence scores
- [ ] Claude API key rotation (mirror Gemini system)
- [ ] Browser automation for API key creation (Gemini, Claude)
- [ ] Secure credential storage for account logins
- [ ] Autonomous quota monitoring (hourly checks)
- [ ] MCP tools for all management operations

**SHOULD HAVE:**
- [ ] Usage trend forecasting (predict monthly costs)
- [ ] Subscription tier change execution (automated downgrade/upgrade)
- [ ] Anomaly detection (unusual usage patterns)
- [ ] Cost alerts (threshold-based notifications)
- [ ] Multi-account creation workflow (batch automation)
- [ ] Scheduled optimization checks (daily analysis)

**COULD HAVE:**
- [ ] Usage dashboard (visual analytics)
- [ ] Webhook notifications (Slack, email)
- [ ] Budget constraints (hard spending limits)
- [ ] Cost allocation by project/task type
- [ ] ML-based usage prediction

**WON'T HAVE (this iteration):**
- Full account creation automation (Gmail signup) - ToS risk
- Cross-service cost comparison (e.g., Claude vs OpenAI for same task)
- Invoice generation / billing reconciliation

---

## Technical Design

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Autonomous Optimization System             │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────┐
│    Usage     │  │  Subscription   │  │   Browser    │
│  Monitoring  │  │  Optimization   │  │  Automation  │
└──────────────┘  └─────────────────┘  └──────────────┘
        │                  │                  │
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────┐
│  PostgreSQL  │  │  Key Rotation   │  │   Secrets    │
│   Snapshots  │  │    Manager      │  │   Manager    │
└──────────────┘  └─────────────────┘  └──────────────┘
```

### Database Schema

**New Tables:**

1. **subscription_tiers** - Track active subscription plans
2. **usage_snapshots** - Daily usage and cost rollups
3. **cost_optimizations** - Recommendation history
4. **claude_api_keys** - Multi-key rotation for Claude
5. **claude_key_usage_log** - Per-key usage tracking

### Core Components

**1. Usage Monitoring**
- `UsageMonitor` - Collect daily snapshots
- `CostCalculator` - Compute costs per service/tier
- `SubscriptionTierManager` - Track active tiers

**2. Optimization**
- `SubscriptionOptimizer` - Generate tier recommendations
- `TierComparison` - Compare costs at different usage levels
- `ConfidenceScoring` - Calculate recommendation confidence

**3. Key Rotation**
- `ClaudeKeyManager` - Mirror Gemini pattern
- `ClaudeCLIAdapter` - Integrate rotation into adapter
- `QuotaManager` - Extended for Claude keys

**4. Browser Automation**
- `BrowserAutomation` - Playwright wrapper
- `GeminiAPIKeyCreator` - Automated Gemini key creation
- `AnthropicAPIKeyCreator` - Automated Claude key creation
- `CredentialManager` - Secure login storage

**5. Autonomous Management**
- `AutomatedAccountManager` - Self-healing quota
- `ScheduledJobs` - Hourly/daily automation
- `AlertingSystem` - User notifications

---

## User Stories

### Epic-Level Stories

**As a user, I want:**

1. **Automatic cost optimization** so I'm not overpaying for underutilized subscriptions
   - Acceptance: System detects Claude MAX @ 25% usage, recommends PRO tier
   - Acceptance: Recommendation includes 30-day usage history and confidence score

2. **Autonomous API key rotation** so I never run out of free quota
   - Acceptance: When Gemini keys hit 80% usage, system creates new key automatically
   - Acceptance: New keys added to rotation within 5 minutes of detection

3. **Hands-off account management** so I only create accounts, system does the rest
   - Acceptance: User provides credentials once, system creates all future API keys
   - Acceptance: No manual key copying or storage required

4. **Real-time usage visibility** so I know where my money goes
   - Acceptance: MCP tool shows current usage and costs across all services
   - Acceptance: Daily snapshots stored with historical trends

5. **Safe subscription changes** so I never lose service by downgrading
   - Acceptance: System validates 30 days of usage fits in lower tier
   - Acceptance: 95%+ confidence required before auto-execution

---

## Implementation Phases

### Phase 1: Usage Monitoring & Cost Tracking (Week 1)
**Goal:** Real-time visibility into usage and costs

**Tasks:**
- [ ] Create database schema (subscription_tiers, usage_snapshots, cost_optimizations)
- [ ] Implement UsageMonitor class
- [ ] Implement CostCalculator class
- [ ] Implement SubscriptionTierManager class
- [ ] Build MCP tools (get-usage-summary, get-cost-breakdown, forecast-monthly-cost)
- [ ] Daily snapshot collection job
- [ ] Test with historical data

**Deliverables:**
- Database migrations
- Working usage monitoring
- MCP tools for querying usage
- Daily snapshot automation

**Success Criteria:**
- Usage snapshots collected daily at midnight
- Cost calculations match actual billing
- MCP tools return accurate data

---

### Phase 2: Subscription Optimization (Week 2)
**Goal:** Autonomous tier recommendations with execution capability

**Tasks:**
- [ ] Implement SubscriptionOptimizer class
- [ ] Build tier comparison logic
- [ ] Implement confidence scoring
- [ ] Create downgrade safety validation
- [ ] Build MCP tools (analyze-subscription-usage, recommend-tier-change, execute-tier-change)
- [ ] Browser automation for tier changes (if API unavailable)
- [ ] Test with real user data

**Deliverables:**
- Working optimization engine
- Tier change MCP tools
- Browser automation for Claude/OpenAI tier changes
- Safety validation system

**Success Criteria:**
- Correctly identifies Claude MAX → PRO opportunity
- Confidence score 95%+ for safe downgrades
- Tier change execution works via browser automation

---

### Phase 3: Claude API Key Rotation (Week 3)
**Goal:** Multi-key rotation for Claude (mirror Gemini)

**Tasks:**
- [ ] Create claude_api_keys and claude_key_usage_log tables
- [ ] Implement ClaudeKeyManager class (all CRUD operations)
- [ ] Update ClaudeCLIAdapter for automatic key rotation
- [ ] Extend QuotaManager to support Claude keys
- [ ] Build MCP tools (get-claude-keys, add-claude-key, get-claude-key-stats, etc.)
- [ ] Test with multiple Claude free tier accounts
- [ ] Document setup process

**Deliverables:**
- Claude key rotation database
- ClaudeKeyManager implementation
- Updated ClaudeCLIAdapter
- MCP tools for key management
- User documentation

**Success Criteria:**
- Multiple Claude keys rotate automatically
- Usage logged per key
- Quota resets at 30-day boundaries
- MCP tools work identically to Gemini tools

---

### Phase 4: API Key Creation Automation (Week 3-4)
**Goal:** Automate API key creation given user credentials

**Tasks:**
- [ ] Implement BrowserAutomation wrapper (Playwright MCP integration)
- [ ] Implement GeminiAPIKeyCreator (login → create key → extract → store)
- [ ] Implement AnthropicAPIKeyCreator (same flow for Claude)
- [ ] Secure credential storage in secrets manager
- [ ] Build MCP tools (create-gemini-api-key, create-claude-api-key, store-account-credentials)
- [ ] Error handling and retry logic
- [ ] Test with real accounts (manual verification)

**Deliverables:**
- BrowserAutomation class
- Service-specific key creators
- MCP tools for automation
- Credential storage system

**Success Criteria:**
- Given Gmail credentials, creates Gemini API key automatically
- Given Anthropic credentials, creates Claude API key automatically
- Keys stored in secrets + rotation database
- <5 minute end-to-end time

---

### Phase 5: Autonomous Operation (Week 4)
**Goal:** Self-healing system with scheduled automation

**Tasks:**
- [ ] Implement AutomatedAccountManager
- [ ] Quota threshold detection (>80% usage)
- [ ] Scheduled jobs (hourly quota checks, daily optimization)
- [ ] User notification system
- [ ] Auto-execution preferences (enable/disable per action type)
- [ ] End-to-end testing
- [ ] Production deployment
- [ ] User documentation

**Deliverables:**
- Autonomous account manager
- Scheduled job system
- Notification system
- Complete user guide

**Success Criteria:**
- Detects >80% quota usage automatically
- Creates new API key within 1 hour of detection
- Daily optimization runs at midnight
- User can enable/disable auto-actions
- Full end-to-end flow tested

---

## Technical Constraints

### Browser Automation Limitations
- Playwright available via MCP (not direct integration)
- CAPTCHA requires manual intervention (pause automation)
- Phone verification must be user-provided
- ToS compliance: automation must be for legitimate personal use

### API Limitations
- Claude API has no programmatic tier management (browser only)
- OpenAI API has no programmatic tier management (browser only)
- Gemini API keys limited to 1M tokens/day per account (free tier)
- Claude free tier limited to $10/month (~50K tokens)

### Security Constraints
- Credentials must be encrypted (AES-256-GCM)
- Browser automation screenshots should not log credentials
- API keys must never appear in logs (plain text)
- Audit trail required for all tier changes

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Incorrect downgrade recommendation | High | Low | 30-day validation, 95% confidence threshold |
| Browser automation failure | Medium | Medium | Retry logic, fallback to manual, error alerts |
| CAPTCHA blocking | Medium | High | Pause for user input, headless detection bypass |
| Credential compromise | High | Low | Encrypted storage, audit logging, key rotation |
| Over-creation of accounts | Low | Medium | 80% threshold, user notification before action |
| Rate limiting | Low | Medium | Backoff strategy, hourly checks instead of continuous |

---

## Dependencies

**Internal:**
- EPIC-013 (Multi-Agent CLI Integration) - Gemini rotation pattern
- Secrets Manager - Credential storage
- Database - PostgreSQL for tracking
- MCP Tools - User interface

**External:**
- Playwright MCP - Browser automation
- Google AI Studio - Gemini API key creation
- Anthropic Console - Claude API key creation
- Service APIs - Usage data retrieval

---

## Testing Strategy

### Unit Tests
- CostCalculator tier pricing
- Confidence scoring algorithms
- Quota threshold detection
- Key rotation logic

### Integration Tests
- Database snapshot collection
- MCP tool end-to-end flows
- Browser automation sequences
- Secrets manager integration

### End-to-End Tests
- Full usage monitoring cycle (collect → analyze → recommend)
- Complete key creation flow (credentials → browser → key → storage)
- Autonomous quota management (detect → create → rotate)
- Subscription tier change (recommendation → execution → validation)

### Manual Testing
- Browser automation with real accounts (Gemini, Claude)
- Subscription tier changes in actual services
- User workflow (credentials → automation → verification)

---

## Documentation Requirements

**User Guides:**
- Setup guide (credential storage, initial configuration)
- API key creation walkthrough
- Subscription optimization usage
- Troubleshooting guide

**Technical Docs:**
- Architecture overview
- Database schema documentation
- MCP tool reference
- Browser automation patterns

**Runbooks:**
- Autonomous operation monitoring
- Emergency disabling procedures
- Manual intervention scenarios

---

## Success Criteria

**Phase 1:**
- [ ] Daily snapshots collecting successfully
- [ ] Cost calculations accurate (±5%)
- [ ] MCP tools return usage data
- [ ] Historical trends visible

**Phase 2:**
- [ ] Claude MAX → PRO recommendation generated
- [ ] Confidence score ≥95% for user's usage
- [ ] Safe downgrade validation passes
- [ ] Tier change execution works (browser automation)

**Phase 3:**
- [ ] 3+ Claude API keys rotating automatically
- [ ] Per-key usage logging functional
- [ ] MCP tools mirror Gemini functionality
- [ ] Quota resets work correctly

**Phase 4:**
- [ ] Given credentials, creates Gemini key (tested)
- [ ] Given credentials, creates Claude key (tested)
- [ ] Keys stored in rotation immediately
- [ ] Error handling prevents data loss

**Phase 5:**
- [ ] Autonomous quota checks run hourly
- [ ] New keys created when >80% threshold hit
- [ ] Daily optimization recommends Claude downgrade
- [ ] User notified of all autonomous actions
- [ ] System runs without intervention for 1 week

---

## Rollout Plan

**Week 1:** Deploy Phase 1 to production
- Usage monitoring active
- Daily snapshots collecting
- User can query via MCP tools

**Week 2:** Deploy Phase 2 to production
- Optimization recommendations generated
- User receives daily cost report
- Tier change capability available (manual approval)

**Week 3:** Deploy Phases 3-4 to production
- Claude rotation available
- API key automation live
- User tests with 1-2 new accounts

**Week 4:** Deploy Phase 5 to production
- Autonomous operation enabled
- Hourly quota checks active
- Daily optimization with auto-execution (opt-in)

**Week 5:** Monitor and optimize
- Verify cost savings realized
- Tune thresholds based on behavior
- Expand to 10 Gemini + 3 Claude accounts

---

## Definition of Done

- [ ] All 5 phases complete and tested
- [ ] User achieves $180/mo savings (Claude downgrade)
- [ ] 10 Gemini accounts + 3 Claude accounts in rotation
- [ ] Autonomous operation runs for 1 week without intervention
- [ ] MCP tools fully functional
- [ ] Documentation complete
- [ ] Code reviewed and merged
- [ ] Production deployment successful

---

## Related Documents

- PRD: `/home/samuel/sv/supervisor-service-s/.bmad/prds/014-autonomous-optimization-prd.md`
- ADR: `/home/samuel/sv/supervisor-service-s/.bmad/adr/014-browser-automation-for-api-keys.md`
- ADR: `/home/samuel/sv/supervisor-service-s/.bmad/adr/014-subscription-tier-management.md`
- Implementation Plan: `/home/samuel/.claude/plans/eager-forging-charm.md`

---

**Epic Owner:** Meta-Supervisor
**Stakeholders:** User (cost optimization, time savings)
**Estimated Effort:** 4 weeks
**ROI:** $180/mo savings = $2,160/year (break-even immediate)
