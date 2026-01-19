# Documentation Structure - Single Source of Truth

**Date:** 2026-01-18
**Status:** ✅ Consolidated
**Architecture:** PIV Loop + BMAD + MCP

---

## 📍 Single Source of Truth

**ALL PLANNING:** `/home/samuel/sv/.bmad/`

This is the ONLY location for meta-supervisor and system-wide planning.

---

## Directory Structure

```
/home/samuel/sv/
├── .bmad/ ⭐ SINGLE SOURCE OF TRUTH
│   ├── README.md                    # Start here
│   ├── project-brief.md             # Vision & goals
│   │
│   ├── prd/                         # Requirements
│   │   └── PRD.md                   # Complete requirements (PIV-based)
│   │
│   ├── architecture/                # Architecture docs
│   │   └── TECHNICAL-SPEC.md        # Technical specifications
│   │
│   ├── epics/                       # All epics
│   │   ├── EPIC-BREAKDOWN.md        # 12 supervisor-service epics
│   │   ├── 001-bmad-integration.md  # Meta-level epic
│   │   ├── 002-learning-system-enhancement.md
│   │   ├── 003-scar-integration-improvements.md ⚠️ HISTORICAL
│   │   └── 004-automated-supervisor-updates.md
│   │
│   ├── system-design/ ⭐ CRITICAL   # Core architecture
│   │   ├── piv-loop-adaptation-guide.md  # MOST IMPORTANT
│   │   ├── supervisor-instruction-propagation-system.md
│   │   ├── learning-system-and-opus-planning.md
│   │   ├── task-timing-and-estimation-system.md
│   │   └── adapt-local-claude.md
│   │
│   ├── infrastructure/              # Infrastructure automation
│   │   ├── secrets-management-system.md
│   │   ├── port-allocation-system.md
│   │   ├── cloudflare-integration.md
│   │   ├── gcloud-integration.md
│   │   ├── automatic-secrets-and-api-key-creation.md
│   │   └── infrastructure-systems-summary.md
│   │
│   ├── discussions/                 # Planning discussions
│   │   ├── FINAL-ARCHITECTURE-DECISIONS.md
│   │   ├── multiple-claude-projects-setup.md
│   │   ├── ui-workflow-improvements.md
│   │   ├── archon-and-cowork-analysis.md
│   │   ├── claude-sdk-compatibility.md
│   │   └── frame0-troubleshooting-and-local-rag.md
│   │
│   ├── adr/                         # Architecture Decision Records
│   │   └── (future ADRs)
│   │
│   └── HISTORICAL/ ⚠️               # Old SCAR-based planning
│       ├── RCA-SUPERVISOR-AUTONOMY-FAILURE.md
│       ├── SUPERVISOR-SUBAGENT-ARCHITECTURE.md
│       ├── COMPLETE-WORKFLOW-MAP.md
│       ├── IMPLEMENTATION-COMPLETE-SUMMARY.md
│       └── DEPLOYMENT-COMPLETE.md
│
├── supervisor-service/              # Implementation
│   ├── .bmad/ → /home/samuel/sv/.bmad/  # SYMLINK (see below)
│   ├── .supervisor-core/            # Core instruction layers
│   ├── .supervisor-meta/            # Meta-specific instructions
│   ├── CLAUDE.md                    # Auto-generated
│   └── src/                         # Source code (BUILD FRESH)
│
├── consilio/                        # Project 1
│   ├── .bmad/                       # Project-specific planning
│   └── CLAUDE.md                    # Auto-generated
│
├── odin/                            # Project 2
│   ├── .bmad/                       # Project-specific planning
│   └── CLAUDE.md                    # Auto-generated
│
├── openhorizon/                     # Project 3
│   ├── .bmad/                       # Project-specific planning
│   └── CLAUDE.md                    # Auto-generated
│
└── health-agent/                    # Project 4
    ├── .bmad/                       # Project-specific planning
    └── CLAUDE.md                    # Auto-generated
```

---

## What Goes Where

### `/home/samuel/sv/.bmad/` (Meta-Supervisor)

**Contains:**
- ✅ System-wide architecture (PIV loop, BMAD, MCP)
- ✅ Supervisor-service implementation planning (12 epics)
- ✅ Infrastructure systems (secrets, ports, DNS, VMs)
- ✅ Meta-features (learning, timing, instruction propagation)
- ✅ Core decision documents

**Does NOT contain:**
- ❌ Project-specific features (those go in project `.bmad/`)
- ❌ Implementation code (that goes in `supervisor-service/src/`)

### `/home/samuel/sv/supervisor-service/.bmad/` (Duplicate - DELETE)

**Status:** ⚠️ DUPLICATE - Should be symlink to root `.bmad/`

**Current state:**
- Has identical copies of planning docs
- Causes confusion (which is source of truth?)

**Solution:**
```bash
# Remove duplicate
rm -rf /home/samuel/sv/supervisor-service/.bmad/

# Create symlink
ln -s /home/samuel/sv/.bmad /home/samuel/sv/supervisor-service/.bmad
```

### `/home/samuel/sv/{project}/.bmad/` (Project-Specific)

**Contains:**
- ✅ Project-specific epics
- ✅ Project-specific ADRs
- ✅ Project-specific features

**Example (Consilio):**
```
consilio/.bmad/
├── project-brief.md             # Consilio vision
├── epics/
│   ├── 001-dark-mode.md         # Feature epic
│   ├── 002-authentication.md    # Feature epic
│   └── 003-dashboard.md         # Feature epic
└── adr/
    ├── 001-choose-supabase.md   # Tech decision
    └── 002-use-tailwind.md      # Tech decision
```

---

