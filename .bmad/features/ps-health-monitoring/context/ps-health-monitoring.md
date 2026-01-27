# Feature Request: PS Health Monitoring System

**Status:** Draft
**Priority:** High
**Target:** CLI (Phase 1), SDK/Browser (Phase 2)
**Created:** 2026-01-22
**Author:** Meta-Supervisor

---

## Problem Statement

**Current Issues:**

1. **Silent Spawn Failures:** When PS spawns a subagent that stalls or fails, PS sits idle for hours without detecting the problem
2. **No Context Awareness:** PS doesn't proactively monitor its own context window usage, leading to mid-task interruptions when context exhausts
3. **Instructions Don't Work:** Despite multiple attempts to instruct PS to "check every 10 minutes", PS never does this autonomously (stateless, can't run loops)
4. **Manual Intervention Required:** User must manually check "is the spawn still working?" or "did context run out?"

**Real-world impact:**
- Wasted hours when spawns fail silently
- Lost work when context exhausts mid-epic
- Constant manual babysitting of PS sessions

---

## Solution: External Health Monitor

**Core Principle:** Since PS can't be proactive, we make it reactive but **force** it to react via external prompting.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Health Monitor Service (runs every 10 minutes)         │
│  - Checks active spawns (DB query)                      │
│  - Prompts PS for context report                        │
│  - Detects stalled/failed work                          │
│  - Triggers corrective actions                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   tmux send-keys       │
              │   (CLI prompting)      │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  PS (running in tmux)  │
              │  - Receives prompt     │
              │  - Reports status      │
              │  - Takes action        │
              └────────────────────────┘
```

---

## Key Features

### 1. Active Spawn Monitoring

**What it does:**
- Tracks all spawned subagents in database
- Checks output files for activity (file modification time)
- Detects stalled spawns (no output for 15+ minutes)
- Prompts PS to investigate and report

**Database Schema:**
```sql
CREATE TABLE active_spawns (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) NOT NULL,
  task_id VARCHAR(100) NOT NULL,
  task_type VARCHAR(50),
  description TEXT,
  spawn_time TIMESTAMP DEFAULT NOW(),
  last_output_change TIMESTAMP,
  output_file TEXT,
  status VARCHAR(20) DEFAULT 'running',
  UNIQUE(project, task_id)
);
```

**Prompts sent:**
- Regular update: "Check active spawn status and provide brief progress update"
- Stalled: "Spawn {task_id} has not produced output for 15+ minutes. Investigate and report."

### 2. Context Window Tracking

**Key Discovery:** PS can see its own context usage via system warnings after tool calls!

Example from PS response:
```
<system-reminder>Token usage: 63153/200000; 136847 remaining</system-reminder>
```

**How it works:**
1. Every 10 minutes, monitor prompts: "Report your current context window usage from system warnings"
2. PS responds: "Context: 31.6% (63,153/200,000 tokens)"
3. Monitor parses response, stores in database
4. Monitor applies decision logic based on thresholds

**Database Schema:**
```sql
CREATE TABLE ps_sessions (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) UNIQUE NOT NULL,
  session_type VARCHAR(10), -- 'cli' or 'sdk'
  session_id VARCHAR(100),   -- tmux session name
  started_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW(),
  last_context_check TIMESTAMP,
  context_usage FLOAT,       -- 0.0 to 1.0
  estimated_tokens_used INT
);
```

### 3. Context-Based Decision Logic

**Thresholds and Actions:**

| Context Usage | Behavior | Action |
|--------------|----------|--------|
| < 30% | Accept any task | Normal operation |
| 30-50% | Accept any task | Start considering handoff timing |
| 50-70% | **Only small tasks** | Before large tasks: create handoff first |
| 70-85% | **Only tiny tasks** | Prompt: "High context - create handoff after current work" |
| > 85% | **MANDATORY handoff** | Reject new work until handoff created |

**Why this works:**
- Since PS now spawns subagents for most work, PS's own context grows slowly
- PS can supervise 20-30 epics before needing handoff (vs 3-5 if doing work directly)
- Proactive handoff prevents mid-epic interruptions

### 4. Automated Handoff Cycle (CLI Only)

**When context > 85%, monitor automates full reset:**

```bash
# Step 1: Prompt PS to create handoff
tmux send-keys -t "consilio-ps" "Create handoff document now - context exhausted" Enter

