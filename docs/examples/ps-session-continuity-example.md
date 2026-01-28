# PS Session Continuity - Integration Examples

**Real code examples showing how to integrate session continuity into PSes**

---

## Example 1: Minimal Integration (5 minutes)

**Bare minimum to add session continuity to existing PS**

```typescript
import { createPSBootstrap } from '../session/PSBootstrap.js';

const bootstrap = createPSBootstrap('odin-s');

export async function handlePSResponse(userMessage: string): Promise<string> {
  // 1. Initialize on first response
  if (!bootstrap.getInstanceId()) {
    await bootstrap.initialize();
  }

  // 2. Build response (your normal PS logic)
  let response = await doYourNormalWork(userMessage);

  // 3. Update context
  bootstrap.updateContext(calculateContextUsage(), extractEpic(userMessage));

  // 4. Append footer (MANDATORY)
  response = bootstrap.appendFooter(response);

  // 5. Return with footer
  return response;
}
```

**Result:**
```
[Your response]
---
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 25% | Active: 0.5h
[Use "resume odin-PS-8f4a2b" to restore this session]
```

---

## Example 2: Full Integration (1 hour)

**Complete integration with all features**

```typescript
import { createPSBootstrap } from '../session/PSBootstrap.js';
import { resumeInstance } from '../session/ResumeEngine.js'; // Epic 007-E

const bootstrap = createPSBootstrap('odin-s');

export async function handlePSRequest(userMessage: string): Promise<string> {
  // Initialize if needed
  if (!bootstrap.getInstanceId()) {
    await bootstrap.initialize();
  }

  // Check for resume command FIRST
  const resumeId = bootstrap.detectResumeCommand(userMessage);
  if (resumeId) {
    return await handleResume(resumeId);
  }

  // Normal PS flow
  let response = '';

  // Detect what user wants to do
  if (userMessage.includes('plan')) {
    response = await planEpic(userMessage);
  } else if (userMessage.includes('continue')) {
    response = await continueEpic(userMessage);
  } else if (userMessage.startsWith('resume')) {
    // Already handled above
    response = 'Resume handled';
  } else {
    response = 'How can I help?';
  }

  // Update context (estimate from response length + message history)
  const contextPercent = Math.round(
    ((messageHistory.length * 150 + response.length) / 200000) * 100
  );
  const currentEpic = parseCurrentEpic(messageHistory);

  bootstrap.updateContext(Math.min(99, contextPercent), currentEpic);

  // Add any warnings
  if (contextPercent > 75) {
    response +=
      `\n⚠️  Context at ${contextPercent}%. Consider a fresh session with "resume ${bootstrap.getInstanceId()}".`;
  }

  // Append footer
  response = bootstrap.appendFooter(response);

  return response;
}

async function handleResume(resumeId: string): Promise<string> {
  try {
    // Get recovery data from resume engine
    const recovery = await resumeInstance(resumeId);

    if (!recovery.success) {
      return `Could not resume ${resumeId}: ${recovery.error}`;
    }

    // Format recovery summary
    let response = `✅ Resumed: ${recovery.instance_id}\n\n`;

    response += `## EPIC ${recovery.epic_id}: ${recovery.epic_name}\n`;
    response += `- **Status**: ${recovery.status.toUpperCase()}\n`;
    response += `- **Progress**: ${recovery.progress}%\n`;
    response += `- **Tests**: ${recovery.test_summary}\n`;
    response += `- **Time Invested**: ${recovery.duration_formatted}\n\n`;

    response += `**Last Action**: ${recovery.last_action}\n`;
    response += `**Checkpoint Age**: ${recovery.checkpoint_age_formatted}\n\n`;

    response += `## Next Steps\n`;
    recovery.next_steps.forEach((step, i) => {
      response += `${i + 1}. ${step}\n`;
    });

    response += `\nReady to continue. Say "continue building" to proceed.`;

    // Update bootstrap state
    bootstrap.updateContext(recovery.context_percent, recovery.epic_id);

    // Log the resume
    console.log(`Resumed session: ${recovery.instance_id}`);

    // Append footer
    response = bootstrap.appendFooter(response);

    return response;
  } catch (error) {
    console.error('Resume error:', error);
    return `Error resuming: ${error.message}`;
  }
}

