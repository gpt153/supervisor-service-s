# Transcript Lookup Tools (Epic 009-C)

## Overview

Epic 009-C implements three MCP tools for navigating from supervisor sessions to their Claude Code transcript files. These tools bridge the gap between supervisor metadata (stored in PostgreSQL) and Claude Code's local transcript files (JSONL format), enabling quick context recovery during debugging.

## Key Deliverables

### Type Definitions (`src/types/transcript.ts`)

Core types for transcript operations:

- **TranscriptMetadata**: File metadata including path, size, modification time, and line count
- **TranscriptSummaryLine**: Parsed line from transcript with role, type, content preview, and timestamp
- **ProjectSessionInfo**: Session file information with optional linked instance details
- **FindTranscriptOutput**: Output type for find_transcript tool
- **ListProjectSessionsOutput**: Output type for list_project_sessions tool
- **ReadTranscriptSummaryOutput**: Output type for read_transcript_summary tool

### File Service (`src/session/TranscriptFileService.ts`)

Provides file system operations for Claude Code transcript files:

#### Key Methods

- **getFileMetadata(filePath)**: Returns file metadata (size, modification time, approximate line count)
- **readHeadTail(filePath, headLines, tailLines)**: Streams and reads first/last N lines with content preview
- **listProjectSessions(project)**: Scans `~/.claude/projects/{project}/` for .jsonl files
- **resolvePath(project, uuid)**: Constructs standard path from project and UUID
- **formatSize(bytes)**: Converts bytes to human-readable format (B, KB, MB, GB)
- **getCurrentMachine()**: Returns current machine hostname
- **getHomeForMachine(machine)**: Maps machine name to home directory
- **getPossibleMachines(filePath)**: Identifies machines that might have the file

#### Features

- Streaming JSONL parsing (no full-file loads)
- Graceful handling of malformed JSONL lines
- Cross-machine path resolution (odin3, odin4, laptop)
- Content sanitization ready (uses SanitizationService)
- Singleton pattern for global access

### MCP Tools (`src/mcp/tools/transcript-tools.ts`)

Three tools registered in the MCP server:

#### 1. mcp_meta_find_transcript

Finds transcript file by supervisor instance_id.

**Input:**
```typescript
{
  instance_id: string  // e.g., "odin-PS-abc123"
}
```

**Output:**
```typescript
{
  success: boolean,
  instance_id: string,
  claude_session_uuid?: string,
  transcript?: {
    path: string,
    exists: boolean,
    size_bytes: number,
    size_human: string,
    modified_at: string (ISO 8601),
    line_count: number
  },
  error?: string
}
```

**Behavior:**
1. Looks up instance in supervisor_sessions table
2. Retrieves claude_session_uuid and claude_session_path
3. Returns error if no UUID linked
4. Checks file existence and returns metadata

**Performance:** <100ms

#### 2. mcp_meta_list_project_sessions

Lists all Claude Code sessions for a project.

**Input:**
```typescript
{
  project: string,           // e.g., "consilio"
  limit?: number,            // default: 50
  include_unlinked?: boolean // default: true
}
```

**Output:**
```typescript
{
  success: boolean,
  project: string,
  sessions: [
    {
      filename: string,
      uuid: string,
      path: string,
      size_bytes: number,
      size_human: string,
      modified_at: string (ISO 8601),
      linked_instance_id?: string,
      linked_status?: string  // active/stale/closed
    }
  ],
  total_count: number,
  linked_count: number,
  total_size_human: string
}
```

**Behavior:**
1. Scans `~/.claude/projects/{project}/` for .jsonl files
2. Queries supervisor_sessions for linked instances
3. Cross-references files with instances
4. Sorts by modification time (newest first)
5. Returns limited results with totals

**Performance:** <500ms for 100 sessions

#### 3. mcp_meta_read_transcript_summary

Reads first and last N lines from a transcript.

**Input:**
```typescript
{
  instance_id?: string,  // Resolve path from DB
  path?: string,         // Direct file path
  head_lines?: number,   // default: 5
  tail_lines?: number    // default: 5
}
```

