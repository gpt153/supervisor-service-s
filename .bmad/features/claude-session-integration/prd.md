# Product Requirements Document: Claude Code Session Reference Integration

**Feature ID:** claude-session-integration
**Created:** 2026-02-04
**Last Updated:** 2026-02-04
**Status:** Planning
**Version:** 1.0.0

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-04 | Meta-Supervisor | Initial PRD with 4-epic breakdown |

---

## Executive Summary

Integrate Claude Code's local session transcripts with the supervisor session continuity system. This creates a bidirectional link between the lightweight metadata tracked in PostgreSQL (128KB, 192 events, 0.5ms queries) and the rich conversation transcripts stored locally by Claude Code (~2.5GB across `~/.claude/projects/`).

**Key Innovation**: Zero-copy reference architecture. Instead of duplicating transcript data into PostgreSQL, store only session UUIDs and file paths as pointers. Selectively extract high-value snippets (2-5KB each) for pattern analysis while keeping the database lean.

**Business Impact:**
- **Deep debugging**: Link structured events to full conversation context when needed
- **Pattern extraction**: Capture decision rationale, error reasoning, and learning patterns without full-transcript storage
- **Backup safety**: Automated backup of valuable Claude session data to Google Drive
- **Future ML readiness**: Structured snippet data enables training on successful patterns
- **99.5% storage reduction**: 2-5KB snippets vs 1.1MB full transcripts

---

## Problem Statement

### Current State

The supervisor session continuity system (Feature 007) tracks structured events (commits, deploys, spawns, epic milestones) but has no connection to the full conversation context where decisions were made. Claude Code stores rich conversation transcripts locally in JSONL format at `~/.claude/projects/[project]/[session-uuid].jsonl`.

**Data gap:**
1. **No link**: Cannot navigate from a supervisor event to the conversation where that decision was made
2. **No context for debugging**: When investigating why a deployment failed, structured events say "deployment_failed" but the reasoning, tool outputs, and decision chain are only in the local transcript
3. **No backup**: 2.5GB of session data on local disk with no redundancy; machine failure loses all historical context
4. **No pattern extraction**: Cannot identify which conversation patterns lead to successful outcomes vs failures

### User Impact

**Debugging scenario:**
- User sees event: `deployment_failed` for consilio at 3:14 AM
- Structured data shows: error_message="port conflict", duration_seconds=12
- Full context needed: Why did the PS choose that port? What alternatives were considered? What was the exact error output?
- Currently: No way to find this context without manually searching through JSONL files

**Pattern analysis scenario:**
- User wants to understand: "Why do epic implementations for UI features take 2x longer than API features?"
- Structured data shows: duration_hours for each epic
- Full context needed: Where did time go? What errors were encountered? What decisions caused delays?
- Currently: No structured way to extract and analyze decision patterns

---

## Goals & Objectives

### Primary Goal

Bridge the gap between supervisor session metadata (PostgreSQL) and Claude Code conversation transcripts (local JSONL files) with minimal storage overhead and maximum debugging utility.

### Success Criteria

**Reference Integration:**
- Every supervisor session has an optional `claude_session_uuid` linking to the local transcript
- Every supervisor session has an optional `claude_session_path` with the filesystem location
- Registration flow updated to capture Claude session ID when available
- Lookup tool enables navigating from supervisor event to transcript location

**Snippet Extraction:**
- `conversation_snippets` table stores high-value context extracts (2-5KB each)
- Three snippet types supported: error_reasoning, decision_rationale, learning_pattern
- MCP tool for extracting snippets from active sessions
- MCP tool for querying snippets by type, project, time range
- 99.5% storage reduction vs full transcripts

**Backup Automation:**
- Automated rclone sync of `~/.claude/projects/` to Google Drive
- 7-day hot local retention, older sessions archived to Drive
- Simple restore procedure documented
- Monitoring for backup success/failure

**Performance:**
- Zero degradation on existing session queries (<10ms)
- Snippet extraction: <500ms per snippet
- Snippet query: <50ms
- Backup: Non-blocking, runs on schedule

---

## Epic Status

| Epic | Status | Effort (Hours) | Dependencies | Completion |
|------|--------|----------------|--------------|------------|
| epic-009-A-session-reference-fields | Pending | 16 | None | 0% |
| epic-009-B-snippet-extraction | Pending | 30 | 009-A | 0% |
| epic-009-C-transcript-lookup-tools | Pending | 20 | 009-A | 0% |
| epic-009-D-backup-automation | Pending | 14 | None | 0% |
| **Total** | **Planning** | **80 hours** | **-** | **0%** |

