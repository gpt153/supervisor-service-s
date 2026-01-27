# Feature Request: Learning System + Action Database

**Created**: 2026-01-27
**Status**: Pending Analysis
**Priority**: CRITICAL
**Complexity**: Level 4 (Large Feature - 8-16 hours)
**Requested By**: User (samuel)
**Category**: Infrastructure / Knowledge Management

---

## Problem Statement

**Critical Issues:**

1. **Context Loss on VM Disconnect**
   - When VM disconnects (network issues, laptop sleep, etc.), PS/MS instances lose all context
   - Cannot resume work from where they left off
   - No record of what PS was doing, decisions made, or progress achieved
   - User must manually explain entire context when reconnecting
   - Work is interrupted, potentially lost

2. **No Audit Trail of PS/MS Actions**
   - Cannot answer questions like:
     - "What did PS do in the last hour?"
     - "Why did this deployment happen at 3am?"
     - "Which PS spawned this subagent?"
     - "What was the decision-making process?"
   - No accountability or transparency into PS/MS operations
   - Cannot debug issues retroactively
   - Cannot analyze PS effectiveness or patterns

3. **Learning System Incomplete**
   - RAG indexing exists (migration, schema, tools) but:
     - Never fully integrated into PS workflows
     - Not automatically triggered
     - Search not proactively used before planning/implementation
     - No automatic learning extraction from completed work
   - Learnings manually created, manually searched
   - High-value insights lost because friction to capture them

4. **No Training Data for Improvement**
   - Cannot identify patterns: "PS consistently struggles with X"
   - Cannot measure improvement over time
   - Cannot create training datasets for future PS improvements
   - Cannot A/B test different PS instruction approaches

**Current Partial Implementations:**

