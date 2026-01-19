# Quick Reference - Instruction Management

## Common Operations

### Generate CLAUDE.md
```bash
npm run assemble
```

### Regenerate (Preserve Content)
```bash
npm run regenerate
```

### Update All Projects
```bash
npm run update-all -- --dry-run  # Preview
npm run update-all               # Execute
```

### Verify System
```bash
npm run verify
```

## Adding Instructions

### Add Core Instruction (All Supervisors)
```bash
# 1. Create file
cat > .supervisor-core/05-new-section.md << 'EOF'
# New Section
Content here...
EOF

# 2. Regenerate
npm run assemble

# 3. Verify
npm run verify
```

### Add Meta Instruction (This Service Only)
```bash
# 1. Create file
cat > .supervisor-meta/04-new-section.md << 'EOF'
# Meta-Specific Section
Content here...
EOF

# 2. Regenerate
npm run assemble
```

### Mark Project-Specific Content
```markdown
<!-- project-specific:start -->
## Custom Section
This will be preserved during regeneration.
<!-- project-specific:end -->
```

Then run:
```bash
npm run regenerate
```

## File Locations

### Generated Output
- `/home/samuel/sv/supervisor-service/CLAUDE.md`

### Instruction Sources
- `.supervisor-core/` - Core instructions
- `.supervisor-meta/` - Meta instructions
- `.claude-specific/` - Preserved sections (auto-generated)

### Scripts
- `src/scripts/assemble-claude.ts` - Assembly script
- `src/scripts/regenerate-claude.ts` - Regeneration script
- `src/scripts/update-all-supervisors.ts` - Batch update
- `src/scripts/verify-instruction-system.ts` - Verification

### Documentation
- `docs/INSTRUCTION-SYSTEM.md` - Full guide
- `src/instructions/README.md` - Quick reference
- `docs/EPIC-008-IMPLEMENTATION.md` - Implementation summary

## CLI Options

### assemble-claude.ts
```bash
tsx src/scripts/assemble-claude.ts [options]

-o, --output <path>      Output path (default: ./CLAUDE.md)
-p, --preserve-project   Include project-specific layer
-v, --verbose            Verbose output
-h, --help               Show help
```

### regenerate-claude.ts
```bash
tsx src/scripts/regenerate-claude.ts [options]

-t, --target <path>      CLAUDE.md path (default: ./CLAUDE.md)
-v, --verbose            Verbose output
-h, --help               Show help
```

### update-all-supervisors.ts
```bash
tsx src/scripts/update-all-supervisors.ts [options]

-d, --dry-run            Preview without writing
-v, --verbose            Verbose output
-h, --help               Show help
```

## Troubleshooting

### CLAUDE.md Not Updating
```bash
# 1. Check source files exist
ls -la .supervisor-core/
ls -la .supervisor-meta/

# 2. Run with verbose
npm run assemble -- --verbose

# 3. Verify system
npm run verify
```

### Lost Project Sections
Use `regenerate` not `assemble`:
```bash
npm run regenerate  # ✓ Preserves project content
npm run assemble    # ✗ Doesn't preserve
```

### Check What Changed
```bash
# Before regenerating
git diff CLAUDE.md

# After regenerating
git diff CLAUDE.md
```

## Best Practices

1. **File Naming**: Use numeric prefixes (01-, 02-, etc.)
2. **Testing**: Always run `npm run verify` after changes
3. **Version Control**: Commit instruction changes separately
4. **Documentation**: Document why instructions were added/changed
5. **Preservation**: Use `regenerate` to keep project customizations

## Example Workflow

### Update Core Instructions
```bash
# 1. Edit instruction file
vim .supervisor-core/02-workflow.md

# 2. Regenerate
npm run assemble

# 3. Verify
npm run verify

# 4. Test (manual)
# Ask Claude to perform a task

# 5. Commit
git add .supervisor-core/02-workflow.md CLAUDE.md
git commit -m "Update workflow instructions"
```

### Add Project-Specific Section
```bash
# 1. Edit CLAUDE.md directly
vim CLAUDE.md

# Add markers:
# <!-- project-specific:start -->
# Custom content
# <!-- project-specific:end -->

# 2. Regenerate to preserve
npm run regenerate

# 3. Verify preserved
cat .claude-specific/section-1.md

# 4. Commit
git add CLAUDE.md
git commit -m "Add project-specific section"
```

## Quick Checks

### Is System Working?
```bash
npm run verify
```
Expected: All checks pass

### What Files Are Loaded?
```bash
npm run assemble -- --verbose
```
Shows all source files used

### What Would Change?
```bash
npm run update-all -- --dry-run
```
Shows preview of changes across projects

## Integration Points

### With MCP Server
Future: Expose tools via MCP for remote management

### With Database
Future: Track instruction versions in database

### With Git
Manual: Commit after regeneration

### With Projects
Use `update-all` to propagate changes

## Performance

### Assembly Time
- Typical: < 100ms
- With verbose: < 200ms

### Verification Time
- Full check: < 500ms

### Update All Projects
- Per project: < 100ms
- 4 projects: < 500ms

## Links

- [Full Documentation](INSTRUCTION-SYSTEM.md)
- [Implementation Details](EPIC-008-IMPLEMENTATION.md)
- [EPIC-008 Specification](../../.bmad/epics/EPIC-BREAKDOWN.md)
