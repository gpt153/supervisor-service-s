# Epic 008-C: PS/MS Integration for Event Lineage

**Status**: Pending
**Priority**: HIGH
**Estimated Effort**: 10 hours
**Dependencies**: Epic 008-B (EventLogger)
**Feature**: event-lineage-tracking

---

## Overview

Integrate EventLogger into the PS/MS workflow to automatically log critical events with proper parent chains. This enables tracing any action back to its originating user request.

## Business Value

- **Full Audit Trail**: Every user request traced to all resulting actions
- **Debug Power**: "Why did this deployment fail?" → Walk parent chain
- **Smart Resume**: Resume with last 50 events, not entire session
- **Zero Manual Work**: PS logs events automatically

## Problem Statement

**Current PS Behavior:**
```
User: "Deploy the app"
PS: [Spawns deployment agent]
PS: [Deployment fails]
PS: "Deployment failed: port 5300 in use"

Debug: "Why did PS try to deploy?"
Answer: ??? (No link from error to user request)
```

**With Event Lineage:**
```sql
SELECT * FROM get_parent_chain('error-event-uuid');

Result:
1. user_message: "Deploy the app"
2. assistant_start: Processing request
3. spawn_decision: Deployment agent needed
4. tool_use: Task tool invoked
5. deployment_started: Starting docker compose
6. error: Port 5300 in use

Debug time: 10 seconds (was: 30 minutes)
```

## Acceptance Criteria

### 1. PS Bootstrap Integration

- [ ] Update `PSBootstrap.ts` to initialize EventLogger
- [ ] Store instance's logger in session context
- [ ] Logger available throughout PS lifecycle

### 2. User Message Logging

- [ ] Log every user message as root event (parent: null)
- [ ] Include: message content (truncated to 500 chars), timestamp
- [ ] Return event UUID for child linking

### 3. Processing Start Logging

- [ ] Log `assistant_start` when PS begins processing
- [ ] Parent: user_message event
- [ ] Include: current epic (if any), context percentage

### 4. Spawn Decision Logging

- [ ] Log every spawn decision with reasoning
- [ ] Parent: assistant_start event
- [ ] Include: subagent_type, model, reason, epic_id

### 5. Tool Use Logging

- [ ] Log significant tool uses (Task, Bash with commands, etc.)
- [ ] Parent: spawn_decision or assistant_start
- [ ] Include: tool name, parameters (sanitized)

### 6. Tool Result Logging

- [ ] Log tool results (success/failure)
- [ ] Parent: tool_use event
- [ ] Include: success flag, duration_ms, error_message

### 7. State Change Logging

- [ ] Log epic status changes
- [ ] Log deployment status changes
- [ ] Parent: appropriate tool_result or assistant_start
- [ ] Include: old_status, new_status, reason

### 8. Error Logging

- [ ] Log all errors with full context
- [ ] Parent: whatever operation failed
- [ ] Include: error_type, message, stack (truncated)

### 9. Resume Enhancement

- [ ] Update ContextReconstructor to use parent chains
- [ ] Load last 50 events (not all events)
- [ ] Walk parent chain for context
- [ ] Generate smart next steps from chain

---

## Technical Specifications

### Integration Points

**1. PSBootstrap.ts Changes:**

```typescript
// Add to PSBootstrap initialization
import { EventLogger } from './EventLogger.js';

interface PSContext {
  instanceId: string;
  logger: EventLogger;
  currentUserMessageId?: string;
  currentProcessingId?: string;
}

async function initializePS(instanceId: string): Promise<PSContext> {
  const logger = new EventLogger(instanceId);

  return {
    instanceId,
    logger,
  };
}
```

**2. User Message Handler:**

```typescript
async function handleUserMessage(
  ctx: PSContext,
  message: string
): Promise<void> {
  // Log user message as root event
  ctx.currentUserMessageId = await ctx.logger.log('user_message', {
    content: message.substring(0, 500),
    timestamp: new Date().toISOString(),
  });

  // Log processing start (child of user message)
  await ctx.logger.withParent(ctx.currentUserMessageId, async () => {
    ctx.currentProcessingId = await ctx.logger.log('assistant_start', {
      epic: getCurrentEpic(),
      context_percent: getContextPercent(),
    });

    // All subsequent operations inherit this parent
    await processRequest(ctx, message);
  });
}
```

**3. Spawn Handler:**