# Step 2: Wait for handoff file creation (monitor polls)
# /home/samuel/sv/consilio-s/.bmad/handoffs/handoff-2026-01-22-15-30.md

# Step 3: Clear context
tmux send-keys -t "consilio-ps" C-c  # Interrupt current work
tmux send-keys -t "consilio-ps" "/clear" Enter

# Step 4: Resume from handoff
tmux send-keys -t "consilio-ps" "Read handoff from .bmad/handoffs/handoff-2026-01-22-15-30.md and resume work" Enter
```

**Benefits:**
- ✅ Zero manual intervention
- ✅ Maintains continuity (no lost state)
- ✅ Prevents context exhaustion mid-task
- ✅ PS sessions can run indefinitely

**Trade-off:**
- Some nuance/conversational context lost (but major state preserved in handoff)

### 5. Health Check Audit Trail

**Database Schema:**
```sql
CREATE TABLE health_checks (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) NOT NULL,
  check_time TIMESTAMP DEFAULT NOW(),
  check_type VARCHAR(50), -- 'spawn', 'context', 'handoff', 'orphaned_work'
  status VARCHAR(20),     -- 'ok', 'warning', 'critical'
  details JSONB,
  action_taken TEXT
);
```

**Records:**
- Every health check performed
- Issues detected (spawn stalled, context high, etc.)
- Actions taken (prompted PS, forced handoff, etc.)
- PS responses

**Use cases:**
- Debugging why PS failed to complete work
- Analytics on spawn success rates
- Context usage patterns per project

---

## Implementation Phases

### Phase 1: CLI Support (MVP)

**Requirements:**
- PS must run in named tmux session: `{project}-ps`
  - Example: `tmux new -s consilio-ps`
  - Convention: `consilio-ps`, `odin-ps`, `supervisor-ps`, etc.

**Components:**

1. **Database Schema** (`migrations/007-ps-health-monitoring.sql`)
   - `ps_sessions` table
   - `active_spawns` table
   - `health_checks` table

2. **Monitor Service** (`src/monitoring/ps-health-monitor.ts`)
   - Runs every 10 minutes (systemd timer or internal setInterval)
   - Queries active spawns, checks health
   - Prompts PS via tmux send-keys
   - Records results in database

3. **Update spawn-subagent tool** (`src/mcp/tools/spawn-subagent-tool.ts`)
   - Record spawn in `active_spawns` table
   - Include project, task_id, output_file path
   - Set initial status 'running'

4. **Prompt Generator** (`src/monitoring/prompt-generator.ts`)
   - Generates appropriate prompts based on health status
   - Templates for: spawn update, spawn stalled, context check, handoff trigger

5. **PS Instructions Update** (`.supervisor-core/05-autonomous-supervision.md`)
   - Add: "Respond to health check prompts immediately"
   - Add: "When prompted for context, report from system warnings"
   - Add: "When prompted for spawn status, check and report"

**Deliverables:**
- ✅ Monitor detects stalled spawns within 10 minutes
- ✅ PS reports context usage every 10 minutes
- ✅ Automated handoff cycle when context > 85%
- ✅ Health check audit trail

### Phase 2: SDK/Browser Support

**Challenges:**
- Cannot use `tmux send-keys` (no tmux session)
- Claude API may not support sending messages to conversations
- User cannot easily `/clear` in browser (needs new conversation)

**Proposed Solution:**

1. **Heuristic Context Tracking:**
   - Track session duration, message count
   - Estimate context: `(session_duration_hours * 20000) / 200000`
   - When estimate > 70%, warn in database

2. **Manual Prompting:**
   - Monitor records warning in database
   - User checks database: `SELECT * FROM health_checks WHERE status = 'warning'`
   - User manually sends message: "Check spawn status and context usage"

3. **Manual Handoff:**
   - When context > 85%, monitor logs critical warning
   - User manually: "Create handoff document"
   - User starts new conversation, pastes handoff

**Benefits:**
- Better than nothing (some monitoring)
- Audit trail still useful

**Limitations:**
- Requires manual user intervention
- Cannot auto-prompt or auto-handoff

---

## Technical Details

### Prompting Mechanism (CLI)

**tmux send-keys command:**
```bash
tmux send-keys -t "{project}-ps" "{prompt}" Enter
```

**Session naming convention:**
```bash
# Consilio PS
tmux new -s consilio-ps
cd /home/samuel/sv/consilio-s
claude code

