# BMAD Implementation System Design

**Date**: 2026-01-24
**Purpose**: Replace PIV with simpler BMAD-native implementation workflow

---

## Problem Statement

**Current PIV System**:
- Assumes user has high-level epic only
- Spawns Prime agent to research codebase (30 min)
- Spawns Plan agent to create detailed plan (15 min)
- Spawns Execute agent to implement (30 min)
- **Total: ~85 minutes**

**Reality**:
- User always creates detailed BMAD epics FIRST
- Epic already has:
  - Technical Requirements with exact code snippets
  - Implementation Notes with step-by-step breakdown
  - Acceptance Criteria for validation
- Prime/Plan phases waste 45 minutes recreating what already exists

---

## BMAD Epic Structure

```markdown
# Epic 001: Project Foundation

**Metadata**: Status, Priority, Effort, Dependencies

## Overview
High-level description

## Goals
What success looks like

## User Stories
Product requirements

## Technical Requirements
### Database Setup
Exact commands to run

### SQLAlchemy Models
```python
class Email(BaseModel):
    # Exact code here
```

## Acceptance Criteria
- [ ] PostgreSQL installed and running
- [ ] All 4 models defined
- [ ] Migrations work

## Implementation Notes for SCAR
1. Start with database setup
2. Create models incrementally
3. Configure Alembic
4. Set up testing
5. Commit frequently

## Documentation
Files to create/update
```

**Epic = Complete Plan**. No need to regenerate.

---

## BMAD Implementation Workflow

```
User creates BMAD epic (.bmad/epics/001-project-foundation.md)
  ↓
PS: Read epic file
  ↓
PS: Parse "Implementation Notes for SCAR" section
  ↓
PS: For each implementation note (1-5):
    - Spawn implementation agent
    - Pass entire epic as context
    - Agent reads Technical Requirements for that step
    - Agent implements
    - Agent commits
    - Validate step completed
  ↓
PS: Validate ALL Acceptance Criteria
  ↓
PS: Create PR
  ↓
Done
```

**Time**: ~40 minutes (vs 85 min with PIV)

---

## Required Subagents

### 1. BMAD Task Implementer (NEW)

**File**: `/home/samuel/sv/.claude/commands/subagents/bmad/implement-task.md`

**Purpose**: Implement one step from epic's Implementation Notes

**Context receives**:
```json
{
  "epic_file": ".bmad/epics/001-project-foundation.md",
  "epic_content": "full epic markdown",
  "current_task": "Create models incrementally",
  "task_index": 2,
  "completed_tasks": ["Database setup"],
  "project_path": "/home/samuel/sv/odin-s"
}
```

**Agent workflow**:
1. Read full epic (has ALL context needed)
2. Focus on Technical Requirements relevant to current task
3. Review completed tasks for context
4. Implement current task
5. Run validations from epic's Testing Strategy
6. Commit with clear message
7. Report completion

**Success**: Code written, tests pass, committed to git

---

### 2. BMAD Acceptance Validator (NEW)

**File**: `/home/samuel/sv/.claude/commands/subagents/bmad/validate-criterion.md`

**Purpose**: Validate one checkbox from Acceptance Criteria

**Context receives**:
```json
{
  "epic_file": ".bmad/epics/001-project-foundation.md",
  "criterion": "PostgreSQL 15+ installed and running",
  "section": "Database",
  "project_path": "/home/samuel/sv/odin-s"
}
```

**Agent workflow**:
1. Read criterion (e.g., "PostgreSQL 15+ installed and running")
2. Determine how to verify (e.g., check postgres version, test connection)
3. Run verification commands
4. Return: met=true/false with evidence

**Success**: Accurate true/false with proof

---

### 3. BMAD Epic Parser (Utility, not subagent)

**File**: `/home/samuel/sv/supervisor-service-s/src/utils/bmad-parser.ts`

**Purpose**: Parse epic markdown into structured data

**Functions**:
```typescript
interface BMADEpic {
  id: string;
  title: string;
  metadata: {
    status: string;
    priority: string;
    effort: string;
    dependsOn?: string[];
  };
  overview: string;
  goals: string[];
  userStories: string[];
  technicalRequirements: Record<string, string>;  // section → content
  acceptanceCriteria: Array<{
    section: string;
    criterion: string;
    checked: boolean;
  }>;
  implementationNotes: string[];
  documentation: string[];
}

function parseBMADEpic(markdownContent: string): BMADEpic;
function getImplementationNotes(epic: BMADEpic): string[];
function getAcceptanceCriteria(epic: BMADEpic): Array<{...}>;
```

---

## New MCP Tool: `bmad_implement_epic`

**File**: `/home/samuel/sv/supervisor-service-s/src/mcp/tools/bmad-tools.ts`

**Tool**: `mcp_meta_bmad_implement_epic`

**Purpose**: Orchestrate complete BMAD epic implementation

**Parameters**:
```typescript
{
  projectName: "odin",
  projectPath: "/home/samuel/sv/odin-s",
  epicFile: ".bmad/epics/001-project-foundation.md",
  baseBranch?: "main",
  createPR?: true
}
```

