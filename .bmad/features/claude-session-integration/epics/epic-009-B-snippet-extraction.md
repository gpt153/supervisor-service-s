---
epic_id: claude-session-integration-009-B
parent_feature: claude-session-integration
status: pending
complexity: 3
created: 2026-02-04
started: null
completed: null
assigned_to: null
source: prd
---

# Epic 009-B: Conversation Snippet Extraction

**Feature**: Claude Code Session Reference Integration - Enrichment Phase
**Epic ID**: claude-session-integration-009-B
**Status**: Pending
**Complexity**: 3 (Medium-High)
**Created**: 2026-02-04
**Effort**: 30 hours
**Dependencies**: Epic 009-A (session reference fields)
**Source**: PRD (claude-session-integration)

---

## Quick Reference

**Purpose**: Create a system for extracting and storing targeted 2-5KB conversation snippets from Claude Code transcripts. Three snippet types: error_reasoning, decision_rationale, learning_pattern.

**Key Deliverable**: `conversation_snippets` table with MCP tools for extraction and querying, enabling pattern analysis at 99.5% storage reduction vs full transcripts.

**Critical Success Factor**: Snippet extraction completes in <500ms, queries complete in <50ms, and snippets are genuinely useful for debugging and pattern analysis.

---

## Project Context

- **Project**: Supervisor Service (Meta)
- **Repository**: `/home/samuel/sv/supervisor-service-s/`
- **Tech Stack**: Node.js 20+, TypeScript 5.3+, PostgreSQL 14+, MCP
- **Parent Feature**: claude-session-integration
- **Depends On**: Epic 009-A (claude_session_uuid and claude_session_path in supervisor_sessions)
- **Parallel With**: Epic 009-C (transcript lookup tools)

---

## Business Context

### Problem Statement

Claude Code session transcripts average 1.1MB each, far too large to store in PostgreSQL. But they contain high-value contextual information that structured events lack: why errors occurred, why certain approaches were chosen, and reusable patterns. Currently, this knowledge is lost once the session ends and the transcript rotates.

### User Value

- **Error debugging**: Extract the reasoning chain that led to and resolved errors
- **Decision audit**: Capture why a particular approach was chosen over alternatives
- **Pattern library**: Build a searchable collection of successful implementation patterns
- **Future ML**: Structured snippets enable training on successful vs unsuccessful patterns
- **99.5% storage reduction**: 2-5KB snippets vs 1.1MB full transcripts

---

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**