# Odin PS
tmux new -s odin-ps
cd /home/samuel/sv/odin-s
claude code

# Meta-Supervisor
tmux new -s supervisor-ps
cd /home/samuel/sv/supervisor-service-s
claude code
```

### Context Parsing

**PS response format:**
```
Context: 31.6% (63,153/200,000 tokens)
```

**Monitor regex:**
```typescript
const match = response.match(/Context:\s+(\d+\.?\d*)%\s+\((\d+)\/(\d+)\s+tokens\)/);
if (match) {
  const percentage = parseFloat(match[1]);
  const used = parseInt(match[2]);
  const total = parseInt(match[3]);

  await pool.query(
    `UPDATE ps_sessions
     SET context_usage = $1, estimated_tokens_used = $2, last_context_check = NOW()
     WHERE project = $3`,
    [percentage / 100, used, project]
  );
}
```

### Spawn Health Detection

**Stalled spawn criteria:**
```typescript
const isStalled = (spawn: ActiveSpawn): boolean => {
  if (!spawn.output_file) return false;

  const stat = await fs.stat(spawn.output_file);
  const minutesSinceChange = (Date.now() - stat.mtimeMs) / 60000;

  return minutesSinceChange > 15;
};
```

**Failed spawn criteria:**
```typescript
const hasFailed = async (spawn: ActiveSpawn): Promise<boolean> => {
  if (!spawn.output_file) return false;

  const output = await fs.readFile(spawn.output_file, 'utf-8');
  const lastLines = output.split('\n').slice(-50).join('\n');

  const errorPatterns = [
    /Error:/,
    /Failed:/,
    /Cannot/,
    /Exception/,
    /Traceback/
  ];

  return errorPatterns.some(pattern => pattern.test(lastLines));
};
```

### Monitor Main Loop

**Pseudo-code:**
```typescript
async function runHealthChecks() {
  // Get all projects with active sessions
  const projects = await pool.query(`
    SELECT DISTINCT project FROM active_spawns WHERE status = 'running'
    UNION
    SELECT project FROM ps_sessions WHERE last_activity > NOW() - INTERVAL '1 hour'
  `);

  for (const { project } of projects.rows) {
    // Check 1: Active spawns
    const spawns = await getActiveSpawns(project);
    for (const spawn of spawns) {
      if (await isStalled(spawn)) {
        await promptPS(project, `Spawn ${spawn.task_id} stalled - investigate`);
        await recordHealthCheck(project, 'spawn', 'warning', { spawn_id: spawn.id });
      } else {
        await promptPS(project, `Status update: active spawn ${spawn.task_id}`);
      }
    }

    // Check 2: Context window
    await promptPS(project, `Report your current context window usage from system warnings`);

    // Check 3: Context threshold actions
    const session = await getSession(project);
    if (session.context_usage > 0.85) {
      await promptPS(project, `Create handoff document now - context at ${Math.round(session.context_usage * 100)}%`);
      await recordHealthCheck(project, 'context', 'critical', { usage: session.context_usage });

      // Wait for handoff, then auto-clear
      await waitForHandoff(project);
      await clearContext(project);
    } else if (session.context_usage > 0.70) {
      await recordHealthCheck(project, 'context', 'warning', { usage: session.context_usage });
    }
  }
}

