# Supervisor-Service Implementation Roadmap

**Version:** 1.0
**Date:** 2026-01-18
**Status:** In Progress - Foundation Complete, Moving to Full Implementation

---

## Executive Summary

**Vision:** A comprehensive multi-project orchestration system enabling a non-coder to manage AI-driven software development across multiple projects using natural language in Claude.ai browser.

**Current Status:** Core infrastructure ~50% complete. Foundation systems (secrets, ports, timing, MCP server, PIV agents) implemented. Ready to proceed with integration, full cloud implementations, and deployment.

**Target Completion:** 3-4 weeks with aggressive parallelization

**Total Epics:** 12 | **Completed:** ~5 | **In Progress:** ~3 | **Remaining:** ~4

---

## Current State Assessment

### ✅ What's Complete (50%)

**EPIC-001: Database Foundation** ✅
- PostgreSQL database configured
- Schema created (secrets, ports, tasks, knowledge)
- Connection pooling implemented
- Unix socket trust authentication working

**EPIC-002: Core MCP Server** ✅
- MCP server implementation (stdio transport)
- Tool routing system
- 9 MCP tools exposed
- Health check endpoints
- Graceful shutdown

**EPIC-003: Secrets Management** ✅
- SecretsManager class with AES-256-GCM encryption
- Hierarchical key paths (meta/project/service)
- MCP tools: store, retrieve, list
- Access tracking
- Audit trail

**EPIC-004: Port Allocation System** ✅
- PortManager class
- Port range allocation (100 per project)
- MCP tools: allocate, list, utilization, release
- Database-enforced ranges
- Conflict prevention guaranteed

**EPIC-007: Task Timing & Estimation** ✅
- TaskTimer class
- Task execution tracking
- MCP tools: start, complete, stats
- Historical data storage
- Estimation algorithm ready

**EPIC-008: Instruction Management** ⚠️ Partial
- InstructionAssembler class implemented
- AdaptLocalClaude class implemented
- Core instructions directory (.supervisor-core/)
- Meta-specific instructions (.supervisor-meta/)
- ✅ CLAUDE.md generation working
- ❌ Automatic triggers not yet implemented

**EPIC-010: PIV Loop Implementation** ⚠️ Partial
- PrimePhase class implemented
- PlanPhase class implemented
- ExecutePhase class implemented
- PIVOrchestrator class implemented
- ❌ Full integration with timing/learning pending
- ❌ End-to-end testing needed

### 🔨 What's In Progress (25%)

**EPIC-005: Cloudflare Integration** 🔨
- CloudflareManager class (stub exists)
- DNS operations designed
- Tunnel sync designed
- ❌ Actual API integration needed
- ❌ MCP tools need implementation

**EPIC-006: GCloud Integration** 🔨
- GCloudManager class (stub exists)
- VM operations designed
- Health monitoring designed
- ❌ Service account integration needed
- ❌ Actual API calls needed
- ❌ MCP tools need implementation

**EPIC-012: Automatic Secret Detection** 🔨
- AutoSecretDetector class implemented
- Pattern recognition ready
- ❌ Integration with supervisor flow needed
- ❌ API key creation for supported providers needed

### ❌ What's Remaining (25%)

**EPIC-009: Learning System Integration** ❌
- LearningsIndex class not started
- RAG integration not started
- Auto-index on file change not implemented
- Supervisor workflow integration not started
- Estimated: 4-6 hours

**EPIC-011: Multi-Project MCP Endpoints** ❌
- Project context isolation designed
- Dynamic endpoint registration designed
- Tool scoping designed
- ❌ Implementation not started
- Estimated: 4-6 hours

**Integration & Testing** ❌
- End-to-end PIV loop testing
- Multi-project workflow validation
- System integration testing
- Performance testing
- Production deployment

---

## Roadmap to Completion

### Phase 1: Complete Core Infrastructure (Week 1)

**Goal:** Finish in-progress epics, achieve 75% completion

**EPIC-005: Cloudflare Integration** (Priority: P1)
- Implement actual Cloudflare API calls
- Add DNS record creation (CNAME, A records)
- Implement tunnel route syncing
- Add /etc/cloudflared/config.yml generation
- Implement cloudflared restart logic
- Create MCP tools
- Test with real domains (153.se, openhorizon.cc)

