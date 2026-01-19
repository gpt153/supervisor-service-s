# Database Schema Documentation

## Overview

The supervisor-service uses PostgreSQL as its primary database with several extensions:
- **uuid-ossp**: UUID generation
- **pgcrypto**: Encryption functions for secrets management
- **pgvector**: Vector similarity search for RAG/knowledge management

## Migration Files

All migrations are located in `/home/samuel/sv/supervisor-service/migrations/`:

1. `001_initial_schema.sql` - Core tables (projects, epics, issues, tasks, service_status, comments)
2. `002_secrets_management.sql` - Encrypted secrets storage and rotation
3. `003_port_allocation.sql` - Dynamic port allocation and health monitoring
4. `004_task_timing.sql` - Task execution tracking and estimation learning
5. `005_learnings_index.sql` - RAG-based knowledge management with vector search

## Schema Details

### Migration 001: Initial Schema

#### Tables

**projects**
- Core table for supervised projects
- Fields: id, name, path, description, status, metadata, created_at, updated_at
- Indexes: name, status

**epics**
- Epic-level planning and tracking
- Fields: id, project_id, epic_id, title, description, status, priority, estimated_hours, actual_hours, complexity, dependencies, metadata, created_at, updated_at, completed_at
- Indexes: project_id, epic_id, status, priority
- Foreign Keys: project_id → projects(id)

**issues**
- GitHub-style issue tracking
- Fields: id, project_id, epic_id, issue_number, title, description, status, priority, labels, assignee, github_id, github_url, metadata, created_at, updated_at, closed_at
- Indexes: project_id, epic_id, status, priority, github_id, labels (GIN)
- Foreign Keys: project_id → projects(id), epic_id → epics(id)

**tasks**
- Granular task tracking
- Fields: id, project_id, epic_id, issue_id, title, description, status, order_index, estimated_minutes, actual_minutes, metadata, created_at, updated_at, completed_at
- Indexes: project_id, epic_id, issue_id, status, order_index
- Foreign Keys: project_id → projects(id), epic_id → epics(id), issue_id → issues(id)

**service_status**
- Service health monitoring
- Fields: id, project_id, service_name, status, last_check, response_time_ms, error_message, metadata, created_at, updated_at
- Indexes: project_id, status, last_check
- Foreign Keys: project_id → projects(id)

**comments**
- Comments on issues and tasks
- Fields: id, issue_id, task_id, author, content, github_id, metadata, created_at, updated_at
- Indexes: issue_id, task_id, created_at
- Foreign Keys: issue_id → issues(id), task_id → tasks(id)

### Migration 002: Secrets Management

#### Tables

**encryption_keys**
- Master encryption key management
- Fields: id, key_name, encrypted_key, algorithm, is_active, rotation_count, last_rotated_at, created_at, updated_at
- Indexes: is_active

**secrets**
- Encrypted secret storage
- Fields: id, project_id, key_name, encrypted_value, encryption_key_id, secret_type, description, metadata, last_accessed_at, access_count, expires_at, created_at, updated_at
- Indexes: project_id, key_name, encryption_key_id, secret_type, expires_at
- Foreign Keys: project_id → projects(id), encryption_key_id → encryption_keys(id)

**secret_access_log**
- Audit trail for secret access
- Fields: id, secret_id, accessed_by, access_type, success, error_message, ip_address, metadata, accessed_at
- Indexes: secret_id, accessed_by, accessed_at, success
- Foreign Keys: secret_id → secrets(id)

**secret_rotation_schedule**
- Automatic secret rotation policies
- Fields: id, secret_id, rotation_interval_days, last_rotation_at, next_rotation_at, auto_rotate, notification_days, metadata, created_at, updated_at
- Indexes: next_rotation_at, auto_rotate
- Foreign Keys: secret_id → secrets(id)

**secret_templates**
- Predefined templates for common secret types
- Fields: id, template_name, secret_type, description, validation_pattern, rotation_interval_days, metadata, created_at, updated_at

#### Views

**secrets_expiring_soon**
- Lists secrets expiring within 30 days
- Fields: id, project_id, key_name, secret_type, expires_at, time_until_expiry, project_name

**secrets_needing_rotation**
- Lists secrets due for rotation within 7 days
- Fields: id, project_id, key_name, secret_type, next_rotation_at, time_until_rotation, auto_rotate, project_name

### Migration 003: Port Allocation

#### Tables

**port_ranges**
- Defines allocatable port ranges
- Fields: id, range_name, start_port, end_port, description, is_active, metadata, created_at, updated_at
- Indexes: is_active, (start_port, end_port)

