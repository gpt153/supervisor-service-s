# Quick Start: Add New Core Instruction

**5-minute guide to adding new behavior that follows the reference pattern**

---

## Step 1: Create Core File (2 min)

```bash
cd /home/samuel/sv/supervisor-service-s/.supervisor-core/
vim 09-new-topic.md
```

**Template**:
```markdown
# Topic Name

## Critical Behavior

**YOU MUST do X whenever Y happens.**

## Checklist

**Must include:**
1. ✅ Item 1
2. ✅ Item 2
3. ✅ Item 3

## When to Update

- Trigger 1
- Trigger 2
- Trigger 3

## Templates & Guides

**Need a template?**
- See: `/home/samuel/sv/docs/templates/topic-template.md`

**Detailed guide:**
- See: `/home/samuel/sv/docs/guides/topic-guide.md`

---

**Maintained by**: Each project-supervisor (PS)
**Update frequency**: After [trigger event]
```

**Size target**: 60-130 lines

---

## Step 2: Create Template (1 min, optional)

```bash
vim /home/samuel/sv/docs/templates/topic-template.md
```

**Include**:
- Complete copy-paste ready structure
- Placeholders: `[YOUR_CONTENT]`
- All sections PSes need to fill

---

## Step 3: Create Guide (2 min, optional)

```bash
vim /home/samuel/sv/docs/guides/topic-guide.md
```

**Include**:
- Section-by-section walkthrough
- Real examples from projects
- Common mistakes (❌ vs ✅)
- Quick self-test

---

## Step 4: Test & Deploy (1 min)

```bash
cd /home/samuel/sv/supervisor-service-s

# Test with one project
npm run init-projects -- --project consilio-s --verbose

# Check it worked
head -15 /home/samuel/sv/consilio-s/CLAUDE.md

# Deploy to all projects
npm run init-projects -- --verbose

# Verify file sizes reasonable
wc -l /home/samuel/sv/*/CLAUDE.md
```

---

## Example: Real Instruction

**File**: `07-deployment-documentation.md` (78 lines)

**Inline (core file)**:
- ✅ Critical rule: "Keep deployment info current"
- ✅ Checklist: 8 items that must be included
- ✅ When to update: 5 triggers
- 📄 Reference: Template and guide

**Referenced (external)**:
- 📄 Template: 149 lines
- 📄 Guide: 290 lines

**Total saved**: 361 lines per project

---

## Key Rules

1. **Keep core file lean** (< 130 lines if possible)
2. **Core behavior MUST be inline** (not just referenced)
3. **Extract templates/examples** to /docs/
4. **Use absolute paths** for references
5. **Test before propagating** to all projects

---

**Full docs**: See `README.md` in this directory
**Detailed guide**: `/home/samuel/sv/docs/guides/instruction-system-maintenance.md`
