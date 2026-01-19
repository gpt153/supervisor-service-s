# Quick Reference: Instruction Management

Quick reference for common instruction management tasks.

## Common Tasks

### Update All Projects

```bash
cd /home/samuel/sv/supervisor-service
npm run init-projects
```

### Update Specific Project

```bash
npm run init-projects -- --project consilio
```

### Preview Changes (Dry Run)

```bash
npm run init-projects -- --dry-run
```

### Watch for Planning Changes

```bash
npm run watch:planning
```

### Update Core Instruction

```bash
# 1. Edit the file
vim .supervisor-core/01-identity.md

# 2. Regenerate all projects
npm run init-projects
```

### Update Project-Specific Instruction

```bash
# 1. Edit the file
vim /home/samuel/sv/consilio/.supervisor-specific/01-project-context.md

# 2. Regenerate that project
npm run init-projects -- --project consilio
```

### Add New Core Instruction

```bash
# 1. Create new file with number prefix
cat > .supervisor-core/05-new-section.md << 'EOF'
# New Section

Content here...
EOF

# 2. Regenerate all projects
npm run init-projects
```

### Add New Project-Specific Instruction

```bash
# 1. Create file in project's .supervisor-specific/
cat > /home/samuel/sv/consilio/.supervisor-specific/02-deployment.md << 'EOF'
# Deployment Instructions

Project-specific deployment info...
EOF

# 2. Regenerate that project
npm run init-projects -- --project consilio
```

## Via MCP Tools

### Regenerate All Projects

```typescript
mcp__meta__regenerate_supervisor({
  dryRun: false,
  preserveProjectSpecific: true
})
```

### Regenerate One Project

```typescript
mcp__meta__regenerate_supervisor({
  project: "consilio",
  dryRun: false,
  preserveProjectSpecific: true
})
```

### Update Core Instruction

```typescript
mcp__meta__update_core_instruction({
  filename: "01-identity.md",
  content: `# Supervisor Identity

Your new content here...`,
  layer: "core",
  regenerateAll: true
})
```

### List All Projects

```typescript
mcp__meta__list_projects({
  includeDetails: true
})
```

### Read Core Instruction

```typescript
mcp__meta__read_core_instruction({
  filename: "01-identity.md",
  layer: "core"
})
```

### List Core Instructions

```typescript
mcp__meta__list_core_instructions({
  layer: "all"
})
```

## Directory Structure

```
/home/samuel/sv/
├── supervisor-service/
│   ├── .supervisor-core/          ← Shared by all projects
│   │   ├── 01-identity.md
│   │   ├── 02-workflow.md
│   │   ├── 03-structure.md
│   │   └── 04-tools.md
│   ├── .supervisor-meta/          ← Only for supervisor-service
│   │   ├── 00-meta-identity.md
│   │   ├── 01-meta-focus.md
│   │   ├── 02-dependencies.md
│   │   └── 03-patterns.md
│   └── CLAUDE.md                  ← Auto-generated (core + meta)
│
├── consilio/
│   ├── .supervisor-specific/      ← Project-specific
│   │   └── 01-project-context.md
│   └── CLAUDE.md                  ← Auto-generated (core + specific)
│
├── odin/
│   ├── .supervisor-specific/
│   │   └── 01-project-context.md
│   └── CLAUDE.md
│
└── ... (other projects)
```

## File Naming

Use numbered prefixes for ordering:

```
01-first-topic.md
02-second-topic.md
10-later-topic.md
20-even-later.md
```

## Layer Priority

1. **Core** (`.supervisor-core/`) - Loaded first, applies to all
2. **Meta** (`.supervisor-meta/`) - Loaded second, only for supervisor-service
3. **Project** (`.supervisor-specific/`) - Loaded last, project-specific

Later layers don't override earlier ones; they append.

## Common Workflows

### Adding New Feature Guidance

**For all projects:**

```bash
cd /home/samuel/sv/supervisor-service
vim .supervisor-core/05-feature-guidance.md
npm run init-projects
```

**For one project:**

```bash
cd /home/samuel/sv/consilio
vim .supervisor-specific/02-feature-guidance.md
cd /home/samuel/sv/supervisor-service
npm run init-projects -- --project consilio
```

### Updating Tech Stack Info

**Update project's tech stack:**

```bash
vim /home/samuel/sv/consilio/.supervisor-specific/01-project-context.md
# Edit the tech stack section
npm run init-projects -- --project consilio
```

### Standardizing Workflow Across Projects

```bash
cd /home/samuel/sv/supervisor-service
vim .supervisor-core/02-workflow.md
# Add new standard procedure
npm run init-projects  # Updates all projects
```

## Troubleshooting

### Changes not appearing?

```bash
# Force regeneration
npm run init-projects

# Check what files are being used
head -10 /home/samuel/sv/consilio/CLAUDE.md
# Look at the metadata header for source paths
```

### Need to see what would change?

```bash
npm run init-projects -- --dry-run --verbose
```

### Watch not triggering?

```bash
# Stop watch (Ctrl+C)
# Start again
npm run watch:planning

# Check if .bmad/ directory exists
ls -la /home/samuel/sv/consilio/.bmad/
```

## Important Notes

- **Never edit `CLAUDE.md` directly** - It's auto-generated
- **Always use numbered prefixes** - Controls order
- **Core changes affect all** - Test before committing
- **Use dry-run first** - Preview changes
- **Commit source files** - Not `CLAUDE.md`

## Getting Help

```bash
# Script help
npm run init-projects -- --help
npm run watch:planning -- --help

# Verify system
npm run verify

# Full documentation
cat docs/INSTRUCTION_MANAGEMENT.md
```
