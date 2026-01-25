# Quick Start: Add New Core Instruction

**5-minute guide**

---

## Workflow

1. **Create core file**: `.supervisor-core/11-new-topic.md` (next number)
2. **Keep lean**: 60-130 lines, core rules + checklists only
3. **Extract details**: Templates → `/docs/templates/`, guides → `/docs/guides/`
4. **Test**: `npm run init-projects -- --project consilio-s --verbose`
5. **Verify size**: `wc -c CLAUDE.md  # Should be < 40k`
6. **Deploy**: `npm run init-projects -- --verbose`

---

## Template Structure

```markdown
# Topic Name

## Critical Rules
**MUST do X when Y**

## Checklist
1. ✅ Step 1
2. ✅ Step 2

## References
**Guide**: `/home/samuel/sv/docs/guides/topic-guide.md`
```

---

**Full guide**: `/home/samuel/sv/docs/guides/instruction-system-maintenance.md`
