# Research: Gemini CLI for PS Sessions - Context Window Strategy Analysis

**Research Date**: 2026-01-24
**Research Agent**: Prime Research (READ-ONLY)
**Project**: Meta-Supervisor Infrastructure
**Research Question**: Should PS (Project-Supervisor) sessions switch from Claude Code to Gemini CLI given context window constraints?

---

## Executive Summary

**Recommendation: NO - Do not switch PS to Gemini CLI**

The PS role is fundamentally a **coordination role, not an execution role**. Context window bloat in PS sessions is a symptom of PS violating its core identity by doing execution work (reading files, researching codebases, writing code) rather than delegating to subagents via `mcp_meta_spawn_subagent`.

**Key Finding**: The problem is NOT the 200k context window limit. The problem is PS sessions filling that context with execution work instead of delegation commands.

**Better Solution**: Enforce PS delegation discipline + optimize CLAUDE.md size, rather than switching to a different AI platform that may not support the tools and capabilities PS needs.

---

## 1. What Causes Context Window Bloat in PS Sessions?

### Analysis of PS Role and Typical Session Patterns

**PS Core Identity (from .supervisor-core/01-identity.md:3-16)**:
```
YOU ARE A COORDINATOR, NOT AN EXECUTOR

FORBIDDEN: Execution Tasks
- ❌ Writing/editing ANY code, tests, configs, documentation
- ❌ Researching codebases, analyzing architecture
- ❌ Creating epics, PRDs, ADRs, plans
- ❌ Running tests, validations, builds

IF YOU DO EXECUTION WORK, YOU HAVE FAILED AS SUPERVISOR.
```

**PS ONLY Responsibilities (from .supervisor-core/01-identity.md:65-71)**:
1. Coordinate: Spawn subagents, monitor progress
2. Git: Commit subagent's code (not your own), push, create PRs
3. Report: SHORT updates (2-3 lines), completion notices
4. State: Track epics, regenerate CLAUDE.md when needed

### Context Window Consumption by Task Type

| Task Type | Tokens Used (Approx) | Should PS Do This? | Correct Approach |
|-----------|---------------------|-------------------|------------------|
| **Spawn subagent** | 500-1,000 | ✅ YES | Use `mcp_meta_spawn_subagent` |
| **Monitor PIV status** | 300-500 | ✅ YES | Check status, brief updates |
| **Git operations** | 500-1,500 | ✅ YES | Commit, push, create PR |
| **Research codebase** | 5,000-15,000 | ❌ NO | Spawn research subagent |
| **Write code** | 10,000-50,000 | ❌ NO | Spawn implementation subagent |
| **Run tests/validation** | 3,000-10,000 | ❌ NO | Spawn validation subagent |
| **Create documentation** | 2,000-8,000 | ❌ NO | Spawn documentation subagent |

**Context Window Bloat Sources**:

1. **PS doing research work**: Reading 10-20 files to understand codebase (5k-15k tokens)
2. **PS writing code**: Implementing features directly (10k-50k tokens)
3. **PS debugging**: Reading error logs, analyzing failures (3k-10k tokens)
4. **PS creating plans**: Writing implementation plans manually (2k-8k tokens)
5. **Oversized CLAUDE.md**: Current size ~40k characters = ~10k tokens

**Estimated Healthy PS Session**:
- 10k tokens: Initial CLAUDE.md load
- 5k tokens: Spawning 10 subagents (500 tokens each)
- 3k tokens: Git operations (commits, PRs)
- 2k tokens: Status monitoring and reporting
- **Total: ~20k tokens** (10% of 200k window)

**Estimated Bloated PS Session** (PS violating identity):
- 10k tokens: Initial CLAUDE.md load
- 15k tokens: Research (reading files instead of spawning research agent)
- 30k tokens: Implementation (writing code instead of spawning implementation agent)
- 10k tokens: Testing (running tests instead of spawning validation agent)
- 8k tokens: Planning (creating plans instead of spawning planning agent)
- **Total: ~73k tokens** (37% of 200k window, 3.6x healthy)

