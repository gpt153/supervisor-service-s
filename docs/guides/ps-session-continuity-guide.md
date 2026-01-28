# PS Session Continuity Integration Guide

**Complete guide for integrating session continuity into Project Supervisors**

---

## Overview

The session continuity system provides:
- **Automatic registration** - PSes auto-register on startup
- **Persistent instance ID** - Same ID throughout session
- **Footer display** - Instance ID visible in every response
- **Automatic heartbeat** - Keep-alive without blocking
- **Command logging** - Important actions automatically logged
- **Resume capability** - One-command recovery
- **Automatic checkpoints** - State recovery points

---

## Integration Checklist

### Phase 1: Bootstrap (10 minutes)

- [ ] Import PSBootstrap
- [ ] Initialize on first request
- [ ] Store instance ID in session state

### Phase 2: Footer (5 minutes)

- [ ] Import FooterRenderer
- [ ] Append footer to every response
- [ ] Verify footer format

### Phase 3: Heartbeat (5 minutes)

- [ ] Call updateContext() periodically
- [ ] Passes async heartbeat
- [ ] Handles context changes

### Phase 4: Logging (20 minutes)

- [ ] Add logSpawn() after Task calls
- [ ] Add logCommit() after git commits
- [ ] Add logDeploy() after deployments
- [ ] Add logPRCreated() after PR creation

### Phase 5: Resume (15 minutes)

- [ ] Detect resume command
- [ ] Call resume engine
- [ ] Display recovery summary
- [ ] Continue from checkpoint

**Total time: ~1 hour per PS**

---

## Basic Integration

### Step 1: Import Bootstrap and Footer

```typescript
// In your PS handler file
import { createPSBootstrap } from '../session/PSBootstrap.js';
import { formatFooterComplete } from '../session/FooterRenderer.js';
```

### Step 2: Initialize Session

```typescript
// At module level
const bootstrap = createPSBootstrap('odin-s'); // Use your project name

// In your PS handler
async function handlePSRequest(userMessage: string): Promise<string> {
  // Initialize on first request (or check if already initialized)
  if (!bootstrap.getInstanceId()) {
    await bootstrap.initialize();
    console.log(`PS initialized: ${bootstrap.getInstanceId()}`);
  }

  // Your PS logic here
  let response = await performPSWork(userMessage);

  // Update context (track usage)
  const contextPercent = calculateContextUsage();
  const currentEpic = extractCurrentEpic(userMessage);
  bootstrap.updateContext(contextPercent, currentEpic);

  // Append footer (MANDATORY - every response)
  response = bootstrap.appendFooter(response);

  return response;
}
```

### Step 3: Add Footer to Every Response

```typescript
// After building response content
response = bootstrap.appendFooter(response);
// Output: ... + "\n---\nInstance: odin-PS-8f4a2b | ..."
```

### Step 4: Log Important Actions

**After spawning subagent:**
```typescript
const result = await Task({
  description: "Implement epic-003",
  prompt: "...",
  subagent_type: "general-purpose",
  model: "haiku"
});

// Log the spawn
await bootstrap.logSpawn('general-purpose', 'Implement epic-003', 'haiku');
```

**After git commit:**
```typescript
const commitResult = await bash(`git commit -m "feat: add authentication"`);

// Log the commit
await bootstrap.logCommit(
  'feat: add authentication',
  3, // files changed
  commitResult.hash
);
```

**After deployment:**
```typescript
await bash(`docker compose up -d`);

// Log the deployment
await bootstrap.logDeploy('odin-api', 5300, 'success', {
  url: 'http://localhost:5300',
  healthcheck: 'passed'
});
```

**After PR creation:**
```typescript
const prResult = await createPullRequest(code);

// Log the PR
await bootstrap.logPRCreated(
  prResult.url,
  'epic-003',
  'feat: authentication with OAuth'
);
```

**After epic completion:**
```typescript
// Mark epic complete
await bootstrap.logEpicComplete(
  'epic-003',
  '42/42 tests passing',
  'https://github.com/...pull/45'
);
```

### Step 5: Handle Resume Command

