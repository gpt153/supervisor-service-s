# Epic 021: Testing & Validation

**Status**: Pending
**Priority**: P0 - Critical
**Complexity**: Medium
**Estimated Effort**: 3 hours
**Dependencies**: All previous epics
**Related PRD**: PRD-PS-Delegation-Enforcement.md

---

## Overview

Test complete PS delegation enforcement system with real PS, validate metrics, regenerate all CLAUDE.md files, and document.

---

## Goals

1. Test with one PS (Consilio or Odin)
2. Validate delegation rate >90%
3. Validate automatic AI Router integration
4. Regenerate all CLAUDE.md files
5. Document complete system

---

## Acceptance Criteria

- [ ] Tested with real PS (Consilio-PS or Odin-PS)
- [ ] Delegation rate >90% in test
- [ ] PS never implements code directly
- [ ] PS never asks "should I spawn?"
- [ ] Automatic Odin integration working
- [ ] Cost tracking shows 60%+ using cheap services
- [ ] All CLAUDE.md files regenerated successfully
- [ ] All PSes under 40k chars
- [ ] Complete system documented

---

## Tasks

### Task 1: Test Delegation Enforcement
- [ ] Start PS session for test project
- [ ] User: "Implement authentication"
- [ ] Verify PS immediately calls mcp_meta_spawn_subagent (doesn't implement)
- [ ] Verify PS never asks "should I spawn?"
- [ ] Verify Odin queried automatically
- [ ] Verify appropriate service selected
- [ ] Repeat with 10 different tasks
- [ ] Calculate delegation rate (should be >90%)

### Task 2: Test Infrastructure Enforcement
- [ ] PS attempts manual cloudflared command
- [ ] Verify validation rejects with helpful error
- [ ] PS attempts manual port selection
- [ ] Verify validation rejects
- [ ] PS uses correct MCP tools
- [ ] Verify all succeed

### Task 3: Test Auto-Documentation
- [ ] PS creates tunnel using tunnel_request_cname
- [ ] Verify update-deployment-docs.md spawned automatically
- [ ] Verify CLAUDE.md regenerated automatically
- [ ] Verify changes committed automatically
- [ ] Verify next PS session has updated context

### Task 4: Test Auto-Discovery
- [ ] Perform same action 5 times
- [ ] Run pattern analyzer manually
- [ ] Verify suggestion generated
- [ ] Verify suggestion saved to .automation-suggestions/

### Task 5: Regenerate All CLAUDE.md Files
- [ ] cd /home/samuel/sv/supervisor-service-s
- [ ] npm run init-projects -- --verbose
- [ ] Verify all CLAUDE.md files updated with new identity
- [ ] Verify all under 40k chars
- [ ] Verify FORBIDDEN sections at top

### Task 6: Validate Metrics
- [ ] Check delegation rate: >90%
- [ ] Check cost optimization: >60% cheap services
- [ ] Check compliance violations: 0
- [ ] Check user reminders needed: 0

### Task 7: Document Complete System
- [ ] Update README.md with new delegation system
- [ ] Create MIGRATION_GUIDE.md (old system → new system)
- [ ] Update CHANGELOG.md with all changes
- [ ] Create announcement for user

---

## Testing Scenarios

**Scenario 1: Feature Implementation**
- User: "Add logout button to dashboard"
- Expected Flow:
  1. PS: "Starting delegation workflow"
  2. PS calls mcp_meta_spawn_subagent(task_type="implementation", description="Add logout button")
  3. Odin queried automatically
  4. Subagent selected (implement-feature.md)
  5. Agent spawned with Gemini
  6. PS: "Implementation agent spawned (ID: abc123)"
  7. PS monitors progress
  8. PS reports completion

**Scenario 2: UI Testing**
- User: "Test all forms in the app"
- Expected: PS spawns test-ui-complete.md automatically, never asks permission

**Scenario 3: Infrastructure Change**
- User: "Deploy frontend"
- Expected:
  1. PS allocates port using mcp_meta_allocate_port
  2. PS starts service
  3. PS creates tunnel using tunnel_request_cname
  4. Documentation updated automatically
  5. CLAUDE.md regenerated automatically
  6. Changes committed automatically

---

## Success Criteria

- ✅ PS delegates >90% of tasks
- ✅ PS never implements code directly
- ✅ PS never asks "should I spawn?"
- ✅ Automatic Odin integration working
- ✅ Cost tracking functional
- ✅ Infrastructure MCP tools enforced
- ✅ Auto-documentation working
- ✅ All CLAUDE.md files regenerated
- ✅ System fully documented

---

## Timeline

**Day 3 - Phase 3**
- Duration: 3 hours
- Final epic

---

## Notes

This is the validation that proves the entire system works. If delegation rate >90% and PS never asks permission, we've succeeded.