### Root Cause Diagnosis

**Primary Issue**: PS sessions exhaust context because PS attempts execution work instead of delegating.

**Evidence from ps-role-guide.md**:
- Lines 76-85: "Context Window Efficiency" - PS uses 500 tokens to spawn, subagent uses 10k in separate context
- Lines 145-163: "The 'Should I Spawn?' Anti-Pattern" - PS asking permission instead of delegating immediately
- Lines 329-427: "What PSes NEVER Do" - Extensive list of forbidden execution tasks

**Secondary Issue**: CLAUDE.md files are 30k-40k characters (~7.5k-10k tokens), consuming 5% of context upfront.

---

## 2. PS Role Requirements: Coordination vs Execution

### Core PS Capabilities Needed

**From ps-role-guide.md:195-287**, PS actually does:

1. **Coordinate Subagents** (coordination)
   - Spawn subagents via MCP tool
   - Monitor progress
   - Handle failures/retries
   - Requires: Tool calling, state tracking

2. **Handle Git Operations** (coordination)
   - `git add`, `git commit`, `git push`
   - Create PRs via `gh` CLI
   - Requires: Bash execution, understanding git workflow

3. **Manage Infrastructure** (coordination)
   - MCP tool calls: `mcp_meta_allocate_port`, `tunnel_request_cname`, `mcp_meta_set_secret`
   - Requires: Tool calling, understanding infrastructure patterns

4. **Report Progress** (coordination)
   - Brief status updates (2-3 lines)
   - Completion notices
   - Requires: Concise communication, awareness of project state

5. **Track State** (coordination)
   - Know which epics complete, in-progress
   - Update deployment documentation (via subagent)
   - Requires: Memory of session context, documentation patterns

### Capabilities PS Does NOT Need

**From ps-role-guide.md:329-427**, PS NEVER does:

1. ❌ Write/edit code
2. ❌ Research codebases (read files, analyze architecture)
3. ❌ Run tests/validation
4. ❌ Debug/fix issues
5. ❌ Create documentation (except triggering subagent for deployment docs)
6. ❌ Ask permission during execution
7. ❌ Run manual infrastructure commands

**Key Insight**: PS is NOT a coding agent. PS is a **task orchestration agent**.

### Skill Requirements Analysis

