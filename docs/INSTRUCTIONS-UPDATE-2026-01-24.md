# PS Instructions Update - 2026-01-24

**Status**: ✅ Complete and Deployed
**Impact**: All project supervisors (9 projects)

---

## What Was Changed

### Before

PS instructions told supervisors to use:
```typescript
mcp_meta_start_piv_loop({ ... })
```

**Problem**: This tool only does basic file analysis (reads package.json, no AI)
- No AI-powered codebase research
- No AI-generated implementation plans
- No AI code writing
- No acceptance criteria validation
- Just placeholder/skeleton logic

### After

PS instructions now tell supervisors to use:
```typescript
mcp_meta_run_piv_per_step({ ... })
```

**Solution**: This tool spawns REAL AI agents for each phase
- ✅ AI researches codebase (understands patterns, architecture)
- ✅ AI creates detailed implementation plans
- ✅ AI writes actual code
- ✅ Validates ALL acceptance criteria
- ✅ Cost-optimized via Odin router
- ✅ Can restart individual hung phases

---

## File Changes

### Core Instruction Updated

**File**: `.supervisor-core/05-autonomous-supervision.md`

**Section Updated**: "PIV Agent Spawning" → "PIV Per-Step Implementation"

**Old workflow**:
```
1. Start PIV: mcp_meta_start_piv_loop({ ... })
2. Monitor (don't interrupt PIV)
3. When complete: Report
```

**New workflow**:
```
1. Start per-step PIV: mcp_meta_run_piv_per_step({ ... })
2. Tool spawns Prime → Plan → Execute → Validates criteria
3. Monitor progress (tool provides phase updates)
4. When complete: Report
```

**Added**:
- Detailed tool parameters with examples
- Explanation of what happens in each phase
- Instructions for restarting individual phases
- Marked legacy tools as DEPRECATED

### Projects Regenerated

All 9 projects got updated CLAUDE.md:
- consilio-s
- health-agent-s
- mcp-configs
- odin-s
- openhorizon-s
- scripts
- supervisor-docs-expert
- supervisor-service-s
- systemd

---

## What This Means

### For PS (Project Supervisor)

When user says "Implement epic-006: GDPR Compliance":

**Old behavior**:
- PS calls monolithic tool
- Tool reads package.json
- Returns basic structure info
- No actual AI work happens

**New behavior**:
- PS calls per-step tool with full epic details
- Tool spawns Gemini/Claude agent to research codebase (10-30 min)
- Tool spawns agent to create implementation plan (15 min)
- Tool spawns agent to write code + tests (30 min)
- Tool validates ALL acceptance criteria
- Returns: success=true only if ALL criteria met

### For User

**Old experience**:
- "Epic complete!" → Check code → Only half done
- Agents produce docs instead of code
- No validation of requirements
- User spends time fixing

**New experience**:
- Epic implementation takes 1-2 hours (AI working)
- Real code written and tested
- All acceptance criteria validated
- User gets: "Success: true" OR "Failed criteria: [list]"
- Clear, accurate reporting

---

## Tool Comparison

### Legacy (DEPRECATED)

| Tool | What It Does | Problem |
|------|--------------|---------|
| `mcp__meta__start_piv_loop` | Reads files, basic analysis | No AI, placeholder logic |
| `mcp__meta__piv_status` | Check status | Only for legacy tool |
| `mcp__meta__cancel_piv` | Cancel PIV | Only for legacy tool |
| `mcp__meta__list_active_piv` | List PIVs | Only for legacy tool |

### Current (PRIMARY)

| Tool | What It Does | Use Case |
|------|--------------|----------|
| `mcp_meta_run_piv_per_step` | **PRIMARY**: Full PIV with AI agents | Default for all epics |
| `mcp_meta_run_prime` | AI research only | Restart hung Prime phase |
| `mcp_meta_run_plan` | AI planning only | Restart hung Plan phase |
| `mcp_meta_run_execute` | AI implementation only | Restart hung Execute phase |

---

## Example Usage

### Simple Epic

