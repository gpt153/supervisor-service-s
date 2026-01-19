# Learning System - RAG Integration

This module implements the Learning System Integration (EPIC-009) for the supervisor-service.

## Overview

The learning system provides:
- **Semantic search** over learning files using pgvector
- **Automatic indexing** via file watcher
- **Learning impact tracking** to measure effectiveness
- **MCP tools** for supervisor integration

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Learning System                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌─────────────┐     ┌─────────────┐│
│  │   .md files  │─────>│ LearningsIndex│────>│  PostgreSQL ││
│  │  (Git-versioned) │   │ (Indexer)   │     │  + pgvector ││
│  └──────────────┘      └─────────────┘     └─────────────┘│
│         │                     │                    │        │
│         │                     v                    │        │
│         │            ┌─────────────┐               │        │
│         └───────────>│ LearningWatcher│<──────────┘        │
│                      │ (Auto-index)  │                     │
│                      └─────────────┘                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              MCP Tools (supervisor access)           │  │
│  │  - search-learnings                                  │  │
│  │  - index-learning                                    │  │
│  │  - track-learning-application                        │  │
│  │  - get-learning-stats                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### LearningsIndex

Main class for learning management.

**Features:**
- Parse learning markdown files
- Generate embeddings using OpenAI API
- Index learnings to PostgreSQL with pgvector
- Semantic search with cosine similarity
- Track learning applications and effectiveness

**Usage:**
```typescript
import { LearningsIndex, OpenAIEmbeddingProvider } from './rag/index.js';

const provider = new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY);
const index = new LearningsIndex(provider);

// Index all learnings
await index.indexAllLearnings();

// Search for relevant learnings
const results = await index.searchLearnings(
  'SCAR build verification issues',
  { category: 'scar-integration', limit: 5 }
);

// Track application
await index.trackApplication(
  learningId,
  'issue',
  issueId,
  'Applied verification pattern to SCAR workflow',
  'successful'
);
```

### LearningWatcher

File system watcher for automatic indexing.

**Features:**
- Watches learnings directory for changes
- Debounces file events to avoid duplicate indexing
- Automatically indexes new/modified learning files
- Callbacks for success and error handling

**Usage:**
```typescript
import { LearningWatcher } from './rag/index.js';

const watcher = new LearningWatcher(index, {
  onIndexed: (filePath, learningId) => {
    console.log(`Indexed: ${filePath} -> ${learningId}`);
  },
  onError: (error, filePath) => {
    console.error(`Failed to index ${filePath}:`, error);
  }
});

watcher.start();

// Later...
watcher.stop();
```

### MCP Tools

Seven MCP tools exposed for supervisor access:

1. **search-learnings** - Semantic search for relevant learnings
2. **index-learning** - Index a specific learning file
3. **index-all-learnings** - Index all learning files
4. **get-learning-stats** - Get usage and effectiveness statistics
5. **track-learning-application** - Record when a learning is applied
6. **verify-learning** - Mark a learning as verified
7. **get-learning-by-id** - Retrieve full learning details

See `src/mcp/tools/learning-tools.ts` for detailed schemas.

## Database Schema

The system uses tables from migration `1737212400000_learnings_index.sql`:

- **learnings** - Indexed learning documents with embeddings
- **learning_applications** - Tracking where learnings are applied
- **search_queries** - Query analytics
- **knowledge_sources** - Source documents (future use)
- **knowledge_chunks** - Chunked content (future use)

### Vector Search Functions

- `search_learnings(embedding, project_id, category, limit, min_similarity)` - Search learnings by semantic similarity
- `find_similar_learnings(embedding, project_id, threshold)` - Find duplicate learnings
- `increment_learning_usage(learning_id)` - Update usage counter

### Views

- **learning_effectiveness** - Success rates and application counts
- **knowledge_coverage_by_project** - Coverage statistics per project
- **popular_search_queries** - Most common search queries

## Learning File Format

Learning markdown files follow this structure:

```markdown
# Learning 001: Title Here

**Date:** 2026-01-18
**Severity:** CRITICAL | HIGH | MEDIUM | LOW
**Category:** category-name
**Tags:** tag1, tag2, tag3

---

## Problem

Description of the problem...

## Root Cause

Why it happened...

## Solution

How to fix it...

## Verification Checklist

- [ ] Step 1
- [ ] Step 2

## Key Principle

Main takeaway...
```

## Workflow Integration

### Before Task Planning

Supervisors should search for relevant learnings before planning tasks:

```typescript
// In supervisor planning workflow
const taskDescription = "Deploy SCAR agent for issue monitoring";

// Search for relevant learnings
const learnings = await searchLearnings(taskDescription, {
  category: 'scar-integration',
  limit: 5
});

// Include learnings in planning prompt
const planningPrompt = `
Task: ${taskDescription}

RELEVANT PAST LEARNINGS:
${learnings.map(l => l.full_content).join('\n\n---\n\n')}

Based on these learnings, create a plan that avoids past mistakes.
`;
```

### After Task Completion

Track when learnings are applied:

```typescript
await trackLearningApplication(
  learningId,
  'issue',
  issueId,
  'Applied SCAR verification pattern',
  'successful',
  'Build verification caught issues that SCAR missed'
);
```

## Environment Variables

Required:
- `OPENAI_API_KEY` - OpenAI API key for embeddings

Optional:
- Database connection variables (from .env)

## Performance

- **Embedding generation**: ~100ms per learning (OpenAI API)
- **Vector search**: <50ms (with HNSW index)
- **Indexing all learnings**: ~30 seconds for 50 learnings

## Future Enhancements

1. **Local embedding model** - Replace OpenAI with local model
2. **Hybrid search** - Combine semantic + keyword search
3. **Learning suggestions** - Auto-suggest learnings during code review
4. **Learning extraction** - Auto-extract learnings from issue resolutions
5. **Cross-project learnings** - Share learnings across all projects

## Testing

See `src/__tests__/rag/` for unit and integration tests.

## Related Documentation

- EPIC-009 specification: `/home/samuel/sv/.bmad/epics/EPIC-BREAKDOWN.md`
- System design: `/home/samuel/sv/.bmad/system-design/learning-system-and-opus-planning.md`
- Database schema: `/home/samuel/sv/supervisor-service/migrations/1737212400000_learnings_index.sql`
