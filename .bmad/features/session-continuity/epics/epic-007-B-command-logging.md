# Epic 007-B: Command Logging Infrastructure

**Epic ID:** 007-B
**Feature:** Session Continuity System
**Created:** 2026-01-28
**Status:** Pending
**Complexity Level:** 3
**Effort:** 80 hours
**Dependencies:** Epic 007-A (Instance Registry) MUST be complete before starting

---

## Executive Summary

Epic 007-B implements automatic and explicit command logging infrastructure for the supervisor system. This epic builds on the instance registry (007-A) to create a complete audit trail of all PS/MS actions.

**Key Outcome:** Every command, spawn, git operation, and explicit log entry is captured in PostgreSQL with full context, timestamps, and secret sanitization.

**User Benefit:** Complete accountability and history for debugging, auditing, and context recovery.

---

## Problem Statement

### Current State
- No record of PS actions (spawns, commits, deployments, planning)
- When debugging issues: "What happened in last hour?" → No way to know
- No audit trail for infrastructure changes
- Cannot reconstruct what PS was working on

### User Impact
- Debugging is slow (no historical context)
- No accountability (cannot trace decisions back)
- Resume is guesswork (don't know what was being done)
- Onboarding new team members: no way to understand system decisions

### Root Cause
- Commands executed by PS are not logged anywhere
- Only evidence is git history (incomplete, misses in-memory work)
- No central repository for cross-tool operations (git, spawns, tests)

---

## Feature Scope

### In Scope
✅ Automatic wrapping of all MCP tool calls
✅ Explicit logging for git, spawn, and planning operations
✅ Secret sanitization (API keys, tokens, passwords)
✅ Command search and filtering capabilities
✅ Database schema with proper indexing
✅ Performance budgets (<50ms per command)

### Out of Scope (Future)
❌ Web UI for command browsing (see 007-E)
❌ Command filtering by role/project (planned for 007-F)
❌ Integration with external audit systems
❌ Streaming logs to external services

---

## Acceptance Criteria

### AC1: Auto-wrap MCP Tools
**Given** MCP server receives a tool call
**When** the call is executed
**Then** it is automatically logged to `command_log` table with:
- instance_id, tool_name, parameters, result, timestamp, success flag
- **Verification:** All MCP tools in test suite produce command_log entries

### AC2: Explicit Logging API
**Given** PS wants to log critical action
**When** PS calls `mcp_meta_log_command(action, details, tags)`
**Then** entry created with:
- instance_id, action, details, tags, timestamp
- **Verification:** Spawn, git, and planning operations all use explicit logging

### AC3: Secret Sanitization
**Given** command contains sensitive data (API_KEY, PASSWORD, TOKEN)
**When** command is logged
**Then** sensitive fields are replaced with `[REDACTED]`
- **Verification:** Test data with real secrets shows redacted values in DB

### AC4: Command Search
**Given** user wants to find past commands
**When** user calls `mcp_meta_search_commands(instance_id, filters)`
**Then** returns matching commands with:
- Full command text, timestamp, result, tags
- Pagination support (limit 100)
- Filters: time range, action type, tags, success/failure
- **Verification:** Test queries return expected results in <500ms

### AC5: Instance Context Integration
**Given** command is logged
**When** instance_id is provided
**Then** command is associated with that instance
- **Verification:** All logged commands link to correct instance

### AC6: Database Schema (Indexed)
**Given** application requires command storage
**When** migration runs
**Then** `command_log` table created with:
- Indexes on: (instance_id, timestamp), (instance_id, action), (instance_id, tool_name)
- Partition strategy for time-series (monthly)
- **Verification:** Migration applies cleanly to fresh DB

### AC7: Performance Budget
**Given** command logging runs
**When** command is executed
**Then** logging overhead <50ms
- **Verification:** Benchmark test logs 1000 commands, measures p95 latency

### AC8: Command Completeness
**Given** PS executes mixed operations
**When** session completes
**Then** command log contains all of:
- MCP tool calls (auto-wrapped)
- Explicit logs (manual)
- Error information if any
- **Verification:** Test session with 20 mixed operations shows all in log

### AC9: Sanitization Rules Comprehensive
**Given** various sensitive patterns in command
**When** logged
**Then** all of these are redacted:
- `API_KEY=...`, `PASSWORD=...`, `TOKEN=...`
- JWT tokens (eyJ...)
- AWS credentials (AKIA...)
- OAuth tokens
- Database connection strings with passwords
- **Verification:** Test data with all patterns shows redaction

### AC10: Query Performance
**Given** command_log has 100k entries
**When** query executed (search by instance + time range)
**Then** completes in <500ms
- **Verification:** Load test with 100k rows, check query plans

---

## Technical Architecture

### Database Schema

#### `command_log` Table

```sql
CREATE TABLE command_log (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Association
  instance_id VARCHAR(64) NOT NULL REFERENCES supervisor_sessions(instance_id),

  -- Command Details
  command_type VARCHAR(32) NOT NULL,        -- 'mcp_tool' | 'explicit'
  action VARCHAR(128) NOT NULL,             -- 'spawn', 'git_commit', 'log_command'
  tool_name VARCHAR(128),                   -- For MCP tools only

  -- Payload
  parameters JSONB NOT NULL DEFAULT '{}',   -- Input parameters (sanitized)
  result JSONB,                             -- Output result
  error_message TEXT,

  -- Status
  success BOOLEAN DEFAULT true,
  execution_time_ms INTEGER,                -- How long the action took

  -- Context
  tags JSONB NOT NULL DEFAULT '[]',         -- ['deployment', 'critical']
  context_data JSONB DEFAULT '{}',          -- Free-form context

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Metadata
  source VARCHAR(32) DEFAULT 'auto'         -- 'auto' | 'explicit'
);

-- Indexes (CRITICAL for performance)
CREATE INDEX idx_command_log_instance_ts
  ON command_log(instance_id, created_at DESC);

CREATE INDEX idx_command_log_instance_action
  ON command_log(instance_id, action);

CREATE INDEX idx_command_log_instance_tool
  ON command_log(instance_id, tool_name);

CREATE INDEX idx_command_log_action
  ON command_log(action);

-- Partitioning strategy (for time-series data)
-- Partition monthly: command_log_2026_01, command_log_2026_02, etc.
```

#### Sanitization Patterns Table

```sql
CREATE TABLE secret_patterns (
  id SERIAL PRIMARY KEY,

  -- Pattern
  pattern_name VARCHAR(64) NOT NULL,        -- 'api_key', 'password', 'jwt_token'
  regex_pattern VARCHAR(512) NOT NULL,      -- Pattern to match

  -- Configuration
  enabled BOOLEAN DEFAULT true,
  replacement_text VARCHAR(64) DEFAULT '[REDACTED]',

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(pattern_name)
);

-- Initial patterns
INSERT INTO secret_patterns (pattern_name, regex_pattern) VALUES
  ('api_key', '(API_KEY|api_key)\s*=\s*["\']?[a-zA-Z0-9_-]+["\']?'),
  ('password', '(PASSWORD|password)\s*=\s*["\']?[^"\s'']+["\']?'),
  ('token', '(TOKEN|token)\s*=\s*["\']?[a-zA-Z0-9._-]+["\']?'),
  ('jwt_token', '(eyJ[a-zA-Z0-9_-]+\.){2}[a-zA-Z0-9_-]+'),
  ('aws_credentials', '(AKIA[0-9A-Z]{16}|aws_access_key_id|aws_secret_access_key)'),
  ('connection_string', 'postgresql://[^:]+:[^@]+@'),
  ('bearer_token', 'Bearer\s+[a-zA-Z0-9._-]+'),
  ('oauth_token', '(access_token|refresh_token)\s*=\s*["\']?[^"\s'']+["\']?');
```

---

## Implementation Approach

### 1. Auto-wrap MCP Tool Calls

**Location:** `src/mcp/auto-logger.ts`

```typescript
/**
 * MCP Tool Auto-Wrapper
 * Intercepts all tool calls and logs them automatically
 */

class ToolCallLogger {
  async wrapToolCall(
    instanceId: string,
    toolName: string,
    parameters: any,
    executor: () => Promise<any>
  ): Promise<any> {
    const startTime = Date.now();
    let result: any;
    let error: Error | null = null;
    let success = true;

    try {
      result = await executor();
    } catch (e) {
      error = e as Error;
      success = false;
      result = null;
    }

    const executionTimeMs = Date.now() - startTime;

    // Auto-log
    await this.logCommand({
      instance_id: instanceId,
      command_type: 'mcp_tool',
      action: toolName,
      tool_name: toolName,
      parameters: await this.sanitizeData(parameters),
      result: success ? await this.sanitizeData(result) : null,
      error_message: error?.message,
      success,
      execution_time_ms: executionTimeMs,
      source: 'auto',
    });

    if (!success) throw error;
    return result;
  }

  private async sanitizeData(data: any): Promise<any> {
    // See Section 2: Sanitization Logic
  }

  private async logCommand(entry: any): Promise<void> {
    // Insert into command_log table
  }
}
```

### 2. Explicit Logging API

**Location:** `src/mcp/explicit-logger.ts`

```typescript
/**
 * Explicit Command Logger
 * PS calls this for critical operations (spawn, git, planning)
 */

class ExplicitCommandLogger {
  async logCommand(
    instanceId: string,
    action: string,
    details: {
      description: string;
      parameters?: any;
      result?: any;
      tags?: string[];
      contextData?: any;
    }
  ): Promise<{ id: string; timestamp: string }> {
    const sanitized = await this.sanitizeData(details);

    const result = await db.query(
      `INSERT INTO command_log
       (instance_id, command_type, action, parameters, result, tags, context_data, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [
        instanceId,
        'explicit',
        action,
        JSON.stringify(sanitized.parameters || {}),
        JSON.stringify(sanitized.result || {}),
        JSON.stringify(details.tags || []),
        JSON.stringify(sanitized.contextData || {}),
        'explicit',
      ]
    );

    return {
      id: result.rows[0].id,
      timestamp: result.rows[0].created_at,
    };
  }

  // Used by PS for: spawns, git operations, planning decisions
  async logSpawn(instanceId: string, details: any): Promise<void> {
    await this.logCommand(instanceId, 'spawn_subagent', {
      description: `Spawned ${details.subagent_type} for ${details.task_type}`,
      parameters: details,
      tags: ['spawn', 'subagent'],
    });
  }

  async logGitOperation(instanceId: string, details: any): Promise<void> {
    await this.logCommand(instanceId, 'git_operation', {
      description: `Git ${details.operation}: ${details.message}`,
      parameters: details,
      tags: ['git', details.operation],
    });
  }

  async logPlanning(instanceId: string, details: any): Promise<void> {
    await this.logCommand(instanceId, 'planning', {
      description: `Planning: ${details.epic_id}`,
      parameters: details,
      tags: ['planning', 'epic'],
    });
  }
}
```

### 3. Secret Sanitization Logic

**Location:** `src/services/sanitization.ts`

```typescript
/**
 * Secret Sanitization Service
 * Redacts sensitive data before logging
 */

