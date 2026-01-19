# EPIC-009: Learning System - Quick Reference

## TL;DR

RAG-based learning system for supervisor-service. Automatically searches past learnings to avoid repeating mistakes.

## Quick Start

### 1. Setup

Add to `.env`:
```bash
OPENAI_API_KEY=your_key_here
```

### 2. Index Learnings

```bash
cd /home/samuel/sv/supervisor-service
npm run index-learnings
```

### 3. Use in Supervisor

Via MCP tools:
```typescript
// Search for relevant learnings
const results = await mcp.call('search-learnings', {
  query: 'SCAR build verification issues',
  category: 'scar-integration',
  limit: 5
});

// Track application
await mcp.call('track-learning-application', {
  learning_id: 'uuid',
  applied_to_type: 'issue',
  applied_to_id: 'issue-142',
  outcome: 'successful'
});

// Get stats
const stats = await mcp.call('get-learning-stats', {});
```

## MCP Tools (7 total)

1. **search-learnings** - Find relevant learnings by semantic similarity
2. **index-learning** - Index a specific file
3. **index-all-learnings** - Batch index all files
4. **get-learning-stats** - Usage and effectiveness metrics
5. **track-learning-application** - Record when learning is applied
6. **verify-learning** - Mark learning as verified
7. **get-learning-by-id** - Get full learning details

## File Watcher

Auto-index on file changes:
```bash
npm run index-learnings:watch
```

## API Usage

```typescript
import { LearningsIndex, OpenAIEmbeddingProvider } from './rag/index.js';

const provider = new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY);
const index = new LearningsIndex(provider);

// Search
const results = await index.searchLearnings('query', {
  category: 'scar-integration',
  limit: 5
});

// Track
await index.trackApplication(
  learningId,
  'issue',
  issueId,
  'context',
  'successful'
);

// Stats
const stats = await index.getStats();
```

## Supervisor Workflow

**Before planning:**
1. Search for relevant learnings
2. Include in planning prompt
3. Create plan avoiding past mistakes

**After completion:**
1. Track which learnings were applied
2. Record outcome (success/failure)
3. Provide feedback

## Files

- **Core:** `src/rag/LearningsIndex.ts`
- **Watcher:** `src/rag/LearningWatcher.ts`
- **Tools:** `src/mcp/tools/learning-tools.ts`
- **Script:** `src/scripts/index-learnings.ts`
- **Example:** `src/examples/learning-system-example.ts`

## Database

Tables:
- `learnings` - Indexed learning documents
- `learning_applications` - Application tracking
- `search_queries` - Query analytics

Functions:
- `search_learnings()` - Vector similarity search
- `increment_learning_usage()` - Update counters

Views:
- `learning_effectiveness` - Success rates
- `knowledge_coverage_by_project` - Coverage stats

## Learning File Format

```markdown
# Learning 001: Title

**Date:** 2026-01-18
**Severity:** CRITICAL
**Category:** category-name
**Tags:** tag1, tag2

## Problem
...

## Solution
...

## Verification Checklist
- [ ] Step 1
```

## Performance

- Embedding: ~100ms per learning
- Search: <50ms
- Indexing 50 learnings: ~30 seconds

## Documentation

- Full docs: `EPIC-009-IMPLEMENTATION.md`
- Module README: `src/rag/README.md`
- Examples: `src/examples/learning-system-example.ts`
