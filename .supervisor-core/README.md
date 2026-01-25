# Core Supervisor Instructions

**Last Updated**: 2026-01-25

This directory contains **core instructions** shared by all project-supervisors (PSes).

---

## Files (Loaded Alphabetically)

```
01-identity.md          - PS role, principles
02-workflow.md          - SOPs, workflows
03-structure.md         - Directory organization
04-tools.md             - Available commands
05-autonomous-supervision.md - PIV loop, autonomy
06-terminology.md       - Official terms (SSB, PS, MS)
07-deployment-documentation.md - Keep deployment info current
08-port-ranges.md       - Port management
09-tunnel-management.md - CNAME creation, tunnel tools
10-secrets-workflow.md  - Mandatory secrets management workflow
```

---

## Reference Pattern

**Inline**: Core rules, checklists, quick refs
**External**: Templates (`/docs/templates/`), guides (`/docs/guides/`), examples (`/docs/examples/`)

**Size limits**: 30-60 (simple), 60-130 (medium), 130-270 (complex)

---

## Regenerating CLAUDE.md

**Test one**: `npm run init-projects -- --project consilio-s --verbose`
**Regenerate all**: `npm run init-projects -- --verbose`
**Verify**: `wc -c /home/samuel/sv/*/CLAUDE.md  # Should be < 40k chars`

---

## References

**Complete maintenance guide**: `/home/samuel/sv/docs/guides/instruction-system-maintenance.md`

**Maintained by**: Meta-supervisor (MS)
**Last optimized**: 2026-01-25 (Phase 7 slimming)
