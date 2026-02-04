---
epic_id: claude-session-integration-009-C
parent_feature: claude-session-integration
status: pending
complexity: 2
created: 2026-02-04
started: null
completed: null
assigned_to: null
source: prd
---

# Epic 009-C: Transcript Lookup Tools

**Feature**: Claude Code Session Reference Integration - Enrichment Phase
**Epic ID**: claude-session-integration-009-C
**Status**: Pending
**Complexity**: 2 (Medium)
**Created**: 2026-02-04
**Effort**: 20 hours
**Dependencies**: Epic 009-A (session reference fields)
**Source**: PRD (claude-session-integration)

---

## Quick Reference

**Purpose**: Provide MCP tools for navigating from supervisor sessions to their Claude Code transcript files. Find transcripts, read metadata, list sessions for a project, and get summary previews.

**Key Deliverable**: Three MCP tools that bridge the gap between supervisor metadata and Claude Code's local transcript files, enabling quick context recovery during debugging.

**Critical Success Factor**: Transcript discovery works across machines (odin3, odin4, laptop) with graceful handling of missing files.

---

## Project Context

- **Project**: Supervisor Service (Meta)
- **Repository**: `/home/samuel/sv/supervisor-service-s/`
- **Tech Stack**: Node.js 20+, TypeScript 5.3+, PostgreSQL 14+, MCP
- **Parent Feature**: claude-session-integration
- **Depends On**: Epic 009-A (claude_session_uuid and claude_session_path)
- **Parallel With**: Epic 009-B (snippet extraction)

---

## Business Context

### Problem Statement

When debugging complex issues, users need to trace from a supervisor event (e.g., "deployment_failed") back to the full conversation where that decision was made. Currently, finding the right Claude Code transcript requires manually navigating the `~/.claude/projects/` directory structure and grepping through JSONL files. There is no tooling to connect supervisor metadata to transcript files.

### User Value

- **Quick debugging**: From instance_id, immediately find the transcript file location and size
- **Project overview**: See all Claude Code sessions for a project with timestamps and sizes
- **Context preview**: Read first/last messages from a transcript without opening the full file
- **Cross-machine support**: Works whether session ran on odin3, odin4, or laptop

---

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**

- [ ] AC1: MCP tool `mcp_meta_find_transcript`
  - Input: `{ instance_id: string }`
  - Behavior:
    1. Look up `claude_session_uuid` and `claude_session_path` from supervisor_sessions
    2. If no UUID linked, return { success: false, error: "No Claude session linked" }
    3. Check if file exists at resolved path
    4. Return file metadata: path, size_bytes, size_human, modified_at, line_count
  - Output:
    ```typescript
    {
      success: true,
      instance_id: string,
      claude_session_uuid: string,
      transcript: {
        path: string,
        exists: boolean,
        size_bytes: number,
        size_human: string,     // "1.2 MB"
        modified_at: string,    // ISO 8601
        line_count: number,     // Approximate from file size
      }
    }
    ```
  - Performance: <100ms

- [ ] AC2: MCP tool `mcp_meta_list_project_sessions`
  - Input: `{ project: string, limit?: number, include_unlinked?: boolean }`
  - Behavior:
    1. Scan `~/.claude/projects/{project}/` directory for `.jsonl` files
    2. Cross-reference with supervisor_sessions to find linked instances
    3. Return list sorted by modification time (newest first)
  - Output:
    ```typescript
    {
      success: true,
      project: string,
      sessions: [
        {
          filename: string,           // "abc123-def456.jsonl"
          uuid: string,               // Extracted from filename
          path: string,               // Full path
          size_bytes: number,
          size_human: string,
          modified_at: string,
          linked_instance_id?: string, // If linked in supervisor_sessions
          linked_status?: string,      // active/stale/closed
        }
      ],
      total_count: number,
      linked_count: number,
      total_size_human: string       // "245 MB"
    }
    ```
  - Performance: <500ms for 100 sessions
  - Default limit: 50

- [ ] AC3: MCP tool `mcp_meta_read_transcript_summary`
  - Input: `{ instance_id?: string, path?: string, head_lines?: number, tail_lines?: number }`
  - Behavior:
    1. Resolve path from instance_id (via supervisor_sessions) or use provided path directly
    2. Read first N lines (default 5) and last N lines (default 5) from JSONL file
    3. Parse each line as JSON, extract role and content summary
    4. Return formatted summary
  - Output:
    ```typescript
    {
      success: true,
      path: string,
      total_lines: number,
      head: [
        {
          line: number,
          role: string,       // "user" | "assistant" | "system"
          type: string,       // "message" | "tool_call" | "tool_result"
          content_preview: string,  // First 200 chars
          timestamp?: string,
        }
      ],
      tail: [
        // Same format as head
      ]
    }
    ```
  - Content sanitized (secrets removed)
  - Performance: <200ms
  - Handles binary/corrupted files gracefully

**SHOULD HAVE:**

- [ ] AC4: Cross-machine path resolution
  - Resolve `~/.claude/projects/` relative to current user's home directory
  - Handle case where transcript is from different machine (return "file not on this machine")
  - Support explicit path override in tool input

