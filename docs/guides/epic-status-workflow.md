# Epic Status Workflow

**Last Updated**: 2026-01-25
**Status**: Production Ready

---

## Overview

Epic status tracking provides automated lifecycle management for epics, from creation to completion. Status is tracked in epic frontmatter and automatically updated by subagents at key lifecycle points.

**Status transitions**:
```
planning → in-progress → completed → archived
```

---

## Frontmatter Schema

**Every epic MUST have this frontmatter**:

```yaml
---
epic_id: {feature-slug}-{NNN}
parent_feature: {feature-slug}
status: planning
complexity: {0-4}
created: {YYYY-MM-DD}
started: null
completed: null
assigned_to: null
source: {prd | feature-request}
---
```

### Field Descriptions

| Field | Type | Description | Auto-Updated By |
|-------|------|-------------|-----------------|
| `epic_id` | string | Unique ID: `{feature-slug}-{NNN}` | `create-epic-automated` |
| `parent_feature` | string | Feature slug this epic belongs to | `create-epic-automated` |
| `status` | enum | Current epic status (see below) | `create-epic-automated`, `implement-feature`, `validate-acceptance-criteria` |
| `complexity` | 0-4 | Complexity level (0=bugfix, 4=major) | `create-epic-automated` |
| `created` | date | Date epic was created (YYYY-MM-DD) | `create-epic-automated` (auto-set to today) |
| `started` | date\|null | Date implementation started | `implement-feature` (auto-set when implementation begins) |
| `completed` | date\|null | Date all acceptance criteria passed | `validate-acceptance-criteria` (auto-set when all criteria pass) |
| `assigned_to` | string\|null | Agent or human assigned to epic | Manual (future: auto-assign) |
| `source` | enum | Where epic came from (`prd` or `feature-request`) | `create-epic-automated` |

---

## Status Lifecycle

### 1. Planning (Initial State)

**Status**: `planning`
**Set by**: `create-epic-automated` subagent
**Triggered when**: PM agent creates epic from PRD or feature request

**Frontmatter state**:
```yaml
status: planning
created: 2026-01-25
started: null
completed: null
```

**Description**: Epic has been created with goals, requirements, and acceptance criteria. Implementation has NOT started yet.

**Next step**: PIV Plan phase (optional) or direct to implementation

---

### 2. In-Progress (Implementation Active)

**Status**: `in-progress`
**Set by**: `implement-feature` subagent
**Triggered when**: Implementation agent starts working on epic

**Frontmatter state**:
```yaml
status: in-progress
created: 2026-01-25
started: 2026-01-25    # Auto-set to today
completed: null
```

**Description**: Implementation has begun. Agent is actively writing code, tests, and documentation.

**Auto-update logic** (in `implement-feature.md`):
```typescript
// Step 1.2: Update epic status when starting implementation
const epicPath = '{{EPIC_FILE}}';
const epicContent = await fs.readFile(epicPath, 'utf-8');

const frontmatterMatch = epicContent.match(/^---\n([\s\S]+?)\n---/);
if (frontmatterMatch) {
  const currentFrontmatter = frontmatterMatch[1];
  const startedDate = new Date().toISOString().split('T')[0];

  const updatedFrontmatter = currentFrontmatter
    .replace(/status: planning/g, 'status: in-progress')
    .replace(/started: null/g, `started: ${startedDate}`);

  const updatedEpicContent = epicContent.replace(
    /^---\n[\s\S]+?\n---/,
    `---\n${updatedFrontmatter}\n---`
  );

  await fs.writeFile(epicPath, updatedEpicContent, 'utf-8');
}
```

**Next step**: PIV Validate phase (acceptance criteria validation)

---

### 3. Completed (All Criteria Passed)

**Status**: `completed`
**Set by**: `validate-acceptance-criteria` subagent
**Triggered when**: ALL acceptance criteria pass validation

**Frontmatter state**:
```yaml
status: completed
created: 2026-01-25
started: 2026-01-25
completed: 2026-01-25  # Auto-set to today
```

**Description**: All acceptance criteria have passed validation. Epic is feature-complete and verified.

**Auto-update logic** (in `validate-acceptance-criteria.md`):
```typescript
// Phase 6: Update Epic Status (If All Pass)
if (allPassed) {
  const epicContent = await fs.readFile(epicPath, 'utf-8');
  const frontmatterMatch = epicContent.match(/^---\n([\s\S]+?)\n---/);

  if (frontmatterMatch) {
    const currentFrontmatter = frontmatterMatch[1];
    const completedDate = new Date().toISOString().split('T')[0];

    const updatedFrontmatter = currentFrontmatter
      .replace(/status: in-progress/g, 'status: completed')
      .replace(/completed: null/g, `completed: ${completedDate}`);

    const updatedEpicContent = epicContent.replace(
      /^---\n[\s\S]+?\n---/,
      `---\n${updatedFrontmatter}\n---`
    );

    await fs.writeFile(epicPath, updatedEpicContent, 'utf-8');
  }
}
```