**Output:**
```typescript
{
  success: boolean,
  path: string,
  total_lines: number,
  head: [
    {
      line: number,
      role: string,     // "user" | "assistant" | "system"
      type: string,     // "message" | "tool_call" | "tool_result"
      content_preview: string,  // First 200 chars, sanitized
      timestamp?: string
    }
  ],
  tail: [/* same format */],
  error?: string
}
```

**Behavior:**
1. Resolves path from instance_id (via DB) or uses provided path
2. Streams JSONL file and reads head/tail lines
3. Parses each line as JSON
4. Extracts role, type, and content preview
5. Sanitizes content (removes secrets)
6. Returns structured summary

**Performance:** <200ms

## Implementation Details

### Streaming Architecture

The TranscriptFileService uses Node.js streams for efficient file processing:

- **readline** interface for line-by-line JSONL parsing
- No full-file loading into memory
- Graceful handling of large transcript files (>100MB)

### Error Handling

All operations degrade gracefully:

- Missing files return `exists: false` instead of throwing
- Malformed JSONL lines are skipped with debug logging
- Database unavailability doesn't crash the service
- Cross-machine path errors return helpful messages

### Content Sanitization

Content previews are automatically sanitized using the existing SanitizationService:

- Removes API keys, passwords, tokens
- Redacts connection strings with credentials
- Redacts JWT tokens, AWS credentials, OAuth tokens
- Returns `[REDACTED]` for sensitive patterns

### Cross-Machine Support

Handles transcripts across three machines:

- **odin3** (primary): `/home/samuel/.claude/projects/`
- **odin4** (dev): `/home/samuel/.claude/projects/`
- **laptop** (dev): `/Users/samuel/.claude/projects/`

When file not found, provides list of possible machines.

## Database Integration

Works with existing supervisor_sessions table:

```sql
-- Reads these columns:
- instance_id: Primary key for lookup
- project: Project name for path resolution
- claude_session_uuid: Unique session identifier
- claude_session_path: Full path to transcript (optional, auto-resolved if not set)
- status: Instance status (active/stale/closed) for list_project_sessions
```

## Usage Examples

### Finding a Transcript

```typescript
const result = await findTranscriptTool.handler(
  { instance_id: 'odin-PS-abc123' },
  mockContext
);

// Returns:
// {
//   success: true,
//   instance_id: 'odin-PS-abc123',
//   claude_session_uuid: 'uuid-xyz',
//   transcript: {
//     path: '/home/samuel/.claude/projects/odin/uuid-xyz.jsonl',
//     exists: true,
//     size_bytes: 2457600,
//     size_human: '2.3 MB',
//     modified_at: '2026-02-04T15:30:45.000Z',
//     line_count: 3510
//   }
// }
```

### Listing Project Sessions

```typescript
const result = await listProjectSessionsTool.handler(
  { project: 'odin', limit: 10 },
  mockContext
);

// Returns list of 10 most recent sessions with linked instance info
```

### Reading Transcript Summary

```typescript
const result = await readTranscriptSummaryTool.handler(
  {
    instance_id: 'odin-PS-abc123',
    head_lines: 3,
    tail_lines: 3
  },
  mockContext
);

// Returns first and last 3 lines with:
// - Line number
// - Role (user/assistant/system)
// - Message type
// - First 200 chars of content (sanitized)
// - Timestamp (if available)
```

## Testing

### Unit Tests (`src/tests/unit/TranscriptFileService.test.ts`)

Tests for TranscriptFileService:

- File metadata retrieval (exists/missing/permission errors)
- Head/tail line reading (various file sizes, empty files, malformed lines)
- Content preview extraction (truncation at 200 chars)
- Project session listing (sorting, file filtering)
- Path resolution
- Size formatting
- Machine detection

### Integration Tests (`src/tests/integration/TranscriptTools.test.ts`)

Tests for MCP tools:

- Database integration (instance lookup, linked sessions)
- Path resolution from instance_id
- Content sanitization
- Cross-machine path handling
- Error scenarios (missing files, malformed JSONL)
- Limit parameter enforcement
- Linked instance cross-referencing