**Critical Path:** 009-A --> 009-B, 009-C (parallel) --> Done. 009-D is independent.

**Parallelization:**
- 009-B and 009-C can run in parallel after 009-A completes
- 009-D can run independently of all other epics (no DB dependency)

---

## Architecture Overview

### System Components

```
+--------------------------------------------------------------------+
|             Claude Session Integration System                       |
+-------------------+-------------------+----------------------------+
| 1. Reference      | 2. Snippet        | 3. Transcript              |
|    Fields          |    Extraction      |    Lookup                  |
| - claude_session   | - conversation    | - find_transcript          |
|   _uuid column     |   _snippets table | - read_transcript_meta     |
| - claude_session   | - extract_snippet | - list_sessions_for_project|
|   _path column     |   MCP tool        |                            |
| - auto-capture on  | - query_snippets  |                            |
|   registration     |   MCP tool        |                            |
+-------------------+-------------------+----------------------------+
| 4. Backup                                                          |
|    Automation                                                      |
| - rclone sync to gdrive                                            |
| - 7-day hot local                                                  |
| - scheduled via cron/systemd                                       |
| - restore procedure                                                |
+--------------------------------------------------------------------+
```

### Data Flow

```
Claude Code Session
  |
  v
~/.claude/projects/[project]/[uuid].jsonl  (local, 1.1MB avg)
  |
  v
Session Registration (mcp_meta_register_instance)
  |
  +-- Captures: claude_session_uuid, claude_session_path
  |
  v
supervisor_sessions table (PostgreSQL, +64 bytes per row)
  |
  +-- Query by instance_id --> get transcript path
  |
  +-- Snippet extraction (on demand)
  |       |
  |       v
  +-- conversation_snippets table (2-5KB per snippet)
  |
  v
rclone sync --> Google Drive (backup, async)
```

### Database Changes

**Modified Table:**
- `supervisor_sessions`: Add 2 columns (claude_session_uuid, claude_session_path)

**New Table:**
- `conversation_snippets`: Stores extracted conversation snippets with type, source reference, and content

### Storage Budget

| Data Type | Per-Record Size | Estimated Volume | 90-Day Total |
|-----------|-----------------|------------------|--------------|
| Reference fields | ~64 bytes | Per session | ~6KB |
| Snippets | 2-5KB | ~5-10/day | ~90-450KB |
| Backup (Drive) | N/A | Full transcripts | ~7.5GB |
| **DB Total** | - | - | **~500KB** |

---

## Key Features

### 1. Session Reference Fields (Epic 009-A)

**Problem Solved:** No link between supervisor sessions and Claude transcripts

**Solution:** Add optional reference columns to `supervisor_sessions` table

**How It Works:**
1. Migration adds `claude_session_uuid` (VARCHAR(64)) and `claude_session_path` (TEXT) to `supervisor_sessions`
2. `mcp_meta_register_instance` updated with optional `claude_session_uuid` parameter
3. Session path auto-resolved from UUID using known directory structure
4. Backward compatible: existing sessions have NULL for new columns
5. Zero overhead on existing queries (nullable columns, no new indexes initially)

**Outcome:** Every supervisor session can optionally point to its full transcript

### 2. Snippet Extraction (Epic 009-B)

**Problem Solved:** Full transcripts too large for database, but contain high-value context

**Solution:** Extract and store targeted 2-5KB snippets

**How It Works:**
1. New `conversation_snippets` table stores categorized extracts
2. Three snippet types:
   - `error_reasoning`: Why an error occurred and how it was resolved
   - `decision_rationale`: Why a particular approach was chosen over alternatives
   - `learning_pattern`: Reusable patterns discovered during implementation
3. MCP tool `mcp_meta_extract_snippet` reads transcript, extracts relevant section
4. MCP tool `mcp_meta_query_snippets` enables searching by type, project, time range
5. Snippets linked to instance_id and optionally to specific event_id

**Outcome:** High-value context preserved at 99.5% storage reduction

### 3. Transcript Lookup Tools (Epic 009-C)

**Problem Solved:** No tooling to navigate from supervisor metadata to transcript files

**Solution:** MCP tools for transcript discovery and metadata reading

**How It Works:**
1. `mcp_meta_find_transcript`: Given instance_id, returns claude_session_path and file metadata (size, modified, line count)
2. `mcp_meta_list_project_sessions`: List all Claude sessions for a project with file sizes and timestamps
3. `mcp_meta_read_transcript_summary`: Read first/last N messages from a transcript for quick context
4. Works across machines by resolving paths relative to `~/.claude/projects/`

