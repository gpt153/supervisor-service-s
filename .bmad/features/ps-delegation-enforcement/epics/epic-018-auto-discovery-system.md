# Epic 018: Auto-Discovery System

**Status**: Pending
**Priority**: P1 - High
**Complexity**: High
**Estimated Effort**: 4 hours
**Dependencies**: None
**Related PRD**: PRD-PS-Delegation-Enforcement.md

---

## Overview

Build self-improving system that logs PS activity, detects repeated patterns, and suggests new automations (subagents/MCP tools).

---

## Goals

1. Log all PS actions (tool usage, purpose, frequency)
2. Analyze patterns daily/weekly
3. Generate automation suggestions
4. Save to .automation-suggestions/ for review
5. System gets smarter over time

---

## Acceptance Criteria

- [ ] Database tables created: ps_activity_logs, automation_suggestions
- [ ] Activity tracker logs every PS action
- [ ] Pattern analyzer runs daily (cron job)
- [ ] Suggestions saved to .automation-suggestions/NNN-pattern-name.md
- [ ] Review workflow functional
- [ ] 3+ patterns detected in first week

---

## Tasks

### Database Schema
- [ ] Create migration: ps_activity_logs (project_name, tool_used, purpose, context, duration_ms)
- [ ] Create migration: automation_suggestions (pattern_name, frequency, current_workflow, suggested_automation, status)

### Activity Tracker
- [ ] Create src/automation/activity-tracker.ts
- [ ] Hook into PS tool execution
- [ ] Log async (don't slow down PS)
- [ ] Batch writes for performance

### Pattern Analyzer
- [ ] Create src/automation/pattern-analyzer.ts
- [ ] Detect repeated sequences (same actions, same order)
- [ ] Detect common tasks (same type across projects)
- [ ] Detect manual workflows (multi-step bash that could be tool)
- [ ] Require 5+ occurrences before suggesting

### Suggestion Generator
- [ ] Create src/automation/suggestion-generator.ts
- [ ] Generate .md files in .automation-suggestions/
- [ ] Include: pattern detected, frequency, current workflow, suggested automation, benefit estimate
- [ ] Category: new_subagent | new_mcp_tool | workflow | unused_tool | optimization

### Scheduled Task
- [ ] Create src/scripts/analyze-patterns.ts
- [ ] Run daily via cron: `0 3 * * * cd /home/samuel/sv/supervisor-service-s && npm run analyze-patterns`
- [ ] Email or log report of suggestions

---

## Testing

**Test 1: Detect Repeated Pattern**
- Manually trigger same action 5 times (e.g., "Update deployment docs after tunnel")
- Run pattern analyzer
- Verify suggestion created: "Auto-update deployment docs after tunnel creation"

**Test 2: Cross-Project Pattern**
- Perform same action in 3 different projects
- Run analyzer
- Verify suggestion: "Create shared tool for X"

---

## Timeline

**Day 2 - Phase 2**
- Duration: 4 hours

---