**Triggers**:
- ✅ PRD update agent (if PRD exists for Level 3-4 features)
- ✅ Validation report banner: "🎉 VALIDATION PASSED - EPIC COMPLETE"

**Next step**: Deployment (if applicable), or move to next epic

---

### 4. Archived (Historical)

**Status**: `archived`
**Set by**: Manual (or future archive agent)
**Triggered when**: Epic is old/deprecated, or parent feature superseded

**Frontmatter state**:
```yaml
status: archived
created: 2025-06-15
started: 2025-06-15
completed: 2025-06-20
```

**Description**: Epic was completed but is now archived for historical reference. Usually means feature has been replaced, removed, or significantly refactored.

**Use case**: Keep epic history without cluttering active epic lists

---

## Status Transition Rules

### Valid Transitions

| From | To | Trigger | Reversible? |
|------|-----|---------|-------------|
| `planning` → `in-progress` | Implementation starts | ✅ Yes (can revert to planning) |
| `in-progress` → `completed` | All criteria pass | ⚠️ Rarely (only if re-validation needed) |
| `completed` → `archived` | Manual archival | ❌ No (permanent) |
| `planning` → `archived` | Epic abandoned | ❌ No (permanent) |

### Invalid Transitions (Forbidden)

| From | To | Why Invalid |
|------|-----|-------------|
| `planning` → `completed` | Must go through implementation first |
| `in-progress` → `archived` | Must complete or return to planning |
| `completed` → `planning` | Re-validation should keep status as completed |

---

## Subagent Responsibilities

### create-epic-automated (Planning Phase)

**Responsibilities**:
- ✅ Create epic with `status: planning`
- ✅ Set `created: {today}` automatically
- ✅ Set `started: null`, `completed: null`
- ✅ Set `source: prd` or `source: feature-request`
- ✅ Determine and set `complexity: {0-4}`

**Must NOT**:
- ❌ Change status to `in-progress` (that's implementation agent's job)
- ❌ Set `started` or `completed` dates

**Template reference**: `/home/samuel/sv/.claude/commands/subagents/planning/create-epic-automated.md`

---

### implement-feature (Implementation Phase)

**Responsibilities**:
- ✅ Update `status: planning → in-progress` when implementation starts
- ✅ Set `started: {today}` automatically
- ✅ Leave `completed: null` (validation agent sets this)

**Must NOT**:
- ❌ Change status to `completed` (that's validation agent's job)
- ❌ Set `completed` date

**Template reference**: `/home/samuel/sv/.claude/commands/subagents/implementation/implement-feature.md`

---

### validate-acceptance-criteria (Validation Phase)

**Responsibilities**:
- ✅ Update `status: in-progress → completed` when ALL criteria pass
- ✅ Set `completed: {today}` automatically
- ✅ Add completion banner to validation report
- ✅ Trigger PRD update agent (if PRD exists)

**Must NOT**:
- ❌ Update status if ANY criteria fail (keep `in-progress`)
- ❌ Change `started` date (already set by implementation agent)

**Template reference**: `/home/samuel/sv/.claude/commands/subagents/validation/validate-acceptance-criteria.md`

---

## Querying Epic Status

### Filter Epics by Status

```typescript
// Get all planning epics
const planningEpics = await findEpicsByStatus('planning');

// Get all in-progress epics
const inProgressEpics = await findEpicsByStatus('in-progress');

// Get all completed epics
const completedEpics = await findEpicsByStatus('completed');
```

### Example Query Implementation

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

