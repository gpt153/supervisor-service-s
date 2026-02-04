---
epic_id: claude-session-integration-009-A
parent_feature: claude-session-integration
status: pending
complexity: 2
created: 2026-02-04
started: null
completed: null
assigned_to: null
source: prd
---

# Epic 009-A: Session Reference Fields

**Feature**: Claude Code Session Reference Integration - Foundation Phase
**Epic ID**: claude-session-integration-009-A
**Status**: Pending
**Complexity**: 2 (Medium)
**Created**: 2026-02-04
**Effort**: 16 hours
**Dependencies**: None (foundation epic)
**Source**: PRD (claude-session-integration)

---

## Quick Reference

**Purpose**: Add `claude_session_uuid` and `claude_session_path` columns to `supervisor_sessions` table and update the registration flow to capture Claude Code's session identifier.

**Key Deliverable**: Supervisor sessions can optionally reference the full Claude Code transcript, enabling downstream lookup and snippet extraction.

**Critical Success Factor**: Zero performance degradation on existing session queries. All existing sessions continue to work with NULL values for new columns.

---

## Project Context

- **Project**: Supervisor Service (Meta)
- **Repository**: `/home/samuel/sv/supervisor-service-s/`
- **Tech Stack**: Node.js 20+, TypeScript 5.3+, PostgreSQL 14+, MCP
- **Parent Feature**: claude-session-integration
- **Related Epics**:
  - 009-B: Snippet Extraction (depends on this)
  - 009-C: Transcript Lookup Tools (depends on this)
  - 009-D: Backup Automation (independent)

---

## Business Context

### Problem Statement

The supervisor session continuity system tracks structured events (commits, deploys, spawns) in PostgreSQL but has no reference to the full conversation transcripts stored by Claude Code at `~/.claude/projects/[project]/[session-uuid].jsonl`. When debugging complex issues, users cannot navigate from a supervisor event to the conversation where that decision was made.

### User Value

- **Reference link**: Every supervisor session can point to its Claude Code transcript
- **Zero overhead**: Nullable columns add no cost to existing queries
- **Foundation**: Enables snippet extraction and transcript lookup in later epics
- **Debugging enablement**: Users can find the full conversation for any supervisor session

### Success Metrics

- [ ] `claude_session_uuid` column added to `supervisor_sessions`
- [ ] `claude_session_path` column added to `supervisor_sessions`
- [ ] `mcp_meta_register_instance` accepts optional `claude_session_uuid`
- [ ] `mcp_meta_link_claude_session` tool available for post-registration linking
- [ ] Session path auto-resolved from UUID when possible
- [ ] Existing sessions have NULL for new columns (backward compatible)
- [ ] Existing session queries remain <10ms

---

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**

- [ ] AC1: Database migration adds `claude_session_uuid` (VARCHAR(64), nullable) and `claude_session_path` (TEXT, nullable) to `supervisor_sessions`
  - Partial index on `claude_session_uuid` WHERE NOT NULL for efficient lookups
  - Migration is idempotent and reversible
  - No default values (NULL for existing rows)

- [ ] AC2: Update `registerInstance` function in `src/session/InstanceRegistry.ts`
  - Accept optional `claudeSessionUuid` parameter
  - Accept optional `claudeSessionPath` parameter
  - Auto-resolve path from UUID if path not provided: `~/.claude/projects/{project}/{uuid}.jsonl`
  - Store both fields in INSERT query

- [ ] AC3: Update `mcp_meta_register_instance` tool in `src/mcp/tools/session-tools.ts`
  - Add optional `claude_session_uuid` property to input schema
  - Add optional `claude_session_path` property to input schema
  - Pass through to `registerInstance`
  - Return `claude_session_uuid` in output when present

- [ ] AC4: New `mcp_meta_link_claude_session` tool for post-registration linking
  - Input: `instance_id`, `claude_session_uuid`, optional `claude_session_path`
  - Updates existing session with Claude reference
  - Validates instance exists before update
  - Auto-resolves path from UUID if not provided

