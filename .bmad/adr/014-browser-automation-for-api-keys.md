# ADR 014-A: Browser Automation for API Key Creation

**Date:** 2026-01-20
**Status:** Accepted
**Epic:** 014 - Autonomous Usage Monitoring & Optimization

---

## Context

We need to automate the creation of API keys for Gemini and Claude services to enable autonomous quota management. Users will manually create Gmail/Anthropic accounts (to avoid ToS violations), but the system should automate the API key creation process from those credentials.

**Requirements:**
- Given login credentials, create API keys automatically
- Support Gemini AI Studio and Anthropic Console
- Store keys in secrets manager and rotation database
- Handle CAPTCHA and phone verification gracefully
- Minimize user intervention (< 5 minutes per key)
- Secure credential handling (no plain text logging)

**Constraints:**
- Must comply with service ToS (no full account automation)
- Must handle auth flows (Google, Anthropic)
- Must work with MCP architecture (Playwright MCP available)
- Must be reliable (90%+ success rate)

---

## Decision

**We will use browser automation via Playwright MCP to create API keys from user-provided credentials.**

### Architecture

```
┌─────────────────────────────────────────┐
│     BrowserAutomation (Core)            │
│  - Generic login/navigation/extraction  │
└─────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│ GeminiAPIKey     │  │ AnthropicAPIKey  │
│ Creator          │  │ Creator          │
│                  │  │                  │
│ - Login to AI    │  │ - Login to       │
│   Studio         │  │   Console        │
│ - Navigate to    │  │ - Navigate to    │
│   key page       │  │   key page       │
│ - Click create   │  │ - Click create   │
│ - Extract key    │  │ - Extract key    │
│ - Store in       │  │ - Store in       │
│   secrets/DB     │  │   secrets/DB     │
└──────────────────┘  └──────────────────┘
```

### Implementation Pattern

**1. BrowserAutomation Core** (`src/automation/BrowserAutomation.ts`):
- Wrapper around Playwright MCP tools
- Generic methods: `login()`, `navigateTo()`, `fillForm()`, `click()`, `extractText()`
- Error handling: Screenshots, retries, CAPTCHA detection
- Headless mode by default

**2. Service-Specific Creators**:
- `GeminiAPIKeyCreator` - Google AI Studio automation
- `AnthropicAPIKeyCreator` - Anthropic Console automation
- Each implements full flow: login → create → extract → store

**3. Credential Storage**:
- Encrypted in secrets manager: `meta/google/credentials`, `meta/anthropic/credentials`
- Never logged in plain text
- Cleared from memory after use

**4. MCP Tool Integration**:
- `create-gemini-api-key` - High-level tool
- `create-claude-api-key` - High-level tool
- `store-account-credentials` - Credential storage

### Example Flow (Gemini)

```typescript
class GeminiAPIKeyCreator {
  async createAPIKey(credentials: { email: string, password: string }): Promise<string> {
    // 1. Navigate to AI Studio
    await this.browser.navigateTo('https://aistudio.google.com/app/apikey');

    // 2. Login if needed
    if (await this.needsLogin()) {
      await this.browser.login('google', credentials);
    }

    // 3. Click "Create API Key"
    await this.browser.click('button:has-text("Create API key")', 'Create API Key button');

    // 4. Handle project selection if prompted
    await this.handleProjectSelection();

    // 5. Extract key
    await this.browser.waitFor({ text: 'AIzaSy' });
    const apiKey = await this.browser.extractText('[data-testid="api-key-value"]');

    // 6. Store
    await this.storeKey(apiKey, credentials.email);

    return apiKey;
  }

  private async storeKey(apiKey: string, email: string): Promise<void> {
    const secretsManager = new SecretsManager();
    const keyManager = new GeminiKeyManager();

    const keyName = email.split('@')[0];

    // Store in secrets
    await secretsManager.set({
      keyPath: `meta/gemini/${keyName}`,
      value: apiKey,
      description: `Gemini API key for ${email}`
    });

    // Add to rotation
    await keyManager.addKey({
      keyName,
      apiKey,
      accountEmail: email,
      dailyQuota: 1000000,
      priority: 0
    });
  }
}
```

---

## Alternatives Considered

### Alternative 1: Selenium WebDriver
**Pros:**
- Mature ecosystem
- Direct control
- More documentation

**Cons:**
- Requires separate driver installation
- Harder to integrate with MCP architecture
- More brittle (driver version matching)

**Rejected:** Playwright MCP already available, better MCP integration

### Alternative 2: Official APIs
**Pros:**
- Most reliable
- No browser automation complexity
- Faster execution