async function findEpicsByStatus(
  projectPath: string,
  status: 'planning' | 'in-progress' | 'completed' | 'archived'
): Promise<{ epicId: string; path: string; created: string; started: string | null; completed: string | null }[]> {
  const featuresDir = path.join(projectPath, '.bmad/features');
  const features = await fs.readdir(featuresDir);

  const results = [];

  for (const feature of features) {
    const epicsDir = path.join(featuresDir, feature, 'epics');
    const epicFiles = await fs.readdir(epicsDir);

    for (const epicFile of epicFiles) {
      if (!epicFile.endsWith('.md')) continue;

      const epicPath = path.join(epicsDir, epicFile);
      const content = await fs.readFile(epicPath, 'utf-8');

      // Extract frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
      if (!frontmatterMatch) continue;

      const frontmatter = frontmatterMatch[1];
      const epicStatus = frontmatter.match(/status: (\w+)/)?.[1];

      if (epicStatus === status) {
        const epicId = frontmatter.match(/epic_id: (.+)/)?.[1] || 'unknown';
        const created = frontmatter.match(/created: (.+)/)?.[1] || 'unknown';
        const started = frontmatter.match(/started: (.+)/)?.[1] || null;
        const completed = frontmatter.match(/completed: (.+)/)?.[1] || null;

        results.push({ epicId, path: epicPath, created, started, completed });
      }
    }
  }

  return results;
}
```

---

## Reporting and Analytics

### Epic Lifecycle Metrics

**Useful metrics to track**:

| Metric | Formula | Use Case |
|--------|---------|----------|
| **Time to Start** | `started - created` | How long epics wait before implementation |
| **Implementation Duration** | `completed - started` | How long implementation takes |
| **Total Epic Duration** | `completed - created` | End-to-end epic lifecycle |
| **Completion Rate** | `completed epics / total epics` | What % of epics finish |
| **Blocked Epics** | `status=in-progress AND (today - started) > 7 days` | Identify stalled work |

### Example: Generate Status Report

```typescript
async function generateStatusReport(projectPath: string): Promise<void> {
  const planning = await findEpicsByStatus(projectPath, 'planning');
  const inProgress = await findEpicsByStatus(projectPath, 'in-progress');
  const completed = await findEpicsByStatus(projectPath, 'completed');

  console.log(`# Epic Status Report`);
  console.log(`\n## Summary`);
  console.log(`- Planning: ${planning.length}`);
  console.log(`- In-Progress: ${inProgress.length}`);
  console.log(`- Completed: ${completed.length}`);
  console.log(`- Total: ${planning.length + inProgress.length + completed.length}`);

  console.log(`\n## In-Progress Epics`);
  for (const epic of inProgress) {
    const daysInProgress = Math.floor((Date.now() - new Date(epic.started!).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`- ${epic.epicId}: ${daysInProgress} days in progress`);
  }
}
```

---

## Integration with PRD Updates

**When epic completes (status → completed), validation agent triggers PRD update:**

```typescript
// Phase 7: Trigger PRD Update (If Level 3-4)
if (prdExists && allPassed) {
  const prdUpdateResult = await spawnSubagent({
    task_type: 'documentation',
    description: `Update PRD with completed epic ${epicId}`,
    context: {
      epic_file: epicPath,
      prd_file: prdPath,
      parent_feature: parentFeature,
      project_path: projectPath,
      completed_date: new Date().toISOString().split('T')[0]
    }
  });
}
```

**PRD update agent responsibilities**:
- Mark epic as complete in PRD's epic list
- Update version history
- Update completion percentage
- Add completion date to timeline

---

## Migration Strategy

**For existing epics without frontmatter**:

1. Create migration script:
   ```typescript
   // scripts/migrate-epic-frontmatter.ts
   // Read all epics
   // Add default frontmatter if missing
   // Set status based on validation reports
   ```

2. Run migration:
   ```bash
   npx tsx scripts/migrate-epic-frontmatter.ts
   ```

3. Verify:
   ```bash
   # Check all epics have frontmatter
   find .bmad/features -name "epic-*.md" -exec grep -L "^---" {} \;
   # Should return nothing (empty)
   ```

---

## Troubleshooting

### Epic Status Not Updating

**Symptom**: Status remains `planning` even after implementation starts

**Likely cause**: `implement-feature` agent didn't run status update step

**Fix**:
1. Read epic file
2. Check if frontmatter exists
3. Manually update status:
   ```yaml
   status: in-progress
   started: {today}
   ```

---

### Epic Completed but Status Still In-Progress

**Symptom**: All criteria passed but status not updated to `completed`

**Likely cause**: `validate-acceptance-criteria` agent failed to update frontmatter

**Fix**:
1. Check validation report (should have "🎉 VALIDATION PASSED" banner)
2. Manually update epic:
   ```yaml
   status: completed
   completed: {today}
   ```

---

### Status Changed Incorrectly

**Symptom**: Status jumped from `planning` to `completed` (skipped `in-progress`)

**Likely cause**: Manual edit or subagent bug

**Fix**:
1. Revert to correct status
2. Add missing dates:
   ```yaml
   status: completed
   started: {estimate from git log}
   completed: {today}
   ```

---

## References

**Templates**:
- `/home/samuel/sv/supervisor-service-s/docs/templates/epic-with-feature-template.md`

**Subagent Templates**:
- `/home/samuel/sv/.claude/commands/subagents/planning/create-epic-automated.md`
- `/home/samuel/sv/.claude/commands/subagents/implementation/implement-feature.md`
- `/home/samuel/sv/.claude/commands/subagents/validation/validate-acceptance-criteria.md`

**Related Guides**:
- `/home/samuel/sv/docs/guides/bmad-workflow.md` - Overall BMAD process
- `/home/samuel/sv/docs/guides/piv-workflow.md` - PIV loop details

---

**Maintained by**: Meta-Supervisor (MS)
**Version**: 1.0
