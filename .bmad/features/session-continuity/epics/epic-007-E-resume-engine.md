# Epic 007-E: Resume Engine

**Status**: Pending
**Priority**: HIGH
**Estimated Effort**: 70 hours
**Cost**: $0 (infrastructure)
**Dependencies**: epic-007-A (Instance Registry), epic-007-B (Command Logging), epic-007-C (Event Store), epic-007-D (Checkpoint System)

---

## Overview

Build an intelligent resume engine that enables users to restore any PS instance by ID after crashes/disconnects. The engine handles instance resolution, context reconstruction, disambiguation, and handoff generation—providing seamless recovery with 95%+ accuracy.

## Business Value

- **Zero Context Loss**: Recover any instance and resume work immediately
- **Simple Interface**: One command: "resume 8f4a2b"
- **Smart Disambiguation**: If multiple matches, show numbered list
- **Handoff Automation**: Auto-generate recovery instructions
- **Crash Resilience**: Survive any disconnect without user manual intervention

## Problem Statement

**Current State (Pre-System):**
- User has Odin PS working on epic-003
- VM disconnects, SSH session dies
- User reconnects, opens new session
- **Problem**: Lost context. Which epic was this? Where to continue?
- **Current workaround**: Manual handoff files (if exists), or 10-30 min context reconstruction

