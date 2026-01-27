# EPIC-009: Learning System Integration - Verification Checklist

Use this checklist to verify the learning system implementation.

## Pre-requisites

- [ ] PostgreSQL database is running
- [ ] Migration 005 has been applied (`learnings` table exists)
- [ ] OpenAI API key is available
- [ ] Node.js v20+ and npm are installed

## Installation Verification

### 1. Files Created

Check that all files were created:

```bash
cd /home/samuel/sv/supervisor-service

# Core RAG module
ls -la src/rag/LearningsIndex.ts
ls -la src/rag/LearningWatcher.ts
ls -la src/rag/index.ts
ls -la src/rag/README.md

# MCP tools
ls -la src/mcp/tools/learning-tools.ts

# Scripts
ls -la src/scripts/index-learnings.ts

# Examples
ls -la src/examples/learning-system-example.ts

# Documentation
ls -la EPIC-009-IMPLEMENTATION.md
ls -la EPIC-009-QUICKREF.md
ls -la EPIC-009-SUMMARY.md
```

- [ ] All files exist

### 2. Compilation

Verify TypeScript compilation:

```bash
npm run build
ls -la dist/rag/
ls -la dist/mcp/tools/learning-tools.js
ls -la dist/scripts/index-learnings.js
```

- [ ] Build completes (may have unrelated errors)
- [ ] `dist/rag/` directory exists
- [ ] Learning tools compiled
- [ ] Index script compiled

### 3. Database Schema

Verify migration 005 is applied:

```sql
\c supervisor_service

-- Check tables exist
\dt learnings
\dt learning_applications
\dt search_queries

-- Check functions exist
\df search_learnings
\df increment_learning_usage

-- Check views exist
\dv learning_effectiveness
\dv knowledge_coverage_by_project

-- Check pgvector extension
\dx vector
```

- [ ] All tables exist
- [ ] All functions exist
- [ ] All views exist
- [ ] pgvector extension is enabled

## Functional Verification

### 4. Environment Setup

```bash
# Copy .env.example to .env if needed
cp .env.example .env

# Add your OpenAI API key
echo "OPENAI_API_KEY=sk-..." >> .env

# Verify environment
cat .env | grep OPENAI_API_KEY
```

- [ ] `.env` file exists
- [ ] `OPENAI_API_KEY` is set

### 5. Database Connection

```bash
tsx test-db-connection.ts
```

Expected output:
```
Database connected successfully at: [timestamp]
```

- [ ] Database connection successful

### 6. Index Learnings

```bash
npm run index-learnings
```

Expected output:
```
=== Learning System Indexer ===

Testing database connection...
Database connected successfully at: [timestamp]
Initializing embedding provider...

Indexing learnings from: /home/samuel/sv/docs/supervisor-learnings/learnings

Indexed learning: 001-subagent-context-handoff.md
Indexed learning: 002-github-api-rate-limits.md
...
Indexed learning: 008-use-haiku-for-simple-tasks.md

✓ Successfully indexed 8 learnings

=== Statistics ===
Total learnings: 8
By category:
  scar-integration: 3
  github-integration: 1
  ...
```

- [ ] Indexing completes without errors
- [ ] All learning files are indexed
- [ ] Statistics are displayed

### 7. Verify Database Contents

```sql
-- Check learnings were indexed
SELECT COUNT(*) FROM learnings;
-- Expected: 8 (or number of .md files)

-- View indexed learnings
SELECT id, title, category, impact_level, confidence_score
FROM learnings
ORDER BY created_at DESC;

-- Check embeddings exist
SELECT id, title,
  array_length(embedding, 1) as embedding_dimensions
FROM learnings
LIMIT 1;
-- Expected: embedding_dimensions = 1536
```

- [ ] Learnings table has correct count
- [ ] Embeddings are 1536 dimensions
- [ ] Metadata is populated correctly

### 8. Test Search Functionality

Create test script `test-search.ts`:

```typescript
import { LearningsIndex, OpenAIEmbeddingProvider } from './src/rag/index.js';

const provider = new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY!);
const index = new LearningsIndex(provider);

const results = await index.searchLearnings(
  'SCAR build verification issues',
  { limit: 3 }
);

console.log(`\nFound ${results.length} relevant learnings:\n`);
results.forEach((r, i) => {
  console.log(`${i + 1}. ${r.title}`);
  console.log(`   Similarity: ${r.similarity}`);
  console.log(`   Category: ${r.category}\n`);
});
```

Run:
```bash
tsx test-search.ts
```

- [ ] Search returns results
- [ ] Results have similarity scores
- [ ] Most relevant learning is about SCAR verification

### 9. Test File Watcher

Terminal 1:
```bash
npm run index-learnings:watch
```