| Capability | Required for PS? | Claude Strength | Gemini Strength | Verdict |
|------------|-----------------|-----------------|----------------|---------|
| Tool calling (MCP) | ✅ Critical | Excellent (native) | Good | Claude advantage |
| Bash execution (git) | ✅ Critical | Excellent | Good | Claude advantage |
| Code understanding | ❌ NOT NEEDED | Excellent | Good | N/A (shouldn't use) |
| Concise reporting | ✅ Important | Excellent | Good | Comparable |
| State tracking | ✅ Important | Excellent | Good | Comparable |
| Long-context reasoning | ❌ NOT NEEDED | Good | Excellent (2M) | N/A (if delegating) |
| Agentic behavior | ✅ Critical | Industry leader | Good | Claude advantage |

**Conclusion**: Claude's strengths align better with PS coordination role (tool calling, bash, agentic behavior). Gemini's 2M context window advantage is irrelevant if PS delegates properly.

---

## 3. Gemini Suitability for PS Coordination Role

### Gemini CLI Analysis

**Installed Tool**: `/usr/local/bin/gemini`

**Capabilities**:
```bash
usage: gemini [-h] [-p PROMPT] [--output-format {json,text}] [--file FILE]
              [--model MODEL] [--project PROJECT] [--location LOCATION]

options:
  -p, --prompt PROMPT   Prompt to send to Gemini
  --output-format {json,text}
  --file FILE           Context files to include
  --model MODEL         Model to use (default: gemini-2.0-flash-exp)
```

**Limitations Identified**:

1. **No MCP Integration**: Gemini CLI is a simple prompt-response tool, not an MCP client
   - PS needs: `mcp_meta_spawn_subagent`, `tunnel_request_cname`, `mcp_meta_allocate_port`, etc.
   - Gemini CLI: Only supports `--prompt` and `--file` (context files)
   - **Blocker**: Cannot call MCP tools, which are fundamental to PS role

2. **No Tool Calling**: No native tool/function calling support in this CLI
   - PS needs: Structured tool calls with parameters
   - Gemini CLI: Text-based prompt/response only
   - **Blocker**: Cannot invoke infrastructure tools or spawn subagents

3. **No Bash Execution**: No integrated Bash tool
   - PS needs: `git add`, `git commit`, `git push`, `gh pr create`
   - Gemini CLI: User would need to copy/paste commands manually
   - **Blocker**: Cannot handle git operations autonomously

4. **No Session Persistence**: Each CLI invocation is isolated
   - PS needs: Track epics, maintain state across conversation
   - Gemini CLI: Stateless, no conversation history
   - **Blocker**: Cannot maintain awareness of project progress

### Gemini Model Capabilities (API-based)

**From ai-models-reference.md**:

**Gemini 3 Pro Preview**:
- Context window: 2M tokens (10x Claude Code's 200k)
- Best for: State-of-the-art reasoning, multimodal, agentic tasks
- Cost: ~$0.075 per 1M tokens (cheap)
- Status: Preview

**Gemini 2.5 Flash Lite**:
- Context window: 1M tokens (5x Claude Code)
- Best for: Production use, fast responses
- Cost: ~$0.075 per 1M tokens
- Status: Stable

**Gemini Tool Calling**: Supported via API (not CLI)
- Can call functions/tools
- Can maintain conversation state
- BUT: No integration with Claude Code's MCP ecosystem

### Compatibility Assessment

| Requirement | Claude Code | Gemini CLI | Gemini API | Verdict |
|-------------|-------------|------------|------------|---------|
| MCP tool calling | ✅ Native | ❌ Not supported | ❌ Different ecosystem | Claude only |
| Bash execution | ✅ Integrated | ❌ Manual | ❌ External | Claude only |
| Git operations | ✅ Autonomous | ❌ Manual copy/paste | ❌ External script | Claude only |
| Session state | ✅ Conversation history | ❌ Stateless | ✅ With wrapper | Claude better |
| 2M context | ❌ 200k only | ✅ 2M | ✅ 2M | Gemini advantage |
| Agentic behavior | ✅ Industry leader | ❌ Basic CLI | ⚠️ Good (via API) | Claude advantage |

**Critical Gap**: Gemini CLI/API cannot access MCP tools (`mcp_meta_spawn_subagent`, etc.), which are the core of the PS delegation workflow.

**Migration Feasibility**: **NOT FEASIBLE** without rebuilding entire infrastructure to support Gemini API + custom tooling wrapper + MCP re-implementation.

---

## 4. Hybrid Model Analysis: Gemini PS + Claude Subagents

### Proposed Architecture

```
User → Gemini PS (coordination) → Odin (AI router) → Claude/Gemini Subagents (execution)
```

**Theory**: Gemini PS uses 2M context for coordination, delegates to Claude subagents via Odin.

### Implementation Challenges

**Challenge 1: MCP Tool Access**

- **Current**: Claude Code has native MCP client, calls `mcp_meta_spawn_subagent` directly
- **Gemini**: No MCP client, would need custom tool wrapper
- **Solution**: Build custom Python/Node wrapper to expose MCP tools to Gemini API
- **Effort**: Significant (1-2 weeks development + testing)

**Challenge 2: Bash Integration**

- **Current**: Claude Code has Bash tool, runs `git` commands directly
- **Gemini**: No Bash tool, would need to surface commands to user or external executor
- **Solution**: Build command execution wrapper
- **Effort**: Medium (3-5 days)

**Challenge 3: Session Management**

- **Current**: Claude Code manages conversation state automatically
- **Gemini API**: Requires manual conversation state management
- **Solution**: Build stateful session wrapper
- **Effort**: Medium (3-5 days)

**Challenge 4: Cost Analysis**

**Current (Claude Code PS + Claude Subagents)**:
- PS session: 20k tokens (if delegating properly) = ~$0.60 @ Claude Sonnet rate
- Subagents: Auto-select via Odin (80% Gemini, 20% Claude) = ~$0.15 average per task

**Proposed (Gemini PS + Claude Subagents)**:
- PS session: 20k tokens (Gemini 3 Pro) = ~$0.0015 (400x cheaper!)
- Subagents: Same as current = ~$0.15 average per task
- **Savings**: ~$0.60 per PS session

**BUT**: Development cost to build Gemini wrapper infrastructure = ~2-3 weeks = ~$5,000-10,000 equivalent
**Break-even**: ~8,000-16,000 PS sessions

**Current Usage**: Estimate ~10-20 PS sessions per day = ~5-10 per day after optimizations
**Break-even Time**: ~2-4 years

### Verdict: Not Cost-Effective

**Pros**:
- ✅ 10x context window (2M vs 200k)
- ✅ Cheaper per-token cost (~400x for PS sessions)
- ✅ Future-proofing for very long sessions

**Cons**:
- ❌ High development cost (2-3 weeks)
- ❌ Maintenance burden (custom wrapper)
- ❌ Loss of Claude's superior agentic capabilities
- ❌ Loss of native MCP integration
- ❌ Long break-even period (2-4 years)
- ❌ Doesn't address ROOT CAUSE (PS doing execution work)

**Recommendation**: NOT worth the investment given current usage patterns and root cause.

---

## 5. Trade-offs: Context Window Gains vs Capability Losses

### What Gemini Offers

**Gains**:
1. **10x context window**: 2M tokens vs 200k (Gemini 3 Pro)
2. **Cost savings**: ~$0.075 per 1M tokens vs ~$3-15 for Claude
3. **Google ecosystem**: Integration with Google AI Studio, Vertex AI

### What Would Be Lost

**Losses**:
1. **Native MCP integration**: Claude Code's built-in MCP client
2. **Integrated Bash tool**: Autonomous git operations, CLI commands
3. **Agentic excellence**: Claude Opus 4.5 is "industry leader in coding, agents, computer use"
4. **Tool calling ecosystem**: Claude's function calling is more mature
5. **Development velocity**: Working system vs 2-3 weeks rebuilding infrastructure
6. **User familiarity**: Team already knows Claude Code workflow

### Context Window Reality Check

**If PS delegates properly** (as designed):
- 10k tokens: CLAUDE.md load
- 5k tokens: Spawning 10 subagents
- 3k tokens: Git operations
- 2k tokens: Monitoring/reporting
- **Total: 20k tokens (10% of Claude Code's 200k window)**

**Headroom**: 180k tokens remaining (90% unused)

**Questions**:
- Why would PS need 2M tokens if it's only coordinating?
- What work is consuming the other 180k tokens?
- **Answer**: PS is doing execution work (forbidden)

**Insight**: If PS needs more than 200k tokens, it's violating its core identity. The solution is to fix PS behavior, not to increase context window.

---

## 6. Alternative Solutions: Optimize Context Usage

### Solution 1: Enforce PS Delegation Discipline (HIGHEST IMPACT)

**Current Anti-Patterns** (from ps-role-guide.md:932-1079):

1. PS reads files to understand codebase (should spawn research agent)
2. PS writes code directly (should spawn implementation agent)
3. PS runs tests manually (should spawn validation agent)
4. PS creates plans manually (should spawn planning agent)

**Enforcement Mechanisms**:

**A. Strengthen PS Identity Instructions**:
```markdown
# .supervisor-core/01-identity.md (add)

## Context Window Budget

YOUR ENTIRE SESSION SHOULD USE < 50k TOKENS (25% of 200k window).

If you approach 100k tokens (50%), you are doing EXECUTION WORK.

STOP and ask: "What execution work am I doing that I should delegate?"
```

**B. Add Health Check Monitoring** (already planned):
```markdown
# From autonomous-supervision.md:131-159

When monitor prompts: "Report your current context window usage"
Response: "Context: 31.6% (63,153/200,000 tokens)"

If >50%, PS must explain what execution work is being done.
```

**C. Add Validation in mcp_meta_spawn_subagent**:
- If PS context usage >100k tokens → Warn PS
- If PS context usage >150k tokens → Require justification
- If PS context usage >180k tokens → Block non-critical operations

**Impact**: Reduces PS context usage by 60-80% (from 73k bloated to 20-30k healthy)

### Solution 2: Optimize CLAUDE.md Size (MEDIUM IMPACT)

**Current Size** (from analysis):
- supervisor-service-s: 40,945 bytes (~10k tokens)
- consilio-s: 36,960 bytes (~9k tokens)
- openhorizon-s: 39,805 bytes (~10k tokens)
- odin-s: 36,423 bytes (~9k tokens)

**Target Size**: <30k bytes (~7.5k tokens) per CLAUDE.md

**Optimization Strategies**:

**A. Reference Pattern** (already documented):
```markdown
# From .supervisor-core/README.md:37-66

Inline:
- ✅ Core behavior rules
- ✅ Checklists
- ✅ Quick reference tables

External (in /docs/):
- 📄 Templates
- 📄 Guides
- 📄 Examples
```

**B. Specific Optimizations**:

1. **10-secrets-workflow.md** (209 lines):
   - Move detailed examples to `/docs/guides/secrets-management-guide.md`
   - Keep only: Rule (vault first), checklist, reference
   - Target: 60-80 lines (save ~3k characters)

2. **09-tunnel-management.md** (164 lines):
   - Move workflow examples to `/docs/guides/tunnel-management-guide.md`
   - Keep only: Tool list, critical rules, quick reference
   - Target: 80-100 lines (save ~2k characters)

3. **05-autonomous-supervision.md** (180 lines):
   - Move PIV tool examples to `/docs/guides/piv-usage-guide.md`
   - Keep only: Autonomy rules, when to delegate, health check protocol
   - Target: 100-120 lines (save ~2k characters)

**Total Savings**: ~7k characters (~1.75k tokens, 17% reduction)

**Impact**: Reduces initial CLAUDE.md load from ~10k to ~8.25k tokens (1.75k saved)

### Solution 3: Lazy-Load Instructions (LOW IMPACT, HIGH COMPLEXITY)

**Concept**: Load minimal PS identity upfront, fetch detailed guides on-demand.

**Implementation**:
```markdown
# CLAUDE.md (minimal)

YOU ARE A PROJECT-SUPERVISOR: COORDINATOR, NOT EXECUTOR.

Core rules:
1. Delegate ALL execution → mcp_meta_spawn_subagent
2. Handle git operations → git add/commit/push
3. Use MCP tools → tunnel_*, mcp_meta_*
4. Report briefly → 1-3 paragraphs

Detailed guides (fetch when needed):
- /docs/guides/ps-role-guide.md
- /docs/guides/autonomous-supervision-guide.md
- /docs/guides/ps-workflows.md
```

**Pros**:
- Reduces initial load to ~5k tokens (50% reduction)
- PS can fetch detailed guides only when needed

**Cons**:
- Requires PS to know when to fetch guides (additional logic)
- Risk of PS forgetting to fetch when needed
- Complexity in instruction system
- May not save much (PS should rarely need detailed guides)

**Impact**: Reduces initial load to ~5k tokens, but adds complexity. Questionable ROI.

### Solution 4: Session Summarization (FUTURE ENHANCEMENT)

**Concept**: Automatically summarize and compress session history after N turns.

**From system context**:
```
The conversation has unlimited context through automatic summarization.
```

**Current State**: Claude Code already does this automatically.

**Potential Enhancement**: Configure more aggressive summarization for PS sessions.

**Impact**: May allow PS sessions to run longer, but doesn't address root cause (PS doing execution work).

### Recommended Approach

**Immediate (Week 1)**:
1. ✅ Enforce PS delegation discipline (add context budget to identity instructions)
2. ✅ Implement health check monitoring (context usage reporting)
3. ✅ Add warnings when PS context usage >50%

**Short-term (Week 2-3)**:
4. ✅ Optimize CLAUDE.md size (move examples to /docs/guides/)
5. ✅ Target: <30k bytes per CLAUDE.md (~7.5k tokens)

**Medium-term (Month 1-2)**:
6. ⚠️ Monitor PS sessions for execution work patterns
7. ⚠️ Create automated alerts when PS violates delegation rules
8. ⚠️ Build dashboard showing PS context usage trends

**NOT Recommended**:
- ❌ Switch to Gemini CLI (not feasible without 2-3 weeks infrastructure work)
- ❌ Lazy-load instructions (complex, questionable ROI)

**Expected Outcome**:
- PS context usage: 73k bloated → 20-30k healthy (60-75% reduction)
- Headroom: 170-180k tokens remaining (85-90% of 200k window)
- Cost: ~1 week development vs 2-3 weeks for Gemini migration

---

## 7. Final Recommendation

### Strategic Decision: Stay with Claude Code

**Reasoning**:

1. **Root Cause**: Context window exhaustion is caused by PS doing execution work, not by insufficient window size.

2. **Proper PS Behavior**: If delegating correctly, PS uses only ~20k tokens (10% of 200k window), leaving 180k headroom.

3. **Gemini Limitations**: Gemini CLI lacks MCP integration, Bash tools, and agentic capabilities critical for PS coordination role.

4. **Migration Cost**: 2-3 weeks development + ongoing maintenance vs 1 week to enforce delegation discipline.

5. **Claude Strengths**: Industry-leading agentic behavior, native MCP support, integrated Bash tool perfectly match PS coordination needs.

6. **Cost-Benefit**: Gemini saves ~$0.60 per PS session, but requires ~$5-10k development. Break-even: 2-4 years.

### Recommended Action Plan

**Phase 1: Immediate Enforcement (Week 1)**

1. **Update .supervisor-core/01-identity.md**:
   ```markdown
   ## Context Window Budget

   YOUR SESSION SHOULD USE < 50k TOKENS (25% of 200k).

   If approaching 100k tokens (50%), you are doing EXECUTION WORK.

   STOP and delegate to subagent.
   ```

2. **Implement Health Check Monitoring**:
   - Monitor prompts PS for context usage every 30 minutes
   - PS reports: "Context: X% (used/total tokens)"
   - If >50%, monitor asks: "What execution work are you doing?"

3. **Add Validation to Spawn Tool**:
   - `mcp_meta_spawn_subagent` checks PS context usage
   - If >100k tokens → Warn: "Context high. Ensure delegating properly."
   - If >150k tokens → Require justification before spawning

**Phase 2: Optimize Instructions (Week 2-3)**

4. **Reduce CLAUDE.md Size**:
   - Move detailed examples from core instructions to `/docs/guides/`
   - Target: <30k bytes per CLAUDE.md
   - Expected savings: ~1.75k tokens per session

5. **Create Optimization Guide**:
   - Document context window management for PS
   - Add checklist: "Are you reading files? → Spawn research agent"
   - Add checklist: "Are you writing code? → Spawn implementation agent"

**Phase 3: Monitor & Iterate (Month 1-2)**

6. **Track PS Context Usage**:
   - Log context usage per session (start, end, peak)
   - Identify patterns of execution work
   - Create dashboard showing trends

7. **Automated Alerts**:
   - If PS reads >3 files in sequence → Alert: "Spawn research agent"
   - If PS writes >50 lines of code → Alert: "Spawn implementation agent"
   - If PS runs >3 bash commands (non-git) → Alert: "Spawn appropriate agent"

**Expected Outcomes**:

- ✅ PS context usage: 20-30k tokens (10-15% of window)
- ✅ Headroom: 170-180k tokens (85-90% remaining)
- ✅ Development time: ~1 week vs 2-3 weeks for Gemini migration
- ✅ Maintains Claude's superior agentic capabilities
- ✅ Maintains native MCP integration
- ✅ No migration risk or infrastructure complexity

### Why NOT Gemini CLI

**Blockers**:
1. ❌ No MCP integration (cannot call `mcp_meta_spawn_subagent`, etc.)
2. ❌ No Bash tool (cannot run `git` operations autonomously)
3. ❌ No session state (cannot track epics, progress)
4. ❌ High migration cost (2-3 weeks) vs low ROI (break-even: 2-4 years)

**Alternative Considered**: Gemini API with custom wrapper
- Feasible but requires significant development
- Loses Claude's agentic superiority
- Only justified if context window truly becomes bottleneck AFTER enforcing delegation

**When to Reconsider Gemini**:
- ✅ After enforcing PS delegation discipline for 1-2 months
- ✅ If PS context usage still consistently >150k tokens (75% of window)
- ✅ If workload increases 5-10x (50-100 PS sessions per day)
- ✅ If Gemini adds native MCP support

---

## Conclusion

**Do not switch PS to Gemini CLI.** The 200k context window is sufficient for PS's coordination role. Context window exhaustion is a symptom of PS violating its core identity by doing execution work instead of delegating.

**Solution**: Enforce delegation discipline, optimize CLAUDE.md size, and implement health check monitoring. Expected outcome: 60-75% reduction in context usage, maintaining 85-90% headroom.

**Gemini Migration**: Not feasible due to lack of MCP integration, Bash tools, and high migration cost. Only reconsider if context remains bottleneck after enforcing proper PS behavior for 1-2 months.

---

## Key Files Reviewed

1. `/home/samuel/sv/supervisor-service-s/.supervisor-core/01-identity.md` - PS identity and role
2. `/home/samuel/sv/supervisor-service-s/.supervisor-core/05-autonomous-supervision.md` - PIV loop, autonomy protocol
3. `/home/samuel/sv/docs/guides/ps-role-guide.md` - Detailed PS role explanation (1,296 lines)
4. `/home/samuel/sv/docs/subagent-catalog.md` - Subagent delegation patterns
5. `/home/samuel/sv/docs/ai-models-reference.md` - Gemini vs Claude capabilities
6. `/home/samuel/sv/docs/guides/autonomous-supervision-guide.md` - Health check protocol

## Integration Points

- **PS Identity**: `.supervisor-core/01-identity.md:3-71` - Core coordinator role
- **Delegation Workflow**: `ps-role-guide.md:29-193` - Why delegation is mandatory
- **Context Window Efficiency**: `ps-role-guide.md:76-95` - Token usage comparison
- **Subagent Spawning**: `subagent-catalog.md:289-311` - How to delegate
- **Gemini Models**: `ai-models-reference.md:8-40` - Gemini capabilities and context limits
- **Claude Models**: `ai-models-reference.md:44-96` - Claude capabilities
- **Health Check Protocol**: `autonomous-supervision-guide.md:65-157` - Context monitoring

## Recommendations for Implementation

**File to Create**: `/home/samuel/sv/docs/guides/context-window-management-guide.md`
- Detailed guide on managing PS context usage
- Checklists for identifying execution work
- Automated monitoring strategies
- Dashboard design for tracking trends

**File to Update**: `.supervisor-core/01-identity.md`
- Add context window budget section
- Add enforcement rules (stop if >100k tokens)
- Add reference to context management guide

**Tool to Enhance**: `mcp_meta_spawn_subagent`
- Add context usage validation
- Warn if PS context >50%
- Require justification if >75%

**Monitoring to Implement**: Health check protocol
- Prompt PS for context usage every 30 minutes
- Alert if execution work detected
- Log usage patterns for analysis

---

**Research Complete**: 2026-01-24
**Recommendation**: Stay with Claude Code, enforce delegation discipline
**Next Steps**: Implement Phase 1 enforcement (Week 1)