**Implementation**:
```typescript
async handler(params) {
  // 1. Read and parse epic
  const epicContent = await fs.readFile(epicFilePath, 'utf-8');
  const epic = parseBMADEpic(epicContent);

  // 2. Get implementation tasks
  const tasks = epic.implementationNotes;

  // 3. Execute each task sequentially
  const completedTasks = [];
  for (const [index, task] of tasks.entries()) {
    console.log(`[BMAD] Task ${index + 1}/${tasks.length}: ${task}`);

    const result = await spawnSubagent({
      task_type: 'implementation',
      description: task,
      context: {
        epic_file: epicFilePath,
        epic_content: epicContent,
        current_task: task,
        task_index: index,
        completed_tasks: completedTasks,
        project_path: params.projectPath
      }
    });

    if (!result.success) {
      return {
        success: false,
        phase: 'implementation',
        failed_task: task,
        task_index: index,
        error: result.error
      };
    }

    completedTasks.push(task);
  }

  // 4. Validate ALL acceptance criteria
  const criteriaResults = [];
  for (const criterion of epic.acceptanceCriteria) {
    const result = await spawnSubagent({
      task_type: 'validation',
      description: `Validate: ${criterion.criterion}`,
      context: {
        epic_file: epicFilePath,
        criterion: criterion.criterion,
        section: criterion.section,
        project_path: params.projectPath
      }
    });

    criteriaResults.push({
      ...criterion,
      met: result.success,
      evidence: result.output
    });
  }

  const allCriteriaMet = criteriaResults.every(c => c.met);

  // 5. Create PR if requested
  let prUrl;
  if (params.createPR && allCriteriaMet) {
    // Git operations handled by Execute agents already
    // Just create PR via gh CLI
    prUrl = await createPR(epic.id, epic.title);
  }

  return {
    success: allCriteriaMet,
    epic_id: epic.id,
    epic_title: epic.title,
    tasks_completed: completedTasks.length,
    criteria_validation: {
      total: criteriaResults.length,
      met: criteriaResults.filter(c => c.met).length,
      results: criteriaResults
    },
    pr_url: prUrl
  };
}
```

---

## Comparison: PIV vs BMAD

### PIV Per-Step (OLD)

```typescript
mcp_meta_run_piv_per_step({
  epicId: "epic-001",
  epicTitle: "Project Foundation",
  epicDescription: "Set up database, models, migrations",
  acceptanceCriteria: [...],
  tasks: [...]
})

// What happens:
// 1. Prime: AI researches codebase (30 min)
// 2. Plan: AI generates implementation plan (15 min)
// 3. Execute: AI writes code (30 min)
// 4. Validate: Check criteria (10 min)
// Total: ~85 min
```

### BMAD Implementation (NEW)

```typescript
mcp_meta_bmad_implement_epic({
  projectName: "odin",
  projectPath: "/home/samuel/sv/odin-s",
  epicFile: ".bmad/epics/001-project-foundation.md"
})

// What happens:
// 1. Parse epic (instant)
// 2. Execute tasks 1-5 from Implementation Notes (30 min)
// 3. Validate criteria (10 min)
// Total: ~40 min
```

**BMAD is 2x faster** because research and planning already done by human.

---

## File Structure

```
/home/samuel/sv/
├── .claude/commands/subagents/
│   ├── bmad/
│   │   ├── implement-task.md          ← NEW
│   │   └── validate-criterion.md      ← NEW
│   ├── implementation/
│   │   └── implement-feature.md       ← KEEP (generic implementation)
│   └── validation/
│       └── validate-changes.md        ← KEEP (generic validation)
├── supervisor-service-s/
│   ├── src/
│   │   ├── mcp/tools/
│   │   │   ├── bmad-tools.ts          ← NEW
│   │   │   └── piv-per-step-tool.ts   ← DEPRECATE
│   │   └── utils/
│   │       └── bmad-parser.ts         ← NEW
│   └── .supervisor-core/
│       └── 05-autonomous-supervision.md ← UPDATE (use BMAD not PIV)
```

---

## Migration Plan

### Week 1: Build BMAD System

**Day 1-2**:
- Create `bmad-parser.ts` utility
- Create `implement-task.md` subagent
- Create `validate-criterion.md` subagent
- Test parser with existing epics

**Day 3-4**:
- Create `bmad-tools.ts` with `mcp_meta_bmad_implement_epic`
- Register tool in MCP server
- Test with simple epic (hello world)

**Day 5**:
- Update PS instructions to use BMAD
- Regenerate all CLAUDE.md files
- Deprecate PIV tools

### Week 2: Production Testing

- Test BMAD with real epic (Epic 001)
- Verify all acceptance criteria validated
- Measure time savings
- Fix any issues

### Week 3: Cleanup

- Remove PIV tool code
- Remove Prime/Plan subagent templates (not needed)
- Update all documentation

---

## Success Metrics

**Before (PIV)**:
- Time per epic: ~85 minutes
- Redundant research/planning: 45 minutes wasted
- User creates epic: 30 min
- **Total**: 115 minutes

**After (BMAD)**:
- Time per epic: ~40 minutes
- No redundant work
- User creates epic: 30 min
- **Total**: 70 minutes

**40% time savings** per epic.

---

## Compatibility

**BMAD epic exists**: Use `mcp_meta_bmad_implement_epic`
**No epic, quick feature**: Use `mcp_meta_spawn_subagent` directly

Both supported, BMAD is primary.

---

**Next**: Implement BMAD parser, subagents, and tool.