**Example Scenario:**
```
[Initial Session] odin-PS-8f4a2b
- Working: epic-003 (authentication)
- Progress: 4.5 hours invested, 42/42 tests passing
- Branch: feat/epic-003-auth, PR created
- Files modified: 12
- Commands logged: 187

[Connection drops at 95% context]

[User reconnects, starts new session]
User: "resume 8f4a2b"

System Response:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Resumed: odin-PS-8f4a2b

Epic 003 (Authentication) - COMPLETED
- Status: Ready for merge
- Tests: 42/42 passed (✓ PASSING)
- Coverage: 87%
- PR: #45 created
- Time invested: 4.5 hours

Checkpoint loaded: 2min ago
Context: ██████████░░░░ 95%

Next steps:
1. Verify PR tests pass on CI
2. Merge PR #45 into main
3. Start epic 004 (MFA implementation)

Command to continue: "Continue building"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Acceptance Criteria

### Core Resume Workflow

1. **Instance Resolution (by ID)**
   - [ ] Parse resume command: `resume 8f4a2b`
   - [ ] Extract instance ID: `8f4a2b`
   - [ ] Query `supervisor_sessions` for matching instance
   - [ ] Validate instance exists and is stale (last heartbeat >2 min ago)
   - [ ] Return instance details

2. **Multi-Instance Disambiguation**
   - [ ] Handle multiple instances with same project
   - [ ] Example: 3 Odin PS instances, ID prefixes `8f4a`, `3c7d`, `a9b2`
   - [ ] User says: `resume odin`
   - [ ] System responds with numbered list:
     ```
     Multiple instances found:
     1. odin-PS-8f4a2b (epic-003, Active 1.5h ago)
     2. odin-PS-3c7d1e (epic-007, Active 2h ago)
     3. odin-PS-a9b2c4 (epic-012, Active 3h ago)

     Use: "resume 8f4a2b" or specify which epic
     ```

3. **Instance Resolution Strategies**
   - [ ] **Exact ID**: "resume 8f4a2b" → Single match
   - [ ] **Partial ID**: "resume 8f4a" → Match prefix
   - [ ] **Project**: "resume odin" → List all Odin instances
   - [ ] **Epic**: "resume epic-003" → Find instance working on that epic
   - [ ] **Newest**: "resume" with no args → Most recent instance

### Context Reconstruction

4. **Checkpoint-Based Restoration (Preferred)**
   - [ ] Load most recent checkpoint for instance
   - [ ] Extract work_state
   - [ ] Verify work state still valid (files not deleted, branch still exists)
   - [ ] Generate recovery summary from checkpoint
   - [ ] Performance: <100ms load time

5. **Event-Based Reconstruction (Fallback)**
   - [ ] If no checkpoint, load last event_store sequence
   - [ ] Replay relevant events (epic_started, test_passed, etc.)
   - [ ] Reconstruct approximate state
   - [ ] Performance: <500ms replay time

6. **Command-Based Reconstruction (Final Fallback)**
   - [ ] If no events, query last 20 commands
   - [ ] Analyze command types to infer state
   - [ ] Generate "best guess" recovery
   - [ ] Clearly mark as low-confidence (<80%)

### Recovery Summary Generation

7. **Summary Content**
   - [ ] Instance ID and project name
   - [ ] Current epic (if applicable): ID, name, status
   - [ ] Progress: time invested, context window, tests passing
   - [ ] Git status: branch, commits, staged files
   - [ ] Checkpoint info: age, trigger type
   - [ ] Last few commands (what was being worked on)
   - [ ] Suggested next steps (actionable)
   - [ ] Confidence score (80-100%)

8. **Summary Format**
   ```
   ✅ Resumed: odin-PS-8f4a2b

   PROJECT: odin-s (Odin Core)

   EPIC: 003 - Authentication (OAuth)
   Status: IN PROGRESS → COMPLETED
   - Tests: 42/42 PASSED ✓
   - Coverage: 87%
   - Time: 4h 32min
   - PR: #45 created (ready for review)

   GIT STATUS:
   - Branch: feat/epic-003-auth
   - Commits: 7 since main
   - Staged: 0 files
   - Changed: 12 files

   CHECKPOINT:
   - Type: epic_completion
   - Loaded: 2 minutes ago
   - Confidence: 99%

   RECENT ACTIONS:
   1. Run test suite (PASSED)
   2. Update PRD v2.0
   3. Commit: "chore: finalize OAuth implementation"

   NEXT STEPS:
   1. ✓ Verify CI passes (in progress)
   2. Merge PR #45 into main
   3. Start epic 004 (MFA) - 60h estimated

   Ready to continue. Command: "continue building"
   ```

### Confidence Scoring

9. **Confidence Calculation**
   - [ ] Checkpoint age: 100% if <5 min, 90% if <1 hour, 70% if >1 hour
   - [ ] State validity: -10% if files deleted, -5% if branch deleted
   - [ ] Event freshness: -5% per 30 min since last event
   - [ ] Final: max(checkpoint_confidence, event_confidence, command_confidence)
   - [ ] Warn if <80%: "Low confidence recovery. Verify manually."

### MCP Tool Specifications

10. **mcp_meta_resume_instance**
    - [ ] Parse resume command
    - [ ] Resolve instance ID (exact, partial, project, epic)
    - [ ] Handle disambiguation
    - [ ] Load checkpoint or reconstruct
    - [ ] Generate summary

11. **mcp_meta_get_instance_details**
    - [ ] Get full details for instance_id
    - [ ] Include: registration time, last heartbeat, stale status
    - [ ] Include: last epic, git branch, context window
    - [ ] Include: checkpoint info, recent commands

12. **mcp_meta_list_stale_instances**
    - [ ] Find all instances without heartbeat >2 min
    - [ ] Return: instance_id, project, last_heartbeat, last_epic
    - [ ] Useful for cleanup/housekeeping

### Instance Validation

13. **Stale Detection**
    - [ ] Instance is stale if last_heartbeat >2 min ago
    - [ ] Cannot resume active instances (heartbeat fresh)
    - [ ] Warn if trying to resume active instance

14. **State Validation**
    - [ ] Verify instance record exists
    - [ ] Verify project directory still exists
    - [ ] Verify git branch still exists (if applicable)
    - [ ] Verify checkpoint is valid (if loading)

### Error Handling

15. **Resume Errors**
    - [ ] **No match**: "No instance found matching 'xyz'"
    - [ ] **Multiple ambiguous matches**: Show list, ask to specify
    - [ ] **Instance active**: "Cannot resume active instance. Current heartbeat: 30s ago"
    - [ ] **Invalid checkpoint**: "Checkpoint corrupted, falling back to events"
    - [ ] **No recovery data**: "No data found to resume from"

### Handoff Document Generation

16. **Auto-Generated Handoff**
    - [ ] When resuming, create optional handoff file
    - [ ] Format: same as manual handoffs
    - [ ] Location: `.handoffs/YYYY-MM-DD-HHMM-{epic}-resume.md`
    - [ ] Contents: resume summary, next steps, commands to run
    - [ ] Purpose: Manual reference, audit trail

### Testing Requirements

17. **Unit Tests**
    - [ ] Instance resolution (exact, partial, project, epic)
    - [ ] Disambiguation (multiple matches)
    - [ ] Confidence scoring
    - [ ] Error handling (all error types)

18. **Integration Tests**
    - [ ] Full resume workflow: Register → Work → Checkpoint → Resume
    - [ ] Multi-instance resume with disambiguation
    - [ ] Event-based reconstruction (no checkpoint)
    - [ ] Stale detection
    - [ ] Validation checks

19. **Recovery Tests**
    - [ ] Checkpoint restoration accuracy (100%)
    - [ ] Event reconstruction accuracy (>95%)
    - [ ] Confidence scores calibrated correctly
    - [ ] Handoff documents generated and valid

20. **Performance Tests**
    - [ ] Resume <500ms (p99)
    - [ ] Instance resolution <50ms
    - [ ] Disambiguation <100ms
    - [ ] Summary generation <100ms

---

## Technical Specifications

### MCP Tool Specifications

**Tool 1: mcp_meta_resume_instance**

```typescript
interface ResumeInstanceRequest {
  instance_id_hint?: string; // "8f4a2b", "odin", "epic-003"
  user_choice?: number; // When disambiguation shows list
}