async function planEpic(userMessage: string): Promise<string> {
  const epicDescription = userMessage.replace('plan', '').trim();

  // Spawn BMAD planning subagent
  const plan = await Task({
    description: `Plan epic: ${epicDescription}`,
    prompt: `Create a comprehensive epic plan...`,
    subagent_type: 'Plan',
    model: 'opus',
  });

  // Log the planning action
  await bootstrap.logSpawn('Plan', `Plan epic: ${epicDescription}`, 'opus');

  return `Plan created:\n${plan}`;
}

async function continueEpic(userMessage: string): Promise<string> {
  const state = bootstrap.getState();
  const currentEpic = state.currentEpic || 'unknown';

  // Spawn implementation subagent
  const result = await Task({
    description: `Continue ${currentEpic}`,
    prompt: `Continue implementation of ${currentEpic}...`,
    subagent_type: 'general-purpose',
    model: 'haiku',
  });

  // Log the spawn
  await bootstrap.logSpawn('general-purpose', `Continue ${currentEpic}`, 'haiku');

  return `Subagent spawned to continue ${currentEpic}...`;
}
```

---

## Example 3: With Git Integration

**Logging commits and tracking progress**

```typescript
import { bash } from '../bash/index.js';
import { createPSBootstrap } from '../session/PSBootstrap.js';

const bootstrap = createPSBootstrap('odin-s');

async function implementAndCommit(epicId: string, changes: string[]): Promise<string> {
  let response = '';

  // Spawn implementation subagent
  const implementation = await Task({
    description: `Implement ${epicId}`,
    prompt: `...`,
    subagent_type: 'general-purpose',
    model: 'haiku',
  });

  // Log spawn
  await bootstrap.logSpawn('general-purpose', `Implement ${epicId}`, 'haiku');

  response += `✅ Implementation complete\n`;

  // Add files and commit
  const gitAdd = await bash('git add .');
  const gitStatus = await bash('git status --short');

  const commitMessage = `feat: ${epicId} - implementation`;
  const gitCommit = await bash(`git commit -m "${commitMessage}"`);

  // Parse commit output to get hash
  const hashMatch = gitCommit.stdout.match(/\[main ([a-f0-9]+)\]/);
  const commitHash = hashMatch ? hashMatch[1] : undefined;

  // Log the commit
  await bootstrap.logCommit(
    commitMessage,
    gitStatus.stdout.split('\n').length - 1, // file count
    commitHash
  );

  response += `✅ Committed: ${commitMessage}\n`;

  // Update context
  const contextPercent = calculateContextUsage();
  bootstrap.updateContext(contextPercent, epicId);

  // Append footer
  response = bootstrap.appendFooter(response);

  return response;
}
```

---

## Example 4: With Deployment Tracking

**Logging deployments and health checks**

```typescript
import { bash } from '../bash/index.js';
import { createPSBootstrap } from '../session/PSBootstrap.js';

const bootstrap = createPSBootstrap('odin-s');

