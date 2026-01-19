# 🚨 CRITICAL: PIV Loop, NOT SCAR

**READ THIS FIRST**

---

## ❌ We Are NOT Using SCAR

**Old approach (what we're REPLACING):**
```
User: "Plan feature X"
  → Supervisor creates epic
  → Creates GitHub issue with @scar mention
  → SCAR (separate system) picks up issue
  → SCAR implements code
  → Supervisor monitors SCAR via GitHub comments
  → Supervisor verifies SCAR's work
```

**Problems with SCAR:**
- Separate system, hard to control
- Unreliable (claims 100% done when 20% done)
- Requires constant monitoring
- GitHub issue overhead
- Not responsive to supervisor feedback

---

## ✅ New Approach: PIV Loop with Subagents

**What we're BUILDING:**
```
User: "Plan feature X"
  → Supervisor spawns PIV loop (internal subagents)
    → PrimePhase: Analyzes requirements, decomposes
    → PlanPhase: Creates detailed implementation plan
    → ExecutePhase: Spawns implementation subagents
      → Subagent 1: Implements feature A
      → Subagent 2: Implements feature B
      → Subagent 3: Writes tests
  → Supervisor verifies each subagent's work
  → Done!
```

**Benefits:**
- All internal (no external SCAR system)
- Direct control of subagents
- Immediate feedback loops
- No GitHub issue overhead
- Responsive to supervisor

---

## 🎯 What You're Building (Epic 10)

**PIV Loop Implementation = Replace SCAR entirely**

**Adapt Cole Medin's approach:**
- He uses: Remote agents via GitHub webhooks
- We use: Local subagents via Task tool

**Reference:** `docs/piv-loop-adaptation-guide.md`

**Three phases:**
1. **PrimePhase** - Understand and decompose
2. **PlanPhase** - Create detailed plan
3. **ExecutePhase** - Spawn subagents to implement

---

## 🚫 Files to Ignore

**These were copied by mistake (SCAR-related):**
- `.claude/commands/supervision/supervise-issue.md` ❌ (monitors SCAR)
- `.claude/commands/supervision/scar-monitor.md` ❌ (polls SCAR)
- `.claude/commands/supervision/approve-scar-plan.md` ❌ (approves SCAR)
- `.claude/commands/supervision/verify-scar-phase.md` ❌ (verifies SCAR)
- `.claude/commands/supervision/verify-scar-start.md` ❌ (checks SCAR)
- `docs/scar-integration.md` ❌ (old SCAR docs)

**DON'T USE THESE. Build PIV loop instead.**

---

## ✅ Files to Use

**Keep these (general subagent commands):**
- `.claude/commands/analyze.md` ✅ (Analyst subagent)
- `.claude/commands/create-epic.md` ✅ (PM subagent)
- `.claude/commands/create-adr.md` ✅ (Architect subagent)
- `.claude/commands/plan-feature.md` ✅ (Meta-orchestrator)

**Build these (PIV loop):**
- `src/agents/piv/PrimePhase.ts` (new)
- `src/agents/piv/PlanPhase.ts` (new)
- `src/agents/piv/ExecutePhase.ts` (new)
- `src/agents/piv/PIVOrchestrator.ts` (new)

---

## 📖 Read This

**To understand PIV loop:**
- `docs/piv-loop-adaptation-guide.md`

**To understand the goal:**
- `PRD-supervisor-service.md` (Epic 10 section)
- `TECHNICAL-SPEC-supervisor-service.md` (PIV Loop section)
- `EPIC-BREAKDOWN-supervisor-service.md` (Epic 10 details)

---

## 🎯 Bottom Line

**We're building a NEW system:**
- Supervisor spawns PIV loop
- PIV loop spawns implementation subagents
- All internal, no SCAR

**SCAR is the OLD way. PIV loop is the NEW way.**

**Build Epic 10 to make this happen!**