```typescript
// In your request handler
async function handlePSRequest(userMessage: string): Promise<string> {
  // Initialize if needed
  if (!bootstrap.getInstanceId()) {
    await bootstrap.initialize();
  }

  // Check for resume command FIRST
  const resumeId = bootstrap.detectResumeCommand(userMessage);
  if (resumeId) {
    return await handleResumeCommand(resumeId);
  }

  // Normal PS logic
  return await doNormalWork(userMessage);
}

// Handle resume
async function handleResumeCommand(instanceId: string): Promise<string> {
  try {
    // Call the resume engine (from epic 007-E)
    const recovery = await resumeInstance(instanceId);

    if (!recovery.success) {
      return `Could not resume ${instanceId}. ${recovery.error}`;
    }

    // Display recovery summary
    let response = `✅ Resumed: ${recovery.instance_id}\n\n`;
    response += `EPIC ${recovery.epic_id}: ${recovery.epic_name}\n`;
    response += `- Status: ${recovery.status}\n`;
    response += `- Progress: ${recovery.progress}%\n`;
    response += `- Tests: ${recovery.test_summary}\n`;
    response += `- Time: ${recovery.duration_formatted}\n\n`;

    response += `LAST ACTION: ${recovery.last_action}\n`;
    response += `CHECKPOINT: ${recovery.checkpoint_age_formatted}\n\n`;

    response += `NEXT STEPS:\n`;
    recovery.next_steps.forEach((step, i) => {
      response += `${i + 1}. ${step}\n`;
    });

    response += `\nReady to continue. Say "continue" or describe what's next.`;

    // Update bootstrap state with recovered state
    bootstrap.updateContext(recovery.context_percent, recovery.epic_id);

    // Append footer
    response = bootstrap.appendFooter(response);

    return response;
  } catch (error) {
    console.error('Resume failed:', error);
    return `Resume failed: ${error.message}`;
  }
}
```

---

## Footer Implementation Details

### Footer Format

```
Instance: {id} | Epic: {epic} | Context: {%}% | Active: {hours}h
```

**Components:**
- `Instance` - Unique session ID (auto-generated)
- `Epic` - Current epic working on (or "—" if none)
- `Context` - Context window usage 0-100%
- `Active` - Hours since session started

### Footer Placement

**Every response should end with:**
```
<response content>
---
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h
[Use "resume odin-PS-8f4a2b" to restore this session]
```

### With Separator

```typescript
// Using PSBootstrap.appendFooter() automatically adds separator
response = bootstrap.appendFooter(response);
// Output: response + "\n---\n" + footer + optional hint
```

### Custom Footer Formatting

```typescript
// If you need custom formatting
import { renderFooter, getResumeHint } from '../session/FooterRenderer.js';

const footer = renderFooter({
  instanceId: bootstrap.getInstanceId(),
  currentEpic: 'epic-003',
  contextPercent: 42,
  sessionStartTime: bootstrap.getState().sessionStartTime
});

const hint = getResumeHint(
  bootstrap.getInstanceId(),
  42,
  true // force show hint
);

response += `\n---\n${footer}`;
if (hint) {
  response += `\n${hint}`;
}
```

---

## Context Window Tracking

### Estimate Context Usage

```typescript
function estimateContextUsage(
  messagesCount: number,
  tokensPerMessage: number = 150
): number {
  const totalTokens = messagesCount * tokensPerMessage;
  const maxTokens = 200000; // Haiku 4.5 context window
  return Math.min(100, Math.round((totalTokens / maxTokens) * 100));
}

// Update periodically
const contextPercent = estimateContextUsage(messageHistory.length);
bootstrap.updateContext(contextPercent, currentEpic);
```

### Context Warning

```typescript
function buildContextWarning(contextPercent: number): string {
  if (contextPercent < 75) {
    return ''; // No warning
  }

  if (contextPercent >= 80) {
    return `\n⚠️  Context window at ${contextPercent}%. Consider resuming with "resume {id}" soon.`;
  }

  return '';
}

// In response builder
let response = buildContextWarning(contextPercent);
response += normalResponse;
response = bootstrap.appendFooter(response);
```

---

## Heartbeat Behavior

### Automatic Heartbeat

```typescript
// Called from updateContext()
bootstrap.updateContext(42, 'epic-003');
// Internally calls: sendHeartbeatAsync(instanceId, 42, 'epic-003')
```

### Heartbeat Details

**Payload:**
```json
{
  "instance_id": "odin-PS-8f4a2b",
  "context_percent": 42,
  "current_epic": "epic-003"
}
```

**Frequency:** Every response via updateContext()
**Timeout:** 120 seconds (marked stale if no heartbeat)
**Overhead:** <20ms (async, non-blocking)

### Manual Heartbeat

```typescript
// Not needed - automatic via updateContext()
// But available if needed:
import { sendHeartbeat } from '../session/HeartbeatManager.js';