async function deployService(service: string, port: number): Promise<string> {
  let response = '';

  // Kill old instances
  await bash(`killall node || true`);
  await bash(`docker rm -f ${service} || true`);

  // Start service
  response += `Starting ${service}...\n`;

  try {
    await bash(`docker compose -f docker-compose.yml up -d`);

    // Health check
    let healthy = false;
    for (let i = 0; i < 12; i++) {
      try {
        const health = await bash(`curl -s http://localhost:${port}/health`);
        if (health.returnCode === 0) {
          healthy = true;
          break;
        }
      } catch (e) {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, 1000)); // Wait 1s
    }

    if (healthy) {
      response += `✅ ${service} running on port ${port}\n`;

      // Log successful deployment
      await bootstrap.logDeploy(service, port, 'success', {
        url: `http://localhost:${port}`,
        healthcheck_passed: true,
      });

      return bootstrap.appendFooter(response);
    } else {
      response += `❌ ${service} failed health check\n`;

      // Log failed deployment
      await bootstrap.logDeploy(service, port, 'failure', {
        error: 'Health check failed',
      });

      return bootstrap.appendFooter(response);
    }
  } catch (error) {
    response += `❌ Deployment error: ${error.message}\n`;

    // Log deployment error
    await bootstrap.logDeploy(service, port, 'failure', {
      error: error.message,
    });

    return bootstrap.appendFooter(response);
  }
}
```

---

## Example 5: With PR Integration

**Logging PR creation and epic completion**

```typescript
import { bash } from '../bash/index.js';
import { createPSBootstrap } from '../session/PSBootstrap.js';

const bootstrap = createPSBootstrap('odin-s');

async function completeEpic(
  epicId: string,
  testResults: { passed: number; total: number }
): Promise<string> {
  let response = '';

  // Push to GitHub
  const branch = `epic/${epicId}`;
  await bash(`git push origin ${branch}`);

  // Create PR
  const prResult = await bash(
    `gh pr create --title "Epic ${epicId}" --body "Implementation of epic ${epicId}"`
  );

  const prUrlMatch = prResult.stdout.match(/https:\/\/github.com\/.*\/pull\/\d+/);
  const prUrl = prUrlMatch ? prUrlMatch[0] : null;

  response += `✅ Epic ${epicId} complete\n`;

  if (prUrl) {
    response += `✅ PR created: ${prUrl}\n`;

    // Log PR creation
    await bootstrap.logPRCreated(prUrl, epicId, `Epic ${epicId}`);

    // Log epic completion
    await bootstrap.logEpicComplete(
      epicId,
      `${testResults.passed}/${testResults.total} tests passing`,
      prUrl
    );

    response += `✅ Ready for review\n`;
  }

  // Clear epic from state
  bootstrap.updateContext(calculateContextUsage(), undefined);

  // Append footer
  response = bootstrap.appendFooter(response);

  return response;
}
```

---

## Example 6: Multi-Epic Workflow

**Managing multiple epics in sequence with resume capability**

```typescript
import { createPSBootstrap } from '../session/PSBootstrap.js';

const bootstrap = createPSBootstrap('odin-s');
let currentEpicIndex = 0;
const epics = ['epic-001', 'epic-002', 'epic-003'];

async function handleContinueBuilding(userMessage: string): Promise<string> {
  // Initialize if needed
  if (!bootstrap.getInstanceId()) {
    await bootstrap.initialize();
  }

  const currentEpic = epics[currentEpicIndex];
  let response = '';

  // Check for resume first
  const resumeId = bootstrap.detectResumeCommand(userMessage);
  if (resumeId) {
    const recovery = await resumeInstance(resumeId);
    response = formatRecovery(recovery);
    bootstrap.updateContext(recovery.context_percent, recovery.epic_id);
    return bootstrap.appendFooter(response);
  }

  // If "continue building", proceed to next epic
  if (userMessage.toLowerCase() === 'continue building') {
    if (currentEpicIndex < epics.length - 1) {
      currentEpicIndex++;
    }
    return await implementEpic(epics[currentEpicIndex]);
  }

  response = `Working on ${currentEpic}...\n`;
  response = bootstrap.appendFooter(response);
  return response;
}

