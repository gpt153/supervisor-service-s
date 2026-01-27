#!/bin/bash
# BMAD Content Migration Script
# Migrates epics, ADRs, and reports to feature-based structure

set -e
cd /home/samuel/sv/supervisor-service-s

echo "=== Phase 3: Content Migration ==="
echo ""

# Feature 1: bmad-integration
echo "Migrating: bmad-integration..."
git mv .bmad/epics/001-bmad-integration.md .bmad/features/bmad-integration/epics/epic-001-bmad-integration.md

# Feature 2: learning-system
echo "Migrating: learning-system..."
git mv .bmad/epics/002-learning-system-enhancement.md .bmad/features/learning-system/epics/epic-002-learning-system-enhancement.md
git mv .bmad/implementation/EPIC-009-IMPLEMENTATION.md .bmad/features/learning-system/reports/
git mv .bmad/implementation/EPIC-009-QUICKREF.md .bmad/features/learning-system/reports/
git mv .bmad/implementation/EPIC-009-SUMMARY.md .bmad/features/learning-system/reports/
git mv .bmad/implementation/EPIC-009-VERIFICATION.md .bmad/features/learning-system/reports/
git mv .bmad/feature-requests/learning-action-database.md .bmad/features/learning-system/context/

# Feature 3: tunnel-manager
echo "Migrating: tunnel-manager..."
git mv .bmad/epics/005-tunnel-manager.md .bmad/features/tunnel-manager/epics/epic-005-tunnel-manager.md
git mv .bmad/adr/001-sqlite-for-tunnel-state.md .bmad/features/tunnel-manager/adr/
git mv .bmad/adr/002-ingress-target-selection-algorithm.md .bmad/features/tunnel-manager/adr/
git mv .bmad/adr/008-shared-cname-vs-per-project.md .bmad/features/tunnel-manager/adr/
git mv .bmad/implementation/EPIC-005-COMPLETE.md .bmad/features/tunnel-manager/reports/
git mv .bmad/implementation/EPIC-005-IMPLEMENTATION.md .bmad/features/tunnel-manager/reports/
git mv .bmad/implementation/EPIC-005-QUICKREF.md .bmad/features/tunnel-manager/reports/
git mv .bmad/feature-requests/tunnel-manager.md .bmad/features/tunnel-manager/context/

# Feature 4: ps-delegation-enforcement
echo "Migrating: ps-delegation-enforcement..."
git mv .bmad/epics/013-multi-agent-cli-integration.md .bmad/features/ps-delegation-enforcement/epics/epic-013-multi-agent-cli-integration.md
git mv .bmad/epics/014-autonomous-usage-monitoring-optimization.md .bmad/features/ps-delegation-enforcement/epics/epic-014-autonomous-usage-monitoring.md
git mv .bmad/epics/015-core-identity-enforcement.md .bmad/features/ps-delegation-enforcement/epics/epic-015-core-identity-enforcement.md
git mv .bmad/epics/016-core-subagent-library-phase1.md .bmad/features/ps-delegation-enforcement/epics/epic-016-core-subagent-library.md
git mv .bmad/epics/017-centralized-subagent-spawning.md .bmad/features/ps-delegation-enforcement/epics/epic-017-centralized-subagent-spawning.md
git mv .bmad/epics/018-auto-discovery-system.md .bmad/features/ps-delegation-enforcement/epics/epic-018-auto-discovery-system.md
git mv .bmad/epics/019-infrastructure-tool-enforcement.md .bmad/features/ps-delegation-enforcement/epics/epic-019-infrastructure-tool-enforcement.md
git mv .bmad/epics/020-reference-documentation.md .bmad/features/ps-delegation-enforcement/epics/epic-020-reference-documentation.md
git mv .bmad/epics/021-testing-validation.md .bmad/features/ps-delegation-enforcement/epics/epic-021-testing-validation.md
git mv .bmad/adr/002-centralized-subagent-spawning.md .bmad/features/ps-delegation-enforcement/adr/
git mv .bmad/implementation/EPIC-011-IMPLEMENTATION.md .bmad/features/ps-delegation-enforcement/reports/
git mv .bmad/implementation/EPIC-011-QUICKREF.md .bmad/features/ps-delegation-enforcement/reports/
git mv .bmad/implementation/EPIC-011-SUMMARY.txt .bmad/features/ps-delegation-enforcement/reports/
git mv .bmad/implementation/EPIC-011-VERIFICATION.md .bmad/features/ps-delegation-enforcement/reports/
git mv .bmad/implementation/EPIC-012-COMPLETE.md .bmad/features/ps-delegation-enforcement/reports/
git mv .bmad/implementation/EPIC-012-IMPLEMENTATION.md .bmad/features/ps-delegation-enforcement/reports/
git mv .bmad/implementation/EPIC-012-QUICKREF.md .bmad/features/ps-delegation-enforcement/reports/
git mv .bmad/implementation/EPIC-012-SUMMARY.txt .bmad/features/ps-delegation-enforcement/reports/
git mv .bmad/feature-requests/ps-delegation-enforcement-subagent-library.md .bmad/features/ps-delegation-enforcement/context/
git mv .bmad/IMPLEMENTATION-SUMMARY-PS-DELEGATION-ENFORCEMENT.md .bmad/features/ps-delegation-enforcement/context/