Terminal 2:
```bash
# Modify a learning file
echo "\n## Additional Notes\nTest modification" >> /home/samuel/sv/docs/supervisor-learnings/learnings/001-subagent-context-handoff.md

# Wait 2 seconds, then check terminal 1
```

Expected in Terminal 1:
```
[timestamp] ✓ Auto-indexed: /path/to/001-subagent-context-handoff.md -> [uuid]
```

- [ ] File watcher detects changes
- [ ] Auto-indexing triggers
- [ ] No errors occur

Press Ctrl+C in Terminal 1 to stop.

### 10. Test MCP Tools

Check MCP tool registration:

```bash
# View registered tools
tsx -e "import { getAllTools } from './src/mcp/tools/index.js'; console.log(getAllTools().map(t => t.name).filter(n => n.includes('learning')));"
```

Expected output:
```
[
  'search-learnings',
  'index-learning',
  'index-all-learnings',
  'get-learning-stats',
  'track-learning-application',
  'verify-learning',
  'get-learning-by-id'
]
```

- [ ] All 7 learning tools are registered

### 11. Test Learning Application Tracking

```typescript
import { LearningsIndex, OpenAIEmbeddingProvider } from './src/rag/index.js';
import { pool } from './src/db/client.js';

const provider = new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY!);
const index = new LearningsIndex(provider);

// Get a learning ID
const learnings = await pool.query('SELECT id FROM learnings LIMIT 1');
const learningId = learnings.rows[0].id;

// Track application
await index.trackApplication(
  learningId,
  'issue',
  'test-issue-123',
  'Test application',
  'successful',
  'Verification successful'
);

// Verify in database
const apps = await pool.query(
  'SELECT * FROM learning_applications WHERE learning_id = $1',
  [learningId]
);

console.log('Application tracked:', apps.rows[0]);
```

- [ ] Application tracking works
- [ ] Data appears in `learning_applications` table
- [ ] Usage count incremented in `learnings` table

### 12. Test Statistics

```bash
tsx src/examples/learning-system-example.ts stats
```

Expected output:
```
=== Learning System Statistics ===
Total learnings: 8

By category:
  scar-integration: 3
  ...

By impact level:
  critical: 2
  high: 3
  ...

Most used learnings:
  1. [Title] (used X times)
  ...

Effectiveness:
  Average success rate: X%
  Total applications: Y
```

- [ ] Statistics display correctly
- [ ] All categories shown
- [ ] Usage counts accurate

## Performance Verification

### 13. Indexing Performance

```bash
time npm run index-learnings
```

Expected:
- 8 learnings: ~10-20 seconds
- 50 learnings: ~30-60 seconds

- [ ] Indexing completes in reasonable time

### 14. Search Performance

Add timing to search script:

```typescript
const start = Date.now();
const results = await index.searchLearnings('query');
const duration = Date.now() - start;
console.log(`Search took ${duration}ms`);
```

Expected: <100ms

- [ ] Search is fast (<100ms)

## Integration Verification

### 15. Example Workflow

```bash
tsx src/examples/learning-system-example.ts
```

- [ ] Example completes without errors
- [ ] All workflow steps execute
- [ ] Output is reasonable

### 16. MCP Server Integration

If MCP server is running:

```bash
# Test search-learnings tool
curl -X POST http://localhost:8080/mcp/tools/search-learnings \
  -H "Content-Type: application/json" \
  -d '{"query": "SCAR verification"}'
```

- [ ] MCP tool responds
- [ ] Results are returned

## Documentation Verification

### 17. Documentation Completeness

Check documentation exists and is comprehensive:

```bash
wc -l EPIC-009-*.md src/rag/README.md
```

- [ ] Implementation guide exists (500+ lines)
- [ ] Quick reference exists
- [ ] Summary exists
- [ ] RAG module README exists

## Cleanup

### 18. Reset Test Data (Optional)

If you need to reset:

```sql
-- Clear learnings
DELETE FROM learning_applications;
DELETE FROM search_queries;
DELETE FROM learnings;
```

Then re-index:
```bash
npm run index-learnings
```

## Final Checklist

- [ ] All files created and compiled
- [ ] Database schema is correct
- [ ] Learnings indexed successfully
- [ ] Search returns relevant results
- [ ] File watcher auto-indexes changes
- [ ] MCP tools are registered
- [ ] Application tracking works
- [ ] Statistics are accurate
- [ ] Performance is acceptable
- [ ] Documentation is complete

## Issues Found

Document any issues encountered:

```
Issue 1: [Description]
Resolution: [How you fixed it]

Issue 2: [Description]
Resolution: [How you fixed it]
```

## Sign-off

- [ ] All verification steps completed
- [ ] All issues resolved or documented
- [ ] System ready for production use

**Verified by:** _______________
**Date:** _______________
**Status:** _______________
