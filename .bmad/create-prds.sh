#!/bin/bash
# Generate PRDs for all features

cd /home/samuel/sv/supervisor-service-s/.bmad/features

# For each feature directory
for feature in */; do
  feature_name=$(basename "$feature")
  
  # Skip if PRD already exists
  if [ -f "$feature/prd.md" ]; then
    echo "PRD exists for $feature_name, skipping..."
    continue
  fi
  
  echo "Creating PRD for: $feature_name"
  
  # Create PRD based on available context
  cat > "$feature/prd.md" << EOF
# Product Requirements Document: ${feature_name//-/ }

**Feature ID:** ${feature_name}
**Created:** 2026-01-27
**Last Updated:** 2026-01-27
**Status:** Active
**Version:** 1.0.0

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-27 | Meta-Supervisor | Initial PRD created during migration |

---

## Executive Summary

This PRD tracks the ${feature_name//-/ } feature for the supervisor-service meta-infrastructure.

See \`context/\` directory for original feature requests and background.

---

## Epic Status

| Epic | Status | Completion | Last Updated |
|------|--------|------------|--------------|
EOF

  # Add epic entries from epics/ directory
  if [ -d "$feature/epics" ]; then
    for epic in "$feature/epics/"*.md; do
      if [ -f "$epic" ]; then
        epic_file=$(basename "$epic")
        epic_name="${epic_file%.md}"
        echo "| $epic_name | Pending | 0% | 2026-01-27 |" >> "$feature/prd.md"
      fi
    done
  fi
  
  cat >> "$feature/prd.md" << 'EOF'

---

## Goals & Objectives

### Primary Goal
[To be defined based on epic implementation]

### Success Criteria
- All epics completed successfully
- All acceptance criteria met
- Implementation validated

---

## Related Documents

### Epics
See `epics/` directory for detailed epic specifications.

### Architecture Decisions
See `adr/` directory for architectural decisions related to this feature.

### Implementation Reports
See `reports/` directory for implementation notes and verification results.

### Context
See `context/` directory for feature requests, handoffs, and background materials.

---

## Change Log

### Version 1.0.0 (2026-01-27)
- Initial PRD created during BMAD structure migration
- Migrated epics from legacy structure
- Established feature-based organization

---

**Note:** This PRD was auto-generated during the migration to feature-based structure. It should be updated with detailed requirements as epics are implemented.
EOF

done

echo ""
echo "PRD generation complete!"