**port_allocations**
- Tracks allocated ports
- Fields: id, project_id, port_range_id, port_number, service_name, service_type, status, process_id, hostname, protocol, metadata, allocated_at, last_used_at, released_at, created_at, updated_at
- Indexes: project_id, port_number, service_name, status, hostname
- Unique: (port_number, hostname, protocol)
- Foreign Keys: project_id → projects(id), port_range_id → port_ranges(id)

**port_health_checks**
- Port health monitoring
- Fields: id, port_allocation_id, check_type, status, response_time_ms, error_message, metadata, checked_at
- Indexes: port_allocation_id, status, checked_at
- Foreign Keys: port_allocation_id → port_allocations(id)

**port_reservations**
- Pre-reserve ports for future use
- Fields: id, project_id, port_range_id, port_number, service_name, reserved_by, expires_at, metadata, created_at, updated_at
- Indexes: project_id, port_number, expires_at
- Foreign Keys: project_id → projects(id), port_range_id → port_ranges(id)

#### Functions

**find_available_port(range_id, hostname, protocol)**
- Returns next available port in range

**allocate_port(project_id, range_id, service_name, service_type, hostname, protocol)**
- Allocates a port and returns port number

**release_port(port_number, hostname)**
- Releases an allocated port

**cleanup_expired_reservations()**
- Removes expired port reservations

#### Views

**port_range_utilization**
- Port usage statistics by range
- Fields: range_id, range_name, start_port, end_port, total_ports, allocated_ports, released_ports, reserved_ports, utilization_percent

**active_port_allocations**
- Currently active port allocations with project info
- Fields: id, port_number, service_name, service_type, status, hostname, protocol, allocated_at, last_used_at, project_name, range_name

### Migration 004: Task Timing

#### Tables

**task_executions**
- Tracks individual task execution attempts
- Fields: id, task_id, project_id, execution_number, started_at, completed_at, duration_minutes, estimated_minutes, variance_minutes, variance_percent, status, complexity, context_switches, interruptions, blockers, notes, metadata, created_at, updated_at
- Indexes: task_id, project_id, status, started_at, complexity
- Foreign Keys: task_id → tasks(id), project_id → projects(id)

**estimation_patterns**
- Learned patterns for better estimates
- Fields: id, project_id, pattern_name, task_type, complexity, avg_duration_minutes, std_deviation, sample_count, confidence_score, factors, metadata, created_at, updated_at
- Indexes: project_id, task_type, complexity, confidence_score
- Unique: (project_id, pattern_name, task_type, complexity)
- Foreign Keys: project_id → projects(id)

**time_tracking_sessions**
- Detailed time tracking with pause/resume
- Fields: id, task_execution_id, session_number, started_at, ended_at, duration_minutes, activity_type, productivity_rating, notes, metadata, created_at, updated_at
- Indexes: task_execution_id, activity_type, started_at
- Foreign Keys: task_execution_id → task_executions(id)

**estimation_factors**
- Factors that influence estimation accuracy
- Fields: id, factor_name, description, impact_type, average_impact, metadata, created_at, updated_at

**task_execution_factors**
- Links executions to factors
- Fields: id, task_execution_id, factor_id, factor_value, notes, created_at
- Indexes: task_execution_id, factor_id
- Unique: (task_execution_id, factor_id)
- Foreign Keys: task_execution_id → task_executions(id), factor_id → estimation_factors(id)

#### Functions

**calculate_execution_metrics()**
- Auto-calculates duration and variance (trigger)

**update_estimation_pattern(project_id, task_type, complexity, duration_minutes)**
- Updates or creates estimation patterns

**get_recommended_estimate(project_id, task_type, complexity)**
- Returns recommended estimate based on historical data

#### Views

**estimation_accuracy_by_project**
- Estimation accuracy statistics per project
- Fields: project_id, project_name, total_executions, avg_variance_percent, stddev_variance_percent, within_10_percent, within_25_percent, over_estimated, under_estimated

**task_performance_trends**
- Performance trends for tasks with multiple executions
- Fields: task_id, task_title, project_id, execution_count, avg_duration, min_duration, max_duration, avg_variance_percent, total_context_switches, total_interruptions

### Migration 005: Learnings Index (RAG)

#### Tables

**knowledge_sources**
- Tracks sources of knowledge
- Fields: id, project_id, source_type, source_id, title, url, file_path, author, metadata, created_at, updated_at, indexed_at
- Indexes: project_id, source_type, source_id
- Foreign Keys: project_id → projects(id)