interface ResumeInstanceResponse {
  success: boolean;
  instance_id: string;
  project: string;

  summary: {
    current_epic?: {
      epic_id: string;
      name: string;
      status: string;
      progress: {
        time_hours: number;
        tests_passed: number;
        tests_total: number;
        coverage_percent: number;
      };
    };
    git_status?: {
      branch: string;
      commits_ahead: number;
      staged_files: number;
      changed_files: number;
    };
    checkpoint?: {
      checkpoint_id: string;
      type: 'context_window' | 'epic_completion' | 'manual';
      age_minutes: number;
    };
    recent_actions: string[];
    next_steps: string[];
  };

  confidence_score: number; // 0-100
  confidence_reason: string;

  handoff_document?: string; // Markdown
  error?: string;
}

// If ambiguous:
interface DisambiguationResponse {
  success: false;
  matches: Array<{
    instance_id: string;
    project: string;
    last_epic?: string;
    last_heartbeat: string;
  }>;
  user_hint: string;
}
```

**Tool 2: mcp_meta_get_instance_details**

```typescript
interface GetInstanceDetailsRequest {
  instance_id: string;
}

interface GetInstanceDetailsResponse {
  instance_id: string;
  project: string;
  instance_type: 'PS' | 'MS';
  status: 'active' | 'stale' | 'inactive';

  registration_time: string;
  last_heartbeat: string;
  last_heartbeat_ago_minutes: number;

  context_window_percent: number;
  current_epic?: string;

  checkpoint_info?: {
    checkpoint_id: string;
    timestamp: string;
    type: string;
  };

  recent_commands: Array<{
    command_type: string;
    timestamp: string;
    summary: string;
  }>;
}
```

**Tool 3: mcp_meta_list_stale_instances**

```typescript
interface ListStaleInstancesResponse {
  instances: Array<{
    instance_id: string;
    project: string;
    instance_type: 'PS' | 'MS';
    last_heartbeat: string;
    minutes_stale: number;
    last_epic?: string;
  }>;
  total_count: number;
}
```

### Implementation Approach

**Phase 1: Instance Resolution (Days 1-2)**
1. Implement exact, partial, project, epic resolution
2. Add disambiguation logic
3. Add MCP tool endpoints

**Phase 2: Context Reconstruction (Days 3-4)**
1. Implement checkpoint-based restoration
2. Implement event-based reconstruction
3. Implement command-based fallback
4. Add validation checks

**Phase 3: Summary Generation (Day 5)**
1. Generate confidence scores
2. Create summary formatting
3. Create handoff documents

**Phase 4: Testing (Days 6-7)**
1. Unit tests (all resolution strategies)
2. Integration tests (full workflow)
3. Performance tests

---

## Files to Create/Modify

### Create

1. **`src/resume/resume-engine.ts`**
   - Core ResumeEngine class
   - Instance resolution, reconstruction, summary

2. **`src/resume/instance-resolver.ts`**
   - Exact, partial, project, epic resolution
   - Disambiguation logic

3. **`src/resume/context-reconstructor.ts`**
   - Checkpoint-based restoration
   - Event-based reconstruction
   - Command-based fallback

4. **`src/resume/summary-generator.ts`**
   - Format recovery summary
   - Confidence scoring
   - Next steps suggestion

5. **`src/resume/handoff-generator.ts`**
   - Generate handoff documents
   - Format: markdown with action items

6. **`src/types/resume-types.ts`**
   - TypeScript interfaces
   - Zod schemas

7. **`src/mcp/tools/resume-tools.ts`**
   - MCP tool implementations

8. **`tests/unit/resume-engine.test.ts`**
   - Resolution, reconstruction, scoring

9. **`tests/integration/resume-workflow.test.ts`**
   - Full resume workflow
   - Disambiguation, stale detection

### Modify

1. **`src/mcp/tools.ts`**
   - Register resume tools

2. **`src/types/index.ts`**
   - Export resume types

---

## Success Criteria

- [ ] Resume command works: "resume 8f4a2b"
- [ ] Instance resolution handles all strategies
- [ ] Disambiguation shows clear list
- [ ] Context reconstructed accurately (>95%)
- [ ] Confidence scores calibrated (error <10%)
- [ ] Resume experience <500ms (p99)
- [ ] Recovery summary generated correctly
- [ ] Integration tests passing (100%)

---

## Related Documents

- `prd.md` - Feature overview
- `epic-007-A-instance-registry.md` - Instance data
- `epic-007-B-command-logging.md` - Command history
- `epic-007-C-event-store.md` - Event history
- `epic-007-D-checkpoint-system.md` - Checkpoint data
- `epic-007-F-ps-integration.md` - PS integration

---

**Maintained by**: Meta-Supervisor
**Created**: 2026-01-28
**Last Updated**: 2026-01-28