**Estimated Time:** 8-10 hours with 3 agents in parallel → **3-4 hours**

**Success Criteria:**
- Can create DNS records via MCP tool
- Tunnel routes sync automatically from port allocations
- Zero manual Cloudflare dashboard usage

**EPIC-006: GCloud Integration** (Priority: P1)
- Set up service account authentication
- Implement VM operations (get, start, stop, resize)
- Add health monitoring (CPU, memory, disk)
- Implement automatic scaling logic
- Create MCP tools
- Test with vm-host and openhorizon-prod accounts

**Estimated Time:** 10-14 hours with 4 agents in parallel → **4-5 hours**

**Success Criteria:**
- Can manage VMs across multiple accounts
- Health monitoring working
- Auto-scaling triggers on high CPU
- Zero manual GCloud console usage

**EPIC-012: Automatic Secret Detection** (Priority: P2)
- Complete AutoSecretDetector integration
- Add API key creation for Google, Stripe, GitHub
- Implement secret redaction in logs
- Test with actual API keys

**Estimated Time:** 3-4 hours with 2 agents → **2-3 hours**

**Success Criteria:**
- Detects API keys in user messages
- Stores automatically with correct key paths
- Creates API keys where possible (Google, Stripe, GitHub)

**Phase 1 Total:** ~10 hours with parallelization

---

### Phase 2: Intelligence & Coordination (Week 2)

**Goal:** Complete remaining epics, achieve 90% completion

**EPIC-009: Learning System Integration** (Priority: P2)
- Create LearningsIndex class
- Implement RAG indexing of .md files
- Add semantic search for learnings
- Integrate with supervisor workflow
- Add auto-index on file change (file watcher)
- Create MCP tools

**Estimated Time:** 4-6 hours with 2 agents → **3-4 hours**

**Success Criteria:**
- Learnings automatically indexed
- Supervisors search learnings before planning
- Past mistakes not repeated
- Learning impact tracked

**EPIC-011: Multi-Project MCP Endpoints** (Priority: P2)
- Create ProjectContextManager class
- Implement dynamic endpoint registration
- Add project configuration system
- Implement tool scoping logic
- Update MCP server for multi-endpoint support
- Test with multiple projects

**Estimated Time:** 4-6 hours with 2 agents → **3-4 hours**

**Success Criteria:**
- /mcp/meta, /mcp/consilio, /mcp/odin, etc. all working
- Each endpoint shows only relevant tools
- No context mixing between projects
- Can switch projects by endpoint

**EPIC-008: Complete Instruction Management** (Priority: P1)
- Implement automatic triggers (epic complete, PR merge, monthly)
- Add event listeners
- Test instruction propagation across all projects
- Validate project-specific sections preserved

**Estimated Time:** 2-3 hours with 1 agent → **2-3 hours**

**Success Criteria:**
- One command updates all supervisors
- Instructions auto-update on triggers
- Project customizations preserved

**EPIC-010: Complete PIV Loop Integration** (Priority: P1)
- Integrate PIV loop with task timing
- Integrate with learning system
- Add full validation testing
- End-to-end PIV cycle test
- Document PIV workflow

**Estimated Time:** 4-5 hours with 2 agents → **3-4 hours**

**Success Criteria:**
- PIV loop runs end-to-end autonomously
- Creates feature branch, implements, validates, creates PR
- Integrates with timing and learnings
- High-quality output with Haiku execution

**Phase 2 Total:** ~15 hours with parallelization

---

### Phase 3: Integration & Testing (Week 3)

**Goal:** Full system integration, comprehensive testing

**System Integration**
- Connect all 12 epics together
- Test full deployment workflow
- Validate multi-project orchestration
- Test resource allocation across projects
- Verify PIV loop with all infrastructure

**Key Integration Tests:**
1. **Full Deployment Test**
   - User: "Deploy new API service for Consilio"
   - System: Allocates port, creates DNS, deploys, syncs tunnel
   - Validation: Service accessible via HTTPS

2. **Multi-Project Parallelism**
   - Spawn 5 PIV agents for Consilio (dark mode)
   - Spawn 3 PIV agents for Odin (parser)
   - Verify resource allocation works
   - Verify no context mixing