# Feature 5: ui-first-workflow
echo "Migrating: ui-first-workflow..."
git mv .bmad/epics/022-design-system-foundation.md .bmad/features/ui-first-workflow/epics/epic-022-design-system-foundation.md
git mv .bmad/epics/ui-002-design-system-foundation.md .bmad/features/ui-first-workflow/epics/epic-ui-002-design-system-foundation.md
git mv .bmad/epics/023-requirements-analysis-engine.md .bmad/features/ui-first-workflow/epics/epic-023-requirements-analysis-engine.md
git mv .bmad/epics/ui-001-requirements-analysis-engine.md .bmad/features/ui-first-workflow/epics/epic-ui-001-requirements-analysis-engine.md
git mv .bmad/epics/024-frame0-design-generation.md .bmad/features/ui-first-workflow/epics/epic-024-frame0-design-generation.md
git mv .bmad/epics/ui-003-frame0-design-generation.md .bmad/features/ui-first-workflow/epics/epic-ui-003-frame0-design-generation.md
git mv .bmad/epics/025-figma-design-import.md .bmad/features/ui-first-workflow/epics/epic-025-figma-design-import.md
git mv .bmad/epics/ui-004-figma-design-import.md .bmad/features/ui-first-workflow/epics/epic-ui-004-figma-design-import.md
git mv .bmad/epics/026-mock-data-system.md .bmad/features/ui-first-workflow/epics/epic-026-mock-data-system.md
git mv .bmad/epics/ui-005-mock-data-generation.md .bmad/features/ui-first-workflow/epics/epic-ui-005-mock-data-generation.md
git mv .bmad/epics/027-interactive-mockup-deployment.md .bmad/features/ui-first-workflow/epics/epic-027-interactive-mockup-deployment.md
git mv .bmad/epics/ui-006-storybook-deployment.md .bmad/features/ui-first-workflow/epics/epic-ui-006-storybook-deployment.md
git mv .bmad/epics/ui-007-dev-environment-deployment.md .bmad/features/ui-first-workflow/epics/epic-ui-007-dev-environment-deployment.md
git mv .bmad/epics/028-requirements-validation.md .bmad/features/ui-first-workflow/epics/epic-028-requirements-validation.md
git mv .bmad/epics/029-backend-connection.md .bmad/features/ui-first-workflow/epics/epic-029-backend-connection.md
git mv .bmad/epics/ui-009-backend-connection-workflow.md .bmad/features/ui-first-workflow/epics/epic-ui-009-backend-connection-workflow.md
git mv .bmad/epics/030-shared-cname-infrastructure.md .bmad/features/ui-first-workflow/epics/epic-030-shared-cname-infrastructure.md
git mv .bmad/epics/ui-008-mcp-tool-suite.md .bmad/features/ui-first-workflow/epics/epic-ui-008-mcp-tool-suite.md
git mv .bmad/adr/007-frame0-vs-figma-default-tool.md .bmad/features/ui-first-workflow/adr/
git mv .bmad/adr/009-mock-data-strategy.md .bmad/features/ui-first-workflow/adr/
git mv .bmad/adr/019-storybook-dev-environment-deployment.md .bmad/features/ui-first-workflow/adr/
git mv .bmad/feature-requests/ui-first-development-workflow.md .bmad/features/ui-first-workflow/context/
git mv .bmad/feature-requests/ui-workflow-flexible-entry.md .bmad/features/ui-first-workflow/context/
git mv .bmad/handoff-ui-first-workflow-2026-01-22.md .bmad/features/ui-first-workflow/context/