- [ ] AC1: Database migration creates `conversation_snippets` table
  ```sql
  CREATE TABLE conversation_snippets (
    snippet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id VARCHAR(32) REFERENCES supervisor_sessions(instance_id) ON DELETE CASCADE,
    event_id UUID REFERENCES event_store(event_id) ON DELETE SET NULL,
    snippet_type VARCHAR(32) NOT NULL
      CHECK (snippet_type IN ('error_reasoning', 'decision_rationale', 'learning_pattern')),
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
  - Indexes on: (instance_id, snippet_type), (snippet_type, created_at), (created_at DESC)
  - Content length check: 100 bytes to 10KB
  - Migration is idempotent and reversible

- [ ] AC2: Snippet extraction service (`src/session/SnippetExtractor.ts`)
  - Reads Claude Code JSONL transcript file
  - Accepts line range (start_line, end_line) or message range (start_turn, end_turn)
  - Extracts specified section and formats as snippet
  - Sanitizes content (removes secrets using existing SanitizationService)
  - Validates content size (100 bytes - 10KB)
  - Returns structured snippet with metadata

- [ ] AC3: MCP tool `mcp_meta_extract_snippet`
  - Input schema:
    ```typescript
    {
      instance_id: string,            // Required: supervisor instance
      snippet_type: string,           // Required: 'error_reasoning' | 'decision_rationale' | 'learning_pattern'
      title: string,                  // Required: descriptive title (max 256 chars)
      content: string,                // Required: the snippet content (100 bytes - 10KB)
      event_id?: string,              // Optional: link to specific event
      source_line_start?: number,     // Optional: line range in transcript
      source_line_end?: number,       // Optional: line range in transcript
      tags?: string[],                // Optional: categorization tags
      metadata?: object               // Optional: additional context
    }
    ```
  - Output: { success, snippet_id, instance_id, snippet_type, title, created_at }
  - Validates instance_id exists (via supervisor_sessions)
  - Validates event_id exists (via event_store) if provided
  - Sanitizes content before storage
  - Performance: <500ms

- [ ] AC4: MCP tool `mcp_meta_query_snippets`
  - Input schema:
    ```typescript
    {
      instance_id?: string,           // Optional: filter by instance
      snippet_type?: string,          // Optional: filter by type
      project?: string,               // Optional: filter by project (via supervisor_sessions JOIN)
      tags?: string[],                // Optional: filter by tags (array containment)
      keyword?: string,               // Optional: text search in title and content
      start_date?: string,            // Optional: ISO 8601 start date
      end_date?: string,              // Optional: ISO 8601 end date
      limit?: number,                 // Optional: max results (default 50, max 500)
      offset?: number                 // Optional: pagination offset
    }
    ```
  - Output: { success, snippets: [...], total_count, has_more }
  - Supports combination of filters
  - Sorted by created_at DESC
  - Performance: <50ms

**SHOULD HAVE:**

- [ ] AC5: Snippet type definitions with descriptions
  - `error_reasoning`: Why an error occurred, what was tried, how it was resolved
  - `decision_rationale`: Why a particular approach was chosen, what alternatives existed
  - `learning_pattern`: Reusable pattern or technique discovered during implementation

- [ ] AC6: Content validation and enrichment
  - Auto-detect snippet type from content keywords (optional hint for users)
  - Word count and estimated read time in metadata
  - Link back to claude_session_uuid if available

**COULD HAVE:**

- [ ] Automatic snippet extraction triggered by event types (error, decision, learning)
- [ ] Snippet deduplication (detect similar content)

**WON'T HAVE (this iteration):**

- ML training pipeline
- Full-text search index (GIN)
- Snippet versioning

---

## Architecture

### Technical Approach

**Database:**
- New `conversation_snippets` table (see AC1)
- FK to `supervisor_sessions` (ON DELETE CASCADE)
- FK to `event_store` (ON DELETE SET NULL, nullable)
- JSONB columns for tags and metadata

**Service Layer:**
- `SnippetExtractor.ts`: Core extraction logic
  - Reads JSONL file streaming (for large files)
  - Extracts line ranges or message ranges
  - Sanitizes content
  - Validates size constraints
- `SnippetStore.ts`: Database operations
  - Insert snippet
  - Query with filters
  - Count by type

**MCP Tools:**
- `mcp_meta_extract_snippet`: Store a new snippet
- `mcp_meta_query_snippets`: Search and filter snippets

### Data Model

```
conversation_snippets
+---------------------+
| snippet_id (UUID)   |  <-- PK
| instance_id (FK)    |  --> supervisor_sessions
| event_id (FK, null) |  --> event_store
| snippet_type        |  'error_reasoning' | 'decision_rationale' | 'learning_pattern'
| title               |  Max 256 chars
| content             |  100 bytes - 10KB
| source_file         |  Path to source transcript
| source_line_start   |  Line range start
| source_line_end     |  Line range end
| tags (JSONB)        |  ['deployment', 'auth', ...]
| metadata (JSONB)    |  { word_count, epic_id, ... }
| created_at          |
| updated_at          |
+---------------------+
```

---

## Implementation Notes

### Task Breakdown

**Task 1: Database Migration (3 hours)**

Create migration file: `migrations/{timestamp}_conversation_snippets.sql`

Full SQL as specified in AC1, plus:
- Index: `idx_snippets_instance_type ON conversation_snippets(instance_id, snippet_type)`
- Index: `idx_snippets_type_created ON conversation_snippets(snippet_type, created_at DESC)`
- Index: `idx_snippets_created ON conversation_snippets(created_at DESC)`
- Content length constraint: `CHECK (LENGTH(content) >= 100 AND LENGTH(content) <= 10240)`
- Auto-update trigger for `updated_at`

- File: `/home/samuel/sv/supervisor-service-s/migrations/{next_timestamp}_conversation_snippets.sql`
- Verify: Migration runs on odin3
- Verify: Rollback works

**Task 2: Type Definitions (3 hours)**

Create `src/types/snippet.ts`:

```typescript
export enum SnippetType {
  ERROR_REASONING = 'error_reasoning',
  DECISION_RATIONALE = 'decision_rationale',
  LEARNING_PATTERN = 'learning_pattern',
}