3. **Infrastructure Automation**
   - VM scaling on high CPU
   - DNS creation automatic
   - Secret retrieval seamless
   - Port allocation conflict-free

4. **Learning System**
   - Make mistake in implementation
   - Record learning
   - Verify supervisor avoids mistake next time
   - Measure impact (time saved)

**Testing Tasks:**
- Unit tests for all managers (80%+ coverage)
- Integration tests for workflows
- End-to-end tests for user scenarios
- Performance testing (20 concurrent agents)
- Security testing (secret encryption, access control)

**Estimated Time:** 12-15 hours

**Success Criteria:**
- All 12 epics integrated and working together
- All tests passing
- Performance acceptable (< 500ms MCP tool calls)
- Security validated
- Documentation complete

---

### Phase 4: Claude.ai Projects Setup (Week 3-4)

**Goal:** Multi-tab workflow ready for production

**Claude.ai Projects Creation**
1. Create 5 Claude.ai Projects:
   - Meta-Supervisor
   - Consilio
   - Odin
   - Health-Agent
   - OpenHorizon

2. Configure each Project:
   - Connect to appropriate MCP endpoint
   - Upload project-specific knowledge
   - Add custom instructions (CLAUDE.md)
   - Test tool availability

3. Validate Multi-Tab Workflow:
   - Open 5 browser tabs
   - Pin tabs for persistence
   - Test switching between projects
   - Verify context isolation
   - Test mobile access (Claude.ai app)

**Configuration Files:**

Create `.claude/config.json` for each project:
```json
{
  "mcpServers": {
    "supervisor-consilio": {
      "command": "node",
      "args": ["/home/samuel/sv/supervisor-service/dist/mcp/server.js"],
      "env": {
        "PROJECT_NAME": "consilio"
      }
    }
  }
}
```

**Estimated Time:** 4-6 hours

**Success Criteria:**
- 5 Claude.ai Projects configured and working
- Each tab accesses correct MCP endpoint
- Tools scoped correctly per project
- Can work on multiple projects simultaneously
- Mobile access working

---

### Phase 5: Production Deployment (Week 4)

**Goal:** Deploy to production, migrate from old system

**Production Deployment**
1. **Service Deployment:**
   - Create systemd service for supervisor-service
   - Configure auto-start on boot
   - Set up logging
   - Monitor health checks
   - Configure backup encryption key

2. **Database Migration:**
   - Migrate existing secrets to new system
   - Import current port allocations
   - Sync Cloudflare DNS records
   - Create GCloud service accounts

3. **Verification:**
   - All services still accessible
   - No port conflicts
   - Tunnel routes correct
   - GCloud access working
   - Secrets retrievable

**systemd Service:**
```ini
[Unit]
Description=Supervisor Service - Multi-Project AI Orchestration
After=network.target postgresql.service

[Service]
Type=simple
User=samuel
WorkingDirectory=/home/samuel/sv/supervisor-service
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
EnvironmentFile=/home/samuel/sv/supervisor-service/.env

[Install]
WantedBy=multi-user.target
```

**Migration Plan:**
- Week 1: Run both systems in parallel
- Week 2: Migrate one project (Odin recommended)
- Week 3: Migrate remaining projects
- Week 4: Retire old system

**Estimated Time:** 8-10 hours

**Success Criteria:**
- Supervisor-service running as systemd service
- All secrets migrated and accessible
- All ports allocated correctly
- DNS records synced
- GCloud service accounts configured
- Zero downtime migration
- Old system retired

---

## Success Metrics & Milestones

### Completion Milestones

**75% Complete (End of Week 1):**
- ✅ Cloudflare integration complete
- ✅ GCloud integration complete
- ✅ Automatic secret detection working
- ✅ All infrastructure managers functional

**90% Complete (End of Week 2):**
- ✅ Learning system integrated
- ✅ Multi-project MCP endpoints working
- ✅ Instruction management complete
- ✅ PIV loop fully integrated

**100% Complete (End of Week 4):**
- ✅ All testing complete
- ✅ Claude.ai Projects configured
- ✅ Production deployment successful
- ✅ Migration from old system complete

### Performance Metrics