class SanitizationService {
  private patterns: Map<string, RegExp> = new Map();

  async initialize(): Promise<void> {
    // Load patterns from secret_patterns table
    const result = await db.query(
      `SELECT pattern_name, regex_pattern FROM secret_patterns WHERE enabled = true`
    );

    for (const row of result.rows) {
      this.patterns.set(row.pattern_name, new RegExp(row.regex_pattern, 'gi'));
    }
  }

  async sanitize(data: any): Promise<any> {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Check if key name suggests sensitivity
        if (this.isSensitiveKey(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  private sanitizeString(str: string): string {
    let result = str;

    // Apply all regex patterns
    for (const [name, pattern] of this.patterns) {
      result = result.replace(pattern, '[REDACTED]');
    }

    return result;
  }

  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    const sensitiveKeywords = [
      'password',
      'token',
      'secret',
      'key',
      'api_key',
      'apikey',
      'authorization',
      'bearer',
      'credential',
      'oauth',
      'jwt',
      'private_key',
    ];

    return sensitiveKeywords.some((keyword) => lowerKey.includes(keyword));
  }
}
```

### 4. MCP Tool Specifications

#### Tool: `mcp_meta_log_command`

```typescript
/**
 * Explicit command logging
 * Used by PS for spawns, git, planning
 */

const logCommandTool: MCPTool = {
  name: 'mcp_meta_log_command',
  description: 'Explicitly log a command or action',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action type: spawn, git_commit, git_push, planning, etc.',
      },
      details: {
        type: 'object',
        description: 'Details object (varies by action type)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization',
      },
    },
    required: ['action', 'details'],
  },
  execute: async (params: any) => {
    const instanceId = getCurrentInstanceId(); // From context
    const logger = new ExplicitCommandLogger();

    try {
      const result = await logger.logCommand(instanceId, params.action, {
        description: params.details.description || `${params.action}`,
        parameters: params.details,
        tags: params.tags || [],
      });

      return {
        success: true,
        logged_id: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
```

#### Tool: `mcp_meta_search_commands`

```typescript
/**
 * Search command history
 * Query logged commands by instance, filters, time range
 */

const searchCommandsTool: MCPTool = {
  name: 'mcp_meta_search_commands',
  description: 'Search command history for an instance',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID to search (required)',
      },
      action: {
        type: 'string',
        description: 'Filter by action type (optional)',
      },
      tool_name: {
        type: 'string',
        description: 'Filter by tool name (optional)',
      },
      time_range: {
        type: 'object',
        description: 'Time range filter',
        properties: {
          start_time: { type: 'string', format: 'date-time' },
          end_time: { type: 'string', format: 'date-time' },
        },
      },
      success_only: {
        type: 'boolean',
        description: 'Only return successful commands',
        default: false,
      },
      limit: {
        type: 'integer',
        description: 'Number of results (max 1000)',
        default: 100,
      },
      offset: {
        type: 'integer',
        description: 'For pagination',
        default: 0,
      },
    },
    required: ['instance_id'],
  },
  execute: async (params: any) => {
    const query = buildSearchQuery(params);

    const result = await db.query(query.sql, query.params);

    return {
      success: true,
      total: result.rowCount,
      commands: result.rows.map((row) => ({
        id: row.id,
        action: row.action,
        tool_name: row.tool_name,
        timestamp: row.created_at,
        parameters: row.parameters,
        result: row.result,
        success: row.success,
        execution_time_ms: row.execution_time_ms,
        tags: row.tags,
      })),
    };
  },
};