await sendHeartbeat(
  bootstrap.getInstanceId(),
  contextPercent,
  epicId
);
```

---

## Command Logging

### Automatic Logging Locations

**1. Spawn subagent:**
```typescript
await bootstrap.logSpawn(
  'general-purpose', // subagent type
  'Implement authentication',
  'haiku' // model
);
```

**2. Commit code:**
```typescript
await bootstrap.logCommit(
  'feat: add oauth login',
  5, // files changed
  'abc123def456' // commit hash (optional)
);
```

**3. Deploy service:**
```typescript
await bootstrap.logDeploy(
  'odin-api',
  5300,
  'success',
  { url: 'http://localhost:5300' }
);
```

**4. Create PR:**
```typescript
await bootstrap.logPRCreated(
  'https://github.com/...pull/45',
  'epic-003',
  'Authentication with OAuth'
);
```

**5. Complete epic:**
```typescript
await bootstrap.logEpicComplete(
  'epic-003',
  '42/42 tests passing',
  'https://github.com/...pull/45'
);
```

### What Gets Logged

- Timestamp (ISO 8601)
- Action type (spawn, commit, deploy, pr_created, epic_completed)
- Description/message
- Parameters (subagent type, model, files changed, etc.)
- Result (if applicable)
- Tags for searching

### Secret Sanitization

**Automatic:** Before storing, all logs are sanitized
- API keys removed
- Tokens redacted
- Passwords masked
- Replaced with [REDACTED]

**You don't need to do anything** - sanitization is automatic.

---

## Resume Workflow (Epic 007-E Integration)

### Detection

```typescript
const resumeId = bootstrap.detectResumeCommand(userMessage);
// Returns instance ID if message starts with "resume {id}"
// Returns null otherwise

if (resumeId) {
  // Handle resume
}
```

### Recovery Data

Resume engine provides:
```typescript
interface RecoveryData {
  instance_id: string;
  project: string;
  epic_id: string;
  epic_name: string;
  status: 'in_progress' | 'completed' | 'blocked';
  progress: number; // 0-100
  checkpoint_age_seconds: number;
  last_action: string;
  next_steps: string[];
  context_percent: number;
  duration_formatted: string;
  test_summary: string;
  // ... more fields
}
```

### Display Format

```typescript
function formatRecovery(recovery: RecoveryData): string {
  let result = `✅ Resumed: ${recovery.instance_id}\n\n`;

  result += `EPIC ${recovery.epic_id}: ${recovery.epic_name}\n`;
  result += `- Status: ${recovery.status.toUpperCase()}\n`;
  result += `- Progress: ${recovery.progress}%\n`;
  result += `- Tests: ${recovery.test_summary}\n`;
  result += `- Time: ${recovery.duration_formatted}\n\n`;

  result += `CHECKPOINT: ${formatCheckpointAge(recovery.checkpoint_age_seconds)}\n`;
  result += `LAST ACTION: ${recovery.last_action}\n\n`;

  result += `NEXT STEPS:\n`;
  recovery.next_steps.forEach((step, i) => {
    result += `${i + 1}. ${step}\n`;
  });

  result += `\nReady to continue. Say "continue" or describe what to do next.`;

  return result;
}
```

---

## Error Handling

### Bootstrap Initialization Errors

```typescript
try {
  await bootstrap.initialize();
} catch (error) {
  console.error('Failed to initialize PS:', error);
  // Continue without session continuity
  // (system still works, just no recovery option)
}
```

### Logging Errors

```typescript
// Logging errors are non-fatal
// If logging fails, system continues normally
// User isn't impacted
try {
  await bootstrap.logSpawn(...);
} catch (error) {
  console.error('Logging failed (non-fatal):', error);
  // Continue processing
}
```

### Resume Errors

```typescript
try {
  const recovery = await resumeInstance(resumeId);
  if (!recovery.success) {
    return `Resume failed: ${recovery.error}`;
  }
  // Normal resume flow
} catch (error) {
  return `Resume error: ${error.message}`;
}
```

---

## Performance Targets

**All operations must complete within targets:**

| Operation | Target | Typical |
|-----------|--------|---------|
| Footer render | <5ms | 1-2ms |
| Heartbeat overhead | <20ms | 5-10ms |
| Log command | <50ms | 10-20ms |
| Bootstrap init | <50ms one-time | 30ms |
| Update context | <1ms | <1ms |
| Detect resume | <1ms | <1ms |

---

## Testing Integration

### Unit Tests

```typescript
import { PSBootstrap } from '../session/PSBootstrap.js';