- [ ] AC5: Claude session directory discovery
  - Auto-discover available projects under `~/.claude/projects/`
  - Map project directory names to supervisor project names

**COULD HAVE:**

- [ ] Transcript text search (grep through JSONL content)
- [ ] Session timeline visualization (message timestamps)

**WON'T HAVE (this iteration):**

- Full transcript reading (too much data for MCP response)
- Transcript editing or modification
- Remote machine transcript access (SSH-based)

---

## Architecture

### Technical Approach

**File System Operations:**
- All transcript operations use `fs/promises` (async, non-blocking)
- JSONL parsing uses `readline` interface for streaming
- File metadata via `fs.stat` (size, modified time)
- Line count approximated from file size (avg ~700 bytes/line) or counted via streaming

**Path Resolution:**
```
Instance ID
  --> supervisor_sessions.claude_session_path  (stored path)
  --> OR resolve: ${HOME}/.claude/projects/${project}/${uuid}.jsonl
  --> Check file exists
  --> Return metadata or "not found"
```

**Project Session Discovery:**
```
~/.claude/projects/${project}/
  --> readdir() for *.jsonl files
  --> stat() each file for size/modified
  --> Cross-reference with supervisor_sessions (WHERE claude_session_uuid = filename_uuid)
  --> Sort by modified DESC
```

### Integration Points

- **supervisor_sessions table**: Read `claude_session_uuid`, `claude_session_path` (from 009-A)
- **Local filesystem**: Read `~/.claude/projects/` directory structure
- **SanitizationService**: Sanitize content previews

---

## Implementation Notes

### Task Breakdown

**Task 1: Transcript File Service (5 hours)**

Create `src/session/TranscriptFileService.ts`:

```typescript
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';

/**
 * Service for reading and inspecting Claude Code transcript files
 */
export class TranscriptFileService {
  private claudeProjectsDir: string;

  constructor() {
    const home = process.env.HOME || '/home/samuel';
    this.claudeProjectsDir = path.join(home, '.claude', 'projects');
  }

  /**
   * Get metadata for a transcript file
   */
  async getFileMetadata(filePath: string): Promise<{
    exists: boolean;
    size_bytes: number;
    size_human: string;
    modified_at: Date;
    line_count: number;
  }>

  /**
   * Read first N and last N lines from a JSONL file
   */
  async readHeadTail(filePath: string, headLines: number, tailLines: number): Promise<{
    head: ParsedLine[];
    tail: ParsedLine[];
    total_lines: number;
  }>

  /**
   * List all .jsonl session files for a project
   */
  async listProjectSessions(project: string): Promise<SessionFileInfo[]>

  /**
   * Resolve the path to a Claude session file
   */
  resolvePath(project: string, uuid: string): string

  /**
   * Format bytes to human-readable string
   */
  formatSize(bytes: number): string
}

interface ParsedLine {
  line: number;
  role: string;
  type: string;
  content_preview: string;
  timestamp?: string;
}

interface SessionFileInfo {
  filename: string;
  uuid: string;
  path: string;
  size_bytes: number;
  size_human: string;
  modified_at: Date;
}
```

Key implementation details:
- `readHeadTail`: Use `readline` to stream first N lines, then use file seeking for tail
- `listProjectSessions`: `readdir` + `stat` for each file, filter `.jsonl` extension
- `formatSize`: Convert bytes to KB/MB/GB
- `getFileMetadata`: `fs.stat` + line count (stream and count `\n`)
- Error handling: Return `exists: false` for missing files, log warnings for malformed data

**Task 2: Type Definitions (2 hours)**

Create `src/types/transcript.ts`:

```typescript
export interface TranscriptMetadata {
  path: string;
  exists: boolean;
  size_bytes: number;
  size_human: string;
  modified_at: string;
  line_count: number;
}

export interface TranscriptSummaryLine {
  line: number;
  role: string;
  type: string;
  content_preview: string;
  timestamp?: string;
}

export interface ProjectSessionInfo {
  filename: string;
  uuid: string;
  path: string;
  size_bytes: number;
  size_human: string;
  modified_at: string;
  linked_instance_id?: string;
  linked_status?: string;
}

export interface FindTranscriptOutput {
  success: boolean;
  instance_id: string;
  claude_session_uuid?: string;
  transcript?: TranscriptMetadata;
  error?: string;
}

export interface ListProjectSessionsOutput {
  success: boolean;
  project: string;
  sessions: ProjectSessionInfo[];
  total_count: number;
  linked_count: number;
  total_size_human: string;
}

export interface ReadTranscriptSummaryOutput {
  success: boolean;
  path: string;
  total_lines: number;
  head: TranscriptSummaryLine[];
  tail: TranscriptSummaryLine[];
  error?: string;
}
```

**Task 3: MCP Tools Implementation (8 hours)**

Create `src/mcp/tools/transcript-tools.ts`:

