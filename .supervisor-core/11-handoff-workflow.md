# Handoff Workflow

**CRITICAL: Use handoffs when context window reaches 80% or switching tasks**

---

## When to Create Handoff

**MANDATORY handoff creation:**
- ✅ Context window ≥ 80%
- ✅ Switching to different epic/task mid-work
- ✅ End of session with incomplete work
- ✅ Multiple parallel sessions working on different tasks

**DO NOT create handoff:**
- ❌ Work is complete and committed
- ❌ Task is fully done (archive instead)

---

## Naming Convention

```
YYYY-MM-DD-HHMM-{epic-or-task-id}-{brief-description}.md
```

**Examples:**
```
2026-01-25-1430-epic-003-authentication.md
2026-01-25-1545-bug-gmail-headers.md
2026-01-25-1620-feature-oauth.md
```

**Rules:**
- Date/time in 24h format (for chronological sorting)
- Epic ID when working on epic
- Brief description (2-4 words, kebab-case)
- Latest timestamp = most recent handoff

---

## Creating Handoff

**Location**: `docs/handoffs/`

**Template**: `/home/samuel/sv/templates/handoff-template.md`

**Must include:**
1. ✅ Current state (what's working, in progress, blocked)
2. ✅ Exact location (file path, line number)
3. ✅ Next steps (numbered checklist)
4. ✅ Files modified (git status output)
5. ✅ Commands to resume (copy-paste ready)

**Workflow:**
```bash
# 1. Create handoff from template
cp /home/samuel/sv/templates/handoff-template.md docs/handoffs/YYYY-MM-DD-HHMM-task.md

# 2. Fill in all sections
# 3. Update docs/handoffs/README.md table
# 4. Commit
git add docs/handoffs/
git commit -m "chore: create handoff for [task]"
git push
```

---

## Resuming from Handoff

**Finding handoff:**
```bash
cd /home/samuel/sv/{project}

# Option 1: List by date (latest first)
ls -lt docs/handoffs/*.md | head

# Option 2: Search by epic
ls docs/handoffs/*epic-003*

# Option 3: Search by keyword
grep -l "OAuth" docs/handoffs/*.md
```

**Resume workflow:**
1. Read full handoff document
2. Run "Commands to Resume" section
3. Check git status
4. Continue from "Next Steps" checklist

---

## Multi-Instance Scenario

**User has 3 PS instances working on different tasks:**

**Instance 1**: `ls docs/handoffs/*epic-003*` → Continue Epic 003
**Instance 2**: `ls docs/handoffs/*bug-gmail*` → Continue Gmail fix
**Instance 3**: `ls docs/handoffs/*oauth*` → Continue OAuth feature

**No confusion!** Each instance finds correct handoff by task ID or keyword.

---

## Completing Work

**When work is done:**
```bash
# Move to archive
mv docs/handoffs/YYYY-MM-DD-HHMM-task.md docs/archive/handoffs/

# Update README table
# Remove entry from docs/handoffs/README.md

# Commit
git add docs/handoffs/ docs/archive/handoffs/
git commit -m "chore: archive handoff for completed [task]"
git push
```

---

## File Structure

```
docs/
├── handoffs/              ← Active (might resume)
│   ├── README.md         ← Current active handoffs table
│   └── 2026-01-25-*.md   ← Active handoff files
└── archive/
    └── handoffs/          ← Completed (historical reference)
        └── 2026-01-*.md   ← Archived handoff files
```

---

## Quick Checklist

**Creating:**
- [ ] Context ≥ 80%?
- [ ] Used naming convention?
- [ ] Filled all template sections?
- [ ] Updated README.md table?
- [ ] Committed handoff?

**Resuming:**
- [ ] Found correct handoff?
- [ ] Read full document?
- [ ] Ran resume commands?
- [ ] Checked git status?

**Completing:**
- [ ] Moved to archive?
- [ ] Updated README.md?
- [ ] Committed changes?

---

**References:**
- **Template**: `/home/samuel/sv/templates/handoff-template.md`
- **README**: `docs/handoffs/README.md` (each project)
- **Archived handoffs**: `docs/archive/handoffs/`