// Helper to build dynamic query
function buildSearchQuery(params: any): { sql: string; params: any[] } {
  let sql = `
    SELECT id, action, tool_name, parameters, result, success,
           execution_time_ms, tags, created_at
    FROM command_log
    WHERE instance_id = $1
  `;
  const params_list: any[] = [params.instance_id];
  let paramIndex = 2;

  if (params.action) {
    sql += ` AND action = $${paramIndex}`;
    params_list.push(params.action);
    paramIndex++;
  }

  if (params.tool_name) {
    sql += ` AND tool_name = $${paramIndex}`;
    params_list.push(params.tool_name);
    paramIndex++;
  }

  if (params.time_range?.start_time) {
    sql += ` AND created_at >= $${paramIndex}`;
    params_list.push(params.time_range.start_time);
    paramIndex++;
  }

  if (params.time_range?.end_time) {
    sql += ` AND created_at <= $${paramIndex}`;
    params_list.push(params.time_range.end_time);
    paramIndex++;
  }

  if (params.success_only) {
    sql += ` AND success = true`;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params_list.push(params.limit || 100);
  params_list.push(params.offset || 0);

  return { sql, params: params_list };
}
```

---

## Implementation Files

### Files to Create

```
src/services/
├── command-logger.ts           # Main logging service
├── sanitization.ts             # Sanitization logic
├── explicit-logger.ts          # Explicit logging API
└── auto-logger.ts              # MCP auto-wrapper

src/mcp/
├── tools/
│   ├── log-command.ts          # MCP tool: log_command
│   └── search-commands.ts      # MCP tool: search_commands
└── middleware/
    └── auto-wrap-logger.ts     # Middleware to auto-wrap all tools

migrations/
└── XXX_create_command_log.sql  # Database schema migration

tests/
├── unit/
│   ├── sanitization.test.ts    # Sanitization logic tests
│   ├── command-logger.test.ts  # Logger tests
│   └── auto-logger.test.ts     # Auto-wrap tests
└── integration/
    ├── command-logging-flow.test.ts  # Full flow test
    ├── search-commands.test.ts       # Search functionality
    └── sanitization-patterns.test.ts # Sanitization verification
```

### Files to Modify

```
src/mcp/server.ts              # Register new tools + auto-wrap middleware
src/db/migrations.ts           # Run command_log migration
src/types/                     # Add CommandLog, SearchQuery types
package.json                   # No new dependencies needed
```

---

## Testing Requirements

### Unit Tests (60 tests)

#### Sanitization Tests
```typescript
describe('SanitizationService', () => {
  // Test each pattern: api_key, password, token, jwt, aws, connection_string, bearer, oauth
  test('should redact API keys', () => {});
  test('should redact passwords', () => {});
  test('should redact JWT tokens', () => {});
  test('should redact nested secrets', () => {});
  test('should handle mixed data types', () => {});
  test('should not redact non-sensitive strings', () => {});
  test('should handle null/undefined gracefully', () => {});
  test('should preserve structure after sanitization', () => {});
});
```

#### Command Logger Tests
```typescript
describe('CommandLogger', () => {
  // Test explicit logging
  test('should log explicit command', () => {});
  test('should include all fields', () => {});
  test('should sanitize parameters', () => {});
  test('should handle errors', () => {});
  test('should assign tags correctly', () => {});

  // Test MCP auto-wrap
  test('should auto-log MCP tool call', () => {});
  test('should capture execution time', () => {});
  test('should record success/failure', () => {});
  test('should log error messages', () => {});
});
```

#### Search Tests
```typescript
describe('SearchCommands', () => {
  test('should search by instance_id', () => {});
  test('should filter by action', () => {});
  test('should filter by tool_name', () => {});
  test('should filter by time range', () => {});
  test('should support pagination', () => {});
  test('should return results in DESC time order', () => {});
  test('should handle no results', () => {});
});
```

### Integration Tests (8 tests)

```typescript
describe('Command Logging Flow', () => {
  // Full lifecycle tests
  test('should log and retrieve full workflow', () => {
    // Create instance → execute tools → search → verify all logged
  });

  test('should sanitize before storage', () => {
    // Log sensitive data → verify sanitized in DB
  });

  test('should handle concurrent logging', () => {
    // 10 instances log simultaneously
  });

  test('should maintain instance association', () => {
    // Multiple instances → search by instance → correct results
  });

  test('should preserve command relationships', () => {
    // Spawn → git commit → test → verify sequence
  });

  test('should handle large payloads', () => {
    // Log 1MB parameters → verify stored correctly
  });

  test('should recover from logging errors', () => {
    // DB temporarily down → MCP tool still works → log retried
  });

  test('should meet performance budget', () => {
    // 1000 commands logged → p95 <50ms
  });
});
```

### Performance Tests (3 tests)

```typescript
describe('Performance', () => {
  test('logging overhead <50ms', () => {
    // Benchmark: 1000 commands, check p95
  });

  test('search query <500ms on 100k rows', () => {
    // Load 100k commands, search by instance+time → verify <500ms
  });

  test('auto-wrap adds <20ms per MCP call', () => {
    // Execute tool with and without wrapper, verify overhead
  });
});
```

### Manual Testing Checklist

```
[ ] Secret Sanitization
  [ ] API key redacted in logs
  [ ] Password redacted
  [ ] JWT token redacted
  [ ] AWS credentials redacted
  [ ] Connection strings redacted
  [ ] Normal text NOT redacted

[ ] Command Logging
  [ ] Auto-wrapped MCP tool appears in log
  [ ] Explicit log call creates entry
  [ ] Timestamp recorded correctly
  [ ] Instance ID linked properly
  [ ] Error information captured if command fails

[ ] Search Functionality
  [ ] Search by instance returns only that instance's commands
  [ ] Filter by action works
  [ ] Time range filter works
  [ ] Success filter works
  [ ] Pagination works (limit/offset)
  [ ] Results sorted by timestamp DESC

[ ] Performance
  [ ] Single command logged in <50ms
  [ ] 1000 commands logged in <1 second
  [ ] Search query completes in <500ms
  [ ] No memory leaks after 10k commands
  [ ] Database indexes used (EXPLAIN ANALYZE)
```

---

## Database Migration

### Migration File: `migrations/XXX_create_command_log.sql`

```sql
-- Epic 007-B: Command Logging Infrastructure

BEGIN;

-- Main command log table
CREATE TABLE command_log (
  id BIGSERIAL PRIMARY KEY,

  instance_id VARCHAR(64) NOT NULL,
  FOREIGN KEY (instance_id) REFERENCES supervisor_sessions(instance_id)
    ON DELETE CASCADE,

  command_type VARCHAR(32) NOT NULL,
  action VARCHAR(128) NOT NULL,
  tool_name VARCHAR(128),

  parameters JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error_message TEXT,

  success BOOLEAN DEFAULT true,
  execution_time_ms INTEGER,

  tags JSONB NOT NULL DEFAULT '[]',
  context_data JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(32) DEFAULT 'auto'
);

-- Indexes (CRITICAL for performance)
CREATE INDEX idx_command_log_instance_ts
  ON command_log(instance_id, created_at DESC);

CREATE INDEX idx_command_log_instance_action
  ON command_log(instance_id, action);

CREATE INDEX idx_command_log_instance_tool
  ON command_log(instance_id, tool_name);

CREATE INDEX idx_command_log_action
  ON command_log(action);

CREATE INDEX idx_command_log_ts
  ON command_log(created_at DESC);

-- Secret patterns table (for sanitization config)
CREATE TABLE secret_patterns (
  id SERIAL PRIMARY KEY,

  pattern_name VARCHAR(64) NOT NULL UNIQUE,
  regex_pattern VARCHAR(512) NOT NULL,

  enabled BOOLEAN DEFAULT true,
  replacement_text VARCHAR(64) DEFAULT '[REDACTED]',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial secret patterns
INSERT INTO secret_patterns (pattern_name, regex_pattern) VALUES
  ('api_key', '(API_KEY|api_key)\s*=\s*["\']?[a-zA-Z0-9_-]+["\']?'),
  ('password', '(PASSWORD|password)\s*=\s*["\']?[^"\s'']+["\']?'),
  ('token', '(TOKEN|token)\s*=\s*["\']?[a-zA-Z0-9._-]+["\']?'),
  ('jwt_token', '(eyJ[a-zA-Z0-9_-]+\.){2}[a-zA-Z0-9_-]+'),
  ('aws_credentials', '(AKIA[0-9A-Z]{16}|aws_access_key_id|aws_secret_access_key)'),
  ('connection_string', 'postgresql://[^:]+:[^@]+@'),
  ('bearer_token', 'Bearer\s+[a-zA-Z0-9._-]+'),
  ('oauth_token', '(access_token|refresh_token)\s*=\s*["\']?[^"\s'']+["\']?');

-- Grants (for MCP server role)
GRANT SELECT, INSERT ON command_log TO mcp_server_role;
GRANT SELECT ON secret_patterns TO mcp_server_role;

COMMIT;
```

---

## MCP Tool Specifications

### Tool Registry

```typescript
// In src/mcp/tools/index.ts

export const commandLoggingTools = [
  {
    name: 'mcp_meta_log_command',
    handler: LogCommandTool,
    description: 'Explicitly log a command or action',
    requiresAuth: false,
  },
  {
    name: 'mcp_meta_search_commands',
    handler: SearchCommandsTool,
    description: 'Search command history for an instance',
    requiresAuth: false,
  },
];
```

### Auto-wrap Middleware

```typescript
// In src/mcp/middleware/auto-wrap-logger.ts

export function createAutoWrapMiddleware(logger: CommandLogger) {
  return async (context: MCPContext, next: () => Promise<any>) => {
    const { toolName, parameters, instanceId } = context;

    if (shouldAutoLog(toolName)) {
      return logger.wrapToolCall(
        instanceId,
        toolName,
        parameters,
        () => next()
      );
    }

    return next();
  };

  function shouldAutoLog(toolName: string): boolean {
    // Auto-log all tools EXCEPT internal ones
    const excludeList = [
      'mcp_meta_heartbeat',  // Special handling
      'mcp_meta_log_command', // Would create double-logging
    ];
    return !excludeList.includes(toolName);
  }
}
```

---

## Dependencies

### Blocked By
- **Epic 007-A** (Instance Registry) - Must be complete before starting
  - Requires: `supervisor_sessions` table
  - Requires: Instance ID generation working
  - Requires: MCP server infrastructure ready

### Blocks
- **Epic 007-D** (Checkpoint System) - Needs command history to create checkpoints
- **Epic 007-E** (Resume Engine) - Needs commands for context reconstruction

### External Dependencies
- PostgreSQL 14+ (already available)
- Node.js 20+ (already available)
- TypeScript 5+ (already available)
- No new npm packages required

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Logging overhead impacts PS performance** | Medium | High | Async logging, <50ms budget enforced in tests, batch if needed |
| **Sensitive data accidentally logged** | Medium | Critical | Comprehensive sanitization patterns, test with real secrets |
| **Database grows too large** | Low | Medium | Partitioning strategy (monthly), 90-day retention, archive plan |
| **Secret patterns miss new formats** | Low | Medium | Regular security audits, allow easy pattern addition |
| **Search queries become slow** | Low | Medium | Proper indexing, partition strategy, query optimization |
| **Auto-wrap breaks edge cases** | Medium | Medium | Comprehensive tests, graceful degradation (log errors don't fail main call) |

---

## Deployment Strategy

### Pre-Deployment Checklist

- [ ] Unit tests passing (100%)
- [ ] Integration tests passing (100%)
- [ ] Performance benchmarks met (<50ms overhead)
- [ ] Database migration tested on staging
- [ ] Sanitization patterns verified with real secrets
- [ ] Code review completed
- [ ] Auto-wrap middleware doesn't break any MCP tools
- [ ] Documentation updated with new MCP tools

### Rollout Steps

1. **Step 1: Migrate Database**
   - Run migration in supervisor_meta
   - Verify tables and indexes created
   - Verify grants applied

2. **Step 2: Deploy Logging Service**
   - Deploy command-logger, sanitization, auto-logger
   - Verify MCP server starts
   - Verify no errors in logs

3. **Step 3: Verify Auto-Wrap**
   - Run test suite against MCP server
   - Verify all tool calls logged
   - Verify no latency spikes

4. **Step 4: Enable Explicit Logging**
   - Make PS use mcp_meta_log_command for spawns, git, planning
   - Verify explicit logs created
   - Verify sanitization working

5. **Step 5: Monitor**
   - Watch database growth
   - Monitor MCP response times
   - Check for errors in auto-wrap

### Rollback Plan

If issues arise:
1. Disable auto-wrap middleware (remove from MCP startup)
2. Keep database tables (no data loss)
3. MCP tools still work (just not logged)
4. Explicit logging can be re-enabled after fixes

---

## Success Metrics

### Functional Success
- ✅ Every MCP tool call auto-logged
- ✅ Every explicit action logged with context
- ✅ All sensitive data redacted
- ✅ Search queries return correct results
- ✅ Database indexes optimized

### Performance Success
- ✅ Command logging overhead <50ms (p95)
- ✅ Search queries <500ms on 100k rows
- ✅ No memory leaks
- ✅ Database growth within budget

### User Success
- ✅ PS can see complete action history
- ✅ PS can search past commands
- ✅ PS can use logs to debug issues
- ✅ PS confident in accuracy (secrets redacted)

---

## References

### Related Documents
- **PRD:** `/home/samuel/sv/supervisor-service-s/.bmad/features/session-continuity/prd.md`
- **Epic 007-A:** `epic-007-A-instance-registry.md` (dependency)
- **Epic 007-C:** `epic-007-C-event-store.md` (parallel)
- **Epic 007-D:** `epic-007-D-checkpoint-system.md` (dependency)
- **Epic 007-E:** `epic-007-E-resume-engine.md` (dependency)

### Design Decisions (ADRs - Future)
- ADR 007-B-001: Hybrid logging (auto + explicit) vs pure auto
- ADR 007-B-002: Client-side vs server-side sanitization
- ADR 007-B-003: JSONB vs separate columns for command payload
- ADR 007-B-004: Partitioning strategy for time-series data

### External References
- PostgreSQL JSONB documentation
- OWASP Secret Management guidelines
- Database indexing best practices

---

## Notes

### Design Rationale

**Hybrid Logging Approach:** Not all actions fit the MCP tool call model. Critical PS operations (spawns, git commits, planning decisions) are logged explicitly to capture rich context that MCP tools might not provide.

**Asynchronous Logging:** Logging happens async (fire-and-forget) to avoid blocking MCP calls. If logging fails, the main operation succeeds. This ensures logging never becomes a bottleneck.

**Server-Side Sanitization:** Redaction happens in the logging service, not on PS, to ensure consistency and to catch patterns we might not think of in every call site.

### Known Limitations

- No real-time search (eventual consistency acceptable)
- No distributed tracing (single MCP server for now)
- No custom patterns per project (future enhancement)
- No streaming logs to external systems (future)

### Future Enhancements

- Web UI for browsing/searching commands (Epic 007-F integration)
- Custom sanitization patterns per project
- Command correlation across instances
- Export commands to CSV/JSON
- Integration with external audit systems
- Real-time command notifications

---

**Maintained by:** Meta-Supervisor (MS)
**Last Updated:** 2026-01-28
**Next Milestone:** Epic 007-A completion (dependency)