async function implementEpic(epicId: string): Promise<string> {
  bootstrap.updateContext(5, epicId);

  // Spawn implementation
  const result = await Task({
    description: `Implement ${epicId}`,
    prompt: `...`,
    subagent_type: 'general-purpose',
    model: 'haiku',
  });

  await bootstrap.logSpawn('general-purpose', `Implement ${epicId}`, 'haiku');

  let response = `Implementing ${epicId}...\n`;

  // Wait for completion (in real scenario)
  // Then:

  // Commit
  await bash('git add . && git commit -m "feat: ' + epicId + '"');
  await bootstrap.logCommit('feat: ' + epicId, 5);

  // Create PR
  const pr = await bash(`gh pr create --title "${epicId}"`);
  const prUrl = extractPRUrl(pr.stdout);
  await bootstrap.logPRCreated(prUrl, epicId, epicId);

  // Mark complete
  await bootstrap.logEpicComplete(epicId, 'All tests passing', prUrl);

  response += `✅ ${epicId} complete\n`;

  // Show next epic
  if (currentEpicIndex < epics.length - 1) {
    response += `\nReady for next epic: ${epics[currentEpicIndex + 1]}\n`;
    response += `Say "continue building" to start next epic.`;
  } else {
    response += `\n✅ All epics complete!`;
  }

  response = bootstrap.appendFooter(response);

  return response;
}
```

---

## Example 7: Error Recovery

**Handling errors gracefully while maintaining session continuity**

```typescript
import { createPSBootstrap } from '../session/PSBootstrap.js';

const bootstrap = createPSBootstrap('odin-s');

async function robustImplementation(epicId: string): Promise<string> {
  // Initialize
  if (!bootstrap.getInstanceId()) {
    try {
      await bootstrap.initialize();
    } catch (error) {
      console.error('Bootstrap failed (non-fatal):', error);
      // Continue without session continuity
    }
  }

  let response = '';

  try {
    // Spawn implementation
    const result = await Task({
      description: `Implement ${epicId}`,
      prompt: `...`,
      subagent_type: 'general-purpose',
      model: 'haiku',
    });

    // Log spawn (with error handling)
    try {
      await bootstrap.logSpawn('general-purpose', `Implement ${epicId}`, 'haiku');
    } catch (error) {
      console.warn('Spawn logging failed:', error);
      // Continue anyway - logging is non-critical
    }

    response += `✅ Implementation complete\n`;

    // Run tests
    try {
      const testResult = await bash(`npm test`);
      const passed = testResult.stdout.match(/(\d+) passing/)?.[1];
      response += `✅ Tests: ${passed} passing\n`;

      // Log success
      await bootstrap.logEpicComplete(epicId, `${passed} tests passing`);
    } catch (error) {
      response += `⚠️ Tests failed: ${error.message}\n`;
      response += `Please review and retry.\n`;
    }

    // Update context and append footer
    bootstrap.updateContext(75, epicId);
    response = bootstrap.appendFooter(response);

    return response;
  } catch (error) {
    // Major error - still try to append footer
    response = `Error during implementation: ${error.message}\n`;
    response += `Session ID: ${bootstrap.getInstanceId()}\n`;

    try {
      response = bootstrap.appendFooter(response);
    } catch (e) {
      // Even footer failed - return minimal response
      response += `\nInstance: ${bootstrap.getInstanceId()}`;
    }

    return response;
  }
}
```

---

## Example 8: Testing Integration

**Unit and integration tests for session continuity**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PSBootstrap } from '../../src/session/PSBootstrap';
import { resetDb } from '../../tests/fixtures/db';

describe('PS Session Continuity Integration', () => {
  let bootstrap: PSBootstrap;

  beforeEach(async () => {
    await resetDb();
    bootstrap = new PSBootstrap('test-project');
  });

  afterEach(async () => {
    try {
      await bootstrap.close();
    } catch (e) {
      // Ignore
    }
  });

  it('should initialize and maintain session state', async () => {
    const instanceId = await bootstrap.initialize();
    expect(instanceId).toMatch(/test-project-PS-[0-9a-f]{6}/);

    // State should persist
    expect(bootstrap.getInstanceId()).toBe(instanceId);

    // Can call again without re-initializing
    const instanceId2 = await bootstrap.initialize();
    expect(instanceId2).toBe(instanceId);
  });

  it('should append footer to responses', () => {
    bootstrap.initialize();
    bootstrap.updateContext(42, 'epic-003');

    const response = bootstrap.appendFooter('Test response');
    expect(response).toContain('Test response');
    expect(response).toContain('Instance:');
    expect(response).toContain('epic-003');
    expect(response).toContain('42%');
  });

  it('should log spawn actions', async () => {
    await bootstrap.initialize();
    await bootstrap.logSpawn('general-purpose', 'Test spawn', 'haiku');

    // Could verify log was stored in DB
    // const logs = await getCommandLogger().searchCommands({ ... });
  });

  it('should detect resume commands', async () => {
    const id = bootstrap.detectResumeCommand('resume test-123');
    expect(id).toBe('test-123');

    const id2 = bootstrap.detectResumeCommand('  resume  test-456  ');
    expect(id2).toBe('test-456');

    const notResume = bootstrap.detectResumeCommand('please help');
    expect(notResume).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    await bootstrap.initialize();

    // Log spawn with missing data should not throw
    await expect(bootstrap.logSpawn('', '')).resolves.not.toThrow();

    // Close should be idempotent
    await bootstrap.close();
    await bootstrap.close(); // Should not throw
  });

  it('should maintain session across multiple operations', async () => {
    const instanceId = await bootstrap.initialize();

    // Update context
    bootstrap.updateContext(10, 'epic-001');

    // Log action
    await bootstrap.logSpawn('task', 'Do something');

    // Update again
    bootstrap.updateContext(25, 'epic-001');

    // Commit
    await bootstrap.logCommit('feat: something', 3);

    // Update again
    bootstrap.updateContext(40, 'epic-001');

    // Append footer
    const response = bootstrap.appendFooter('Final response');

    expect(response).toContain(instanceId);
    expect(response).toContain('epic-001');
    expect(response).toContain('40%');
  });
});
```

