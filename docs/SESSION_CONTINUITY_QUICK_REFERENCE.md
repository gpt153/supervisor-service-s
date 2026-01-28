# Session Continuity - Quick Reference Guide

## Quick Connection Test

```bash
psql -U supervisor -d supervisor_meta -c "SELECT COUNT(*) FROM supervisor_sessions;"
```

## Session Management

### Start a Session

```sql
INSERT INTO supervisor_sessions (
  instance_id, project, instance_type, status
) VALUES (
  'consilio-PS-abc123', 'consilio-s', 'PS', 'active'
)
RETURNING instance_id, status, created_at;
```

### Update Heartbeat

```sql
UPDATE supervisor_sessions 
SET last_heartbeat = NOW()
WHERE instance_id = 'consilio-PS-abc123';
```

### Mark Session Stale

```sql
UPDATE supervisor_sessions 
SET status = 'stale'
WHERE instance_id = 'consilio-PS-abc123';
```

### Close Session

```sql
UPDATE supervisor_sessions 
SET status = 'closed', closed_at = NOW()
WHERE instance_id = 'consilio-PS-abc123';
```

### Find Stale Sessions

```sql
SELECT instance_id, project, last_heartbeat
FROM supervisor_sessions
WHERE status = 'active'
AND last_heartbeat < NOW() - INTERVAL '30 minutes'
ORDER BY last_heartbeat DESC;
```

## Command Logging

### Log a Command

```sql
INSERT INTO command_log (
  instance_id, command_type, action, tool_name, success, execution_time_ms
) VALUES (
  'consilio-PS-abc123', 'task', 'spawn', 'haiku', true, 1250
)
RETURNING id, action, success;
```

### Get Command History

```sql
SELECT id, command_type, action, success, execution_time_ms, created_at
FROM command_log
WHERE instance_id = 'consilio-PS-abc123'
ORDER BY created_at DESC
LIMIT 20;
```

### Find Failed Commands

```sql
SELECT id, action, error_message, created_at
FROM command_log
WHERE instance_id = 'consilio-PS-abc123'
AND success = false
ORDER BY created_at DESC;
```

## Event Sourcing

### Log an Event

```sql
INSERT INTO event_store (
  instance_id, event_type, sequence_num, event_data
) VALUES (
  'consilio-PS-abc123', 'epic_started', 1, '{"epic_id":"001"}'::jsonb
)
RETURNING event_id, event_type, sequence_num;
```

### Get Event Sequence

```sql
SELECT sequence_num, event_type, event_data, created_at
FROM event_store
WHERE instance_id = 'consilio-PS-abc123'
ORDER BY sequence_num;
```

### Get Recent Events

```sql
SELECT sequence_num, event_type, timestamp
FROM event_store
WHERE instance_id = 'consilio-PS-abc123'
ORDER BY sequence_num DESC
LIMIT 10;
```

## Checkpoints

### Create Manual Checkpoint

```sql
INSERT INTO checkpoints (
  instance_id, checkpoint_type, sequence_num, 
  context_window_percent, work_state
) VALUES (
  'consilio-PS-abc123', 'manual', 1, 45,
  '{"epic":"001","phase":"impl"}'::jsonb
)
RETURNING checkpoint_id, sequence_num;
```

### Get Latest Checkpoint

```sql
SELECT checkpoint_id, context_window_percent, work_state
FROM checkpoints
WHERE instance_id = 'consilio-PS-abc123'
ORDER BY sequence_num DESC
LIMIT 1;
```

### Get All Checkpoints

```sql
SELECT checkpoint_id, sequence_num, checkpoint_type, 
       context_window_percent, created_at
FROM checkpoints
WHERE instance_id = 'consilio-PS-abc123'
ORDER BY sequence_num;
```

## Monitoring Queries

### Session Dashboard

```sql
SELECT 
  ss.instance_id,
  ss.project,
  ss.status,
  ss.context_percent,
  ss.current_epic,
  (NOW() - ss.last_heartbeat) as time_since_heartbeat,
  (SELECT COUNT(*) FROM event_store WHERE instance_id = ss.instance_id) as events,
  (SELECT COUNT(*) FROM command_log WHERE instance_id = ss.instance_id) as commands
FROM supervisor_sessions ss
ORDER BY ss.last_heartbeat DESC;
```