**knowledge_chunks**
- Chunked text with embeddings for semantic search
- Fields: id, source_id, project_id, chunk_index, content, content_hash, embedding (vector 1536), token_count, metadata, created_at, updated_at
- Indexes: source_id, project_id, content_hash, embedding (HNSW)
- Foreign Keys: source_id → knowledge_sources(id), project_id → projects(id)

**learnings**
- Extracted insights and best practices
- Fields: id, project_id, title, content, learning_type, category, confidence_score, impact_level, source_chunks, tags, embedding (vector 1536), verified, verified_by, verified_at, usage_count, last_used_at, metadata, created_at, updated_at
- Indexes: project_id, learning_type, category, confidence_score, impact_level, tags (GIN), verified, embedding (HNSW)
- Foreign Keys: project_id → projects(id)

**learning_applications**
- Tracks when/where learnings are applied
- Fields: id, learning_id, applied_to_type, applied_to_id, context, outcome, feedback, created_at
- Indexes: learning_id, outcome
- Foreign Keys: learning_id → learnings(id)

**search_queries**
- Logs user queries for analytics
- Fields: id, project_id, query_text, query_embedding (vector 1536), search_type, result_count, top_result_id, top_result_similarity, filters, user_feedback, metadata, created_at
- Indexes: project_id, created_at, user_feedback
- Foreign Keys: project_id → projects(id), top_result_id → knowledge_chunks(id)

#### Functions

**search_knowledge_chunks(query_embedding, project_id, limit, min_similarity)**
- Semantic search for knowledge chunks
- Returns: chunk_id, source_id, content, similarity, metadata

**search_learnings(query_embedding, project_id, category, limit, min_similarity)**
- Semantic search for learnings
- Returns: learning_id, title, content, learning_type, category, similarity, confidence_score

**find_similar_learnings(embedding, project_id, similarity_threshold)**
- Find duplicate/similar learnings
- Returns: learning_id, title, similarity

**increment_learning_usage(learning_id)**
- Increments usage count and updates last_used_at

#### Views

**learning_effectiveness**
- Effectiveness metrics for learnings
- Fields: id, title, learning_type, category, confidence_score, usage_count, application_count, successful_applications, failed_applications, success_rate_percent

**knowledge_coverage_by_project**
- Knowledge coverage statistics per project
- Fields: project_id, project_name, source_count, chunk_count, learning_count, total_tokens, source_type_count, source_types

**popular_search_queries**
- Most common search queries
- Fields: project_id, query_text, query_count, avg_results, helpful_count, not_helpful_count, last_queried

## Running Migrations

### Apply all migrations
```bash
npm run migrate:up
```

### Rollback last migration
```bash
npm run migrate:down
```

### Create new migration
```bash
npm run migrate:create <migration-name>
```

## Seeding Development Data

```bash
npm run db:seed
```

This will populate:
- Sample projects (consilio, odin, openhorizon, health-agent)
- Port ranges for different service types
- Epics, issues, and tasks
- Estimation factors
- Secret templates

## Database Connection

Configure via environment variables in `.env`:

```bash
DATABASE_URL=postgresql://supervisor:supervisor@localhost:5432/supervisor_service
PGHOST=localhost
PGPORT=5432
PGUSER=supervisor
PGPASSWORD=supervisor
PGDATABASE=supervisor_service
```

## TypeScript Types

All database types are defined in `/home/samuel/sv/supervisor-service/src/types/database.ts`

Import types:
```typescript
import type { Project, Epic, Issue, Task } from '../types/database.js';
```

## Query Helpers

Common query functions in `/home/samuel/sv/supervisor-service/src/db/queries.ts`

Example usage:
```typescript
import { createProject, getProjectByName } from '../db/queries.js';

const project = await createProject({
  name: 'my-project',
  path: '/path/to/project',
  description: 'My awesome project'
});
```

## Best Practices

1. **Always use migrations** - Never modify the schema directly
2. **Use transactions** - For multi-step operations, use the `transaction()` helper
3. **Index appropriately** - All foreign keys and frequently queried fields are indexed
4. **Use prepared statements** - All queries use parameterized queries to prevent SQL injection
5. **Monitor performance** - The `query()` function logs execution time
6. **Handle errors** - All query functions throw errors that should be caught
7. **Use views** - For complex queries, use database views for consistency
8. **Vector search** - Use cosine similarity for vector embeddings (pgvector)
9. **Encryption** - Use pgcrypto functions for encrypting sensitive data
10. **Audit trails** - Secret access and learning applications are automatically logged