- [ ] AC5: Update `Instance` type in `src/types/session.ts`
  - Add `claude_session_uuid?: string`
  - Add `claude_session_path?: string`
  - Update `RegisterInstanceInput` interface

- [ ] AC6: Backward compatibility
  - All existing sessions continue to work with NULL values
  - All existing tools work unchanged when `claude_session_uuid` not provided
  - Heartbeat, list, query tools unaffected

**SHOULD HAVE:**

- [ ] AC7: Include `claude_session_uuid` in instance details responses
  - Update `mcp_meta_get_instance_details` output to include UUID when present
  - Update `mcp_meta_list_instances` output to include UUID when present

- [ ] AC8: Session path resolution utility
  - Utility function `resolveClaudeSessionPath(project: string, uuid: string): string`
  - Handles different machine home directory paths
  - Checks file existence (returns null if file not found)

**COULD HAVE:**

- [ ] Auto-detect Claude session UUID from environment (if available)

**WON'T HAVE (this iteration):**

- Snippet extraction (Epic 009-B)
- Transcript file reading (Epic 009-C)
- Backup automation (Epic 009-D)

### Non-Functional Requirements

**Performance:**
- Session registration with UUID: <55ms (5ms overhead vs current <50ms)
- Existing session queries: <10ms (no degradation)
- Partial index ensures UUID lookups are fast without bloating main index

**Backward Compatibility:**
- All new columns nullable
- No default values that trigger table rewrite
- No changes to existing column definitions
- No changes to existing index definitions

---

## Architecture

### Technical Approach

**Database Change:**
- Two new nullable columns on `supervisor_sessions`
- One partial index for UUID lookups (only indexes non-NULL values)
- No trigger changes (existing heartbeat trigger unaffected)

**Registration Flow Update:**
```
mcp_meta_register_instance(project, type, claude_session_uuid?)
  --> registerInstance(project, type, context, hostMachine, claudeSessionUuid?)
    --> resolveSessionPath(project, uuid)
    --> INSERT ... claude_session_uuid, claude_session_path
    --> RETURN { ..., claude_session_uuid, claude_session_path }
```

**Post-Registration Linking:**
```
mcp_meta_link_claude_session(instance_id, claude_session_uuid)
  --> UPDATE supervisor_sessions SET claude_session_uuid = $1, claude_session_path = $2 WHERE instance_id = $3
  --> RETURN { success, instance_id, claude_session_uuid }
```

### Integration Points

- **supervisor_sessions table**: 2 new columns
- **InstanceRegistry.ts**: Updated registerInstance signature
- **session-tools.ts**: Updated register tool, new link tool
- **session.ts types**: Updated Instance and RegisterInstanceInput interfaces
- **Future epics**: 009-B and 009-C read these fields

---

## Implementation Notes

### Task Breakdown

**Task 1: Database Migration (3 hours)**

Create migration file: `migrations/{timestamp}_claude_session_reference.sql`

```sql
BEGIN;

-- Add Claude Code session reference columns
ALTER TABLE supervisor_sessions
  ADD COLUMN IF NOT EXISTS claude_session_uuid VARCHAR(64),
  ADD COLUMN IF NOT EXISTS claude_session_path TEXT;

-- Partial index for efficient UUID lookups (only indexes non-NULL values)
CREATE INDEX IF NOT EXISTS idx_supervisor_sessions_claude_uuid
  ON supervisor_sessions(claude_session_uuid)
  WHERE claude_session_uuid IS NOT NULL;

COMMIT;
```

Rollback:
```sql
BEGIN;
DROP INDEX IF EXISTS idx_supervisor_sessions_claude_uuid;
ALTER TABLE supervisor_sessions DROP COLUMN IF EXISTS claude_session_path;
ALTER TABLE supervisor_sessions DROP COLUMN IF EXISTS claude_session_uuid;
COMMIT;
```