## What's Historical (SCAR-based)

### Files to Move to `HISTORICAL/`:

1. `RCA-SUPERVISOR-AUTONOMY-FAILURE.md` - About SCAR supervision failures
2. `SUPERVISOR-SUBAGENT-ARCHITECTURE.md` - About SCAR subagent spawning
3. `COMPLETE-WORKFLOW-MAP.md` - SCAR workflow (11 phases)
4. `IMPLEMENTATION-COMPLETE-SUMMARY.md` - SCAR implementation complete
5. `DEPLOYMENT-COMPLETE.md` - SCAR deployment
6. `epics/003-scar-integration-improvements.md` - SCAR epic

**Why historical:**
- These docs describe the OLD remote SCAR agent architecture
- We're building NEW PIV-based local agents
- Keep for reference but clearly mark as HISTORICAL

---

## What's Current (PIV-based)

### Core Documents (Read in Order):

1. **Start** → `README.md` - Navigation guide
2. **Vision** → `project-brief.md` - What we're building
3. **Architecture** → `system-design/piv-loop-adaptation-guide.md` ⭐ CRITICAL
4. **Requirements** → `prd/PRD.md` - Complete requirements
5. **Implementation** → `epics/EPIC-BREAKDOWN.md` - 12 epics in 3 phases
6. **Technical** → `architecture/TECHNICAL-SPEC.md` - Technical details

### Critical Architecture Documents:

- `system-design/piv-loop-adaptation-guide.md` - Defines PIV vs SCAR
- `discussions/FINAL-ARCHITECTURE-DECISIONS.md` - Key decisions
- All files in `infrastructure/` - Infrastructure systems
- All files in `system-design/` - Meta-system design

---

## Rules for Documentation Updates

### 1. Single Update Location

**When updating planning:**
- ✅ Update `/home/samuel/sv/.bmad/` ONLY
- ❌ Never update `supervisor-service/.bmad/` (it's a symlink)
- ❌ Never duplicate docs across locations

### 2. Project-Specific vs System-Wide

**System-wide (goes in root `.bmad/`):**
- PIV loop architecture
- Infrastructure systems
- Supervisor-service epics
- Meta-features

**Project-specific (goes in project `.bmad/`):**
- Consilio dark mode epic
- Odin parser improvements
- Health-Agent features

### 3. Historical vs Current

**Mark as HISTORICAL:**
- Anything mentioning SCAR remote agent
- Anything mentioning GitHub webhooks for orchestration
- Anything mentioning Archon task management
- Old workflows superseded by PIV loop

**Keep as CURRENT:**
- Anything PIV-based
- Anything MCP-based
- Anything BMAD-based
- Infrastructure automation

---

## Cleanup Actions Required

### 1. Move Historical Docs

```bash
# Create historical directory
mkdir -p /home/samuel/sv/.bmad/HISTORICAL/

# Move SCAR-related docs
mv /home/samuel/sv/.bmad/RCA-SUPERVISOR-AUTONOMY-FAILURE.md /home/samuel/sv/.bmad/HISTORICAL/
mv /home/samuel/sv/.bmad/SUPERVISOR-SUBAGENT-ARCHITECTURE.md /home/samuel/sv/.bmad/HISTORICAL/
mv /home/samuel/sv/.bmad/COMPLETE-WORKFLOW-MAP.md /home/samuel/sv/.bmad/HISTORICAL/
mv /home/samuel/sv/.bmad/IMPLEMENTATION-COMPLETE-SUMMARY.md /home/samuel/sv/.bmad/HISTORICAL/
mv /home/samuel/sv/.bmad/DEPLOYMENT-COMPLETE.md /home/samuel/sv/.bmad/HISTORICAL/
mv /home/samuel/sv/.bmad/epics/003-scar-integration-improvements.md /home/samuel/sv/.bmad/HISTORICAL/
```

### 2. Remove Duplicate and Create Symlink

```bash
# Remove duplicate
rm -rf /home/samuel/sv/supervisor-service/.bmad/

# Create symlink
ln -s /home/samuel/sv/.bmad /home/samuel/sv/supervisor-service/.bmad
```

### 3. Update README Files

```bash
# Update root README
# Add note: "This is the SINGLE SOURCE OF TRUTH"

# Update supervisor-service README
# Add note: ".bmad/ is a symlink to /home/samuel/sv/.bmad/"
```

---

## Verification

### After cleanup, verify:

```bash
# 1. Only one .bmad with actual files
ls -la /home/samuel/sv/.bmad/

# 2. Supervisor-service has symlink
ls -la /home/samuel/sv/supervisor-service/.bmad  # Should show -> /home/samuel/sv/.bmad

# 3. Historical docs moved
ls -la /home/samuel/sv/.bmad/HISTORICAL/

# 4. Current docs clean
ls -la /home/samuel/sv/.bmad/epics/  # Should NOT have 003-scar-integration
```

---

## Quick Reference

**Where to find:**
- Architecture: `/home/samuel/sv/.bmad/system-design/piv-loop-adaptation-guide.md`
- Requirements: `/home/samuel/sv/.bmad/prd/PRD.md`
- Epics: `/home/samuel/sv/.bmad/epics/EPIC-BREAKDOWN.md`
- Infrastructure: `/home/samuel/sv/.bmad/infrastructure/`
- Decisions: `/home/samuel/sv/.bmad/discussions/FINAL-ARCHITECTURE-DECISIONS.md`

**Where NOT to look:**
- `supervisor-service/.bmad/` (symlink, not source)
- `.bmad/HISTORICAL/` (old SCAR system)

**Total current docs:** 26 (from today's planning session)

---

**Status:** Ready to consolidate - run cleanup actions above