### Event Type Summary

```sql
SELECT event_type, COUNT(*) as count
FROM event_store
WHERE instance_id = 'consilio-PS-abc123'
GROUP BY event_type
ORDER BY count DESC;
```

### Command Performance

```sql
SELECT 
  command_type,
  action,
  COUNT(*) as count,
  AVG(execution_time_ms) as avg_ms,
  MAX(execution_time_ms) as max_ms,
  SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
FROM command_log
WHERE instance_id = 'consilio-PS-abc123'
GROUP BY command_type, action
ORDER BY avg_ms DESC;
```

## Useful Patterns

### Session Lifecycle

```sql
-- Create session
BEGIN;
INSERT INTO supervisor_sessions (instance_id, project, instance_type, status)
VALUES ('project-PS-abc123', 'project-s', 'PS', 'active');

-- Log startup event
INSERT INTO event_store (instance_id, event_type, sequence_num, event_data)
VALUES ('project-PS-abc123', 'instance_registered', 1, '{}'::jsonb);

-- Create initial checkpoint
INSERT INTO checkpoints (instance_id, checkpoint_type, sequence_num, context_window_percent, work_state)
VALUES ('project-PS-abc123', 'automatic', 1, 0, '{}'::jsonb);

COMMIT;
```

### Update Context and Log

```sql
BEGIN;
UPDATE supervisor_sessions 
SET context_percent = 55, last_heartbeat = NOW()
WHERE instance_id = 'project-PS-abc123';

INSERT INTO event_store (instance_id, event_type, sequence_num, event_data)
VALUES ('project-PS-abc123', 'context_window_updated', 2, '{"percent": 55}'::jsonb);

INSERT INTO checkpoints (instance_id, checkpoint_type, sequence_num, context_window_percent, work_state)
VALUES ('project-PS-abc123', 'automatic', 2, 55, '{"context": 55}'::jsonb);

COMMIT;
```

## Table Statistics

```sql
SELECT 
  'supervisor_sessions' as table_name, 
  pg_size_pretty(pg_total_relation_size('supervisor_sessions')) as size,
  COUNT(*) as rows
FROM supervisor_sessions
UNION ALL
SELECT 'command_log', pg_size_pretty(pg_total_relation_size('command_log')), COUNT(*) FROM command_log
UNION ALL
SELECT 'event_store', pg_size_pretty(pg_total_relation_size('event_store')), COUNT(*) FROM event_store
UNION ALL
SELECT 'checkpoints', pg_size_pretty(pg_total_relation_size('checkpoints')), COUNT(*) FROM checkpoints;
```

## Valid Values Reference

### instance_type
- `PS` - Project Supervisor
- `MS` - Meta Supervisor

### status
- `active` - Session in progress
- `stale` - No heartbeat for 30+ minutes
- `closed` - Session ended

### checkpoint_type
- `manual` - Created by user
- `automatic` - Created by system

### event_type (21 types)
- lifecycle: instance_registered, instance_heartbeat, instance_stale
- epic: epic_started, epic_completed, epic_failed, epic_planned
- test: test_started, test_passed, test_failed
- validation: validation_passed, validation_failed
- git: commit_created, pr_created, pr_merged
- deploy: deployment_started, deployment_completed, deployment_failed
- system: context_window_updated, checkpoint_created, checkpoint_loaded, feature_requested, task_spawned

## Emergency Commands

### Count All Records

```sql
SELECT 
  'supervisor_sessions' as table_name, COUNT(*) FROM supervisor_sessions
UNION ALL
SELECT 'command_log', COUNT(*) FROM command_log
UNION ALL
SELECT 'event_store', COUNT(*) FROM event_store
UNION ALL
SELECT 'checkpoints', COUNT(*) FROM checkpoints;
```

### Check Index Health

```sql
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY schemaname, tablename;
```

### List Table Constraints

```sql
SELECT constraint_name, constraint_type, table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND table_name IN ('supervisor_sessions', 'command_log', 'event_store', 'checkpoints')
ORDER BY table_name, constraint_name;
```

