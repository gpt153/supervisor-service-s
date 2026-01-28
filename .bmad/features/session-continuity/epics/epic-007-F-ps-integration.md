# Epic 007-F: PS Instruction Integration

**Status**: Pending
**Priority**: HIGH
**Estimated Effort**: 40 hours
**Cost**: $0 (instruction updates)
**Dependencies**: epic-007-A (Instance Registry), epic-007-E (Resume Engine)

---

## Overview

Integrate the session continuity system into PS instructions so it operates automatically with zero user intervention. Every PS instance will show an instance ID in the footer, log commands automatically, create checkpoints, and handle resume requests.

## Business Value

- **Automatic Operation**: PSes auto-register, log, checkpoint without explicit calls
- **Visible Feedback**: Instance ID in every response footer
- **User-Friendly Resume**: One-command recovery ("resume 8f4a2b")
- **Full Audit Trail**: Complete history of all PS actions
- **Zero Training**: System works without user effort

## Problem Statement

**Current State:**
- Session continuity tools exist but PS doesn't use them
- PS has no unique instance ID
- PSes don't register on startup
- No automatic logging or heartbeating
- System incomplete and non-operational

**Example Gap:**
```
[Bad] PS response without integration:
────────────────────────────────────────
Working on epic-003. Implementation spawned.
Tests running.
────────────────────────────────────────

[Good] PS response with integration:
────────────────────────────────────────
Working on epic-003. Implementation spawned.
Tests running.
────────────────────────────────────────
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h
[Use "resume odin-PS-8f4a2b" to restore this session]
```

**Missing:**
- Instance ID not shown
- No heartbeat tracking
- No automatic logging
- No checkpoint creation
- System appears "optional" rather than "built-in"

## Acceptance Criteria

### PS Initialization

1. **Auto-Registration on First Message**
   - [ ] When PS first responds, call `mcp_meta_register_instance()`
   - [ ] Get unique instance_id: "odin-PS-8f4a2b"
   - [ ] Store instance_id in PS context (persist for session)
   - [ ] One-time per session (not every message)

2. **Store Instance ID in Context**
   - [ ] Instance ID stored in PS state
   - [ ] Available for all subsequent messages
   - [ ] Used in heartbeat, logging, footer

### Footer Implementation

3. **Footer in Every Response**
   - [ ] Last line of every PS response: footer with instance ID
   - [ ] Format: `Instance: {instance_id} | Epic: {epic_id} | Context: {context}% | Active: {time}h`
   - [ ] Example: `Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h`
   - [ ] Subtle but always visible

4. **Footer Information**
   - [ ] Instance: unique ID (odin-PS-8f4a2b)
   - [ ] Epic: current epic_id (or "—" if none)
   - [ ] Context: context window % (0-100)
   - [ ] Active: time since session start (in hours)

5. **Resume Hint (Optional)**
   - [ ] After footer, optional hint: `[Use "resume {id}" to restore this session]`
   - [ ] Only shown when context >30% (meaningful work done)
   - [ ] Reminds user of resume capability

### Automatic Heartbeating