**Outcome:** Easy navigation from structured events to full conversation context

### 4. Backup Automation (Epic 009-D)

**Problem Solved:** 2.5GB of session data on local disk with no redundancy

**Solution:** Automated rclone sync to Google Drive

**How It Works:**
1. rclone configured with Google Drive remote (odin@153.se)
2. Scheduled sync: `~/.claude/projects/` --> `gdrive:claude-backups/`
3. Hot retention: 7 days local, older archived to Drive only
4. Restore script for recovering sessions from Drive
5. Monitoring: Log sync results, alert on failure (3 consecutive)
6. Non-blocking: Runs via systemd timer, does not impact active sessions

**Outcome:** Session data protected against machine failure

---

## Technical Specifications

### MCP Tools (6 New Tools)

| Category | Tool | Purpose |
|----------|------|---------|
| Reference | `mcp_meta_link_claude_session` | Link Claude session UUID to supervisor instance |
| Lookup | `mcp_meta_find_transcript` | Find transcript file for an instance |
| Lookup | `mcp_meta_list_project_sessions` | List all Claude sessions for a project |
| Lookup | `mcp_meta_read_transcript_summary` | Read first/last messages from transcript |
| Snippet | `mcp_meta_extract_snippet` | Extract and store conversation snippet |
| Snippet | `mcp_meta_query_snippets` | Search snippets by type/project/time |

### Performance Budget

| Metric | Target |
|--------|--------|
| Session registration (with UUID) | <55ms (5ms overhead vs current <50ms) |
| Existing session queries | <10ms (no degradation) |
| Snippet extraction | <500ms |
| Snippet query | <50ms |
| Transcript file lookup | <100ms |
| Backup sync (incremental) | <5 min |

### Database Migration

**Migration 1:** Add reference columns to `supervisor_sessions`
```sql
ALTER TABLE supervisor_sessions
  ADD COLUMN claude_session_uuid VARCHAR(64),
  ADD COLUMN claude_session_path TEXT;

CREATE INDEX idx_supervisor_sessions_claude_uuid
  ON supervisor_sessions(claude_session_uuid)
  WHERE claude_session_uuid IS NOT NULL;
```