export interface Snippet {
  snippet_id: string;
  instance_id: string;
  event_id?: string;
  snippet_type: SnippetType;
  title: string;
  content: string;
  source_file?: string;
  source_line_start?: number;
  source_line_end?: number;
  tags: string[];
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ExtractSnippetInput {
  instance_id: string;
  snippet_type: SnippetType;
  title: string;
  content: string;
  event_id?: string;
  source_line_start?: number;
  source_line_end?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface QuerySnippetsInput {
  instance_id?: string;
  snippet_type?: SnippetType;
  project?: string;
  tags?: string[];
  keyword?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface QuerySnippetsOutput {
  snippets: Snippet[];
  total_count: number;
  has_more: boolean;
}
```

Include Zod validation schemas for inputs.

**Task 3: Snippet Store Service (6 hours)**

Create `src/session/SnippetStore.ts`:

```typescript
/**
 * Database operations for conversation snippets
 */
export class SnippetStore {
  /**
   * Insert a new snippet
   */
  async insertSnippet(input: ExtractSnippetInput): Promise<Snippet>

  /**
   * Query snippets with filters
   */
  async querySnippets(input: QuerySnippetsInput): Promise<QuerySnippetsOutput>

  /**
   * Count snippets by type for an instance
   */
  async countByType(instanceId: string): Promise<Record<SnippetType, number>>

  /**
   * Delete snippets older than retention days
   */
  async cleanupOldSnippets(retentionDays: number): Promise<{ deleted: number }>
}
```

- Uses `pool` from `../db/client.js`
- Parameterized queries for all inputs
- Content sanitized using existing `SanitizationService` from `src/session/SanitizationService.ts`
- Validates instance_id exists via `supervisor_sessions` lookup
- Validates event_id exists via `event_store` lookup (if provided)
- Returns structured results

**Task 4: Snippet Extractor Service (4 hours)**

Create `src/session/SnippetExtractor.ts`:

```typescript
/**
 * Extract snippets from Claude Code JSONL transcript files
 */
export class SnippetExtractor {
  /**
   * Read a section of a JSONL transcript file
   * Uses streaming to avoid loading full file into memory
   *
   * @param filePath Path to .jsonl file
   * @param startLine Starting line number (1-indexed)
   * @param endLine Ending line number (1-indexed)
   * @returns Array of parsed JSONL records
   */
  async readSection(filePath: string, startLine: number, endLine: number): Promise<any[]>

  /**
   * Extract and format a snippet from a transcript
   * Combines multiple conversation turns into a coherent snippet
   *
   * @param filePath Path to .jsonl file
   * @param startLine Start line
   * @param endLine End line
   * @param snippetType Type classification
   * @returns Formatted snippet content string
   */
  async extractFormatted(
    filePath: string,
    startLine: number,
    endLine: number,
    snippetType: SnippetType
  ): Promise<string>
}
```

- Uses `readline` interface for streaming JSONL parsing
- Handles malformed lines gracefully (skip with warning)
- Validates file exists before reading
- Content size validation (100 bytes - 10KB)

**Task 5: MCP Tools (8 hours)**

Add to `src/mcp/tools/session-tools.ts` (or create `src/mcp/tools/snippet-tools.ts`):

`mcp_meta_extract_snippet`:
- Validate input with Zod schema
- Validate instance_id exists
- Validate event_id exists (if provided)
- Sanitize content
- Call SnippetStore.insertSnippet
- Return snippet_id, type, title, created_at

`mcp_meta_query_snippets`:
- Validate input with Zod schema
- Call SnippetStore.querySnippets
- Return snippets array with pagination

Register tools in `getSessionTools()` or create new `getSnippetTools()` function.

**Task 6: Unit Tests (6 hours)**

Tests for SnippetStore:
- [ ] Insert snippet with all fields
- [ ] Insert snippet with minimal fields
- [ ] Reject snippet with content too short (<100 bytes)
- [ ] Reject snippet with content too long (>10KB)
- [ ] Query by instance_id
- [ ] Query by snippet_type
- [ ] Query by tags (array containment)
- [ ] Query by keyword (title + content search)
- [ ] Query by date range
- [ ] Pagination (limit + offset)
- [ ] Cleanup old snippets

Tests for SnippetExtractor:
- [ ] Read section from valid JSONL file
- [ ] Handle non-existent file gracefully
- [ ] Handle malformed JSONL lines
- [ ] Validate content size constraints

Tests for MCP tools:
- [ ] extract_snippet validates required fields
- [ ] extract_snippet rejects invalid snippet_type
- [ ] extract_snippet stores and returns snippet_id
- [ ] query_snippets returns filtered results
- [ ] query_snippets handles empty results

### Estimated Effort

- Task 1 (Database): 3 hours
- Task 2 (Types): 3 hours
- Task 3 (SnippetStore): 6 hours
- Task 4 (SnippetExtractor): 4 hours
- Task 5 (MCP Tools): 8 hours
- Task 6 (Tests): 6 hours
- **Total**: 30 hours

---

## Acceptance Criteria

**Feature-Level Acceptance:**

- [ ] AC1: `conversation_snippets` table created with all indexes
- [ ] AC2: Snippet extraction stores content correctly
- [ ] AC3: All three snippet types accepted and validated
- [ ] AC4: Content sanitized before storage (no secrets)
- [ ] AC5: Query with filters returns correct results
- [ ] AC6: Snippet extraction <500ms
- [ ] AC7: Snippet query <50ms
- [ ] AC8: Content size constraints enforced (100 bytes - 10KB)
- [ ] AC9: FK validation (instance_id must exist)

**Code Quality:**

- [ ] Type-safe (no `any` types in new code)
- [ ] JSDoc comments on all public functions
- [ ] Import paths use `.js` extension
- [ ] Follows existing patterns in session module

---

## Dependencies

**Blocked By:**
- Epic 009-A: Session reference fields (needs instance_id in supervisor_sessions)

**Blocks:**
- None

**External Dependencies:**
- Claude Code JSONL format (for transcript reading in SnippetExtractor)
- Existing SanitizationService (for content sanitization)

---

## Files Modified/Created

| File | Action | Description |
|------|--------|-------------|
| `migrations/{ts}_conversation_snippets.sql` | Create | Database migration |
| `src/types/snippet.ts` | Create | Snippet type definitions and Zod schemas |
| `src/session/SnippetStore.ts` | Create | Database operations for snippets |
| `src/session/SnippetExtractor.ts` | Create | JSONL transcript reading and extraction |
| `src/session/index.ts` | Modify | Export new modules |
| `src/mcp/tools/snippet-tools.ts` | Create | MCP tools for snippet operations |
| `src/mcp/tools/index.ts` | Modify | Register snippet tools |

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **JSONL format varies** | Medium | Medium | Parse defensively; skip malformed lines; log warnings |
| **Large transcripts slow extraction** | Low | Medium | Stream parsing; line-range extraction avoids full read |
| **Content too noisy** | Medium | Low | Sanitization removes secrets; size constraints limit noise |
| **FK constraint failures** | Low | Medium | Validate instance_id and event_id before INSERT |

---

**Specification Version**: 1.0
**Last Updated**: 2026-02-04
**Maintained by**: Meta-Supervisor (MS)
**Status**: Ready for Implementation (after 009-A)