6. **Heartbeat with Every Response**
   - [ ] Call `mcp_meta_heartbeat()` after sending response
   - [ ] Include: instance_id, context_window, current_epic
   - [ ] Non-blocking (async, don't wait for result)
   - [ ] Performance: <20ms overhead

7. **Heartbeat Payload**
   - [ ] instance_id: "odin-PS-8f4a2b"
   - [ ] project: "odin-s"
   - [ ] context_window: integer 0-100
   - [ ] current_epic: epic_id or null
   - [ ] git_branch: current branch (if applicable)

### Automatic Command Logging

8. **Explicit Logging for Critical Actions**
   - [ ] Log when PS spawns subagent: `mcp_meta_log_command('spawn', { subagent_type, description })`
   - [ ] Log when PS commits: `mcp_meta_log_command('commit', { message, files_changed })`
   - [ ] Log when PS creates PR: `mcp_meta_log_command('pr_created', { pr_url, epic_id })`
   - [ ] Log when PS deploys: `mcp_meta_log_command('deploy', { service, port, status })`
   - [ ] Log when PS plans: `mcp_meta_log_command('task_created', { description, epic_id })`

9. **Logging Integration Points**
   - [ ] After Task spawn: log spawn with subagent_type
   - [ ] After git commit: log commit with message
   - [ ] After PR creation: log pr_created
   - [ ] After deployment: log deployment status
   - [ ] After task creation: log task details

10. **Sanitization**
    - [ ] Remove secrets from logs before storage
    - [ ] Pattern match: API keys, tokens, passwords
    - [ ] Replace with [REDACTED]
    - [ ] Log note: "[Contains secrets - REDACTED]"

### Automatic Checkpoint Creation

11. **Context Window Checkpoint**
    - [ ] Monitor context_window in heartbeat
    - [ ] When context_window ≥ 80%, call `mcp_meta_create_checkpoint()`
    - [ ] Happens automatically (no PS action needed)
    - [ ] Logged: "Checkpoint created (80% context)"

12. **Epic Completion Checkpoint**
    - [ ] When PS marks epic complete, emit event: `mcp_meta_emit_event('epic_completed', {...})`
    - [ ] Event store automatically creates checkpoint
    - [ ] Capture: epic_id, status, test results, time invested

### Resume Request Handling

13. **Resume Command Recognition**
    - [ ] PS recognizes: "resume {id}" in user message
    - [ ] Calls: `mcp_meta_resume_instance(instance_id_hint={id})`
    - [ ] Receives: recovery summary + instructions
    - [ ] Displays summary to user

14. **Resume Response Format**
    - [ ] Show recovery summary
    - [ ] Show next steps
    - [ ] Show checkpoint info (age, trigger)
    - [ ] Ask: "Ready to continue?"

15. **Resume State Restoration**
    - [ ] Load checkpoint work_state
    - [ ] Restore context (what was being worked on)
    - [ ] Restore git branch (if applicable)
    - [ ] Provide actionable next steps

### PS Instructions Updates

16. **CLAUDE.md Updates for All PSes**
    - [ ] Add session continuity section to PS instructions
    - [ ] Explain instance IDs and footer
    - [ ] Document resume command
    - [ ] Show example recovery scenario
    - [ ] Link to complete guide

17. **Instruction Content**
    - [ ] Session Continuity System enabled
    - [ ] Your instance ID: shown in footer
    - [ ] Resume after disconnect: `resume {id}`
    - [ ] Automatic logging: no manual effort needed
    - [ ] Checkpoints: created automatically
    - [ ] Example: "Resume odin-PS-8f4a2b"

### Resume Command Handling

18. **Resume Workflow in PS**
    - [ ] User: "resume 8f4a2b"
    - [ ] PS detects resume command
    - [ ] PS calls resume MCP tool
    - [ ] MCP returns: recovery summary + instructions
    - [ ] PS displays summary
    - [ ] PS shows next steps
    - [ ] PS awaits user confirmation ("continue" or "start over")

19. **Resume Output Example**
    ```
    User: resume odin-PS-8f4a2b

    PS Response:
    ────────────────────────────────────────
    ✅ Resumed: odin-PS-8f4a2b

    EPIC 003: Authentication (OAuth)
    - Status: COMPLETED ✓
    - Tests: 42/42 PASSED
    - Coverage: 87%
    - PR #45: Created
    - Time: 4h 32min

    CHECKPOINT: epic_completion (2m old)

    NEXT STEPS:
    1. Verify PR tests on CI
    2. Merge PR #45 to main
    3. Start epic 004 (MFA)

    Ready to continue. Say "continue building" to proceed.
    ────────────────────────────────────────
    Instance: odin-PS-8f4a2b | Epic: 003 | Context: 92% | Active: 4.5h
    ```

### Integration with Existing Workflows

20. **No Breaking Changes**
    - [ ] Session continuity is transparent
    - [ ] Existing PS workflows unchanged
    - [ ] All features optional from user perspective
    - [ ] Manual handoffs still work (but now optional)

21. **Compatibility**
    - [ ] Works with existing PS codebase
    - [ ] No new dependencies required
    - [ ] MCP tools already exist (from epic-007-A through 007-E)
    - [ ] Minimal PS code changes

### Testing Requirements

22. **Unit Tests**
    - [ ] Footer generation
    - [ ] Command logging with sanitization
    - [ ] Heartbeat payload formatting
    - [ ] Resume command parsing

23. **Integration Tests**
    - [ ] Full PS lifecycle: Register → Log → Heartbeat → Checkpoint → Resume
    - [ ] Multi-epic workflow with sessions
    - [ ] Resume recovery accuracy
    - [ ] Manual logging (spawn, commit, deploy)

24. **E2E Tests**
    - [ ] User perspective: Start PS → Work → Disconnect → Resume → Continue
    - [ ] Multi-instance: 3 instances of same project → Resume correct one
    - [ ] State preservation: Resume, verify state matches pre-disconnect

---

## Technical Specifications

### PS Integration Points

**On Startup (First Response)**
```typescript
// Initialize session continuity
const instanceId = await mcp_meta_register_instance({
  project: 'odin-s',
  instance_type: 'PS',
  user_visible_name: 'Odin Project Supervisor'
});
// Store in PS state for rest of session
this.sessionState.instanceId = instanceId;
```

**On Every Response (After Content)**
```typescript
// Generate footer
const footer = generateFooter({
  instanceId: this.sessionState.instanceId,
  currentEpic: this.sessionState.currentEpic,
  contextWindow: this.sessionState.contextWindow,
  sessionDurationHours: getSessionDuration()
});

response.text += `\n${footer}`;

// Heartbeat (async, non-blocking)
mcp_meta_heartbeat({
  instance_id: this.sessionState.instanceId,
  context_window: this.sessionState.contextWindow,
  current_epic: this.sessionState.currentEpic
}).catch(err => logger.warn('Heartbeat failed', err));
```

**When Spawning Task**
```typescript
const result = await Task({
  description: "...",
  prompt: "...",
  subagent_type: "...",
  model: "..."
});

// Log the spawn
await mcp_meta_log_command({
  instance_id: this.sessionState.instanceId,
  command_type: 'spawn',
  command_data: {
    subagent_type: result.subagent_type,
    description: result.description,
    model: result.model
  }
});
```

**When Committing**
```typescript
const commitResult = await bash(`git commit -m "${message}"`);

// Log the commit
await mcp_meta_log_command({
  instance_id: this.sessionState.instanceId,
  command_type: 'commit',
  command_data: {
    message,
    files_changed: commitResult.files_count,
    commit_hash: commitResult.hash
  }
});
```

**When Handling Resume**
```typescript
const userMessage = "resume odin-PS-8f4a2b";

if (userMessage.startsWith('resume ')) {
  const instanceHint = userMessage.slice(7).trim();
  const recovery = await mcp_meta_resume_instance({
    instance_id_hint: instanceHint
  });

  if (recovery.success) {
    return formatResumeResponse(recovery);
  } else {
    return handleDisambiguation(recovery.matches);
  }
}
```

### Implementation Approach

**Phase 1: Initialization & Footer (Days 1-2)**
1. PS registration on first response
2. Footer generation and rendering
3. Instance ID storage in PS state

**Phase 2: Heartbeating & Logging (Days 3-4)**
1. Heartbeat with every response
2. Explicit logging for spawn, commit, deploy
3. Secret sanitization

**Phase 3: Checkpoint Integration (Day 5)**
1. Monitor context_window in heartbeat
2. Auto-create checkpoint at 80%
3. Auto-create checkpoint on epic completion

**Phase 4: Resume Handling (Day 6)**
1. Resume command detection
2. MCP resume tool integration
3. Recovery display formatting

**Phase 5: Testing & Docs (Days 7-8)**
1. Unit tests (all integration points)
2. Integration tests (full lifecycle)
3. PS instruction updates
4. Example scenarios

---

## Files to Create/Modify

### Modify in PS (Every Project)

1. **`{project}/CLAUDE.md`** - All PSes
   - Add session continuity section
   - Show instance ID in footer
   - Document resume command
   - Explain automatic logging

2. **`{project}/.supervisor-core/01-identity.md`** (or PS instructions)
   - Session continuity system overview
   - Instance ID format and visibility
   - Resume workflow
   - Automatic logging expectations

3. **`{project}/{project}-supervisor.ts`** or main PS handler
   - Initialize instance on startup
   - Add footer to every response
   - Heartbeat with every response
   - Log critical actions (spawn, commit, deploy)
   - Handle resume command

### Create (Meta Service)

1. **`src/ps-integration/ps-bootstrap.ts`**
   - PS initialization helper
   - Provides methods: `initializeSession()`, `generateFooter()`, `logCommand()`

2. **`src/ps-integration/footer-generator.ts`**
   - Format footer for responses
   - Include instance ID, epic, context, duration

3. **`docs/guides/ps-session-continuity-guide.md`**
   - Complete guide for PSes
   - Integration examples
   - Troubleshooting

4. **`src/mcp/tools/ps-integration-tools.ts`**
   - Helper tools for PS integration
   - Simplify PS code

### Create (Documentation)

1. **`docs/examples/ps-session-continuity-example.md`**
   - Example PS implementation
   - Startup code, footer generation, logging
   - Resume handling

---

## Success Criteria

- [ ] Every PS shows instance ID in footer
- [ ] Heartbeat called with every response (20ms overhead)
- [ ] Spawn, commit, deploy automatically logged
- [ ] Checkpoint created at 80% context
- [ ] Resume command works: "resume {id}"
- [ ] Recovery summary displayed correctly
- [ ] All PSes operational (odin, consilio, openhorizon, health-agent)
- [ ] No breaking changes to existing PS workflows
- [ ] Integration tests passing (100%)

---

## Related Documents

- `prd.md` - Feature overview
- `epic-007-A-instance-registry.md` - Instance management
- `epic-007-B-command-logging.md` - Command logging
- `epic-007-C-event-store.md` - Event store
- `epic-007-D-checkpoint-system.md` - Checkpoints
- `epic-007-E-resume-engine.md` - Resume engine

---

## Rollout Plan

### Week 1: Supervisor Service PS

**Deploy In:**
- supervisor-service-s (Meta PS only)

**Verify:**
- Instance registration works
- Footer shows correctly
- Heartbeat maintains
- Commands logged
- Checkpoints created

### Week 2: First Project PS

**Deploy In:**
- consilio-s (Consilio PS)

**Verify:**
- Resume works correctly
- No user-facing disruption
- Collect feedback

### Week 3: All Project PSes

**Deploy In:**
- odin-s, openhorizon-s, health-agent-s

**Verify:**
- All PSes operational
- System-wide monitoring

---

**Maintained by**: Meta-Supervisor
**Created**: 2026-01-28
**Last Updated**: 2026-01-28
