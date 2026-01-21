# Epic 019: Infrastructure Tool Enforcement - Implementation Plan

## Overview
Add validation to existing MCP infrastructure tools to enforce correct usage patterns and prevent bypasses.

## Files to Modify

### 1. src/tunnel/CNAMEManager.ts
**Location**: Lines 50-60 (TODO comment exists)

**Add validation**:
```typescript
// Validate port allocation
const portAllocations = await this.portManager.listByProject(request.projectName);
const portAllocation = portAllocations.find(a => a.portNumber === request.targetPort);

if (!portAllocation) {
  return {
    success: false,
    error: `Port ${request.targetPort} not allocated to project ${request.projectName}`,
    recommendation: `Use mcp_meta_allocate_port to allocate port ${request.targetPort} first. Your project's port range: check .supervisor-specific/02-deployment-status.md`
  };
}

// Validate port is in assigned range
const portRanges = await this.portManager.getPortRanges();
const projectRange = portRanges.find(r => r.rangeName === request.projectName);

if (!projectRange) {
  return {
    success: false,
    error: `No port range assigned to project ${request.projectName}`,
    recommendation: 'Contact meta-supervisor to assign port range'
  };
}

if (request.targetPort < projectRange.startPort || request.targetPort > projectRange.endPort) {
  return {
    success: false,
    error: `Port ${request.targetPort} outside assigned range (${projectRange.startPort}-${projectRange.endPort})`,
    recommendation: `Choose a port within your assigned range: ${projectRange.startPort}-${projectRange.endPort}`
  };
}

// Validate service is running on that port
const portInUse = await this.portManager.verifyPort(request.targetPort);
if (!portInUse) {
  return {
    success: false,
    error: `Service not running on port ${request.targetPort}`,
    recommendation: 'Start your service first, then create tunnel. Verify with: curl localhost:' + request.targetPort
  };
}
```

### 2. src/mcp/tools/secrets-tools.ts
**Location**: Lines 108-162 (setSecretTool handler)

**Add validation before line 135**:
```typescript
// Validate key path format
const keyPathRegex = /^(meta|project|service)\/[a-z0-9-_]+\/[a-z0-9-_]+$/;
if (!keyPathRegex.test(params.keyPath)) {
  return {
    success: false,
    error: 'Invalid key path format',
    keyPath: params.keyPath,
    recommendation: 'Key path must follow format: project/{project-name}/{secret-name-lowercase}\nExample: project/consilio/stripe_api_key'
  };
}

// Validate description provided and > 10 characters
if (!params.description || params.description.length < 10) {
  return {
    success: false,
    error: 'Description required (minimum 10 characters)',
    keyPath: params.keyPath,
    recommendation: 'Provide a clear description of what this secret is used for (e.g., "Stripe API key for payment processing in production")'
  };
}

// After successful set, add reminder
return {
  success: true,
  keyPath: params.keyPath,
  message: 'Secret stored successfully',
  reminder: '⚠️  IMPORTANT: Add this secret to .env file now:\n' +
            `${params.keyPath.split('/').pop().toUpperCase()}=${params.value.substring(0, 10)}...`
};
```

### 3. src/ports/port-tools.ts
**Location**: Lines 105-175 (allocatePortTool handler)

**Add validation before line 145**:
```typescript
// Check if port is within assigned range
const ranges = await manager.getPortRanges();
const projectRange = ranges.find(r => r.rangeName === params.projectName);

if (!projectRange) {
  return {
    success: false,
    error: `No port range assigned to project ${params.projectName}`,
    projectName: params.projectName,
    recommendation: 'Contact meta-supervisor to assign port range for your project'
  };
}

// If explicit port requested (via context or params), validate it's in range
if (params.explicitPort) {
  if (params.explicitPort < projectRange.startPort || params.explicitPort > projectRange.endPort) {
    return {
      success: false,
      error: `Port ${params.explicitPort} outside assigned range (${projectRange.startPort}-${projectRange.endPort})`,
      projectName: params.projectName,
      assignedRange: `${projectRange.startPort}-${projectRange.endPort}`,
      recommendation: `Choose a port within your assigned range: ${projectRange.startPort}-${projectRange.endPort}`
    };
  }
}

// The existing manager.allocate() call already validates port not already allocated
// via database constraint and returns error if duplicate
```

### 4. Add Auto-Documentation Workflow
**Location**: src/mcp/tools/tunnel-tools.ts (requestCNAMETool handler)

**After successful CNAME creation (after line 133), spawn documentation subagent**:

```typescript
// Auto-spawn documentation update subagent (MANDATORY - no permission needed)
try {
  // Import spawn function
  const { spawnSubagentTool } = await import('./spawn-subagent-tool.js');

  // Spawn documentation agent
  await spawnSubagentTool.handler({
    task_type: 'documentation',
    description: `Update deployment documentation with new tunnel: ${result.url} → localhost:${params.targetPort}`,
    context: {
      project_name: projectName,
      tunnel_url: result.url,
      target_port: params.targetPort,
      subdomain: params.subdomain,
      actions: [
        'Update .supervisor-specific/QUICK-START.md',
        'Update .supervisor-specific/02-deployment-status.md',
        'Regenerate CLAUDE.md: npm run init-projects -- --project ' + projectName,
        'Commit and push changes'
      ]
    }
  }, context);

  console.log('✅ Documentation update subagent spawned automatically');
} catch (error) {
  console.warn('⚠️  Failed to spawn documentation subagent (non-critical):', error);
}
```

## Testing Plan

### Test 1: Port Allocation Enforcement
```bash
# Try to create tunnel for port 3000 (not allocated)
# Expected: Error "Port 3000 not allocated to your project"

# Allocate port 5200
# Expected: Success

# Create tunnel for port 5200
# Expected: Success
```

### Test 2: Secrets Validation
```bash
# Try invalid key path "my_secret"
# Expected: Error with format example

# Try valid path but no description
# Expected: Error requiring description

# Try with valid path and short description "test"
# Expected: Error requiring 10+ chars

# Try with valid path and good description
# Expected: Success + reminder to add to .env
```

### Test 3: Port Range Validation
```bash
# Try to allocate port 3000 for consilio (outside range 5000-5099)
# Expected: Error with assigned range

# Try to allocate port 5050 for consilio
# Expected: Success
```

### Test 4: Auto-Documentation
```bash
# Create tunnel successfully
# Expected: Documentation subagent spawned
# Expected: CLAUDE.md regenerated
# Expected: Changes committed
# Expected: Next session has updated deployment info
```

## Implementation Notes

1. All validation must return helpful error messages
2. Error messages must direct to correct MCP tool
3. Auto-documentation is MANDATORY (no user permission needed)
4. Maintain backward compatibility with existing calls
5. Log validation failures for debugging

## Success Criteria

- [ ] All 3 MCP tools have validation
- [ ] All validation returns helpful errors
- [ ] Auto-documentation workflow works end-to-end
- [ ] All tests pass
- [ ] No regression in existing functionality
