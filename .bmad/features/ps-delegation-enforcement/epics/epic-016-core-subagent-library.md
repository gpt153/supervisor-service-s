# Epic 016: Core Subagent Library (Phase 1)

**Status**: In Progress
**Priority**: P0 - Critical
**Complexity**: Medium
**Estimated Effort**: 4 hours
**Dependencies**: None
**Related PRD**: PRD-PS-Delegation-Enforcement.md
**Parent Feature**: PS Delegation Enforcement System

---

## Overview

Create standardized subagent library with 5 core PIV-loop subagents that PS delegates to instead of executing tasks directly.

---

## Goals

1. Create directory structure for subagent library
2. Implement 5 core PIV-loop subagents with consistent template structure
3. Port prime-research.md and implement-feature.md from SCAR system
4. Ensure all subagents have FORBIDDEN/MANDATORY sections
5. Focus on READ-ONLY enforcement for research, validation for implementation

---

## Subagents to Create

### 1. prime-research.md (task_type: research)
- 🚨 READ-ONLY - FORBIDDEN FROM IMPLEMENTING ANYTHING
- Analyze codebase structure, patterns, architecture
- Output: Research report with architecture summary, key files, integration points
- Port from SCAR prime.md with enhancements

### 2. plan-implementation.md (task_type: planning)
- Create step-by-step implementation plan
- Research existing patterns in codebase
- Identify integration points and dependencies
- Output: .bmad/plans/feature-plan.md with tasks, validation steps

### 3. implement-feature.md (task_type: implementation)
- Execute code changes based on plan
- Follow task order exactly
- Run ALL validations before completing
- Port from SCAR execute.md
- Output: Implemented code + validation report

### 4. validate-changes.md (task_type: validation)
- Run ALL validation commands (lint, type-check, tests, build)
- Collect all errors comprehensively
- DO NOT skip any checks
- Output: Comprehensive validation report with pass/fail

### 5. test-ui-complete.md (task_type: testing)
- Comprehensive Playwright UI testing
- Click EVERY button, fill EVERY form, test EVERY interaction
- Auto-discover all interactive elements
- Test valid + invalid data, edge cases, navigation
- Output: Complete test suite with 100% UI coverage + screenshots

---

## Acceptance Criteria

**🚨 SLIM DESIGN PROTOCOL (MANDATORY):**
- [ ] ALL subagent files MUST be <200 lines (CRITICAL: Currently 283-553 lines - MUST SLIM)
- [ ] YAML frontmatter for metadata (task_type, complexity, keywords) - counts toward 200 lines
- [ ] All detailed examples extracted to /docs/examples/subagent-patterns/
- [ ] All "why" explanations extracted to /docs/guides/
- [ ] Workflow steps: 20-30 lines MAX (concise numbered steps only)
- [ ] References section at bottom linking to detailed guides
- [ ] After slimming, verify: `wc -l /home/samuel/sv/.claude/commands/subagents/*/*.md | sort -rn` shows ALL <200 lines
- [ ] After regeneration, verify: `wc -c /home/samuel/sv/*/CLAUDE.md | sort -rn` shows ALL <40k chars

**DIRECTORY STRUCTURE:**
- [ ] Directory created: /home/samuel/sv/.claude/commands/subagents/ ✓
- [ ] Subdirectories created: research/, planning/, implementation/, validation/, testing/ ✓

**SUBAGENT TEMPLATES (SLIM VERSION):**
- [ ] All 5 subagents follow slim template structure:
  - [ ] YAML frontmatter with metadata (5-10 lines)
  - [ ] FORBIDDEN section (10-15 lines, concise bullets)
  - [ ] MANDATORY section (10-15 lines with placeholders)
  - [ ] Workflow steps (20-30 lines, numbered, NO code examples >10 lines)
  - [ ] Output requirements (5-10 lines)
  - [ ] Success criteria (5-10 lines)
  - [ ] References section (3-5 lines linking to /docs/)
- [ ] Total per file: <200 lines
- [ ] prime-research.md has READ-ONLY enforcement impossible to miss
- [ ] implement-feature.md has validation requirements
- [ ] test-ui-complete.md references Playwright guide (examples in /docs/)

---

## Template Structure

```markdown
# Subagent: [Name]

**task_type**: [research|planning|implementation|etc.]
**description**: Brief description
**estimated_tokens**: [small|medium|large]
**complexity**: [simple|medium|complex]

---

## 🚨 FORBIDDEN

- ❌ Never do X
- ❌ Never do Y

---

## MANDATORY

- ✅ Always do A
- ✅ Always do B

---

## Workflow

1. Step 1
2. Step 2
3. Step 3

---

## Output Requirements

- File: path/to/output
- Format: markdown/code/report
- Must include: X, Y, Z

---

## Validation Checklist

- [ ] Check 1
- [ ] Check 2
- [ ] Check 3

---

## Success Criteria

- ✅ Criterion 1
- ✅ Criterion 2

---

## Common Pitfalls

- ⚠️ Don't do X (instead do Y)
- ⚠️ Don't forget Z
```

