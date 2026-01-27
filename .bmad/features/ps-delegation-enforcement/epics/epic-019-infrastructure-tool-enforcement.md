# Epic 019: Infrastructure Tool Enforcement

**Status**: Completed
**Priority**: P0 - Critical
**Complexity**: Medium
**Estimated Effort**: 4 hours
**Dependencies**: None
**Related PRD**: PRD-PS-Delegation-Enforcement.md

---

## Overview

Add validation to existing MCP tools to enforce correct usage, prevent bypasses, and auto-update documentation after infrastructure changes.

---

## Goals

1. Validate prerequisites in all infrastructure MCP tools
2. Reject violations with helpful error messages
3. Implement automatic documentation update workflow
4. Ensure 100% MCP tool usage (no manual bypasses)

---

## Acceptance Criteria

- [x] tunnel_request_cname validates: port allocated, in range, service running
- [x] mcp_meta_set_secret validates: key path format, description provided
- [x] mcp_meta_allocate_port validates: port in assigned range, not already allocated
- [x] Automatic documentation workflow: tunnel creation returns mandatory auto-update instructions for PS
- [x] All validations return helpful errors directing to correct MCP tool

---

## Tasks

### Task 1: Add Validation to tunnel_request_cname
- [ ] Check port is allocated to requesting project
- [ ] Check port is within project's assigned range
- [ ] Check service is running on that port (curl localhost:PORT)
- [ ] Return error if any check fails: "Port 5000 not allocated to your project. Use mcp_meta_allocate_port first."

### Task 2: Add Validation to mcp_meta_set_secret
- [ ] Validate key path format: project/{project-name}/{secret-name-lowercase}
- [ ] Validate description provided and >10 characters
- [ ] Return reminder to add to .env after storing
- [ ] Reject if validation fails: "Key path must follow format: project/{project}/{secret}"

### Task 3: Add Validation to mcp_meta_allocate_port
- [ ] Check port is within assigned range for requesting project
- [ ] Check port not already allocated (query database)
- [ ] Record allocation in database
- [ ] Reject if outside range: "Port 3000 outside your assigned range (5200-5299)"

### Task 4: Implement Auto-Documentation Workflow
- [ ] After tunnel_request_cname succeeds:
  1. Call mcp_meta_spawn_subagent with task_type="documentation", description="Update deployment docs with new tunnel"
  2. Agent updates .supervisor-specific/02-deployment-status.md
  3. Agent runs: npm run init-projects -- --project {project} to regenerate CLAUDE.md
  4. Agent commits and pushes changes
- [ ] NO PERMISSION NEEDED - this is mandatory workflow
- [ ] Return to PS: "Tunnel created. Documentation updated automatically."

### Task 5: Update PS Instructions
- [ ] Add infrastructure FORBIDDEN rules to 01-identity.md (done in Epic 015)
- [ ] Reference validation errors in instructions
- [ ] Add examples of correct MCP tool usage

---

## Testing

**Test 1: Port Allocation Enforcement**
- PS tries: tunnel_request_cname for port 3000 (not allocated)
- Expected: Error "Port 3000 not allocated to your project"
- PS allocates: mcp_meta_allocate_port(port=5200)
- PS creates tunnel: tunnel_request_cname(port=5200)
- Expected: Success

**Test 2: Secrets Validation**
- PS tries: mcp_meta_set_secret with invalid key path "my_secret"
- Expected: Error "Key path must follow format: project/{project}/{secret}"
- PS retries: mcp_meta_set_secret with "project/consilio/stripe_key"
- Expected: Success

**Test 3: Auto-Documentation**
- PS creates tunnel
- Expected: update-deployment-docs.md subagent spawned automatically
- Expected: CLAUDE.md regenerated automatically
- Expected: Changes committed automatically
- Expected: Next PS session has updated deployment info

---

## Timeline

**Day 3 - Phase 3**
- Duration: 4 hours

---