describe('PSBootstrap', () => {
  let bootstrap: PSBootstrap;

  beforeEach(() => {
    bootstrap = new PSBootstrap('test-project');
  });

  it('should initialize instance', async () => {
    const id = await bootstrap.initialize();
    expect(id).toMatch(/test-project-PS-[0-9a-f]{6}/);
  });

  it('should append footer', () => {
    // Initialize first
    bootstrap.initialize();

    const response = bootstrap.appendFooter('Test response');
    expect(response).toContain('Instance:');
    expect(response).toContain('Epic:');
    expect(response).toContain('Context:');
  });

  it('should detect resume command', () => {
    const id = bootstrap.detectResumeCommand('resume test-123');
    expect(id).toBe('test-123');
  });
});
```

### Integration Test

```typescript
// Full lifecycle test
async function testFullLifecycle() {
  const bootstrap = new PSBootstrap('odin-s');

  // 1. Initialize
  const instanceId = await bootstrap.initialize();
  console.log(`Initialized: ${instanceId}`);

  // 2. Update context
  bootstrap.updateContext(25, 'epic-003');

  // 3. Log action
  await bootstrap.logSpawn('general-purpose', 'Test spawn');

  // 4. Append footer
  let response = 'Test response';
  response = bootstrap.appendFooter(response);

  // 5. Verify
  expect(response).toContain(instanceId);
  expect(response).toContain('epic-003');

  // 6. Close
  await bootstrap.close();
}
```

---

## Troubleshooting

### Footer not showing

**Check:**
- [ ] Calling `bootstrap.appendFooter(response)`?
- [ ] After building response content?
- [ ] Not removing footer elsewhere?

**Fix:**
```typescript
response = bootstrap.appendFooter(response);
// Don't modify response after this
return response;
```

### Wrong epic in footer

**Check:**
- [ ] Calling `bootstrap.updateContext(context, epicId)`?
- [ ] Using correct epic ID format?
- [ ] Updated every response?

**Fix:**
```typescript
bootstrap.updateContext(contextPercent, 'epic-003');
// Next response will show correct epic
```

### Resume not working

**Check:**
- [ ] Instance ID matches exactly?
- [ ] Instance not older than 2 weeks?
- [ ] Session marked as stale?

**Fix:**
```typescript
// Use full instance ID
const resumeId = bootstrap.detectResumeCommand('resume odin-PS-8f4a2b');
// Pass to resume engine with exact ID
```

### Heartbeat errors

**Check:**
- [ ] Database connection active?
- [ ] Instance registered successfully?

**Note:** Heartbeat failures are non-fatal
- System logs warning
- Session continues
- Next heartbeat will retry

---

## Migration from Manual Handoffs

**Old way (manual):**
```
Create handoff file before switching tasks
Include state, next steps, commands to resume
```

**New way (automatic):**
```
Just start new session with "resume {id}"
System loads all state automatically
No manual files needed
```

**Migration path:**
1. Add PSBootstrap to existing PS
2. Enable footer in responses
3. Existing manual handoffs still work
4. Gradually move to resume commands

---

## References

- **FooterRenderer API**: `/home/samuel/sv/supervisor-service-s/src/session/FooterRenderer.ts`
- **PSBootstrap API**: `/home/samuel/sv/supervisor-service-s/src/session/PSBootstrap.ts`
- **Types**: `/home/samuel/sv/supervisor-service-s/src/types/session.ts`
- **Examples**: `/home/samuel/sv/docs/examples/ps-session-continuity-example.md`

---

**Maintained by**: Meta-Supervisor
**Last Updated**: 2026-01-28
