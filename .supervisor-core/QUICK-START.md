# Quick Start: Add New Core Instruction

**5-minute guide for adding new behavior**

---

## Step 1: Create Core File

```bash
cd /home/samuel/sv/supervisor-service-s/.supervisor-core/
vim 10-new-topic.md  # Use next number
```

**Template** (60-130 lines target):
```markdown
# Topic Name

## Critical Behavior

**YOU MUST do X whenever Y happens.**

## Checklist

1. ✅ Item 1
2. ✅ Item 2
3. ✅ Item 3

## When to Act

- Trigger 1
- Trigger 2

## References

**Template**: `/home/samuel/sv/docs/templates/topic-template.md`
**Guide**: `/home/samuel/sv/docs/guides/topic-guide.md`
```

---

## Step 2: Create External Docs (Optional)

**Template** (`/docs/templates/topic-template.md`):
- Copy-paste ready structure
- Placeholders for project-specific content

**Guide** (`/docs/guides/topic-guide.md`):
- Detailed walkthrough
- Real examples
- Common mistakes

**Examples** (`/docs/examples/topic-examples.sh`):
- Concrete code examples
- Exact commands to run

---

## Step 3: Test & Deploy

```bash
cd /home/samuel/sv/supervisor-service-s

# Test one project
npm run init-projects -- --project consilio-s --verbose

# Check size
wc -c /home/samuel/sv/consilio-s/CLAUDE.md  # Should be < 40k

# Deploy all
npm run init-projects -- --verbose
```

---

## Key Rules

1. **Core behavior inline** (not just referenced)
2. **Keep lean** (< 130 lines if possible)
3. **Extract examples** to /docs/
4. **Absolute paths** in references
5. **Test before propagating**

---

**Full guide**: `/home/samuel/sv/docs/guides/instruction-system-maintenance.md`
