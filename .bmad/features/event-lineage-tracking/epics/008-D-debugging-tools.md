# Epic 008-D: Debugging and Analysis MCP Tools

**Status**: Pending
**Priority**: MEDIUM
**Estimated Effort**: 7 hours
**Dependencies**: Epic 008-C (PS Integration)
**Feature**: event-lineage-tracking

---

## Overview

Create MCP tools for querying event lineage, enabling debugging, performance analysis, and smart session resume through the meta-supervisor.

## Business Value

- **Instant Debugging**: "Why did X fail?" → Call get_parent_chain tool
- **Performance Analysis**: Find slow operations via duration queries
- **Session Intelligence**: Resume tools provide context-aware suggestions
- **Export Capability**: Export session for external analysis

## Problem Statement

**Current Debugging:**
```
User: "Why did epic-003 fail?"
PS: [Reads command_log] "I see it tried to deploy..."
PS: [Reads git log] "Last commit was..."
PS: "I'm not sure what caused the failure."
Time: 10+ minutes, incomplete answer
```

**With Lineage Tools:**
```
User: "Why did epic-003 fail?"
PS: [Calls get_failure_chain('epic-003')]
Result: Complete chain from user request to failure
Time: 10 seconds, complete answer
```

## Acceptance Criteria

### 1. MCP Tool: get_parent_chain

- [ ] Input: `event_uuid: string, max_depth?: number`
- [ ] Output: Array of events from root to specified event
- [ ] Performance: <50ms for depth 100
- [ ] Error handling: Returns empty array if event not found

### 2. MCP Tool: get_event_tree

- [ ] Input: `root_uuid: string, max_depth?: number`
- [ ] Output: Tree structure of all descendants
- [ ] Performance: <200ms for 100 descendants
- [ ] Useful for visualizing decision branches

### 3. MCP Tool: get_failure_chain

- [ ] Input: `instance_id: string, epic_id?: string`
- [ ] Output: Most recent error event with full parent chain
- [ ] Includes: error details, what led to failure
- [ ] Helper for quick debugging

### 4. MCP Tool: analyze_performance

- [ ] Input: `instance_id: string, time_range?: { start, end }`
- [ ] Output: Aggregated stats by event type
- [ ] Includes: avg_duration, max_duration, count
- [ ] Identifies slow operations

### 5. MCP Tool: smart_resume_context

- [ ] Input: `instance_id: string`
- [ ] Output: Reconstructed context using lineage
- [ ] Includes: current_epic, last_action, parent_chain
- [ ] Memory bounded (max 50 events)

### 6. MCP Tool: export_session

- [ ] Input: `instance_id: string, format: 'json' | 'jsonl'`
- [ ] Output: Session events in specified format
- [ ] Streaming: Uses pagination to avoid memory bloat
- [ ] Compatible with Claude Code .jsonl format

---

## Technical Specifications

See full implementation details in planning agent output.

Key files to create:
- `src/mcp/tools/lineage-tools.ts` - All lineage MCP tools
- Update `src/mcp/ToolRegistry.ts` - Register new tools

---

## Success Criteria

- [ ] All 5 MCP tools implemented
- [ ] get_parent_chain returns correct chain
- [ ] get_failure_chain finds most recent error
- [ ] smart_resume_context returns bounded context
- [ ] All queries bounded (LIMIT enforced)
- [ ] Performance: <100ms per query
- [ ] Tools registered in ToolRegistry
- [ ] Unit tests pass

---

## Implementation Steps (for Haiku Agent)

1. **Create lineage-tools.ts** at `src/mcp/tools/lineage-tools.ts`
2. **Implement getParentChain** - Wrap SQL function
3. **Implement getEventTree** - Recursive CTE
4. **Implement getFailureChain** - Find error + chain
5. **Implement analyzePerformance** - Aggregate stats
6. **Implement smartResumeContext** - Use EventLogger
7. **Register tools** in ToolRegistry
8. **Write unit tests**
9. **Test via MCP**: Call tools through MCP interface

---

**Maintained by**: Meta-Supervisor
**Created**: 2026-01-31
**Last Updated**: 2026-01-31