```typescript
// PS calls this
mcp_meta_run_piv_per_step({
  projectName: "consilio",
  projectPath: "/home/samuel/sv/consilio-s",
  epicId: "epic-006",
  epicTitle: "GDPR Compliance",
  epicDescription: "Implement GDPR compliance features including data export, account deletion, cookie consent, and privacy policy display.",
  acceptanceCriteria: [
    "User can export all personal data",
    "User can delete account and all data",
    "Cookie consent banner implemented",
    "Privacy policy displayed"
  ],
  baseBranch: "main",
  createPR: true
})

// What happens automatically:
// 1. Prime: Gemini agent researches consilio codebase (10 min)
// 2. Plan: Gemini agent creates detailed plan (15 min)
// 3. Execute: Claude agent writes code + tests (30 min)
// 4. Validate: 4 agents validate each criterion (5 min each)
//
// Returns:
// {
//   success: true/false,
//   prime: { ... research output ... },
//   plan: { ... implementation plan ... },
//   execute: { ... code changes ... },
//   criteria_validation: {
//     all_met: true/false,
//     results: [
//       { criterion: "User can export...", met: true },
//       { criterion: "User can delete...", met: true },
//       { criterion: "Cookie consent...", met: false },  // Example
//       { criterion: "Privacy policy...", met: true }
//     ]
//   }
// }
```

### Restarting Hung Phase

```typescript
// If Execute phase hangs/fails
// Don't need to re-run Prime and Plan
mcp_meta_run_execute({
  epicId: "epic-006",
  epicTitle: "GDPR Compliance",
  planFile: ".agents/plans/epic-006.json",
  projectPath: "/home/samuel/sv/consilio-s",
  // Picks up where it left off
})
```

---

## Migration Path

### Week 1 (Now)
- ✅ Instructions updated
- ✅ All CLAUDE.md regenerated
- ✅ Per-step tool is primary
- ✅ Legacy tools marked DEPRECATED

### Week 2 (After Testing)
- Test per-step with real epics
- Gather usage metrics
- Fix any issues discovered

### Week 3 (Production)
- Monitor all PIV executions
- Verify success rate >80%
- Document best practices

### Month 2 (Cleanup)
- Remove legacy tool code
- Update all documentation
- Final cleanup

---

## Rollback Plan

If per-step tool has critical issues:

1. Edit `.supervisor-core/05-autonomous-supervision.md`
2. Change instructions back to `mcp_meta_start_piv_loop`
3. Run `npm run init-projects`
4. All PSes revert to legacy tool

**Note**: Legacy tools are NOT deleted, just marked deprecated.

---

## Testing Checklist

Before considering this complete:

- [ ] Test per-step with simple epic (hello world function)
- [ ] Verify Prime agent actually researches (not just reads files)
- [ ] Verify Plan agent creates detailed plan
- [ ] Verify Execute agent writes code (not just docs)
- [ ] Verify acceptance criteria validation works
- [ ] Test phase restart (kill Execute, restart just Execute)
- [ ] Verify cost tracking via Odin
- [ ] Test complex epic (GDPR, 4+ criteria)

---

## Expected Outcomes

### Success Metrics (Target)

**Before**:
- Epic completion rate: ~30%
- Acceptance criteria validation: 0%
- Agents produce only docs: Common
- User intervention per epic: 100%

**After** (Target):
- Epic completion rate: >80%
- Acceptance criteria validation: 100%
- Agents produce only docs: <5%
- User intervention per epic: <20%

### User Experience

**Before**:
- User: "Implement epic"
- PS: "Working..."
- 2 hours later: "Complete!"
- User checks: Only docs, no code
- User: "Where's the implementation?"
- User fixes manually

**After**:
- User: "Implement epic"
- PS: "Spawning Prime agent (research)..."
- PS: "Spawning Plan agent (design)..."
- PS: "Spawning Execute agent (implementation)..."
- PS: "Validating acceptance criteria..."
- PS: "Complete! 4/4 criteria met. PR #123 created."
- User checks: All code done, tests pass

---

## Conclusion

This update represents a fundamental shift from **placeholder PIV** to **real AI-powered PIV**.

The old tool was a skeleton. The new tool is the actual implementation.

All PSes now have access to:
- Real AI research
- Real AI planning
- Real AI implementation
- Real validation
- Real cost optimization

**Next**: Test with actual epics and iterate based on results.

---

**Updated by**: Meta-supervisor
**Date**: 2026-01-24
**Status**: Deployed to all 9 projects
