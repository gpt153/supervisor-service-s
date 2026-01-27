# Feature-Epic Mapping for Migration

**Date**: 2026-01-27
**Purpose**: Guide for migrating epics to feature-based structure

---

## Feature 1: bmad-integration

**Directory**: `.bmad/features/bmad-integration/`

**Epics**:
- `001-bmad-integration.md` → `epic-001-bmad-integration.md`

**ADRs**: None

**Reports**: None

---

## Feature 2: learning-system

**Directory**: `.bmad/features/learning-system/`

**Epics**:
- `002-learning-system-enhancement.md` → `epic-002-learning-system-enhancement.md`

**ADRs**: None

**Reports** (from `.bmad/implementation/`):
- `EPIC-009-IMPLEMENTATION.md`
- `EPIC-009-QUICKREF.md`
- `EPIC-009-SUMMARY.md`
- `EPIC-009-VERIFICATION.md`

**Feature Request**: `learning-action-database.md`

---

## Feature 3: tunnel-manager

**Directory**: `.bmad/features/tunnel-manager/`

**Epics**:
- `005-tunnel-manager.md` → `epic-005-tunnel-manager.md`

**ADRs**:
- `001-sqlite-for-tunnel-state.md`
- `002-ingress-target-selection-algorithm.md`
- `008-shared-cname-vs-per-project.md`

**Reports** (from `.bmad/implementation/`):
- `EPIC-005-COMPLETE.md`
- `EPIC-005-IMPLEMENTATION.md`
- `EPIC-005-QUICKREF.md`

**Feature Request**: `tunnel-manager.md`

---

## Feature 4: ps-delegation-enforcement

**Directory**: `.bmad/features/ps-delegation-enforcement/`

**Epics**:
- `013-multi-agent-cli-integration.md` → `epic-013-multi-agent-cli-integration.md`
- `014-autonomous-usage-monitoring-optimization.md` → `epic-014-autonomous-usage-monitoring.md`
- `015-core-identity-enforcement.md` → `epic-015-core-identity-enforcement.md`
- `016-core-subagent-library-phase1.md` → `epic-016-core-subagent-library.md`
- `017-centralized-subagent-spawning.md` → `epic-017-centralized-subagent-spawning.md`
- `018-auto-discovery-system.md` → `epic-018-auto-discovery-system.md`
- `019-infrastructure-tool-enforcement.md` → `epic-019-infrastructure-tool-enforcement.md`
- `020-reference-documentation.md` → `epic-020-reference-documentation.md`
- `021-testing-validation.md` → `epic-021-testing-validation.md`

**ADRs**:
- `002-centralized-subagent-spawning.md`

**Reports** (from `.bmad/implementation/`):
- `EPIC-011-IMPLEMENTATION.md`
- `EPIC-011-QUICKREF.md`
- `EPIC-011-SUMMARY.txt`
- `EPIC-011-VERIFICATION.md`
- `EPIC-012-COMPLETE.md`
- `EPIC-012-IMPLEMENTATION.md`
- `EPIC-012-QUICKREF.md`
- `EPIC-012-SUMMARY.txt`

**Feature Request**: `ps-delegation-enforcement-subagent-library.md`

**Other**:
- `IMPLEMENTATION-SUMMARY-PS-DELEGATION-ENFORCEMENT.md` (move to context/)

---

## Feature 5: ui-first-workflow

**Directory**: `.bmad/features/ui-first-workflow/`

**Epics**:
- `022-design-system-foundation.md` → `epic-022-design-system-foundation.md`
- `ui-002-design-system-foundation.md` → `epic-ui-002-design-system-foundation.md`
- `023-requirements-analysis-engine.md` → `epic-023-requirements-analysis-engine.md`
- `ui-001-requirements-analysis-engine.md` → `epic-ui-001-requirements-analysis-engine.md`
- `024-frame0-design-generation.md` → `epic-024-frame0-design-generation.md`
- `ui-003-frame0-design-generation.md` → `epic-ui-003-frame0-design-generation.md`
- `025-figma-design-import.md` → `epic-025-figma-design-import.md`
- `ui-004-figma-design-import.md` → `epic-ui-004-figma-design-import.md`
- `026-mock-data-system.md` → `epic-026-mock-data-system.md`
- `ui-005-mock-data-generation.md` → `epic-ui-005-mock-data-generation.md`
- `027-interactive-mockup-deployment.md` → `epic-027-interactive-mockup-deployment.md`
- `ui-006-storybook-deployment.md` → `epic-ui-006-storybook-deployment.md`
- `ui-007-dev-environment-deployment.md` → `epic-ui-007-dev-environment-deployment.md`
- `028-requirements-validation.md` → `epic-028-requirements-validation.md`
- `029-backend-connection.md` → `epic-029-backend-connection.md`
- `ui-009-backend-connection-workflow.md` → `epic-ui-009-backend-connection-workflow.md`
- `030-shared-cname-infrastructure.md` → `epic-030-shared-cname-infrastructure.md`
- `ui-008-mcp-tool-suite.md` → `epic-ui-008-mcp-tool-suite.md`

**ADRs**:
- `007-frame0-vs-figma-default-tool.md`
- `009-mock-data-strategy.md`
- `019-storybook-dev-environment-deployment.md`

**Reports**: None yet

**Feature Requests**:
- `ui-first-development-workflow.md`
- `ui-workflow-flexible-entry.md`

**Other**:
- `handoff-ui-first-workflow-2026-01-22.md` (move to context/)

---

## Feature 6: mobile-platform

**Directory**: `.bmad/features/mobile-platform/`