- File: `/home/samuel/sv/supervisor-service-s/migrations/{next_timestamp}_claude_session_reference.sql`
- Verify: Migration runs on odin3 without error
- Verify: Existing rows have NULL for new columns
- Verify: Existing indexes unaffected

**Task 2: Update Type Definitions (2 hours)**

Update `src/types/session.ts`:
- Add `claude_session_uuid?: string` to `Instance` interface
- Add `claude_session_path?: string` to `Instance` interface
- Add `claude_session_uuid?: string` to `RegisterInstanceInput` interface
- Add `claude_session_path?: string` to `RegisterInstanceInput` interface
- Add `claude_session_uuid?: string` to `RegisterInstanceOutput` interface
- Add `claude_session_path?: string` to `RegisterInstanceOutput` interface
- Add to `InstanceListItem` and `InstanceMatch` interfaces

**Task 3: Session Path Resolution Utility (2 hours)**

Create utility in `src/session/ClaudeSessionResolver.ts`:

```typescript
/**
 * Resolve the filesystem path to a Claude Code session transcript
 *
 * @param project Project name (used as directory name under ~/.claude/projects/)
 * @param uuid Claude session UUID
 * @returns Resolved path or null if file does not exist
 */
export function resolveClaudeSessionPath(project: string, uuid: string): string {
  const homeDir = process.env.HOME || '/home/samuel';
  return `${homeDir}/.claude/projects/${project}/${uuid}.jsonl`;
}

/**
 * Check if a Claude session transcript file exists
 *
 * @param sessionPath Path to check
 * @returns true if file exists, false otherwise
 */
export async function claudeSessionExists(sessionPath: string): Promise<boolean> {
  // Use fs.access to check existence
}
```

- File: `/home/samuel/sv/supervisor-service-s/src/session/ClaudeSessionResolver.ts`
- Export from `src/session/index.ts`

**Task 4: Update InstanceRegistry.ts (3 hours)**

Update `registerInstance` in `src/session/InstanceRegistry.ts`:
- Add `claudeSessionUuid?: string` parameter
- Add `claudeSessionPath?: string` parameter
- Auto-resolve path from UUID if path not provided
- Update INSERT query to include new columns
- Update RETURNING clause to include new columns
- Update all row mapping to include new fields

Update `updateHeartbeat`, `listInstances`, `getInstanceDetails`, `getPrefixMatches`:
- Update SELECT queries to include `claude_session_uuid`, `claude_session_path`
- Update row mapping to include new fields

New function `linkClaudeSession`:
```typescript
export async function linkClaudeSession(
  instanceId: string,
  claudeSessionUuid: string,
  claudeSessionPath?: string
): Promise<Instance> {
  // UPDATE supervisor_sessions SET claude_session_uuid = $1, claude_session_path = $2
  // WHERE instance_id = $3 RETURNING ...
}
```

**Task 5: Update MCP Tools (4 hours)**

Update `mcp_meta_register_instance` in `src/mcp/tools/session-tools.ts`:
- Add `claude_session_uuid` to input schema properties (type: string, optional)
- Add `claude_session_path` to input schema properties (type: string, optional)
- Pass to `registerInstance` call
- Include in response when present

New tool `mcp_meta_link_claude_session` in `src/mcp/tools/session-tools.ts`:
- Input schema: { instance_id: string (required), claude_session_uuid: string (required), claude_session_path: string (optional) }
- Handler: Validate instance exists, call `linkClaudeSession`, return result
- Add to `getSessionTools()` array

Update `mcp_meta_get_instance_details`:
- Include `claude_session_uuid` in response when present

Update `mcp_meta_list_instances`:
- Include `claude_session_uuid` in response when present

**Task 6: Unit Tests (2 hours)**

Test file: `tests/unit/session/ClaudeSessionResolver.test.ts`
- [ ] `resolveClaudeSessionPath` returns correct path format
- [ ] `resolveClaudeSessionPath` handles different project names
- [ ] `claudeSessionExists` returns false for non-existent file
- [ ] `claudeSessionExists` returns true for existing file (mock)