```typescript
async function spawnSubagent(
  ctx: PSContext,
  options: SpawnOptions
): Promise<SpawnResult> {
  // Log spawn decision
  const spawnEventId = await ctx.logger.log('spawn_decision', {
    reason: options.reason,
    subagent_type: options.subagent_type,
    model: options.model,
    epic_id: options.epic_id,
  });

  // Execute spawn with this event as parent
  return await ctx.logger.withParent(spawnEventId, async () => {
    const toolEventId = await ctx.logger.log('tool_use', {
      tool: 'Task',
      parameters: sanitize(options),
    });

    try {
      const result = await executeSpawn(options);

      await ctx.logger.log('tool_result', {
        success: true,
        duration_ms: result.duration,
        agent_id: result.agentId,
      }, { parentUuid: toolEventId });

      return result;
    } catch (error) {
      await ctx.logger.log('error', {
        error_type: 'spawn_failed',
        message: error.message,
        stack: error.stack?.substring(0, 500),
      }, { parentUuid: toolEventId });

      throw error;
    }
  });
}
```

**4. ContextReconstructor Update:**

```typescript
// Update tryReplayEvents() to use lineage

async function tryReplayEventsWithLineage(
  instanceId: string
): Promise<ReconstructedContext | null> {
  const logger = new EventLogger(instanceId);

  // Get last 50 events (memory safe)
  const recent = await logger.getRecentEvents(50);

  if (recent.length === 0) {
    return null;
  }

  // Find last user message (root of current chain)
  const lastUserMsg = recent
    .reverse()
    .find(e => e.event_type === 'user_message');

  if (lastUserMsg) {
    // Walk parent chain of most recent event
    const mostRecent = recent[recent.length - 1];
    const chain = await logger.getParentChain(mostRecent.event_id);

    // Reconstruct context from chain
    const context = reconstructFromChain(chain);
    return context;
  }

  // Fall back to basic reconstruction
  return reconstructFromEvents(recent);
}
```

---

## Testing Requirements

### Integration Tests

```typescript
// tests/integration/event-lineage-integration.test.ts

describe('PS Event Lineage Integration', () => {
  it('should create full chain from user message to error', async () => {
    const ctx = await initializePS('test-PS-abc123');

    // Simulate: User -> Process -> Spawn -> Tool -> Error
    const msgId = await ctx.logger.log('user_message', { content: 'Deploy' });

    await ctx.logger.withParent(msgId, async () => {
      const processId = await ctx.logger.log('assistant_start', {});

      await ctx.logger.withParent(processId, async () => {
        const spawnId = await ctx.logger.log('spawn_decision', {});

        await ctx.logger.withParent(spawnId, async () => {
          const toolId = await ctx.logger.log('tool_use', {});

          const errorId = await ctx.logger.log('error', {
            message: 'Port in use',
          }, { parentUuid: toolId });

          // Verify chain
          const chain = await ctx.logger.getParentChain(errorId);
          expect(chain.map(e => e.event_type)).toEqual([
            'user_message',
            'assistant_start',
            'spawn_decision',
            'tool_use',
            'error'
          ]);
        });
      });
    });
  });

  it('should resume with bounded memory', async () => {
    const ctx = await initializePS('test-PS-abc123');

    // Create 1000 events
    for (let i = 0; i < 1000; i++) {
      await ctx.logger.log('test_event', { i });
    }

    const memBefore = process.memoryUsage().heapUsed;
    const recent = await ctx.logger.getRecentEvents(50);
    const memAfter = process.memoryUsage().heapUsed;

    // Memory increase should be minimal (< 1MB for 50 events)
    expect(memAfter - memBefore).toBeLessThan(1_000_000);
    expect(recent.length).toBe(50);
  });
});
```

---

## Success Criteria

- [ ] PSBootstrap initializes EventLogger
- [ ] User messages logged as root events
- [ ] Spawn decisions linked to user messages
- [ ] Tool uses linked to spawn decisions
- [ ] Errors linked to failing operations
- [ ] Full chain traceable from any event
- [ ] Resume uses last 50 events (not all)
- [ ] Memory stable regardless of session length
- [ ] Integration tests pass

---

## Implementation Steps (for Haiku Agent)

1. **Update PSBootstrap.ts**:
   - Import EventLogger
   - Add logger to PSContext
   - Initialize on startup

2. **Add logging to user message handler**:
   - Log user_message as root
   - Wrap processing in withParent()

3. **Add logging to spawn handler**:
   - Log spawn_decision with reason
   - Log tool_use and tool_result

4. **Add error logging**:
   - Log errors with parent context
   - Include error details

5. **Update ContextReconstructor**:
   - Use getRecentEvents(50)
   - Use getParentChain for context

6. **Write integration tests**

7. **Test manually**:
   - Start PS
   - Send user message
   - Query: `SELECT * FROM event_store WHERE instance_id = 'your-id' ORDER BY timestamp`
   - Verify parent chains

---

**Maintained by**: Meta-Supervisor
**Created**: 2026-01-31
**Last Updated**: 2026-01-31
