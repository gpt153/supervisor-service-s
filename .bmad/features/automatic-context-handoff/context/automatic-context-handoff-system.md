# Feature Request: Automatic Context Handoff System

**Created**: 2026-01-21
**Status**: Pending Analysis
**Priority**: HIGH
**Complexity**: Level 2 (Medium Feature - 2-4 hours)
**Requested By**: User (samuel)
**Analyzed By**: Documentation Expert PS

---

## Problem Statement

**Current Issues:**

1. **Context Window Exhaustion**
   - Claude instances have finite context windows (200k tokens for Sonnet)
   - Long-running sessions eventually hit context limits
   - When context full, PS/agent stops working mid-task
   - User must manually create new session and re-explain context
   - Work is interrupted, context is lost

2. **No Automatic Detection**
   - PS doesn't monitor its own context usage
   - No warning when approaching limit
   - Sudden failure when limit reached
   - No graceful degradation

3. **Manual Handoff Process**
   - User must notice context is full
   - User must open new instance (SSB or SSC)
   - User must manually explain what was being worked on
   - User must provide previous context
   - Time-consuming and error-prone

4. **Context Loss Risk**
   - Critical state might not be transferred
   - Work-in-progress lost
   - Decisions/rationale forgotten
   - User has to reconstruct history

**User's Request:**
> "We need to get the automatic handoff-creation working where PS automatically creates a handoff when there is 20% or 30% left on context window. Maybe MS can supervise this and automatically create a new instance and prompt it to read handoff and continue if it was a CLI instance."

---

## Desired Outcome

**What Success Looks Like:**

1. **Automatic Detection**
   - PS monitors its own context usage continuously
   - Triggers handoff creation at configurable threshold (20-30% remaining)
   - No user intervention needed
   - Proactive, not reactive