- ✅ Learning database schema exists (`learnings`, `knowledge_chunks`, `knowledge_sources`)
- ✅ RAG indexing implementation exists (`LearningsIndex.ts`, `LearningWatcher.ts`)
- ✅ MCP tools defined for learning search (`search-learnings`, `index-learning`, etc.)
- ❌ **NOT integrated into PS workflow** (PSes don't search learnings before planning)
- ❌ **NOT automatically triggered** (no auto-indexing on file changes)
- ❌ **NO action logging** (no record of what PS/MS do)
- ❌ **NO resume capability** (can't pick up after disconnect)

---

## Desired Outcome

**What Success Looks Like:**

### A. Learning System (Complete Integration)

1. **Automatic RAG Indexing**
   - File watcher active on all `.md` files in `docs/supervisor-learnings/`, `.bmad/`, `docs/guides/`
   - New/modified files automatically indexed within 1 minute
   - Embeddings generated and stored in PostgreSQL with pgvector
   - No manual index updates needed

2. **Proactive Learning Search**
   - **BEFORE planning epic**: PS automatically searches learnings for related context
   - **BEFORE implementing feature**: PS searches for past issues/patterns
   - **BEFORE deployment**: PS searches for deployment learnings
   - Learnings automatically included in planning prompts
   - PSes avoid repeating past mistakes

3. **Automatic Learning Extraction**
   - After completing epic: PS analyzes what went well/poorly
   - Automatically creates learning draft in `.bmad/learnings/auto-YYYY-MM-DD-HHMMSS.md`
   - User reviews and approves (moves to `docs/supervisor-learnings/`)
   - Auto-extraction uses completion notes, git history, issue resolutions

4. **Semantic Search UI** (future)
   - Query: "SCAR build verification issues" → Returns top 5 relevant learnings
   - Filter by category, severity, date range
   - Quick access for user to search knowledge base

### B. Action Log Database (New System)

1. **Comprehensive Action Logging**
   - Every PS/MS action logged to database with full context:
     - Spawn subagent: Which agent, for what task, epic ID, timestamp
     - Commit/push: What files, commit message, branch, reason
     - Deploy: Service, port, version, deployment type
     - Planning: Epic analyzed, decisions made, approach chosen
     - Validation: What validated, pass/fail, failures found
     - Tool usage: MCP tool called, parameters, result
   - Context preserved: Epic ID, files touched, commands run, outcomes
   - Linked to session: Can trace all actions in a session

2. **Resume After Disconnect**
   - When PS disconnects mid-work:
     - User reconnects, says "Resume work"
     - PS queries action log: "What was last session doing?"
     - Reads last 10-20 actions from database
     - Reconstructs context: "You were implementing epic-012, validation failed on test suite, next step is fix tests"
     - Automatically continues from where left off
   - No user re-explanation needed

3. **Audit Trail & Reporting**
   - Query capabilities:
     - "Show all deployments in last 7 days"
     - "What did Consilio PS do yesterday?"
     - "Why was port 5175 allocated?"
     - "Which subagents failed in last week?"
   - Auto-generate daily/weekly PS activity reports
   - Track PS productivity: Actions per hour, success rates

4. **Training Data Collection**
   - Action logs become training data:
     - Successful patterns: "When PS did X, outcome was good"
     - Failure patterns: "When PS skipped Y, errors occurred"
     - Timing data: "Authentication features take 3.2 hours on average"
   - Export to CSV/JSON for analysis
   - Identify areas for PS instruction improvement

---

## User Impact

**Who Benefits:**
- **User (samuel)**: Can reconnect and resume instantly, full audit trail of system actions
- **All PSes**: Learn from past work, avoid repeated mistakes, resume after interruption
- **Meta-Supervisor**: Better monitoring, automatic reporting, training data for improvements

**Value Delivered:**
- **Context Preservation**: Zero loss on disconnect (resume from database)
- **Knowledge Utilization**: Learnings actively used, not just stored
- **Accountability**: Complete audit trail of all PS/MS actions
- **Continuous Improvement**: Training data to make PS smarter over time
- **Time Saved**: No re-explaining context after disconnect (10-30 min per incident)
- **Quality**: Learnings prevent repeated mistakes (fewer bugs, faster delivery)

---

## Related Features/Context

**Existing Learning System:**
- Database schema: `/home/samuel/sv/supervisor-service-s/migrations/1737212400000_learnings_index.sql`
- Implementation: `/home/samuel/sv/supervisor-service-s/src/rag/LearningsIndex.ts`
- MCP tools: `/home/samuel/sv/supervisor-service-s/src/mcp/tools/learning-tools.ts`
- Epic: `/home/samuel/sv/supervisor-service-s/.bmad/epics/002-learning-system-enhancement.md`

**Similar Systems:**
- `task_executions` table tracks task timing (but not PS actions)
- `time_tracking_sessions` tracks work sessions (but not action details)
- Both are passive tracking, not active logging or resume-capable

**Dependencies:**
- OpenAI API key (for embeddings) - already available
- PostgreSQL with pgvector extension - already set up
- MCP server infrastructure - already running

---

## Detailed Requirements

### Part A: Learning System Integration

#### 1. Automatic RAG Indexing

**File Watcher Service:**

```typescript
// Start on MCP server initialization
const watcher = new LearningWatcher(learningsIndex, {
  watchPaths: [
    '/home/samuel/sv/docs/supervisor-learnings/learnings/',
    '/home/samuel/sv/.bmad/learnings/', // Auto-extracted learnings
    '/home/samuel/sv/docs/guides/', // System guides
  ],
  onIndexed: (filePath, learningId) => {
    console.log(`Auto-indexed: ${filePath}`);
    // Optional: Notify PSes of new learning
  },
  onError: (error, filePath) => {
    console.error(`Failed to index ${filePath}:`, error);
  }
});

watcher.start();
```

**Trigger Conditions:**
- File created: Index immediately
- File modified: Re-index (update existing embedding)
- File deleted: Remove from index
- Debounce: 30 seconds (avoid re-indexing during active editing)

**Indexing Process:**
1. Detect file change
2. Parse markdown (extract title, category, tags, content)
3. Generate embedding via OpenAI API (text-embedding-ada-002)
4. Store in `learnings` table with metadata
5. Log to console: "Indexed learning-042-scar-verification.md"

**Configuration:**
- Enable/disable per environment: `ENABLE_AUTO_INDEXING=true`
- Embedding model: `EMBEDDING_MODEL=text-embedding-ada-002`
- Watch paths configurable in `.env`

#### 2. Proactive Learning Search in PS Workflows

**Integration Points:**

**A. Before Epic Planning (MANDATORY):**

When PS receives "Plan feature X" or "Implement epic-NNN":

```typescript
// In PS instructions (add to CLAUDE.md or planning workflow)
BEFORE creating plan:
1. Search learnings: mcp_meta_search_learnings({
     query: "[feature/epic description]",
     category: "[relevant category]",
     limit: 5
   })
2. Include top 3-5 learnings in planning prompt
3. Planning prompt format:
   "Feature: [description]

   RELEVANT PAST LEARNINGS:
   - [Learning 1: title + key takeaway]
   - [Learning 2: title + key takeaway]
   ...

   Based on these learnings, create implementation plan that avoids past mistakes."
```

**B. Before Implementation (RECOMMENDED):**

When spawning implementation subagent:

```typescript
// Search for implementation-specific learnings
const learnings = await searchLearnings(
  `${taskType} implementation in ${technology}`,
  { category: taskCategory, limit: 3 }
);

// Include in subagent prompt
const prompt = `
Implement: ${task}

PAST LEARNINGS:
${learnings.map(l => `- ${l.title}: ${l.content.substring(0, 200)}...`).join('\n')}

Follow these learnings to avoid known issues.
[rest of implementation instructions]
`;
```

**C. Before Deployment (MANDATORY):**

When deploying service:

```typescript
// Search deployment learnings
const deploymentLearnings = await searchLearnings(
  'deployment issues port conflicts cleanup',
  { category: 'deployment', impact_level: 'high', limit: 5 }
);

// Include in deployment checklist
// PS verifies each learning's recommendation before deploying
```

**Workflow Changes Required:**
- Update `.supervisor-core/02-workflow.md`: Add learning search step to epic planning
- Update `.claude/commands/plan-interactive.md`: Include learning search in planning flow
- Update deployment subagent: Add learning search before deploy

#### 3. Automatic Learning Extraction

**Trigger Points:**

**A. After Epic Completion:**

When PS marks epic complete:

```typescript
// Analyze epic work
const epicAnalysis = {
  epic_id: 'epic-012',
  what_worked: extractFromNotes(epicNotes, 'success'),
  what_failed: extractFromNotes(epicNotes, 'blocker'),
  surprises: extractFromNotes(epicNotes, 'unexpected'),
  time_estimate: epic.estimated_hours,
  time_actual: epic.actual_hours,
  key_decisions: extractDecisions(gitHistory, epicNotes),
};

// Generate learning draft
const learningDraft = await generateLearningDraft(epicAnalysis);

// Save to .bmad/learnings/auto-[epic-id]-TIMESTAMP.md
await saveDraft(learningDraft);

// Notify user
console.log(`📚 Learning draft created: .bmad/learnings/auto-epic-012-2026-01-27.md`);
console.log('Review and move to docs/supervisor-learnings/ to publish.');
```

**B. After Issue Resolution:**

When issue closed with resolution notes:

```typescript
// Check if resolution contains learning-worthy content
if (issueResolution.length > 200 && issueLabels.includes('bug')) {
  const learning = extractLearningFromIssue(issue);
  await saveDraft(learning);
}
```

**Learning Draft Template:**

```markdown
# Learning [AUTO-GENERATED]: [Title from analysis]

**Date:** [YYYY-MM-DD]
**Severity:** [HIGH/MEDIUM/LOW - inferred from impact]
**Category:** [Inferred from epic category]
**Tags:** [Auto-tagged based on content]
**Status:** DRAFT - Review and approve before publishing

---

## Problem

[Extracted from epic notes / issue description]

## Root Cause

[Extracted from investigation notes / git commit messages]

## Solution

[Extracted from implementation approach / resolution]

## Key Takeaway

[Generated summary - 1-2 sentences]

---

**Auto-generated from:** epic-012-authentication-system
**Review checklist:**
- [ ] Problem description accurate?
- [ ] Root cause correct?
- [ ] Solution generalizable?
- [ ] Tags appropriate?
- [ ] Move to docs/supervisor-learnings/ when approved
```

**User Workflow:**
1. PS auto-generates draft in `.bmad/learnings/`
2. User reviews draft (checks accuracy)
3. User edits/refines as needed
4. User moves to `docs/supervisor-learnings/learnings/` to publish
5. File watcher auto-indexes on move (now searchable)

#### 4. Learning Search MCP Tool Enhancement

**Current Tool:** `mcp_meta_search_learnings` already exists

**Enhancements Needed:**

```typescript
// Add to existing tool
export const searchLearningsTool: ToolDefinition = {
  name: 'search-learnings',
  description: 'Search learnings with semantic similarity. ALWAYS use before planning/implementing.',
  inputSchema: {
    // ... existing params ...
    include_applications: {
      type: 'boolean',
      description: 'Include where learning was previously applied (default: true)',
    },
    include_effectiveness: {
      type: 'boolean',
      description: 'Include success rate of learning (default: true)',
    },
  },
  handler: async (params, context) => {
    const results = await index.searchLearnings(params.query, options);

    // Enhance with application history
    if (params.include_applications) {
      for (const result of results) {
        result.applications = await getApplicationHistory(result.learning_id);
        result.success_rate = calculateSuccessRate(result.applications);
      }
    }

    return {
      query: params.query,
      results_count: results.length,
      learnings: results.map(formatLearningResult),
      recommendation: generateRecommendation(results), // "Apply Learning #12 - 95% success rate"
    };
  },
};
```

---

### Part B: Action Log Database (New System)

#### 1. Database Schema

**New Tables:**

```sql
-- PS/MS action log
-- Records every action taken by supervisors
CREATE TABLE IF NOT EXISTS supervisor_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255) NOT NULL, -- Unique session identifier
  supervisor_type VARCHAR(10) NOT NULL, -- 'PS' or 'MS'
  project VARCHAR(100), -- Project name (e.g., 'consilio-s', NULL for MS)
  action_type VARCHAR(50) NOT NULL, -- spawn, commit, deploy, plan, validate, search, tool_call
  action_category VARCHAR(50), -- deployment, git, planning, execution, learning

  -- Action details (JSONB for flexibility)
  context JSONB NOT NULL DEFAULT '{}', -- Action-specific context
  /*
  Example contexts by action_type:

  spawn: {
    subagent_type: "implementation",
    model: "haiku",
    task_description: "Implement authentication",
    epic_id: "epic-012",
    agent_id: "abc123"
  }

  commit: {
    files: ["src/auth.ts", "tests/auth.test.ts"],
    message: "feat: add JWT authentication",
    branch: "feature/auth",
    epic_id: "epic-012",
    commit_hash: "a1b2c3d4"
  }

  deploy: {
    service: "consilio-api",
    port: 5000,
    type: "docker",
    health_check_url: "http://localhost:5000/health",
    deployment_status: "success"
  }

  plan: {
    epic_id: "epic-012",
    approach: "JWT with httpOnly cookies",
    learnings_consulted: ["learning-042", "learning-053"],
    decisions: ["Use JWT", "Store in cookies"]
  }

  validate: {
    epic_id: "epic-012",
    validation_type: "acceptance_criteria",
    passed: true,
    failures: []
  }

  tool_call: {
    tool_name: "mcp_meta_allocate_port",
    params: {port: 5000, service: "api"},
    result: {success: true}
  }
  */

  -- Outcome
  outcome VARCHAR(50) NOT NULL DEFAULT 'success', -- success, failure, blocked, in_progress
  error_message TEXT, -- If outcome = failure
  duration_seconds INTEGER, -- How long action took

  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Relationships
  parent_action_id UUID REFERENCES supervisor_actions(id), -- If this action spawned from another
  related_epic_id VARCHAR(100), -- Link to epic if applicable
  related_issue_id VARCHAR(100) -- Link to issue if applicable
);

-- Indexes
CREATE INDEX idx_supervisor_actions_session_id ON supervisor_actions(session_id);
CREATE INDEX idx_supervisor_actions_type ON supervisor_actions(action_type);
CREATE INDEX idx_supervisor_actions_supervisor_type ON supervisor_actions(supervisor_type);
CREATE INDEX idx_supervisor_actions_project ON supervisor_actions(project);
CREATE INDEX idx_supervisor_actions_timestamp ON supervisor_actions(timestamp DESC);
CREATE INDEX idx_supervisor_actions_outcome ON supervisor_actions(outcome);
CREATE INDEX idx_supervisor_actions_epic ON supervisor_actions(related_epic_id);

-- GIN index for JSONB context search
CREATE INDEX idx_supervisor_actions_context ON supervisor_actions USING GIN(context);

-- Session tracking
CREATE TABLE IF NOT EXISTS supervisor_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  supervisor_type VARCHAR(10) NOT NULL,
  project VARCHAR(100),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  session_type VARCHAR(20) NOT NULL, -- 'cli' or 'browser'
  disconnect_reason VARCHAR(100), -- 'normal', 'network_disconnect', 'timeout', etc.
  total_actions INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}' -- Can store: user, machine, claude_version, etc.
);

CREATE INDEX idx_supervisor_sessions_project ON supervisor_sessions(project);
CREATE INDEX idx_supervisor_sessions_started_at ON supervisor_sessions(started_at DESC);
CREATE INDEX idx_supervisor_sessions_last_activity ON supervisor_sessions(last_activity DESC);
```

**Helper Functions:**

```sql
-- Get recent actions for a session
CREATE OR REPLACE FUNCTION get_session_actions(
  p_session_id VARCHAR,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  action_id UUID,
  action_type VARCHAR,
  context JSONB,
  outcome VARCHAR,
  timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT id, action_type, context, outcome, timestamp
  FROM supervisor_actions
  WHERE session_id = p_session_id
  ORDER BY timestamp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get last session for resume
CREATE OR REPLACE FUNCTION get_last_session(
  p_project VARCHAR,
  p_supervisor_type VARCHAR DEFAULT 'PS'
)
RETURNS TABLE (
  session_id VARCHAR,
  last_activity TIMESTAMP WITH TIME ZONE,
  total_actions INTEGER,
  last_action_type VARCHAR,
  last_action_context JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ss.session_id,
    ss.last_activity,
    ss.total_actions,
    sa.action_type as last_action_type,
    sa.context as last_action_context
  FROM supervisor_sessions ss
  LEFT JOIN LATERAL (
    SELECT action_type, context
    FROM supervisor_actions
    WHERE session_id = ss.session_id
    ORDER BY timestamp DESC
    LIMIT 1
  ) sa ON true
  WHERE ss.project = p_project
    AND ss.supervisor_type = p_supervisor_type
  ORDER BY ss.last_activity DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Activity report
CREATE OR REPLACE VIEW supervisor_activity_summary AS
SELECT
  DATE(timestamp) as activity_date,
  supervisor_type,
  project,
  action_type,
  outcome,
  COUNT(*) as action_count,
  AVG(duration_seconds) as avg_duration_seconds
FROM supervisor_actions
GROUP BY DATE(timestamp), supervisor_type, project, action_type, outcome
ORDER BY activity_date DESC, action_count DESC;
```

#### 2. Action Logging Implementation

**Where Logging Happens:**

**Option A: In PS Instructions (CLAUDE.md)**

Add to `.supervisor-core/01-identity.md`:

```markdown
## MANDATORY: Action Logging

**After EVERY action, log to database:**

Examples:
- After spawning subagent: mcp_meta_log_action({
    action_type: "spawn",
    context: { subagent_type, model, task, epic_id, agent_id }
  })
- After commit: mcp_meta_log_action({
    action_type: "commit",
    context: { files, message, branch, epic_id, hash }
  })
- After deploy: mcp_meta_log_action({
    action_type: "deploy",
    context: { service, port, type, status }
  })
```

**Option B: In MCP Server (Automatic)**

Wrap all MCP tools to auto-log:

```typescript
// MCP server wrapper
function wrapToolWithLogging(tool: ToolDefinition): ToolDefinition {
  return {
    ...tool,
    handler: async (params, context) => {
      const startTime = Date.now();
      const sessionId = context.session_id || generateSessionId();

      try {
        const result = await tool.handler(params, context);

        // Log successful action
        await logAction({
          session_id: sessionId,
          supervisor_type: context.supervisor_type, // 'PS' or 'MS'
          project: context.project,
          action_type: 'tool_call',
          action_category: categorizeAction(tool.name),
          context: {
            tool_name: tool.name,
            params: params,
            result: result,
          },
          outcome: 'success',
          duration_seconds: (Date.now() - startTime) / 1000,
        });

        return result;
      } catch (error) {
        // Log failed action
        await logAction({
          session_id: sessionId,
          supervisor_type: context.supervisor_type,
          project: context.project,
          action_type: 'tool_call',
          action_category: categorizeAction(tool.name),
          context: {
            tool_name: tool.name,
            params: params,
          },
          outcome: 'failure',
          error_message: error.message,
          duration_seconds: (Date.now() - startTime) / 1000,
        });

        throw error;
      }
    },
  };
}
```

**Recommendation:** Hybrid approach
- Automatic logging: All MCP tool calls (Option B)
- Manual logging: Git operations, spawns, planning (Option A - PS explicitly logs)
- Best of both: Complete coverage without missing anything

**New MCP Tools:**

```typescript
// Log action
export const logActionTool: ToolDefinition = {
  name: 'log-action',
  description: 'Log PS/MS action to audit database',
  inputSchema: {
    type: 'object',
    properties: {
      action_type: {
        type: 'string',
        enum: ['spawn', 'commit', 'deploy', 'plan', 'validate', 'search', 'tool_call'],
        description: 'Type of action performed',
      },
      context: {
        type: 'object',
        description: 'Action-specific context (subagent details, files, etc.)',
      },
      outcome: {
        type: 'string',
        enum: ['success', 'failure', 'blocked', 'in_progress'],
        default: 'success',
      },
      error_message: {
        type: 'string',
        description: 'Error details if outcome = failure',
      },
      epic_id: {
        type: 'string',
        description: 'Related epic ID',
      },
    },
    required: ['action_type', 'context'],
  },
  handler: async (params, context) => {
    // Insert to supervisor_actions table
    const actionId = await insertAction({
      session_id: context.session_id,
      supervisor_type: context.supervisor_type,
      project: context.project,
      action_type: params.action_type,
      context: params.context,
      outcome: params.outcome || 'success',
      error_message: params.error_message,
      related_epic_id: params.epic_id,
    });

    // Update session last_activity
    await updateSessionActivity(context.session_id);

    return {
      success: true,
      action_id: actionId,
      message: `Action logged: ${params.action_type}`,
    };
  },
};

// Get recent actions (for resume)
export const getRecentActionsTool: ToolDefinition = {
  name: 'get-recent-actions',
  description: 'Get recent PS/MS actions from last session (for resume after disconnect)',
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Session ID to query (defaults to last session for this project)',
      },
      limit: {
        type: 'number',
        default: 20,
        description: 'Number of recent actions to retrieve',
      },
    },
  },
  handler: async (params, context) => {
    let sessionId = params.session_id;

    // If no session_id provided, get last session for this project
    if (!sessionId) {
      const lastSession = await getLastSession(context.project, context.supervisor_type);
      sessionId = lastSession?.session_id;

      if (!sessionId) {
        return {
          success: false,
          message: 'No previous session found for this project',
        };
      }
    }

    const actions = await getSessionActions(sessionId, params.limit || 20);

    // Format for PS consumption
    const summary = {
      session_id: sessionId,
      action_count: actions.length,
      last_action: actions[0],
      recent_actions: actions.map(a => ({
        type: a.action_type,
        context: a.context,
        outcome: a.outcome,
        timestamp: a.timestamp,
      })),
      work_in_progress: inferWorkInProgress(actions),
      suggested_next_steps: suggestNextSteps(actions),
    };

    return {
      success: true,
      summary,
    };
  },
};

// Helper: Infer what PS was working on
function inferWorkInProgress(actions: Action[]): string {
  const lastAction = actions[0];

  if (lastAction.action_type === 'spawn' && lastAction.outcome === 'in_progress') {
    return `Subagent ${lastAction.context.agent_id} still running: ${lastAction.context.task_description}`;
  }

  if (lastAction.action_type === 'validate' && lastAction.outcome === 'failure') {
    return `Validation failed for ${lastAction.context.epic_id}: ${lastAction.context.failures.length} issues`;
  }

  if (lastAction.action_type === 'commit') {
    return `Last commit: ${lastAction.context.message} (check if push needed)`;
  }

  // Check for active epic
  const epicActions = actions.filter(a => a.context.epic_id);
  if (epicActions.length > 0) {
    const epicId = epicActions[0].context.epic_id;
    return `Working on ${epicId}`;
  }

  return 'No active work detected';
}

// Helper: Suggest next steps
function suggestNextSteps(actions: Action[]): string[] {
  const suggestions: string[] = [];
  const lastAction = actions[0];

  if (lastAction.action_type === 'spawn' && lastAction.outcome === 'in_progress') {
    suggestions.push(`Check subagent status: mcp_meta_get_subagent_status({agent_id: "${lastAction.context.agent_id}"})`);
    suggestions.push('If subagent complete, run validation');
  }

  if (lastAction.action_type === 'validate' && lastAction.outcome === 'failure') {
    suggestions.push('Fix validation failures');
    suggestions.push('Re-run validation after fixes');
  }

  if (lastAction.action_type === 'commit' && !actions.some(a => a.action_type === 'deploy')) {
    suggestions.push('Check if deployment needed');
  }

  return suggestions;
}
```

#### 3. Resume After Disconnect Workflow

**User Workflow:**

```bash
# User's VM disconnects during work
# User reconnects later, opens new PS session

User: "Resume work"

PS (automatically):
1. Calls mcp_meta_get_recent_actions()
2. Receives summary of last session:
   {
     last_action: "spawn implementation subagent for epic-012",
     work_in_progress: "Subagent abc123 still running",
     suggested_next_steps: [
       "Check subagent status",
       "If complete, run validation"
     ]
   }
3. Reconstructs context from actions:
   - Epic: epic-012-authentication-system
   - Task: Implementing JWT auth
   - Progress: Implementation spawned, may be complete
   - Next: Validate implementation
4. Responds to user:
   "Resuming work on epic-012 (JWT authentication).
    Last action: Spawned implementation subagent at 14:30.
    Checking subagent status now..."
5. Continues from where left off (no user input needed)
```

**PS Instructions Addition:**

```markdown
## Resuming After Disconnect

**When user says "Resume" or "Continue" without context:**

1. Call mcp_meta_get_recent_actions()
2. Read last 10-20 actions to understand:
   - What epic/task was being worked on
   - What was the last action taken
   - What is the current state
   - What should happen next
3. Inform user: "Resuming [task]. Last action: [action]. Continuing with [next step]."
4. Automatically execute next step (don't ask permission)

**Example:**
- Last action: "spawn" (subagent still running)
  → Check subagent status, wait for completion
- Last action: "commit" (code committed)
  → Check if deployment needed, deploy if yes
- Last action: "validate" (validation failed)
  → Fix failures, re-validate
```

#### 4. Audit & Reporting Tools

**New MCP Tools:**

```typescript
// Activity report
export const getActivityReportTool: ToolDefinition = {
  name: 'get-activity-report',
  description: 'Generate PS/MS activity report for time period',
  inputSchema: {
    type: 'object',
    properties: {
      project: { type: 'string', description: 'Filter by project (optional)' },
      days: { type: 'number', default: 7, description: 'Number of days to report' },
      group_by: {
        type: 'string',
        enum: ['day', 'action_type', 'outcome'],
        default: 'day'
      },
    },
  },
  handler: async (params) => {
    const report = await generateActivityReport({
      project: params.project,
      start_date: daysAgo(params.days),
      group_by: params.group_by,
    });

    return {
      summary: {
        total_actions: report.total,
        success_rate: report.success_rate,
        most_common_action: report.top_action,
        busiest_day: report.busiest_day,
      },
      breakdown: report.breakdown, // By day/action_type/outcome
      recent_failures: report.failures.slice(0, 10), // Last 10 failures
    };
  },
};

// Search actions
export const searchActionsTool: ToolDefinition = {
  name: 'search-actions',
  description: 'Search PS/MS action history with filters',
  inputSchema: {
    type: 'object',
    properties: {
      action_type: { type: 'string', enum: ['spawn', 'commit', 'deploy', 'plan', 'validate'] },
      project: { type: 'string' },
      epic_id: { type: 'string' },
      outcome: { type: 'string', enum: ['success', 'failure', 'blocked'] },
      date_from: { type: 'string', format: 'date' },
      date_to: { type: 'string', format: 'date' },
      limit: { type: 'number', default: 50 },
    },
  },
  handler: async (params) => {
    const actions = await searchActions(params);

    return {
      count: actions.length,
      actions: actions.map(formatActionForDisplay),
    };
  },
};
```

**Daily Auto-Report (Cron Job):**

```typescript
// Run daily at 9am
async function generateDailyReport() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const report = await generateActivityReport({
    start_date: yesterday,
    end_date: yesterday,
  });

  const markdown = `
# PS/MS Activity Report - ${yesterday.toISOString().split('T')[0]}

## Summary
- Total actions: ${report.total}
- Success rate: ${report.success_rate}%
- Projects active: ${report.active_projects.join(', ')}

## Deployments (${report.deployments.length})
${report.deployments.map(d => `- ${d.project}: ${d.service} → ${d.outcome}`).join('\n')}

## Failed Actions (${report.failures.length})
${report.failures.map(f => `- ${f.action_type} in ${f.project}: ${f.error_message}`).join('\n')}

## Top Activity
${Object.entries(report.by_action_type).map(([type, count]) => `- ${type}: ${count}`).join('\n')}
  `;

  // Save to docs/reports/daily/YYYY-MM-DD.md
  await saveReport(markdown, `daily/${yesterday.toISOString().split('T')[0]}.md`);
}
```

#### 5. Training Data Export

**Export Tool:**

```typescript
export const exportTrainingDataTool: ToolDefinition = {
  name: 'export-training-data',
  description: 'Export action logs as training data for PS improvement',
  inputSchema: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['csv', 'json', 'jsonl'], default: 'jsonl' },
      date_from: { type: 'string', format: 'date' },
      date_to: { type: 'string', format: 'date' },
      include_context: { type: 'boolean', default: true },
    },
  },
  handler: async (params) => {
    const actions = await getAllActions({
      start_date: params.date_from,
      end_date: params.date_to,
    });

    // Format for training
    const trainingData = actions.map(action => ({
      input: {
        task: action.context.task_description || action.action_type,
        epic_id: action.related_epic_id,
        context: params.include_context ? action.context : undefined,
      },
      output: {
        action_taken: action.action_type,
        outcome: action.outcome,
        duration_seconds: action.duration_seconds,
      },
      metadata: {
        timestamp: action.timestamp,
        project: action.project,
        supervisor_type: action.supervisor_type,
      },
    }));

    // Export in requested format
    const exported = params.format === 'csv'
      ? convertToCSV(trainingData)
      : params.format === 'json'
      ? JSON.stringify(trainingData, null, 2)
      : trainingData.map(d => JSON.stringify(d)).join('\n');

    const filename = `training-data-${Date.now()}.${params.format}`;
    await saveFile(`docs/training-data/${filename}`, exported);

    return {
      success: true,
      filename,
      record_count: trainingData.length,
      path: `docs/training-data/${filename}`,
    };
  },
};
```

---

## Integration Points

### How PSes Log Actions Automatically

**Approach:** Hybrid (automatic + manual)

**Automatic Logging (via MCP server wrapper):**
- All MCP tool calls automatically logged
- Captures: tool name, params, result, duration, success/failure
- No PS effort required

**Manual Logging (PS explicitly calls log-action):**
- Git operations: Commit, push, PR creation
- Spawning subagents: Before/after spawn
- Planning decisions: After analyzing epic
- Deployment: Before/after deploy

**Example in PS workflow:**

```typescript
// In deployment workflow (already using Task tool)
// Add logging:

// BEFORE deploy
await mcp_meta_log_action({
  action_type: 'deploy',
  context: {
    service: 'consilio-api',
    port: 5000,
    type: 'docker',
    epic_id: 'epic-012',
  },
  outcome: 'in_progress',
});

// Run deployment...

// AFTER deploy
await mcp_meta_log_action({
  action_type: 'deploy',
  context: {
    service: 'consilio-api',
    port: 5000,
    type: 'docker',
    health_check_url: 'http://localhost:5000/health',
    deployment_status: 'success',
  },
  outcome: 'success',
});
```

### When to Trigger Learning Extraction

**Automatic Triggers:**

1. **Epic Completion**
   - When PS marks epic as complete
   - Analyze epic work (notes, commits, decisions)
   - Generate draft learning

2. **Validation Failures (>3 attempts)**
   - If validation fails multiple times, likely learning-worthy
   - Extract: What went wrong, how it was fixed

3. **User Manual Trigger**
   - User says "Extract learning from this work"
   - PS analyzes recent actions, creates draft

**Extraction Process:**

```typescript
async function extractLearningFromEpic(epicId: string): Promise<LearningDraft> {
  // Gather data
  const epic = await readEpic(epicId);
  const actions = await getActionsForEpic(epicId);
  const commits = await getCommitsForEpic(epicId);
  const validations = actions.filter(a => a.action_type === 'validate');

  // Analyze
  const analysis = {
    what_worked: extractSuccesses(actions, commits),
    what_failed: extractFailures(actions, validations),
    key_decisions: extractDecisions(actions),
    time_actual: calculateDuration(actions),
    time_estimated: epic.estimated_hours,
  };

  // Generate draft
  const draft = {
    title: `Learnings from ${epic.title}`,
    category: epic.category,
    severity: analysis.what_failed.length > 0 ? 'HIGH' : 'MEDIUM',
    problem: analysis.what_failed.join('\n'),
    solution: analysis.what_worked.join('\n'),
    key_takeaway: summarize(analysis),
  };

  return draft;
}
```

### How to Search Action History

**Query Patterns:**

```typescript
// 1. Recent activity
const recentActions = await searchActions({
  project: 'consilio-s',
  date_from: daysAgo(7),
  limit: 100,
});

// 2. Failed deploys
const failedDeploys = await searchActions({
  action_type: 'deploy',
  outcome: 'failure',
  date_from: daysAgo(30),
});

// 3. Epic-specific actions
const epicActions = await searchActions({
  epic_id: 'epic-012',
});

// 4. Subagent spawns
const spawns = await searchActions({
  action_type: 'spawn',
  project: 'consilio-s',
  date_from: daysAgo(1),
});

// 5. All actions in time range
const actions = await searchActions({
  date_from: '2026-01-20',
  date_to: '2026-01-27',
  project: 'odin-s',
});
```

**Search via MCP tool:**

```typescript
// PS can search action history
const result = await mcp_meta_search_actions({
  action_type: 'deploy',
  outcome: 'failure',
  days: 7,
});

// Returns recent failed deployments with context
```

### Integration with Quality Workflows

**Validation Workflow:**

```typescript
// Before validation
await mcp_meta_log_action({
  action_type: 'validate',
  context: {
    epic_id: 'epic-012',
    validation_type: 'acceptance_criteria',
  },
  outcome: 'in_progress',
});

// Run validation...

// After validation
await mcp_meta_log_action({
  action_type: 'validate',
  context: {
    epic_id: 'epic-012',
    validation_type: 'acceptance_criteria',
    passed: validationResult.passed,
    failures: validationResult.failures,
  },
  outcome: validationResult.passed ? 'success' : 'failure',
});

// If validation fails, extract learning
if (!validationResult.passed && validationAttempts >= 3) {
  await extractLearningFromFailures(validationResult);
}
```

---

## Open Questions

### RAG Embedding Model

**Options:**

1. **OpenAI text-embedding-ada-002** (current)
   - ✅ Pros: High quality, 1536 dimensions, well-tested
   - ❌ Cons: Requires API key, costs money ($0.0001/1k tokens), external dependency

2. **OpenAI text-embedding-3-small**
   - ✅ Pros: Cheaper ($0.00002/1k tokens), faster, 1536 dimensions
   - ❌ Cons: Still requires API key, external dependency

3. **Local model (sentence-transformers)**
   - ✅ Pros: Free, no API needed, fast, offline-capable
   - ❌ Cons: Lower quality, different dimensions (384-768), requires setup

**Recommendation:** Start with OpenAI ada-002 (already implemented), migrate to local model later if cost becomes issue.

### Action Log Retention Policy

**Options:**

1. **Keep forever**
   - ✅ Pros: Complete history, useful for analysis
   - ❌ Cons: Database grows large, slower queries

2. **Retain 90 days, archive rest**
   - ✅ Pros: Recent data fast, long-term data preserved
   - ❌ Cons: Two-tier system, complexity

3. **Retain 30 days, delete rest**
   - ✅ Pros: Simple, fast queries
   - ❌ Cons: Lose historical data, can't analyze long-term trends

**Recommendation:** Retain 90 days in primary table, archive older data to separate table (archived_supervisor_actions), keep archives for 1 year.

**Implementation:**

```sql
-- Automated cleanup (run weekly)
CREATE OR REPLACE FUNCTION archive_old_actions()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move actions >90 days old to archive
  INSERT INTO archived_supervisor_actions
  SELECT * FROM supervisor_actions
  WHERE timestamp < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  -- Delete from main table
  DELETE FROM supervisor_actions
  WHERE timestamp < NOW() - INTERVAL '90 days';

  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
```

### Performance Impact of Logging Every Action

**Concerns:**
- Will logging slow down PS operations?
- Database write load
- Disk space usage

**Analysis:**

**Per-action overhead:**
- Database insert: ~5-10ms
- JSONB serialization: ~1-2ms
- Total: ~10-15ms per action

**Expected action frequency:**
- PS performs ~10-50 actions per hour
- All PSes combined: ~200-500 actions/hour
- Database writes: ~8 inserts/minute (negligible)

**Disk space:**
- Average action: ~2KB (with context)
- 500 actions/hour × 24 hours × 30 days = 360k actions/month
- Storage: 360k × 2KB = 720MB/month (trivial)

**Conclusion:** Performance impact negligible, disk space acceptable.

**Mitigation:**
- Use async logging (don't block PS on insert)
- Batch inserts if needed (queue 10 actions, insert together)
- Index optimization (only index fields we query)

### Action Log Real-Time vs Batched

**Options:**

1. **Real-time logging**
   - Every action logged immediately
   - ✅ Pros: Up-to-date, accurate resume capability
   - ❌ Cons: More database writes

2. **Batched logging**
   - Queue actions, flush every 30 seconds
   - ✅ Pros: Fewer database writes, better performance
   - ❌ Cons: Lose actions if crash before flush

**Recommendation:** Real-time with async writes (best of both)

```typescript
// Async logging (non-blocking)
async function logAction(action: Action): Promise<void> {
  // Fire and forget (don't await)
  insertActionAsync(action).catch(err => {
    console.error('Failed to log action:', err);
    // Fallback: Write to file
    appendToLogFile(action);
  });
}
```

### Resume Workflow Details

**How PS reads action log and continues:**

**Step 1: User reconnects**

```bash
User: "Resume"
```

**Step 2: PS calls get-recent-actions**

```typescript
const actions = await mcp_meta_get_recent_actions({ limit: 20 });

// Returns:
{
  session_id: "session-abc123",
  last_action: {
    type: "spawn",
    context: {
      subagent_type: "implementation",
      task: "Implement JWT auth",
      epic_id: "epic-012",
      agent_id: "xyz789"
    },
    outcome: "in_progress",
    timestamp: "2026-01-27T14:30:00Z"
  },
  work_in_progress: "Subagent xyz789 still running",
  suggested_next_steps: [
    "Check subagent status",
    "If complete, run validation"
  ]
}
```

**Step 3: PS reconstructs context**

```typescript
// PS internally:
const epicId = actions.last_action.context.epic_id;
const agentId = actions.last_action.context.agent_id;

// Read epic for full context
const epic = await readEpic(epicId);

// Check subagent status
const agentStatus = await mcp_meta_get_subagent_status({ agent_id: agentId });
```

**Step 4: PS responds to user**

```typescript
// PS message to user:
`Resuming work on ${epic.title}.

Last action (1 hour ago): Spawned implementation subagent for JWT authentication.

Checking subagent status... [calling mcp_meta_get_subagent_status]

Subagent completed successfully!

Next step: Validating implementation against acceptance criteria.

[Proceeding with validation...]`
```

**Step 5: PS continues automatically**

```typescript
// PS spawns validation subagent
await spawnValidationSubagent(epicId);

// Logs the action
await mcp_meta_log_action({
  action_type: 'validate',
  context: { epic_id: epicId },
  outcome: 'in_progress',
});
```

**Key: PS uses action log as memory to reconstruct context and continue seamlessly.**

---

## Architecture Brainstorming

### Where Does Logging Happen?

**Option A: In MCP Server (Centralized)**

```
PS → MCP Tool Call → MCP Server → Execute + Log → Database
```

**Pros:**
- Centralized logging logic
- All tool calls automatically logged
- Consistent format

**Cons:**
- Can't log non-MCP actions (git commits, spawns)
- MCP server must be always running

**Option B: In PS Instructions (Distributed)**

```
PS → Explicitly call log-action tool → MCP Server → Database
```

**Pros:**
- PS controls what gets logged
- Can log non-MCP actions
- Flexible

**Cons:**
- PS must remember to log
- Inconsistent if PS forgets
- More effort for PS

**Option C: Hybrid (Recommended)**

```
MCP Server: Auto-logs all MCP tool calls
PS Instructions: Explicitly logs git, spawns, planning
```

**Pros:**
- Complete coverage
- Automatic for tools
- Flexible for non-tools

**Cons:**
- Two logging paths (but both use same database)

**Recommendation:** Hybrid approach (Option C)

### Storage: Same DB or Separate?

**Options:**

1. **Same database (supervisor_meta)**
   - ✅ Pros: Simple, single connection, easy queries
   - ❌ Cons: Mixes concerns (learnings + actions)

2. **Separate database (supervisor_actions)**
   - ✅ Pros: Cleaner separation, independent scaling
   - ❌ Cons: Two databases to maintain, cross-DB queries harder

**Recommendation:** Same database (supervisor_meta)
- Action logging is meta-infrastructure (fits meta DB)
- Learnings and actions often queried together (e.g., "Did learning prevent failures?")
- Simpler to maintain

### Query Patterns

**Most Common Queries:**

1. **Resume workflow:**
   ```sql
   -- Get last session's actions
   SELECT * FROM supervisor_actions
   WHERE session_id = (
     SELECT session_id FROM supervisor_sessions
     WHERE project = 'consilio-s'
     ORDER BY last_activity DESC LIMIT 1
   )
   ORDER BY timestamp DESC LIMIT 20;
   ```

2. **Activity report:**
   ```sql
   -- Daily activity summary
   SELECT
     DATE(timestamp) as day,
     action_type,
     outcome,
     COUNT(*) as count
   FROM supervisor_actions
   WHERE project = 'consilio-s'
     AND timestamp >= NOW() - INTERVAL '7 days'
   GROUP BY day, action_type, outcome
   ORDER BY day DESC, count DESC;
   ```

3. **Epic actions:**
   ```sql
   -- All actions for specific epic
   SELECT * FROM supervisor_actions
   WHERE related_epic_id = 'epic-012'
   ORDER BY timestamp ASC;
   ```

4. **Failed actions:**
   ```sql
   -- Recent failures
   SELECT * FROM supervisor_actions
   WHERE outcome = 'failure'
     AND timestamp >= NOW() - INTERVAL '24 hours'
   ORDER BY timestamp DESC;
   ```

5. **Subagent tracking:**
   ```sql
   -- Find subagent spawns and outcomes
   SELECT * FROM supervisor_actions
   WHERE action_type = 'spawn'
     AND context->>'agent_id' = 'xyz789';
   ```

**Indexes to support these:**
- session_id (resume)
- timestamp DESC (recent actions)
- related_epic_id (epic tracking)
- outcome (failures)
- JSONB GIN index on context (subagent queries)

### Privacy: What NOT to Log

**Sensitive Data to Exclude:**

1. **Secrets**
   - API keys, tokens, passwords
   - Environment variables with "SECRET", "KEY", "TOKEN"
   - Filter before logging: `sanitizeContext(context)`

2. **PII (Personal Identifiable Information)**
   - User emails, phone numbers (if in context)
   - Credit card numbers, SSNs

3. **Large Data**
   - Full file contents (just log file paths)
   - Giant JSON blobs (summarize or reference)

**Sanitization Function:**

```typescript
function sanitizeContext(context: any): any {
  const sanitized = { ...context };

  // Remove known secret keys
  const secretKeys = ['api_key', 'token', 'password', 'secret', 'credentials'];
  for (const key of secretKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }

  // Redact secret-like values
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      // Looks like API key (long alphanumeric)
      if (value.match(/^[a-zA-Z0-9]{32,}$/)) {
        sanitized[key] = '[REDACTED]';
      }

      // Looks like JWT
      if (value.match(/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/)) {
        sanitized[key] = '[REDACTED]';
      }
    }
  }

  // Truncate large values
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string' && value.length > 1000) {
      sanitized[key] = value.substring(0, 1000) + '... [TRUNCATED]';
    }
  }

  return sanitized;
}
```

**Apply Before Logging:**

```typescript
await logAction({
  action_type: 'deploy',
  context: sanitizeContext({
    service: 'api',
    env_vars: { DATABASE_URL: 'postgresql://...', API_KEY: 'sk-abc123...' }
  }),
  outcome: 'success',
});

// Logged context:
// { service: 'api', env_vars: { DATABASE_URL: 'postgresql://...', API_KEY: '[REDACTED]' } }
```

---

## Acceptance Criteria

**This feature is complete when:**

### Part A: Learning System Integration

1. **RAG Indexing Operational**
   - ✅ File watcher active on learnings directories
   - ✅ New .md files auto-indexed within 1 minute
   - ✅ Embeddings stored in PostgreSQL with pgvector
   - ✅ Manual index-learning tool still works

2. **Learning Search in PS Workflows**
   - ✅ Before planning epic: PS automatically searches learnings
   - ✅ Search results included in planning prompt
   - ✅ PS can manually search: mcp_meta_search_learnings tool
   - ✅ Results show: title, similarity score, key takeaway, past applications

3. **Automatic Learning Extraction**
   - ✅ After epic completion: Draft learning auto-generated
   - ✅ Draft saved to .bmad/learnings/auto-*.md
   - ✅ User reviews and publishes (moves to docs/supervisor-learnings/)
   - ✅ Published learning auto-indexed by file watcher

4. **Learning Tools Enhanced**
   - ✅ search-learnings includes application history
   - ✅ track-learning-application logs usage
   - ✅ get-learning-stats shows effectiveness

### Part B: Action Log Database

5. **Action Logging Functional**
   - ✅ All MCP tool calls automatically logged
   - ✅ PS logs git operations (commit, push, PR)
   - ✅ PS logs spawns, planning, validation
   - ✅ Context sanitized (no secrets logged)
   - ✅ Actions linked to epic/issue when applicable

6. **Database Schema Deployed**
   - ✅ supervisor_actions table created
   - ✅ supervisor_sessions table created
   - ✅ Indexes created (session_id, timestamp, type, project)
   - ✅ Helper functions created (get_session_actions, get_last_session)
   - ✅ Views created (supervisor_activity_summary)

7. **Resume Capability Working**
   - ✅ User says "Resume" → PS queries last session
   - ✅ PS reads last 20 actions from database
   - ✅ PS reconstructs context (epic, task, progress)
   - ✅ PS automatically continues from where left off
   - ✅ No user re-explanation needed

8. **Audit & Reporting Tools**
   - ✅ get-activity-report tool generates daily/weekly reports
   - ✅ search-actions tool queries action history
   - ✅ Daily reports auto-generated and saved to docs/reports/
   - ✅ Reports include: deployments, failures, top actions

9. **Training Data Export**
   - ✅ export-training-data tool exports to CSV/JSON/JSONL
   - ✅ Includes action context, outcome, duration
   - ✅ Exported files saved to docs/training-data/

10. **Privacy & Performance**
    - ✅ Secrets sanitized before logging
    - ✅ Large values truncated
    - ✅ Logging async (non-blocking)
    - ✅ Action log retention: 90 days active, 1 year archive

### Integration Tests

11. **End-to-End Workflows Tested**
    - ✅ Plan epic → Searches learnings → Includes in plan
    - ✅ Implement epic → Logs actions → Completes → Extracts learning
    - ✅ Disconnect mid-work → Reconnect → Resume from action log
    - ✅ Deploy service → Logged → Shows in activity report
    - ✅ Validation fails → Logged → Triggers learning extraction

12. **Documentation Complete**
    - ✅ Learning system integration guide
    - ✅ Action logging developer guide
    - ✅ Resume workflow user guide
    - ✅ Query patterns documented
    - ✅ Privacy guidelines documented

---

## Success Metrics

**Quantitative:**

**Learning System:**
- Auto-indexing latency: <1 minute from file save to searchable
- Learning search usage: >80% of epics search learnings before planning
- Learning extraction: >50% of completed epics generate learning drafts
- Learning reuse: >3 applications per learning on average

**Action Logging:**
- Action logging coverage: >95% of PS/MS actions logged
- Resume success rate: >90% of resume attempts successful (no context loss)
- Logging overhead: <20ms per action
- Database size: <1GB for 90 days of actions

**Qualitative:**
- User never manually creates context handoffs
- PS resumes work seamlessly after disconnect
- Learnings actively prevent repeated mistakes
- Audit trail answers "what happened?" questions
- Training data enables future PS improvements

---

## Technical Notes

**Dependencies:**
- OpenAI API (embeddings): `text-embedding-ada-002`
- PostgreSQL 14+ with pgvector extension
- Node.js fs watcher (chokidar)
- MCP server infrastructure

**Integration Points:**
- PS workflow instructions (CLAUDE.md)
- MCP tool wrappers (automatic logging)
- Epic planning workflow (learning search)
- Deployment workflow (action logging)
- Validation workflow (learning extraction)

**Performance Considerations:**
- Embedding generation: ~100ms per learning (OpenAI API)
- Vector search: <50ms (HNSW index)
- Action logging: ~10ms per action (async)
- Resume context reconstruction: ~500ms (database query + epic read)

**Risks & Mitigations:**
- Risk: OpenAI API costs
  - Mitigation: Use cheaper model (text-embedding-3-small), or migrate to local model
- Risk: Database growth
  - Mitigation: 90-day retention with archival
- Risk: PS forgets to log actions
  - Mitigation: Hybrid approach (automatic + manual), instructions emphasize logging
- Risk: Privacy leak (secrets in logs)
  - Mitigation: Sanitization function, secret detection regex

**Estimated Effort:**
- Learning system integration: 4-6 hours
- Action log database setup: 3-4 hours
- MCP tools (logging, resume, reporting): 4-6 hours
- Testing & refinement: 3-4 hours
- Documentation: 2-3 hours
- **Total: 16-23 hours (2-3 days)**

---

## Open Questions

1. Should learning extraction be automatic (every epic) or manual (user triggers)?
   - **Recommendation:** Automatic draft, user approves before publishing

2. Should action logs be committed to git or database-only?
   - **Recommendation:** Database-only (more data, faster queries, no git bloat)

3. What's the minimum action log to enable resume? (5? 10? 20?)
   - **Recommendation:** Last 20 actions (balances context vs performance)

4. Should we log subagent actions (actions inside spawned agents)?
   - **Recommendation:** No initially (too much data), only PS/MS actions

5. How to handle session IDs across disconnects?
   - **Recommendation:** Generate at PS startup, include in all actions, query last session by project

6. Should learning search be MANDATORY or RECOMMENDED?
   - **Recommendation:** MANDATORY for epic planning, RECOMMENDED for implementation

7. What if OpenAI API fails during indexing?
   - **Recommendation:** Retry 3 times, fall back to keyword-only indexing, alert user

---

## References

**Existing Systems:**
- Learning database: `/home/samuel/sv/supervisor-service-s/migrations/1737212400000_learnings_index.sql`
- RAG implementation: `/home/samuel/sv/supervisor-service-s/src/rag/LearningsIndex.ts`
- Learning tools: `/home/samuel/sv/supervisor-service-s/src/mcp/tools/learning-tools.ts`
- Task timing: `/home/samuel/sv/supervisor-service-s/migrations/1737212300000_task_timing.sql`

**Related Features:**
- Automatic Context Handoff System: `.bmad/feature-requests/automatic-context-handoff-system.md`
- Learning System Enhancement Epic: `.bmad/epics/002-learning-system-enhancement.md`

**Similar Patterns:**
- Git history as audit trail
- Database transaction logs
- Application performance monitoring (APM) systems
- Session replay tools

---

**Status**: Ready for BMAD analysis and planning
**Next Step**: Analyze feature, create implementation epic
**Priority**: CRITICAL (enables context preservation, resume capability)
**Complexity**: Level 4 (Large feature, 16-23 hours estimated)