**Epics**:
- `031-react-native-project-setup.md` → `epic-031-react-native-project-setup.md`
- `032-ios-build-pipeline.md` → `epic-032-ios-build-pipeline.md`
- `033-android-build-pipeline.md` → `epic-033-android-build-pipeline.md`
- `034-firebase-test-lab-integration.md` → `epic-034-firebase-test-lab-integration.md`
- `035-github-actions-cicd.md` → `epic-035-github-actions-cicd.md`
- `036-expo-snack-integration.md` → `epic-036-expo-snack-integration.md`
- `037-macbook-integration.md` → `epic-037-macbook-integration.md`
- `038-mobile-testing-mcp-tools.md` → `epic-038-mobile-testing-mcp-tools.md`
- `039-mobile-deployment-automation.md` → `epic-039-mobile-deployment-automation.md`

**ADRs**:
- `010-react-native-vs-flutter.md`
- `011-firebase-test-lab-vs-aws.md`

**Reports**: None yet

**Feature Requests**:
- `mobile-app-development-platform.md`
- `mobile-platform-v2.md`

---

## Feature 7: ps-health-monitoring

**Directory**: `.bmad/features/ps-health-monitoring/`

**Epics**:
- `040-ps-health-monitoring.md` → `epic-040-ps-health-monitoring.md`

**ADRs**:
- `003-health-monitoring-and-restart-strategy.md`
- `015-tmux-prompting-for-ps-health-checks.md`
- `016-health-monitoring-database-schema.md`

**Reports**: None yet

**Feature Request**: `ps-health-monitoring.md`

---

## Feature 8: automatic-quality-workflows

**Directory**: `.bmad/features/automatic-quality-workflows/`

**Epics**:
- `006-automatic-quality-workflows-mvp.md` → `epic-006-automatic-quality-workflows.md`

**ADRs**:
- `004-agent-model-selection-for-quality-workflows.md`
- `005-event-driven-vs-polling-architecture.md`

**Reports**: None yet

**Feature Request**: `automatic-quality-workflows.md`

**Analysis**: `analysis/automatic-quality-workflows-analysis.md` (move to context/)

---

## Feature 9: automated-supervisor-updates

**Directory**: `.bmad/features/automated-supervisor-updates/`

**Epics**:
- `004-automated-supervisor-updates.md` → `epic-004-automated-supervisor-updates.md`

**ADRs**:
- `006-claude-md-update-strategy.md`

**Reports**: None yet

**Feature Request**: None (standalone epic)

---

## Feature 10: secrets-management

**Directory**: `.bmad/features/secrets-management/`

**Epics**: None in epics/ directory

**ADRs**: None

**Reports** (from `.bmad/implementation/`):
- `EPIC-003-COMPLETE.md`
- `EPIC-003-IMPLEMENTATION.md`

**Feature Request**: None (implementation-only)

---

## Feature 11: port-allocation

**Directory**: `.bmad/features/port-allocation/`

**Epics**: None in epics/ directory

**ADRs**: None

**Reports** (from `.bmad/implementation/`):
- `EPIC-004-IMPLEMENTATION.md`

**Feature Request**: None (implementation-only)

---

## Feature 12: database-foundation

**Directory**: `.bmad/features/database-foundation/`

**Epics**: None in epics/ directory

**ADRs**: None

**Reports** (from `.bmad/implementation/`):
- `EPIC-001-COMPLETE.md`
- `EPIC-002-IMPLEMENTATION.md`
- `EPIC-006-GCLOUD.md`
- `EPIC-006-SUMMARY.md`
- `EPIC-007-IMPLEMENTATION.md`

**Feature Request**: None (implementation-only)

---

## Feature 13: subagent-debugging

**Directory**: `.bmad/features/subagent-debugging/`

**Epics**:
- `epic-012-fix-subagent-hanging.md` → `epic-012-fix-subagent-hanging.md`

**ADRs**: None

**Reports**: None yet

**Feature Request**: None (bug fix epic)

---

## Feature 14: automatic-context-handoff

**Directory**: `.bmad/features/automatic-context-handoff/`

**Epics**: None yet

**ADRs**:
- `017-context-threshold-strategy.md`
- `018-automated-handoff-cycle-design.md`

**Reports**: None yet

**Feature Request**: `automatic-context-handoff-system.md`

**Handoffs** (move to context/):
- `HANDOFF-2026-01-23.md`

---

## Non-Epic Files to Handle

**Test Epics** (move to `.bmad/archive/test-epics/`):
- `test-001-hello-world.md`
- `test-002-gemini-test.md`
- `test-003-codex-test.md`

**Duplicate/Summary** (move to appropriate feature context/):
- `019-implementation-summary.md` (duplicate, remove)
- `EPIC-BREAKDOWN.md` (overview, move to docs/)

**Research** (already in `.bmad/research/`):
- Keep as-is

**Analysis** (already in `.bmad/analysis/`):
- Keep as-is

**PRD** (already in `.bmad/prd/`):
- Migrate content to feature PRDs, then archive

---

## Migration Statistics

**Total Epics to Migrate**: 51
**Total ADRs to Migrate**: 19
**Total Implementation Reports**: 22
**Total Features**: 14
**Test Epics to Archive**: 3

---

## Next Steps

1. Create feature directory structure (Phase 2)
2. Migrate epics using git mv (Phase 3)
3. Migrate ADRs using git mv (Phase 3)
4. Migrate implementation reports using git mv (Phase 3)
5. Create PRDs from feature requests (Phase 4)
6. Update frontmatter and create README (Phase 5)
7. Validate migration (Phase 6)
