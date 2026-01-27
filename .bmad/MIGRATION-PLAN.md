# BMAD Structure Migration Plan: Supervisor-Service-S

**Date**: 2026-01-27
**Status**: Planning
**Complexity**: HIGH (most complex migration in SV system)

---

## Current State

### Structure Issues
- 48 epics in `.bmad/epics/` (flat structure)
- 10 feature requests in `.bmad/feature-requests/`  
- PRDs split across `.bmad/prd/` and `.bmad/prds/`
- Many epics are actually implementation reports (EPIC-NNN-IMPLEMENTATION.md)
- ADRs numbered similarly to epics (001-, 002-, etc.)
- NO `.bmad/features/` directory

### Why Automated Migration Won't Work
- Script detects 82 "features" (one per file) - too granular
- No `Feature:` tags in epic frontmatter to guide grouping
- Implementation reports mixed with actual epics
- Need manual curation to group properly

---

## Proposed Feature Grouping

Based on feature-requests and PRDs, group epics into these logical features:

### 1. **bmad-integration** (Epic 001)
- Foundation epic for BMAD system

### 2. **learning-system** (Epics 002, EPIC-009-*)
- Learning system enhancement
- Learning system integration and implementation

### 3. **tunnel-manager** (Epics 005, EPIC-005-*, ADR-001, ADR-002, ADR-008)
- Cloudflare tunnel management
- CNAME infrastructure
- Related ADRs

### 4. **ps-delegation-enforcement** (Epics 013-021, EPIC-011-*, EPIC-012-*)
- Multi-agent CLI integration (013)
- Autonomous usage monitoring (014)
- Core identity enforcement (015)
- Core subagent library (016)
- Centralized subagent spawning (017, EPIC-017-*)
- Auto-discovery system (018)
- Infrastructure tool enforcement (019)
- Reference documentation (020)
- Testing validation (021)
- Multi-project MCP endpoints (EPIC-011-*)
- Automatic secret detection (EPIC-012-*)

### 5. **ui-first-workflow** (Epics 022-030, ui-001 to ui-009)
- Design system foundation (022, ui-002)
- Requirements analysis engine (023, ui-001)
- Frame0 design generation (024, ui-003)
- Figma design import (025, ui-004)
- Mock data system (026, ui-005)
- Interactive mockup deployment (027, ui-006, ui-007)
- Requirements validation (028)
- Backend connection (029, ui-009)
- Shared CNAME infrastructure (030)
- MCP tool suite (ui-008)

### 6. **mobile-platform** (Epics 031-039)
- React Native project setup (031)
- iOS build pipeline (032)
- Android build pipeline (033)
- Firebase Test Lab integration (034)
- GitHub Actions CI/CD (035)
- Expo Snack integration (036)
- Macbook integration (037)
- Mobile testing MCP tools (038)
- Mobile deployment automation (039)

### 7. **ps-health-monitoring** (Epic 040)
- PS health monitoring system

### 8. **automatic-quality-workflows** (Epic 006)
- Quality workflows MVP

### 9. **automated-supervisor-updates** (Epic 004)
- Supervisor updates system

### 10. **secrets-management** (EPIC-003-*)
- Secrets management implementation

### 11. **port-allocation** (EPIC-004-*)
- Port allocation system

### 12. **database-foundation** (EPIC-001-*, EPIC-002-*, EPIC-006-*, EPIC-007-*)
- Database foundation
- Gcloud integration
- Task timing estimation

### 13. **subagent-debugging** (epic-012)
- Fix subagent hanging issues

### 14. **automatic-context-handoff**
- Handoff system (from feature-request)

---

## Migration Steps

### Phase 1: Preparation
1. [ ] Review all epics and categorize by feature
2. [ ] Identify implementation reports vs actual epics
3. [ ] Map ADRs to features
4. [ ] Create feature-to-epic mapping document

### Phase 2: Structure Creation
1. [ ] Create `.bmad/features/` directory
2. [ ] Create feature subdirectories (14 features)
3. [ ] Create standard structure in each:
   - `prd.md`
   - `epics/`
   - `adr/`
   - `reports/`
   - `context/`
   - `plans/`

### Phase 3: Content Migration
1. [ ] Move epics to feature directories using `git mv`
2. [ ] Rename to `epic-NNN-name.md` format
3. [ ] Move ADRs to appropriate feature `adr/` directories
4. [ ] Move implementation reports to `reports/` directories

### Phase 4: PRD Creation
1. [ ] Create PRDs from feature-requests
2. [ ] Add Document History tables
3. [ ] Add Epic Status tables
4. [ ] Cross-reference related documents

### Phase 5: Cleanup
1. [ ] Update epic frontmatter with `Feature:` tags
2. [ ] Mark legacy directories with deprecation notices
3. [ ] Create `features/README.md`
4. [ ] Generate migration report

### Phase 6: Validation
1. [ ] Verify all epics moved
2. [ ] Verify no broken links
3. [ ] Verify PRDs complete
4. [ ] Test CLAUDE.md generation

---

## Decision Required

**Question for User**: 
- Should we proceed with manual migration (significant work)?
- Or should we wait and accumulate this as technical debt?
- Or should we create a simplified structure (fewer features)?

**Estimated Time**: 2-3 hours for complete migration

---

## Risks

1. **High complexity** - 48 epics + reports to categorize
2. **Potential information loss** - Need careful review
3. **Breaking changes** - All epic paths change
4. **Time intensive** - Manual curation required

---

## Alternatives

### Option A: Full Migration (Recommended)
- Complete feature-based structure
- All epics properly grouped
- PRDs for all features
- Clean, maintainable structure

### Option B: Minimal Migration
- Keep existing structure
- Add `.bmad/features/` for NEW work only
- Migrate old epics gradually as needed

### Option C: Hybrid Approach
- Migrate only active features (ui-first, mobile-platform, ps-health)
- Leave completed epics in legacy structure
- Mark as "mixed" structure

---

**Next Step**: User decision on which approach to take.