---

## Quick Copy-Paste Templates

### Template 1: Minimal PS

```typescript
import { createPSBootstrap } from '../session/PSBootstrap.js';

const bootstrap = createPSBootstrap('PROJECT-NAME');

export async function handlePS(msg: string): Promise<string> {
  if (!bootstrap.getInstanceId()) await bootstrap.initialize();

  let response = 'Your response here';

  bootstrap.updateContext(calculateContext(), getEpic());
  response = bootstrap.appendFooter(response);

  return response;
}
```

### Template 2: With Logging

```typescript
const bootstrap = createPSBootstrap('PROJECT-NAME');

async function doWork() {
  if (!bootstrap.getInstanceId()) await bootstrap.initialize();

  // Spawn
  const task = await Task({...});
  await bootstrap.logSpawn('type', 'desc', 'model');

  // Commit
  await bash('git commit -m "msg"');
  await bootstrap.logCommit('msg', 5);

  // Deploy
  await bash('docker compose up -d');
  await bootstrap.logDeploy('svc', 5300, 'success');

  let response = 'Done';
  response = bootstrap.appendFooter(response);
  return response;
}
```

### Template 3: With Resume

```typescript
const bootstrap = createPSBootstrap('PROJECT-NAME');

async function handleRequest(msg: string) {
  if (!bootstrap.getInstanceId()) await bootstrap.initialize();

  // Check resume first
  const resumeId = bootstrap.detectResumeCommand(msg);
  if (resumeId) {
    const recovery = await resumeInstance(resumeId);
    let response = formatRecovery(recovery);
    response = bootstrap.appendFooter(response);
    return response;
  }

  // Normal flow
  let response = 'Working...';
  response = bootstrap.appendFooter(response);
  return response;
}
```

---

**Maintained by**: Meta-Supervisor
**Last Updated**: 2026-01-28