---

## Tasks

### Task 1: Create Directory Structure
- [ ] mkdir -p /home/samuel/sv/.claude/commands/subagents/research
- [ ] mkdir -p /home/samuel/sv/.claude/commands/subagents/planning
- [ ] mkdir -p /home/samuel/sv/.claude/commands/subagents/implementation
- [ ] mkdir -p /home/samuel/sv/.claude/commands/subagents/validation
- [ ] mkdir -p /home/samuel/sv/.claude/commands/subagents/testing

### Task 2: Create prime-research.md
- [ ] Port from /home/samuel/.archon/workspaces/localrag/.agents/commands/prime.md
- [ ] Add 🚨 FORBIDDEN - NEVER IMPLEMENT, NEVER EDIT, NEVER CREATE FILES
- [ ] Add READ-ONLY enforcement at top
- [ ] Add workflow: Glob → Read → Analyze → Report
- [ ] Add output format: .bmad/research/[feature-name]-research.md
- [ ] Add success criteria: Architecture understood, key files identified, no files modified

### Task 3: Create plan-implementation.md
- [ ] Add FORBIDDEN: Never implement, only plan
- [ ] Add MANDATORY: Research existing patterns first
- [ ] Add workflow: Read plan requirements → Research codebase → Create task list → Define validation
- [ ] Add output format: .bmad/plans/[feature-name]-plan.md with numbered tasks
- [ ] Add validation checklist: All tasks actionable, dependencies clear, validation defined

### Task 4: Create implement-feature.md
- [ ] Port from /home/samuel/.archon/workspaces/localrag/.agents/commands/execute.md
- [ ] Add MANDATORY: Follow plan exactly, run validations before completing
- [ ] Add workflow: Read plan → Execute tasks in order → Run validations → Report
- [ ] Add output format: Implemented code + validation-report.md
- [ ] Add success criteria: All tasks complete, all validations pass

### Task 5: Create validate-changes.md
- [ ] Add MANDATORY: Run ALL checks, never skip
- [ ] Add workflow: Run lint → Run type-check → Run tests → Run build → Collect errors
- [ ] Add output format: validation-report.md with pass/fail for each check
- [ ] Add common pitfalls: Don't stop at first error, collect ALL errors

### Task 6: Create test-ui-complete.md
- [ ] Add MANDATORY: Click ALL buttons, fill ALL forms, test ALL interactions
- [ ] Add workflow using Playwright:
  1. Navigate to page
  2. Auto-discover all interactive elements (buttons, links, forms, inputs)
  3. For each element: Click/fill with valid data, verify response
  4. For each form: Test invalid data, edge cases, error handling
  5. Test navigation paths (all routes)
  6. Take screenshots at key points
  7. Generate comprehensive test suite
- [ ] Add output format: tests/e2e/complete-ui-test.spec.ts + screenshots/
- [ ] Add success criteria: 100% UI coverage, all interactions tested

### Task 7: Test Each Subagent
- [ ] Manually test prime-research.md with sample task
- [ ] Manually test plan-implementation.md with sample feature
- [ ] Verify FORBIDDEN/MANDATORY sections clear
- [ ] Verify output format correct

---

## Testing

**Test 1: READ-ONLY Enforcement (prime-research.md)**
- Spawn research agent for "analyze authentication system"
- Verify agent only reads files, never edits
- Verify agent produces research report
- Verify no files modified

**Test 2: Comprehensive Testing (test-ui-complete.md)**
- Spawn UI testing agent for simple app
- Verify agent discovers ALL interactive elements
- Verify agent tests valid AND invalid inputs
- Verify 100% UI coverage achieved

**Test 3: Template Consistency**
- Review all 5 subagents
- Verify all follow same template structure
- Verify all have FORBIDDEN/MANDATORY sections
- Verify all have clear output requirements

---

## Success Metrics

- 5 core subagents created with consistent structure
- prime-research.md enforces READ-ONLY (no files modified)
- test-ui-complete.md achieves 100% UI coverage
- All subagents follow template pattern
- All subagents tested and working

---

## Related Epics

- Epic 015: Core Identity & Enforcement (PS identity references these subagents)
- Epic 017: Centralized Subagent Spawning (tool selects from these subagents)
- Epic 020: Reference Documentation (subagent catalog lists these)

---

## Timeline

**Day 1 - Phase 1: Foundation**
- Start: After Epic 015
- Duration: 4 hours
- Completion: End of Day 1

---

## Notes

These 5 subagents are the CORE of the PIV-loop (Prime, Implement, Validate). All other subagents in later phases build on this foundation.

Key: prime-research.md MUST be READ-ONLY. If research agent modifies files, the entire enforcement model fails.