**Migration 2:** Create `conversation_snippets` table
```sql
CREATE TABLE conversation_snippets (
  snippet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id VARCHAR(32) REFERENCES supervisor_sessions(instance_id) ON DELETE CASCADE,
  event_id UUID REFERENCES event_store(event_id) ON DELETE SET NULL,
  snippet_type VARCHAR(32) NOT NULL CHECK (snippet_type IN ('error_reasoning', 'decision_rationale', 'learning_pattern')),
  title VARCHAR(256) NOT NULL,
  content TEXT NOT NULL,
  source_file TEXT,
  source_line_start INTEGER,
  source_line_end INTEGER,
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Implementation Roadmap

### Phase 1: Foundation (Epic 009-A, ~2 days)

**Epic 009-A: Session Reference Fields**
- Database migration adding reference columns
- Update `registerInstance` to accept optional claude_session_uuid
- Update `mcp_meta_register_instance` tool input schema
- Auto-resolve session path from UUID
- Update session types

**Deliverables:**
- supervisor_sessions table has claude_session_uuid and claude_session_path columns
- Registration accepts and stores Claude session references
- Zero impact on existing functionality

### Phase 2: Enrichment (Epics 009-B + 009-C in parallel, ~1 week)

**Epic 009-B: Snippet Extraction**
- conversation_snippets table migration
- Snippet extraction service (reads JSONL, extracts sections)
- MCP tools: extract_snippet, query_snippets
- Snippet type validation and categorization

**Epic 009-C: Transcript Lookup Tools**
- MCP tool: find_transcript (instance_id --> file path + metadata)
- MCP tool: list_project_sessions (project --> all Claude sessions)
- MCP tool: read_transcript_summary (first/last N messages)
- Cross-machine path resolution

**Deliverables:**
- High-value context extracted and searchable
- Easy navigation from supervisor events to full transcripts

### Phase 3: Backup (Epic 009-D, independent, ~1-2 days)

**Epic 009-D: Backup Automation**
- rclone configuration for Google Drive
- Backup script with retention policy
- systemd timer for scheduling
- Restore procedure documentation
- Basic monitoring (log success/failure)

**Deliverables:**
- Automated daily backup of Claude session data
- Restore procedure tested and documented

---

## Non-Functional Requirements

### Reliability

- Reference fields: NULL-safe (existing sessions unaffected)
- Snippet extraction: Graceful degradation if transcript file missing
- Backup: Retry on failure, alert after 3 consecutive failures
- Data durability: PostgreSQL ACID for snippets, Google Drive for transcript backups

### Security

- Transcript paths are local filesystem paths (no secrets in paths)
- Snippet content sanitized using existing SanitizationService (reuse from Epic 007-B)
- Backup encrypted in transit (rclone HTTPS to Drive)
- No full transcripts stored in database

### Performance

- Zero degradation on existing queries (nullable columns, partial index)
- Snippet queries indexed by type, instance_id, created_at
- Transcript file operations: Non-blocking, file existence checked before read
- Backup: Runs off-peak, incremental sync

### Backwards Compatibility

- All new columns are nullable (existing sessions work unchanged)
- New tools are additive (no existing tool signatures changed)
- Registration tool updated with optional parameter only
- Database migration is additive (no destructive changes)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Claude session format changes** | Medium | Medium | Version-detect JSONL format; adapter pattern for parsing |
| **Transcript files moved/deleted** | Medium | Low | Graceful degradation; check file exists before operations |
| **Snippet extraction too slow** | Low | Medium | Stream JSONL instead of loading full file; line-range extraction |
| **rclone quota limits on Drive** | Low | Medium | Monitor usage; exclude old sessions; compress before upload |
| **Cross-machine path resolution fails** | Medium | Low | Resolve relative to `~/.claude/projects/`; machine-specific overrides |
| **Storage growth from snippets** | Low | Low | Retention policy; 30-day cleanup; monitor table size |

---

## Testing Strategy

### Unit Testing

**Per Epic:**
- 009-A: Migration rollback/forward, register with/without UUID, path resolution
- 009-B: Snippet extraction from test JSONL, type validation, query filtering
- 009-C: File discovery, metadata reading, cross-machine path resolution
- 009-D: Backup script dry-run, restore script validation

**Coverage Target:** 80% code coverage for new code

### Integration Testing

**Test Scenarios:**
1. **Full lifecycle**: Register with UUID --> Extract snippet --> Query snippet --> Find transcript
2. **Backward compatibility**: Register without UUID --> All existing tools work unchanged
3. **Cross-machine**: Resolve transcript path on odin3, odin4, laptop
4. **Missing transcript**: Extract snippet from non-existent file --> Graceful error
5. **Backup/restore**: Sync sessions --> Delete local --> Restore from Drive --> Verify

### Performance Testing

- Verify existing session queries remain <10ms with new columns
- Verify snippet extraction completes <500ms for 1MB transcript
- Verify snippet query <50ms with 1000 snippets in table

---

## Dependencies

### Existing Infrastructure (Already Built)

- PostgreSQL database (supervisor_service)
- MCP server infrastructure
- supervisor_sessions table (Epic 007-A)
- event_store table (Epic 007-C)
- SanitizationService (Epic 007-B)
- Session registration and heartbeat tools

### External Dependencies

- Claude Code's local session storage format (~/.claude/projects/)
- rclone (for backup automation)
- Google Drive API access (odin@153.se account)

### No New Package Dependencies

All functionality implemented with existing packages:
- `pg` for database operations
- `fs/promises` for file system operations
- `readline` for streaming JSONL parsing
- `child_process` for rclone invocation (backup only)

---

## Related Documents

### Epics
- `epics/epic-009-A-session-reference-fields.md` - Database reference fields
- `epics/epic-009-B-snippet-extraction.md` - Conversation snippet system
- `epics/epic-009-C-transcript-lookup-tools.md` - Transcript discovery and reading
- `epics/epic-009-D-backup-automation.md` - Automated backup to Google Drive

### Parent Feature
- `../session-continuity/prd.md` - Session Continuity System (Feature 007)

### Related Features
- `../event-lineage-tracking/prd.md` - Event Lineage Tracking (Feature 008)
- `../learning-system/prd.md` - Learning System (Feature 002)

---

## Change Log

### Version 1.0.0 (2026-02-04) - PLANNING

**Initial PRD:**
- 4-epic breakdown with clear parallelization
- Reference-based architecture (zero-copy)
- Selective snippet extraction (99.5% storage reduction)
- Automated backup with Google Drive
- 80 hours estimated effort
- Backward compatible with existing session continuity system

---

**Maintained by**: Meta-Supervisor (MS)
**Next Review**: After Epic 009-A completion