// Run every 10 minutes
setInterval(runHealthChecks, 10 * 60 * 1000);
```

---

## Benefits

### For Users
- ✅ **Autonomous operation:** PS truly works unsupervised for hours/days
- ✅ **No lost time:** Stalled spawns caught within 10 minutes (vs hours of manual checking)
- ✅ **No mid-task interruptions:** Proactive handoff prevents context exhaustion mid-epic
- ✅ **Visibility:** Health check audit trail shows what PS is doing

### For PS
- ✅ **External enforcement:** Can't ignore instructions (forced to respond)
- ✅ **Accurate context data:** Uses actual token counts from system warnings
- ✅ **Long session life:** Spawn-delegation means 20-30 epics per session
- ✅ **Continuity:** Automated handoff cycle maintains state across resets

### For System
- ✅ **Analytics:** Track spawn success rates, context patterns, failure modes
- ✅ **Debugging:** Audit trail for "why did PS stop working?"
- ✅ **Cost optimization:** Detect wasteful operations (spawns that always fail)

---

## Open Questions

1. **Monitor frequency:** 10 minutes vs 5 minutes vs 15 minutes?
   - Trade-off: responsiveness vs noise
   - Recommendation: Start with 10 min, tune based on data

2. **Handoff timing:** When exactly to trigger auto-handoff?
   - Current: >85% context
   - Alternative: >80% and no active work?
   - Risk: Too early = lost conversational context

3. **Spawn timeout:** How long before declaring spawn "permanently failed"?
   - Current: 15 min stall = warning
   - Propose: 30 min stall = abandon and retry?

4. **SDK support:** Can we integrate Claude API for browser prompting?
   - Need to investigate: conversation message injection
   - Fallback: Manual prompting workflow

5. **Cross-project interference:** Should monitor prompt ALL projects or only active ones?
   - Current: Only projects with active spawns
   - Alternative: All projects in tmux sessions?

---

## Success Metrics

**Phase 1 (CLI):**
- ✅ 100% of stalled spawns detected within 10 minutes
- ✅ 0 context exhaustion interruptions (all handoffs before 90%)
- ✅ <5 minutes from handoff trigger to context clear + resume
- ✅ PS session uptime >24 hours without manual intervention

**Phase 2 (SDK):**
- ✅ Context warnings logged for 100% of browser sessions >2 hours
- ✅ Manual handoff workflow documented and tested

---

## Related Work

**Existing Features:**
- Subagent spawn tool (`mcp_meta_spawn_subagent`) - already tracks spawns
- Handoff instructions (`.supervisor-core/05-autonomous-supervision.md`) - PS knows how
- tmux requirement for CLI - already documented

**Dependencies:**
- Database (PostgreSQL) - already available
- tmux - already required for CLI sessions
- System warnings in Claude Code - already working (proven today)

**Future Enhancements:**
- Integration with Odin for spawn failure analysis
- Machine learning on spawn success patterns
- Predictive handoff timing (before context hits threshold)
- Multi-PS coordination (don't all handoff at same time)

---

## Implementation Estimate

**Phase 1 (CLI):**
- Database schema: 1 hour
- Monitor service core: 4 hours
- Spawn tracking integration: 2 hours
- Prompt generator: 2 hours
- tmux integration: 2 hours
- Testing + refinement: 4 hours
- Documentation updates: 2 hours

**Total: ~17 hours**

**Phase 2 (SDK):**
- TBD (depends on Claude API investigation)

---

## Next Steps

1. Create ADR for architecture decisions
2. Design database schema (migration file)
3. Implement monitor service skeleton
4. Test tmux prompting mechanism
5. Integrate with spawn-subagent tool
6. Update PS instructions
7. Deploy to supervisor-service-s
8. Test with real consilio-ps session
9. Iterate based on real-world data

---

**Approved by:** [Pending]
**Implementation starts:** [TBD]