**Target Metrics (From PRD):**
- MCP tool call response time: < 500ms (p95)
- Secret retrieval: < 100ms (p95)
- Port allocation: < 200ms (p95)
- DNS record creation: < 2s (p95)
- VM operations: < 180s (p95)
- Estimation accuracy: 90% within 20% of actual
- Port conflicts: 0 (guaranteed)
- Estimation error: < 10% average

### Cost Optimization

**Token Usage Reduction:**
- Planning: Sonnet 4.5 (high quality)
- Execution: Haiku 4 (cost-effective)
- Expected savings: 60-85% vs all-Sonnet

**Estimated Monthly Cost:**
- Current (all-Sonnet): ~$800/month
- Optimized (Sonnet + Haiku): ~$320/month
- **Savings: $480/month**

---

## Epic Dependency Graph

```
EPIC-001 (Database) ✅
    ├── EPIC-002 (MCP Server) ✅
    │   ├── EPIC-003 (Secrets) ✅
    │   │   ├── EPIC-005 (Cloudflare) 🔨 [Week 1]
    │   │   ├── EPIC-006 (GCloud) 🔨 [Week 1]
    │   │   └── EPIC-012 (Auto-secrets) 🔨 [Week 1]
    │   ├── EPIC-004 (Ports) ✅
    │   │   └── EPIC-005 (Cloudflare) 🔨 [Week 1]
    │   ├── EPIC-007 (Timing) ✅
    │   │   ├── EPIC-009 (Learning) ❌ [Week 2]
    │   │   └── EPIC-010 (PIV Loop) ⚠️ [Week 2]
    │   ├── EPIC-008 (Instructions) ⚠️ [Week 2]
    │   │   └── EPIC-010 (PIV Loop) ⚠️ [Week 2]
    │   └── EPIC-011 (Multi-endpoint) ❌ [Week 2]

Legend:
✅ Complete
⚠️ Partial (in progress)
🔨 In progress (stubs exist)
❌ Not started
```

---

## Parallelization Strategy

### Week 1 Agents (Maximum 4 concurrent)
**Agent 1:** EPIC-005 Cloudflare (DNS operations)
**Agent 2:** EPIC-005 Cloudflare (Tunnel sync)
**Agent 3:** EPIC-006 GCloud (VM operations)
**Agent 4:** EPIC-006 GCloud (Health monitoring)

### Week 2 Agents (Maximum 4 concurrent)
**Agent 1:** EPIC-009 Learning (RAG indexing)
**Agent 2:** EPIC-011 Multi-endpoint (Project contexts)
**Agent 3:** EPIC-010 PIV integration (Timing + Learning)
**Agent 4:** EPIC-008 Instruction triggers

### Week 3 Agents (Testing)
**Agent 1-2:** Integration testing
**Agent 3-4:** End-to-end testing

---

## Risk Assessment & Mitigation

### High-Priority Risks

**Risk 1: API Rate Limits**
- **Impact:** Could block deployments
- **Mitigation:** Rate limit tracking, request queuing, exponential backoff, response caching
- **Probability:** Medium
- **Status:** Not yet implemented

**Risk 2: Secret Encryption Key Loss**
- **Impact:** All secrets inaccessible (critical)
- **Mitigation:** Store key in multiple locations (systemd + .bashrc + documented), backup to 1Password
- **Probability:** Low
- **Status:** Key stored in .env, needs backup plan

**Risk 3: Port Range Exhaustion**
- **Impact:** Can't deploy more services
- **Mitigation:** 100 ports per project is generous, monitor at 80%, can expand range
- **Probability:** Very Low
- **Status:** Monitoring not yet implemented

**Risk 4: Context Window Limits**
- **Impact:** Slower responses, higher cost
- **Mitigation:** Automatic summarization, subagent delegation, context handoff
- **Probability:** Medium
- **Status:** Context handoff system designed

**Risk 5: PIV Loop Complexity**
- **Impact:** Delays in autonomous feature development
- **Mitigation:** Start with simple features, thorough testing, iterative improvement
- **Probability:** Medium
- **Status:** Basic implementation exists, needs testing

---

## Next Actions (Prioritized)

### Immediate (This Week)

1. **Complete EPIC-005: Cloudflare Integration**
   - Implement actual Cloudflare API calls
   - Test DNS creation with 153.se
   - Test tunnel route syncing
   - Estimated: 3-4 hours