`mcp_meta_find_transcript`:
- Look up instance from supervisor_sessions
- Get claude_session_uuid and claude_session_path
- If no UUID: return error "No Claude session linked to this instance"
- Check file existence at resolved path
- Return metadata via TranscriptFileService.getFileMetadata

`mcp_meta_list_project_sessions`:
- Use TranscriptFileService.listProjectSessions to scan directory
- Query supervisor_sessions for any linked UUIDs:
  ```sql
  SELECT instance_id, claude_session_uuid, status
  FROM supervisor_sessions
  WHERE project = $1 AND claude_session_uuid IS NOT NULL
  ```
- Cross-reference: match session file UUID to linked instances
- Sort by modified_at DESC, apply limit
- Calculate total size

`mcp_meta_read_transcript_summary`:
- Resolve path from instance_id or use provided path
- Use TranscriptFileService.readHeadTail
- Sanitize content previews (first 200 chars of each message)
- Return structured summary

Register all three tools via `getTranscriptTools()` function.
Add to MCP server tool registration.

**Task 4: Cross-Machine Path Resolution (2 hours)**

In `TranscriptFileService`:
- Detect current machine: `os.hostname()`
- Map machine names to home directories:
  ```typescript
  const MACHINE_HOME_MAP: Record<string, string> = {
    'odin3': '/home/samuel',
    'gcp-odin3-vm': '/home/samuel',
    'odin4': '/home/samuel',
    'laptop': '/Users/samuel',  // macOS
  };
  ```
- When file not found at primary path, check if it might be on another machine
- Return helpful message: "Transcript may be on machine: odin4"

**Task 5: Unit Tests (3 hours)**

Test `TranscriptFileService`:
- [ ] `getFileMetadata` returns correct size and modified time
- [ ] `getFileMetadata` returns exists: false for missing file
- [ ] `readHeadTail` returns correct number of lines
- [ ] `readHeadTail` handles file shorter than requested lines
- [ ] `readHeadTail` handles empty file
- [ ] `readHeadTail` handles malformed JSONL lines (skip gracefully)
- [ ] `listProjectSessions` returns .jsonl files only
- [ ] `listProjectSessions` returns empty array for missing directory
- [ ] `resolvePath` constructs correct path
- [ ] `formatSize` formats bytes correctly (KB, MB, GB)

Test MCP tools:
- [ ] `find_transcript` returns metadata for linked session
- [ ] `find_transcript` returns error for unlinked session
- [ ] `list_project_sessions` cross-references with DB
- [ ] `read_transcript_summary` returns sanitized previews
- [ ] All tools handle missing files gracefully

### Estimated Effort

- Task 1 (TranscriptFileService): 5 hours
- Task 2 (Types): 2 hours
- Task 3 (MCP Tools): 8 hours
- Task 4 (Cross-Machine): 2 hours
- Task 5 (Tests): 3 hours
- **Total**: 20 hours

---

## Acceptance Criteria

**Feature-Level Acceptance:**

- [ ] AC1: `find_transcript` returns file metadata for linked session
- [ ] AC2: `find_transcript` returns error for session without linked UUID
- [ ] AC3: `list_project_sessions` scans directory and cross-references DB
- [ ] AC4: `list_project_sessions` returns correct linked/unlinked counts
- [ ] AC5: `read_transcript_summary` returns sanitized first/last lines
- [ ] AC6: Missing files handled gracefully (exists: false, no crash)
- [ ] AC7: Performance: find <100ms, list <500ms, summary <200ms
- [ ] AC8: Cross-machine path resolution returns helpful messages

**Code Quality:**

- [ ] Type-safe (no `any` types in new code)
- [ ] JSDoc comments on all public functions
- [ ] Import paths use `.js` extension
- [ ] Streaming used for large file operations (no full-file loads)

---

## Dependencies

**Blocked By:**
- Epic 009-A: Session reference fields (needs claude_session_uuid, claude_session_path)

**Blocks:**
- None

**External Dependencies:**
- Claude Code local storage directory structure (`~/.claude/projects/`)
- File system access on host machine

---

## Files Modified/Created

| File | Action | Description |
|------|--------|-------------|
| `src/types/transcript.ts` | Create | Type definitions for transcript operations |
| `src/session/TranscriptFileService.ts` | Create | File system operations for transcripts |
| `src/session/index.ts` | Modify | Export TranscriptFileService |
| `src/mcp/tools/transcript-tools.ts` | Create | Three MCP tools for transcript operations |
| `src/mcp/tools/index.ts` | Modify | Register transcript tools |

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Claude directory structure changes** | Low | Medium | Adapter pattern; detect structure version |
| **Large project directories slow listing** | Medium | Low | Apply limit; stream readdir results |
| **JSONL format varies across Claude versions** | Medium | Medium | Defensive parsing; skip malformed lines |
| **File permissions prevent reading** | Low | Low | Check access before read; return permission error |
| **Cross-machine path resolution incorrect** | Medium | Low | Test on all three machines; fallback to $HOME |

---

**Specification Version**: 1.0
**Last Updated**: 2026-02-04
**Maintained by**: Meta-Supervisor (MS)
**Status**: Ready for Implementation (after 009-A)