2. **Automatic Handoff Document Creation**
   - PS automatically creates handoff document when threshold reached
   - Document contains:
     - Current task/epic being worked on
     - Progress so far (what's complete, what's in-progress, what's pending)
     - Recent decisions and rationale
     - Active subagents (if any)
     - Next steps to continue work
     - Links to relevant files/epics/plans
   - Saved to standard location: `.bmad/handoffs/handoff-TIMESTAMP.md`

3. **Automatic New Instance Creation (CLI only)**
   - Meta-Supervisor detects handoff creation
   - For CLI sessions (SSC): Automatically spawns new Claude Code instance
   - For Browser sessions (SSB): Notifies user (can't auto-create browser sessions)
   - New instance automatically primed with handoff document

4. **Seamless Continuation**
   - New instance reads handoff automatically
   - Understands full context without user re-explaining
   - Continues work from where previous instance left off
   - User experiences smooth transition, not interruption

5. **Handoff History**
   - All handoffs preserved in `.bmad/handoffs/` directory
   - Chronological record of long sessions
   - Useful for debugging and understanding evolution of decisions

---

## User Impact

**Who Benefits:**
- **User (samuel)**: Never manually creates handoffs, work never interrupted
- **All Project-Supervisors**: Can work on long-running tasks indefinitely
- **Meta-Supervisor**: Better monitoring of session health

**Value Delivered:**
- **Time Saved**: No manual handoff creation (5-10 minutes saved per handoff)
- **Continuity**: Zero context loss during transitions
- **Autonomy**: System handles its own context limitations
- **Productivity**: Long tasks can run for days without interruption
- **Peace of Mind**: User doesn't have to monitor context usage

---

## Related Features/Context

**Current Context Monitoring:**
- Claude API provides usage information in responses
- Includes: input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens
- Can calculate: total_tokens_used, percentage_of_context_consumed

**Existing Handoff Pattern:**
- User occasionally creates manual handoffs
- Format is ad-hoc
- Stored in project root or various locations
- Not standardized

**Meta-Supervisor Capabilities:**
- Already monitors PS instances
- Can track activity via MCP tools
- Can spawn new processes
- For CLI: Can execute Claude Code CLI commands

**PIV-Loop Context:**
- PIV agents might be active when handoff occurs
- Need to preserve PIV state in handoff
- New instance should resume PIV monitoring

---

## Detailed Requirements

### 1. Context Usage Monitoring

**What to Monitor:**
- Total tokens used so far in conversation
- Maximum context window for current model (200k for Sonnet)
- Percentage consumed
- Rate of consumption (tokens per message)
- Estimated messages remaining at current rate

**How to Monitor:**
- After every message/response, check usage stats
- Calculate percentage: (total_tokens_used / max_context_window) * 100
- Trigger handoff when percentage >= threshold (default: 70% = 30% remaining)

**Threshold Configuration:**
- Default: 70% used (30% remaining)
- Configurable per PS in .supervisor-specific/ config file
- User can override: 60%, 70%, 80%
- Trade-off: Earlier = more handoffs, Later = less buffer for handoff creation

**Early Warning (Optional):**
- At 50% usage: Log warning to user "Approaching context limit, will create handoff at 70%"
- At 60% usage: Reminder "Will create handoff soon"
- At 70% usage: Create handoff

### 2. Handoff Document Format

**Location:** `.bmad/handoffs/handoff-YYYY-MM-DD-HHMMSS.md`

**Standard Template:**

```
# Context Handoff

**Created**: 2026-01-21 14:30:45
**Previous Instance**: [Session ID or identifier]
**Context Usage**: 140,000 / 200,000 tokens (70%)
**Project**: consilio-s
**Current Epic**: epic-012-authentication-system.md

---

## Current Task

[Plain English description of what PS was working on]

Example:
- Implementing JWT authentication system for API
- Currently in PIV-loop: Implementation phase
- Active subagent: implement-feature (agent_id: abc123)

---

## Progress Summary

### Completed
- ✅ Research phase: Analyzed existing auth patterns in codebase
- ✅ Planning phase: Created implementation plan in .bmad/plans/auth-plan.md
- ✅ Implementation started: Created JWT middleware, added to routes

### In Progress
- 🔄 Writing tests for authentication endpoints
- 🔄 Validation pending

### Pending
- ⏳ Documentation update
- ⏳ Deployment

---

## Active Subagents

- **implement-feature** (agent_id: abc123)
  - Status: Running
  - Task: Implement JWT authentication
  - Started: 14:15

- **None** (if no active subagents)

---

## Recent Decisions

1. **Decision**: Use JWT instead of session-based auth
   - Rationale: API is stateless, JWT fits architecture better
   - ADR: .bmad/adr/005-jwt-authentication.md

2. **Decision**: Store tokens in httpOnly cookies
   - Rationale: XSS protection
   - No ADR needed (implementation detail)

---

## Files Modified

- src/middleware/auth.ts (new)
- src/routes/api.ts (updated)
- src/types/user.ts (updated)
- .env.example (updated with JWT_SECRET)

---

## Next Steps

1. Continue PIV-loop: Resume implementation subagent or check its status
2. After implementation complete: Run validation subagent
3. Update documentation with new auth endpoints
4. Commit and push changes
5. Update epic status to complete

---

## Important Context

- User requested JWT specifically (not OAuth)
- Must store secret in vault first: mcp_meta_set_secret
- Port 5000 already allocated for API
- Production deployment: consilio.153.se

---

## Links

- Epic: .bmad/epics/epic-012-authentication-system.md
- Plan: .bmad/plans/auth-plan.md
- ADR: .bmad/adr/005-jwt-authentication.md
- Implementation status: See PIV agent monitoring

---

**Instructions for New Instance:**

1. Read this handoff document completely
2. Navigate to project: cd /home/samuel/sv/consilio-s
3. Check active subagents: mcp_meta_get_subagent_status(agent_id: abc123)
4. If subagent still running: Monitor and wait for completion
5. If subagent complete: Continue with next step (validation)
6. If subagent failed: Check error logs and spawn fix subagent
7. Continue from "Next Steps" section above
```

**Dynamic Content:**
- Current task/epic from context
- Progress from epic checklist or workflow status
- Active subagents from Meta-Supervisor state
- Recent decisions from conversation history
- Files modified from git status
- Next steps inferred from current state

### 3. Handoff Creation Workflow

**Trigger Conditions:**
- Primary: Context usage >= threshold (default 70%)
- Secondary: User manually requests handoff (via /handoff command or MCP tool)
- Tertiary: PS detects it's about to perform large operation that would exceed context

**Creation Process:**

**Step 1: Detect Threshold Reached**
- After each message, PS checks: current_tokens / max_tokens >= 0.70
- If true, initiate handoff creation

**Step 2: Gather Handoff Information**
- Current task: From conversation context
- Epic/plan: From .bmad/ files being worked on
- Progress: From epic checklist, workflow status, git status
- Active subagents: Query Meta-Supervisor via MCP tool
- Recent decisions: From recent conversation history (last 10-20 messages)
- Files modified: git status
- Next steps: Infer from current state and plan

**Step 3: Generate Handoff Document**
- Use handoff template
- Fill in all sections with gathered information
- Write to `.bmad/handoffs/handoff-TIMESTAMP.md`

**Step 4: Notify Meta-Supervisor**
- Call MCP tool: mcp_meta_handoff_created({ project, handoff_path, session_type })
- session_type: "cli" or "browser"

**Step 5: Graceful Shutdown**
- PS completes current message
- PS responds to user: "⚠️ Context limit approaching (70% used). Created handoff at .bmad/handoffs/handoff-TIMESTAMP.md. [Next steps based on session type]"
- For CLI: "Meta-Supervisor will spawn new instance automatically."
- For Browser: "Please open new session and run: /continue-handoff handoff-TIMESTAMP.md"
- PS stops responding to further messages

### 4. Automatic New Instance Creation (CLI Only)

**Meta-Supervisor Workflow:**

**Step 1: Receive Handoff Notification**
- MCP tool mcp_meta_handoff_created called by PS
- Extract: project, handoff_path, session_type

**Step 2: Determine Action Based on Session Type**

**If session_type = "cli":**
- Spawn new Claude Code CLI instance automatically
- Command: `claude-code /home/samuel/sv/{project}/`
- Initial prompt: "You are the Project-Supervisor for {project}. A handoff was created due to context limits. Read the handoff document at {handoff_path} and continue the work."

**If session_type = "browser":**
- Cannot auto-create browser sessions (user must open manually)
- Create notification file: `.bmad/handoffs/HANDOFF_PENDING.md`
- Content: "New handoff created at {handoff_path}. Open new browser session and run /continue-handoff to resume."
- User sees this next time they interact with project

**Step 3: Prime New Instance**
- New instance starts
- Automatically reads handoff document
- Loads all referenced files (epic, plan, ADR, etc.)
- Checks active subagents status
- Ready to continue work immediately

**Step 4: Clean Transition**
- Old instance marked as completed in Meta-Supervisor tracking
- New instance registered as active
- Handoff document preserved for history

### 5. Handoff Continuation Commands

**For New Instance to Use:**

**Manual Command (if needed):**
```
/continue-handoff handoff-2026-01-21-143045.md
```

**What It Does:**
- Reads specified handoff document
- Loads all context
- Checks active subagents
- Prompts PS: "Handoff loaded. Current task: [task]. Continue work? [Y/n]"
- If Y: Automatically continues from "Next Steps"

**Automatic Continuation (CLI):**
- Meta-Supervisor passes handoff path as initial prompt
- New instance automatically executes /continue-handoff
- No user intervention needed

### 6. Handoff History Management

**Directory Structure:**
```
.bmad/handoffs/
├── handoff-2026-01-18-093012.md  (3 days old)
├── handoff-2026-01-20-141523.md  (1 day old)
├── handoff-2026-01-21-143045.md  (current)
└── HANDOFF_PENDING.md  (if browser session)
```

**Retention Policy:**
- Keep all handoffs for current epic
- After epic complete: Archive to .bmad/handoffs/archive/
- Archive retention: 90 days (configurable)
- Cleanup: Automated via Meta-Supervisor cron job

**Handoff Chain:**
- Each handoff can reference previous handoff
- Useful for understanding progression of long tasks
- Forms chronological record

### 7. Edge Cases & Error Handling

**Edge Case 1: Handoff Creation Fails**
- PS detects threshold but fails to create handoff
- Fallback: PS warns user, continues working but stops at 90% to force handoff
- User notified: "Handoff creation failed. Please manually create or risk context loss."

**Edge Case 2: New Instance Fails to Start**
- Meta-Supervisor tries to spawn CLI instance but fails
- Fallback: Create HANDOFF_PENDING.md and notify user via health-agent or email
- User manually starts new session

**Edge Case 3: Multiple Handoffs in Quick Succession**
- If new instance also reaches threshold quickly (very long task)
- Each handoff references previous: "This is handoff #3 in chain, see handoff-PREV.md"
- Chain of handoffs forms complete history

**Edge Case 4: Active Subagent When Handoff Created**
- PS checks subagent status
- If subagent still running: Include in handoff with agent_id
- New instance can monitor existing subagent via agent_id
- No need to re-spawn

**Edge Case 5: User Interrupts During Handoff**
- Handoff creation is atomic operation
- Either completes fully or not at all
- If interrupted: PS retries on next message

### 8. Configuration Options

**Per-Project Configuration File:**
`.supervisor-specific/handoff-config.yaml`

```yaml
handoff:
  enabled: true
  threshold: 70  # Percentage of context used before creating handoff
  auto_continue_cli: true  # Auto-spawn new CLI instance
  auto_continue_browser: false  # Can't auto-spawn browser, always false
  retention_days: 90  # How long to keep archived handoffs
  notify_user_at: 50  # Warn user at 50% context usage
```

**Global Defaults (Meta-Supervisor):**
- Default threshold: 70%
- Default retention: 90 days
- Can be overridden per project

### 9. Integration with Existing Systems

**PIV-Loop Integration:**
- When handoff created during PIV-loop, preserve PIV state
- Include active PIV agent_id
- New instance resumes PIV monitoring at same phase

**Subagent Integration:**
- Handoff includes all active subagent IDs
- New instance can query their status via mcp_meta_get_subagent_status
- No need to re-spawn if still running

**Git Integration:**
- Handoff includes git status (modified files, branch, uncommitted changes)
- New instance can resume where left off

**Epic Tracking:**
- Handoff links to current epic
- Epic progress preserved
- New instance continues epic work

---

## Acceptance Criteria

**This feature is complete when:**

1. **Context Monitoring Working**
   - ✅ PS monitors context usage after every message
   - ✅ Calculates percentage: current_tokens / max_tokens
   - ✅ Threshold configurable (default 70%)
   - ✅ Early warning at 50% (optional)

2. **Handoff Creation Automatic**
   - ✅ Triggers automatically at threshold
   - ✅ Creates handoff document in `.bmad/handoffs/`
   - ✅ Follows standard template
   - ✅ Includes all required sections (task, progress, decisions, next steps)
   - ✅ Dynamic content (current epic, active subagents, files modified)

3. **Meta-Supervisor Notification**
   - ✅ PS calls mcp_meta_handoff_created MCP tool
   - ✅ Meta-Supervisor receives notification
   - ✅ Tracks session type (cli vs browser)

4. **CLI Auto-Continuation Working**
   - ✅ Meta-Supervisor spawns new Claude Code instance for CLI sessions
   - ✅ New instance automatically reads handoff
   - ✅ New instance continues work seamlessly
   - ✅ No user intervention needed

5. **Browser Handoff Process**
   - ✅ Creates HANDOFF_PENDING.md for browser sessions
   - ✅ User sees notification
   - ✅ /continue-handoff command works
   - ✅ Loads all context properly

6. **Edge Cases Handled**
   - ✅ Handoff creation failure: Falls back gracefully
   - ✅ New instance spawn failure: Notifies user
   - ✅ Active subagents: Preserved in handoff
   - ✅ Multiple handoffs: Chain preserved
   - ✅ Interruption during handoff: Atomic operation

7. **Handoff History Managed**
   - ✅ All handoffs saved to `.bmad/handoffs/`
   - ✅ Archive after epic complete
   - ✅ Retention policy: 90 days
   - ✅ Cleanup automated

8. **Configuration System**
   - ✅ Per-project config: `.supervisor-specific/handoff-config.yaml`
   - ✅ Global defaults in Meta-Supervisor
   - ✅ Threshold, retention, warnings configurable

9. **Testing & Validation**
   - ✅ Test with simulated high context usage
   - ✅ Test CLI auto-spawn
   - ✅ Test browser handoff notification
   - ✅ Test handoff continuation
   - ✅ Test with active subagents
   - ✅ Test handoff chain (3+ handoffs)

10. **Documentation**
    - ✅ User guide: How handoffs work
    - ✅ PS instructions: When and how to create handoffs
    - ✅ Handoff template documented
    - ✅ Configuration options documented

---

## Success Metrics

**Quantitative:**
- Zero context-related failures (baseline: occasional failures)
- Handoff creation time: <30 seconds
- New instance spawn time: <10 seconds (CLI)
- Context preserved: 100% (no loss)
- Handoff transitions: Seamless (user doesn't notice)

**Qualitative:**
- User never manually creates handoffs
- Long tasks run for days without interruption
- No context loss during transitions
- System handles its own limitations gracefully

---

## Technical Notes

**Dependencies:**
- Claude API usage stats (input_tokens, output_tokens)
- Meta-Supervisor MCP service
- Claude Code CLI (for spawning new instances)
- File system access (for handoff storage)

**Integration Points:**
- PS context monitoring logic
- Meta-Supervisor session tracking
- Claude Code CLI spawn mechanism
- Handoff document template

**Performance Considerations:**
- Context monitoring overhead: Minimal (simple calculation after each message)
- Handoff creation: ~10-30 seconds (gathering info, writing file)
- New instance spawn: ~5-10 seconds (CLI startup time)

**Risks & Mitigations:**
- Risk: Threshold too low → Too many handoffs
  - Mitigation: Configurable threshold, default 70%
- Risk: Handoff creation slow
  - Mitigation: Optimize gathering process, async where possible
- Risk: New instance doesn't understand handoff
  - Mitigation: Standard template, explicit instructions in handoff

**Estimated Effort:**
- Context monitoring: 1-2 hours
- Handoff creation: 2-3 hours
- Meta-Supervisor integration: 2-3 hours
- CLI auto-spawn: 1-2 hours
- Testing & refinement: 2-3 hours
- Total: 8-13 hours (1-2 days)

---

## Open Questions

1. Should early warning be mandatory or optional?
2. What threshold is optimal (60%? 70%? 80%)?
3. Should browser sessions get any auto-continuation (email notification)?
4. How to handle handoffs during critical operations (mid-commit)?
5. Should handoffs be version-controlled (committed to git)?

---

## References

**Related Features:**
- PS Delegation Enforcement (separate feature request)
- PIV-Loop (existing feature using context heavily)
- Meta-Supervisor session tracking

**Similar Patterns:**
- Jupyter notebook checkpointing
- Database transaction savepoints
- OS process hibernation

**User's Original Request:**
> "We need to get the automatic handoff-creation working where PS automatically creates a handoff when there is 20% or 30% left on context window. Maybe MS can supervise this and automatically create a new instance and prompt it to read handoff and continue if it was a CLI instance."

---

**Status**: Ready for BMAD analysis and planning
**Next Step**: Create epic with implementation tasks
**Analyst**: TBD
**PM**: TBD
**Implementation**: Meta-Supervisor team