2. **Complete EPIC-006: GCloud Integration**
   - Set up service account authentication
   - Implement VM operations
   - Test with vm-host account
   - Estimated: 4-5 hours

3. **Complete EPIC-012: Automatic Secret Detection**
   - Finish integration
   - Add API key creation
   - Test secret redaction
   - Estimated: 2-3 hours

**Week 1 Total:** ~10 hours

### Next Week

4. **Implement EPIC-009: Learning System**
   - Create LearningsIndex
   - RAG integration
   - Auto-indexing
   - Estimated: 3-4 hours

5. **Implement EPIC-011: Multi-Project Endpoints**
   - Project context isolation
   - Dynamic endpoints
   - Tool scoping
   - Estimated: 3-4 hours

6. **Complete EPIC-008 & EPIC-010**
   - Instruction triggers
   - PIV integration
   - End-to-end testing
   - Estimated: 5-7 hours

**Week 2 Total:** ~15 hours

### Following Weeks

7. **Integration & Testing (Week 3)**
   - System integration
   - Comprehensive testing
   - Performance optimization
   - Estimated: 12-15 hours

8. **Production Deployment (Week 4)**
   - Claude.ai Projects setup
   - Service deployment
   - Migration from old system
   - Estimated: 12-16 hours

---

## Resources Required

### Infrastructure
- ✅ PostgreSQL 14+ (already configured)
- ✅ GCP VM (already running)
- ✅ Cloudflare account (already have)
- ⚠️ GCloud service accounts (need to create)
- ✅ Node.js 20+ (already installed)

### APIs & Services
- ✅ Anthropic API (have key)
- ⚠️ Cloudflare API token (need to verify access)
- ❌ GCloud service account keys (need to create)
- ✅ GitHub API (already integrated)

### Development Tools
- ✅ Claude Code (for implementation)
- ✅ MCP protocol (already implemented)
- ✅ TypeScript toolchain (already configured)
- ✅ Database migrations (schema exists)

---

## Documentation Status

### Complete Documentation
- ✅ Project Brief
- ✅ PRD (Product Requirements Document)
- ✅ Technical Specification
- ✅ Epic Breakdown (12 epics)
- ✅ PIV Loop Adaptation Guide
- ✅ Infrastructure Systems Summary
- ✅ Final Architecture Decisions
- ✅ BMAD Methodology Guide

### Documentation Needed
- ❌ API Integration Guide (Cloudflare, GCloud)
- ❌ Deployment Runbook
- ❌ Troubleshooting Guide
- ❌ User Manual (for non-coder)
- ❌ Migration Guide (from old system)

---

## Timeline Summary

**Total Estimated Time:** 47-56 hours sequential → **3-4 weeks with parallelization**

| Week | Focus | Hours | Status |
|------|-------|-------|--------|
| Week 1 | Complete Infrastructure (EPIC-005, 006, 012) | ~10 | Ready to start |
| Week 2 | Intelligence & Coordination (EPIC-009, 011, 008, 010) | ~15 | Pending Week 1 |
| Week 3 | Integration & Testing | ~15 | Pending Week 2 |
| Week 4 | Production Deployment | ~14 | Pending Week 3 |

**Current Progress:** ~50% complete (6/12 epics done or mostly done)

**Path to 100%:**
- Week 1: → 75% complete
- Week 2: → 90% complete
- Week 3: → 95% complete
- Week 4: → 100% complete

---

## Conclusion

**Status:** Well-positioned for successful completion. Foundation is solid (~50% done), core infrastructure working. Remaining work is primarily:
1. API integrations (Cloudflare, GCloud)
2. Intelligence features (Learning, Multi-project)
3. Testing and production deployment

**Confidence Level:** High - Core systems proven, design validated, clear path forward

**Recommended Approach:**
1. Start Week 1 work immediately (Cloudflare + GCloud integration)
2. Maintain parallel development (3-4 agents simultaneously)
3. Test incrementally (validate each epic before moving forward)
4. Deploy to production early Week 4
5. Iterate based on real-world usage

**This roadmap provides a clear, actionable path from current 50% completion to full production deployment in 3-4 weeks.**

---

**END OF ROADMAP**

**Next Step:** Begin Week 1 implementation - EPIC-005 Cloudflare Integration