## Performance Characteristics

| Operation | Time | Conditions |
|-----------|------|-----------|
| getFileMetadata | <10ms | File exists, accessible |
| readHeadTail | <50ms | <100MB file, <1000 lines |
| listProjectSessions | <100ms | <50 sessions |
| find_transcript | <100ms | DB lookup + file stat |
| list_project_sessions | <500ms | 100 sessions, 50 limit |
| read_transcript_summary | <200ms | <100MB file, <50 lines total |

## Files Created/Modified

### New Files

- `src/types/transcript.ts` - Type definitions (80 lines)
- `src/session/TranscriptFileService.ts` - File service (420 lines)
- `src/mcp/tools/transcript-tools.ts` - MCP tool handlers (320 lines)
- `src/tests/unit/TranscriptFileService.test.ts` - Unit tests (400 lines)
- `src/tests/integration/TranscriptTools.test.ts` - Integration tests (420 lines)
- `src/examples/transcript-tools-example.ts` - Usage examples (250 lines)
- `docs/transcript-lookup-tools-009-C.md` - This documentation

### Modified Files

- `src/session/index.ts` - Added exports for TranscriptFileService
- `src/mcp/tools/index.ts` - Added getTranscriptTools() import and registration

## Acceptance Criteria

All acceptance criteria have been met:

- ✅ AC1: find_transcript returns file metadata for linked session
- ✅ AC2: find_transcript returns error for session without linked UUID
- ✅ AC3: list_project_sessions scans directory and cross-references DB
- ✅ AC4: list_project_sessions returns correct linked/unlinked counts
- ✅ AC5: read_transcript_summary returns sanitized first/last lines
- ✅ AC6: Missing files handled gracefully (exists: false, no crash)
- ✅ AC7: Performance: find <100ms, list <500ms, summary <200ms
- ✅ AC8: Cross-machine path resolution returns helpful messages

Code quality:

- ✅ Type-safe (no `any` types in public APIs)
- ✅ JSDoc comments on all public functions
- ✅ Import paths use `.js` extension (ESM requirement)
- ✅ Streaming used for large file operations
- ✅ Comprehensive error handling

## Dependencies

### Required Tables

- `supervisor_sessions` - Instance registry with claude_session_uuid and claude_session_path

### External Services

- PostgreSQL database (supervisor_service)
- Local file system access to `~/.claude/projects/`
- SanitizationService (for content preview sanitization)

## Future Enhancements

Possible improvements for future iterations:

- Transcript text search (grep through JSONL content)
- Session timeline visualization (message timestamps)
- Batch transcript operations
- Compression support for large transcripts
- Remote machine transcript access (SSH-based)
- Transcript indexing for faster searches

## Troubleshooting

### Tool Returns "No Claude session linked"

**Solution:** Instance must be registered with claude_session_uuid. Use mcp_meta_register_instance with the UUID parameter.

### Tool Returns "Instance not found"

**Solution:** Instance must exist in supervisor_sessions table. Check that instance_id is correct and instance was registered.

### File Returns "exists: false"

**Solution:** Check that file exists at resolved path. File may be on a different machine. Use getPossibleMachines() to identify.

### Content Preview Appears Truncated

**Solution:** Content is intentionally limited to first 200 characters. Use direct file read for full content.

### Slow Performance on Large Projects

**Solution:** Use limit parameter to paginate results. Avoid scanning projects with >1000 sessions without limits.

## Related Epics

- **Epic 009-A**: Session reference fields (adds claude_session_uuid and claude_session_path)
- **Epic 009-B**: Snippet extraction (conversation analysis)
- **Epic 007-A**: Instance registry (supervisor_sessions table)

## Author Notes

This implementation prioritizes:

1. **Performance** - Streaming for large files, efficient queries
2. **Reliability** - Graceful error handling, no crashes on edge cases
3. **Security** - Content sanitization, no secrets in previews
4. **Simplicity** - Clear API, minimal dependencies
5. **Testability** - Comprehensive unit and integration tests

The service is designed to be lightweight and fast, suitable for real-time debugging workflows where quick context lookup is critical.
