# Handoff Workflow

**CRITICAL: Create handoffs when context ≥ 80% or switching tasks**

---

## When to Create

**MANDATORY:**
- ✅ Context window ≥ 80%
- ✅ Switching to different epic/task mid-work
- ✅ End of session with incomplete work
- ✅ Multiple parallel sessions on different tasks

**DO NOT:**
- ❌ Work is complete and committed

---

## Naming Convention

```
YYYY-MM-DD-HHMM-{epic-or-task-id}-{brief-description}.md
```

**Examples:**
- `2026-01-25-1430-epic-003-authentication.md`
- `2026-01-25-1545-bug-gmail-headers.md`

**Rules:** Date/time (24h), epic ID, 2-4 word description, kebab-case

---

## Required Sections

**Location**: `docs/handoffs/`

1. ✅ Current state (working, in progress, blocked)
2. ✅ Exact location (file path:line)
3. ✅ Next steps (numbered checklist)
4. ✅ Files modified (git status)
5. ✅ Commands to resume (copy-paste ready)

---

## Quick Checklist

**Creating:**
- [ ] Context ≥ 80%?
- [ ] Used naming convention?
- [ ] Filled all sections?
- [ ] Commands copy-paste ready?
- [ ] Updated README?
- [ ] Committed?

**Resuming:**
- [ ] Found correct handoff?
- [ ] Read full document?
- [ ] Ran resume commands?
- [ ] Checked git status?

---

## References

**Template:** `/home/samuel/sv/templates/handoff-template.md`
**Guide:** `/home/samuel/sv/docs/guides/handoff-workflow-guide.md`