**Cons:**
- Google AI Studio has no API key creation API
- Anthropic Console has no API key creation API
- Would require manual key creation

**Rejected:** APIs don't exist for key creation

### Alternative 3: Manual MCP Tool with Instructions
**Pros:**
- Simple
- No automation complexity
- User retains full control

**Cons:**
- User must copy/paste keys manually
- Time-consuming (15 minutes per key)
- Defeats purpose of autonomous system

**Rejected:** Doesn't meet automation requirement

### Alternative 4: Full Account Creation (Gmail signup)
**Pros:**
- Fully autonomous
- No user intervention

**Cons:**
- ToS violation risk
- Phone verification required (can't automate)
- CAPTCHA challenges
- High complexity

**Rejected:** ToS concerns, user explicitly said "hold on gmail account creation"

---

## Consequences

### Positive
- ✅ **90%+ automation**: User only creates accounts, system does rest
- ✅ **Time savings**: 15 min → 2 min per API key
- ✅ **Scalability**: Can create 10+ keys in under 30 minutes
- ✅ **Self-healing quota**: System creates keys when needed
- ✅ **MCP integration**: Uses existing Playwright MCP server

### Negative
- ⚠️ **CAPTCHA challenges**: Requires manual intervention when triggered
- ⚠️ **Brittle selectors**: Web UI changes can break automation
- ⚠️ **Maintenance overhead**: Must update when UIs change
- ⚠️ **Not 100% reliable**: Phone verification, CAPTCHA, rate limits

### Mitigations
- **CAPTCHA**: Pause automation, notify user, resume after manual completion
- **Brittle selectors**: Use multiple selector strategies (text, role, testid)
- **Maintenance**: Monitor for failures, update selectors proactively
- **Reliability**: Retry logic (3 attempts), fallback to manual with clear instructions

---

## Implementation Checklist

**Phase 1: Core Framework**
- [ ] Implement `BrowserAutomation` wrapper class
- [ ] Add generic methods (login, navigate, fill, click, extract)
- [ ] Add error handling (screenshots, retries, CAPTCHA detection)
- [ ] Test with simple navigation flows

**Phase 2: Gemini Integration**
- [ ] Implement `GeminiAPIKeyCreator`
- [ ] Handle Google login flow
- [ ] Handle project selection
- [ ] Extract API key from page
- [ ] Store in secrets + rotation
- [ ] Test with real account

**Phase 3: Claude Integration**
- [ ] Implement `AnthropicAPIKeyCreator`
- [ ] Handle Anthropic login flow
- [ ] Navigate to keys page
- [ ] Create key with generated name
- [ ] Extract key from modal
- [ ] Store in secrets + rotation
- [ ] Test with real account

**Phase 4: MCP Tools**
- [ ] Create `create-gemini-api-key` tool
- [ ] Create `create-claude-api-key` tool
- [ ] Create `store-account-credentials` tool
- [ ] Create `list-stored-accounts` tool
- [ ] Add tool documentation

**Phase 5: Error Handling**
- [ ] CAPTCHA detection and pause
- [ ] Phone verification detection
- [ ] Rate limit detection
- [ ] Retry logic with backoff
- [ ] User notification on failure

---

## Security Considerations

**Credential Storage:**
- AES-256-GCM encryption at rest
- Never logged in plain text
- Audit trail for all access
- Automatic expiration (30 days)

**Browser Security:**
- Screenshots exclude credential fields
- Headless mode by default
- Isolated browser contexts
- Clear cookies/cache after use

**API Key Security:**
- Stored in secrets manager immediately
- Never appear in logs
- Rotation database uses encrypted connection
- Access restricted to supervisor process

---

## Monitoring & Alerts

**Success Metrics:**
- Key creation success rate (target: 90%+)
- Average time to create key (target: <5 min)
- CAPTCHA intervention rate (acceptable: <20%)
- Retry rate (target: <10%)

**Alerts:**
- Key creation failure after 3 retries
- CAPTCHA triggered (requires user intervention)
- Phone verification required
- Rate limit exceeded
- Selector not found (UI changed)

---

## References

- Epic: `/home/samuel/sv/supervisor-service-s/.bmad/epics/014-autonomous-usage-monitoring-optimization.md`
- PRD: `/home/samuel/sv/supervisor-service-s/.bmad/prds/014-autonomous-optimization-prd.md`
- Playwright MCP: Available as MCP server for Claude Code CLI
- Google AI Studio: https://aistudio.google.com/app/apikey
- Anthropic Console: https://console.anthropic.com/settings/keys

---

**Decision Maker:** Meta-Supervisor
**Reviewers:** N/A (autonomous system)
**Next Review:** After Phase 4 implementation