# Feature 6: mobile-platform
echo "Migrating: mobile-platform..."
git mv .bmad/epics/031-react-native-project-setup.md .bmad/features/mobile-platform/epics/epic-031-react-native-project-setup.md
git mv .bmad/epics/032-ios-build-pipeline.md .bmad/features/mobile-platform/epics/epic-032-ios-build-pipeline.md
git mv .bmad/epics/033-android-build-pipeline.md .bmad/features/mobile-platform/epics/epic-033-android-build-pipeline.md
git mv .bmad/epics/034-firebase-test-lab-integration.md .bmad/features/mobile-platform/epics/epic-034-firebase-test-lab-integration.md
git mv .bmad/epics/035-github-actions-cicd.md .bmad/features/mobile-platform/epics/epic-035-github-actions-cicd.md
git mv .bmad/epics/036-expo-snack-integration.md .bmad/features/mobile-platform/epics/epic-036-expo-snack-integration.md
git mv .bmad/epics/037-macbook-integration.md .bmad/features/mobile-platform/epics/epic-037-macbook-integration.md
git mv .bmad/epics/038-mobile-testing-mcp-tools.md .bmad/features/mobile-platform/epics/epic-038-mobile-testing-mcp-tools.md
git mv .bmad/epics/039-mobile-deployment-automation.md .bmad/features/mobile-platform/epics/epic-039-mobile-deployment-automation.md
git mv .bmad/adr/010-react-native-vs-flutter.md .bmad/features/mobile-platform/adr/
git mv .bmad/adr/011-firebase-test-lab-vs-aws.md .bmad/features/mobile-platform/adr/
git mv .bmad/feature-requests/mobile-app-development-platform.md .bmad/features/mobile-platform/context/
git mv .bmad/feature-requests/mobile-platform-v2.md .bmad/features/mobile-platform/context/

# Feature 7: ps-health-monitoring
echo "Migrating: ps-health-monitoring..."
git mv .bmad/epics/040-ps-health-monitoring.md .bmad/features/ps-health-monitoring/epics/epic-040-ps-health-monitoring.md
git mv .bmad/adr/003-health-monitoring-and-restart-strategy.md .bmad/features/ps-health-monitoring/adr/
git mv .bmad/adr/015-tmux-prompting-for-ps-health-checks.md .bmad/features/ps-health-monitoring/adr/
git mv .bmad/adr/016-health-monitoring-database-schema.md .bmad/features/ps-health-monitoring/adr/
git mv .bmad/feature-requests/ps-health-monitoring.md .bmad/features/ps-health-monitoring/context/

# Feature 8: automatic-quality-workflows
echo "Migrating: automatic-quality-workflows..."
git mv .bmad/epics/006-automatic-quality-workflows-mvp.md .bmad/features/automatic-quality-workflows/epics/epic-006-automatic-quality-workflows.md
git mv .bmad/adr/004-agent-model-selection-for-quality-workflows.md .bmad/features/automatic-quality-workflows/adr/
git mv .bmad/adr/005-event-driven-vs-polling-architecture.md .bmad/features/automatic-quality-workflows/adr/
git mv .bmad/feature-requests/automatic-quality-workflows.md .bmad/features/automatic-quality-workflows/context/
git mv .bmad/analysis/automatic-quality-workflows-analysis.md .bmad/features/automatic-quality-workflows/context/