Test updates to existing session tests:
- [ ] `registerInstance` with claude_session_uuid stores correctly
- [ ] `registerInstance` without claude_session_uuid stores NULL
- [ ] `linkClaudeSession` updates existing session
- [ ] `linkClaudeSession` throws for non-existent instance
- [ ] `getInstanceDetails` includes claude_session_uuid in response
- [ ] `listInstances` includes claude_session_uuid when present
- [ ] Existing session queries still <10ms

### Estimated Effort

- Task 1 (Database): 3 hours
- Task 2 (Types): 2 hours
- Task 3 (Resolver): 2 hours
- Task 4 (InstanceRegistry): 3 hours
- Task 5 (MCP Tools): 4 hours
- Task 6 (Tests): 2 hours
- **Total**: 16 hours

---

## Acceptance Criteria

**Feature-Level Acceptance:**

- [ ] AC1: Database migration adds both columns without error
  - Migration runs on odin3
  - Existing rows have NULL for new columns
  - Rollback script works

- [ ] AC2: Registration with UUID works
  - `mcp_meta_register_instance` with `claude_session_uuid` stores value
  - Session path auto-resolved from UUID
  - Response includes `claude_session_uuid`

- [ ] AC3: Registration without UUID still works
  - `mcp_meta_register_instance` without `claude_session_uuid` works as before
  - NULL stored for new columns
  - No performance degradation

- [ ] AC4: Link tool works
  - `mcp_meta_link_claude_session` updates existing session
  - Returns updated session with UUID
  - Errors on non-existent instance

- [ ] AC5: Instance details include UUID
  - `mcp_meta_get_instance_details` shows `claude_session_uuid` when present
  - `mcp_meta_list_instances` shows `claude_session_uuid` when present

- [ ] AC6: Performance maintained
  - Session registration <55ms with UUID
  - Existing queries <10ms (benchmark before and after)

**Code Quality:**

- [ ] All code type-safe (no `any` types in new code)
- [ ] JSDoc comments on all new public functions
- [ ] Import paths use `.js` extension (ESM requirement)
- [ ] Follows existing patterns in InstanceRegistry.ts

---

## Dependencies

**Blocked By:**
- None (foundation epic)

**Blocks:**
- Epic 009-B: Snippet Extraction (reads claude_session_uuid to find transcripts)
- Epic 009-C: Transcript Lookup Tools (reads claude_session_path for file operations)

**External Dependencies:**
- PostgreSQL 14+ (already deployed)
- Claude Code local storage format (stable since Claude Code 1.0)

---

## Database Migration

### Migration File

See Task 1 above for full SQL.

### Key Decision: Partial Index

Using a partial index (`WHERE claude_session_uuid IS NOT NULL`) because:
- Most historical sessions will have NULL UUIDs
- Only sessions with UUIDs need fast lookup
- Saves index space and maintenance overhead
- Standard PostgreSQL pattern for sparse data

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Migration fails** | Low | Medium | Test on development DB first; rollback script ready |
| **Claude session format changes** | Low | Low | UUID format is stable; path resolution is simple concatenation |
| **Performance degradation** | Low | High | Nullable columns have near-zero overhead; benchmark before/after |
| **Cross-machine path differences** | Medium | Low | Use $HOME-relative paths; resolve at read time |

---

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `migrations/{ts}_claude_session_reference.sql` | Create | Database migration |
| `src/types/session.ts` | Modify | Add UUID/path fields to interfaces |
| `src/session/ClaudeSessionResolver.ts` | Create | Path resolution utility |
| `src/session/InstanceRegistry.ts` | Modify | Add UUID to registration, new linkClaudeSession |
| `src/session/index.ts` | Modify | Export new resolver |
| `src/mcp/tools/session-tools.ts` | Modify | Update register tool, add link tool |

---

**Specification Version**: 1.0
**Last Updated**: 2026-02-04
**Maintained by**: Meta-Supervisor (MS)
**Status**: Ready for Implementation