# Feature 9: automated-supervisor-updates
echo "Migrating: automated-supervisor-updates..."
git mv .bmad/epics/004-automated-supervisor-updates.md .bmad/features/automated-supervisor-updates/epics/epic-004-automated-supervisor-updates.md
git mv .bmad/adr/006-claude-md-update-strategy.md .bmad/features/automated-supervisor-updates/adr/

# Feature 10: secrets-management
echo "Migrating: secrets-management..."
git mv .bmad/implementation/EPIC-003-COMPLETE.md .bmad/features/secrets-management/reports/
git mv .bmad/implementation/EPIC-003-IMPLEMENTATION.md .bmad/features/secrets-management/reports/

# Feature 11: port-allocation
echo "Migrating: port-allocation..."
git mv .bmad/implementation/EPIC-004-IMPLEMENTATION.md .bmad/features/port-allocation/reports/

# Feature 12: database-foundation
echo "Migrating: database-foundation..."
git mv .bmad/implementation/EPIC-001-COMPLETE.md .bmad/features/database-foundation/reports/
git mv .bmad/implementation/EPIC-002-IMPLEMENTATION.md .bmad/features/database-foundation/reports/
git mv .bmad/implementation/EPIC-006-GCLOUD.md .bmad/features/database-foundation/reports/
git mv .bmad/implementation/EPIC-006-SUMMARY.md .bmad/features/database-foundation/reports/
git mv .bmad/implementation/EPIC-007-IMPLEMENTATION.md .bmad/features/database-foundation/reports/

# Feature 13: subagent-debugging
echo "Migrating: subagent-debugging..."
git mv .bmad/epics/epic-012-fix-subagent-hanging.md .bmad/features/subagent-debugging/epics/epic-012-fix-subagent-hanging.md

# Feature 14: automatic-context-handoff
echo "Migrating: automatic-context-handoff..."
git mv .bmad/adr/017-context-threshold-strategy.md .bmad/features/automatic-context-handoff/adr/
git mv .bmad/adr/018-automated-handoff-cycle-design.md .bmad/features/automatic-context-handoff/adr/
git mv .bmad/feature-requests/automatic-context-handoff-system.md .bmad/features/automatic-context-handoff/context/
git mv .bmad/HANDOFF-2026-01-23.md .bmad/features/automatic-context-handoff/context/

# Archive test epics
echo "Archiving test epics..."
git mv .bmad/epics/test-001-hello-world.md .bmad/archive/test-epics/
git mv .bmad/epics/test-002-gemini-test.md .bmad/archive/test-epics/
git mv .bmad/epics/test-003-codex-test.md .bmad/archive/test-epics/

# Remove duplicate/summary files
echo "Removing duplicate files..."
git rm .bmad/epics/019-implementation-summary.md

# Move EPIC-BREAKDOWN to docs
echo "Moving overview docs..."
git mv .bmad/epics/EPIC-BREAKDOWN.md .bmad/features/EPIC-BREAKDOWN-LEGACY.md

# Move ADRs that have duplicate numbers (keep one)
echo "Handling duplicate ADR numbers..."
# Keep 014-browser-automation (more specific), rename 014-subscription-tier
git mv .bmad/adr/014-subscription-tier-management.md .bmad/features/ps-delegation-enforcement/adr/020-subscription-tier-management.md
git mv .bmad/adr/014-browser-automation-for-api-keys.md .bmad/features/ps-delegation-enforcement/adr/014-browser-automation-for-api-keys.md

echo ""
echo "=== Migration Complete ==="
echo "Migrated 51 epics, 19 ADRs, 22 reports"
echo ""
