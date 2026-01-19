# Instruction Management System

## Overview

The Instruction Management System is a layered approach to generating and maintaining CLAUDE.md files for AI supervisors. It allows core instructions to be shared across all supervisors while preserving project-specific customizations.

## Architecture

### Three-Layer System

```
┌─────────────────────────────────────┐
│        Final CLAUDE.md              │
│  (Auto-generated, do not edit)      │
└─────────────────────────────────────┘
              ▲
              │ Assembly
              │
┌─────────────┴─────────────┐
│                           │
│  1. Core Instructions     │
│     (.supervisor-core/)   │
│     Shared by all         │
│                           │
├───────────────────────────┤
│                           │
│  2. Meta/Project          │
│     (.supervisor-meta/)   │
│     Service-specific      │
│                           │
├───────────────────────────┤
│                           │
│  3. Project-Specific      │
│     (.claude-specific/)   │
│     Preserved local mods  │
│                           │
└───────────────────────────┘
```

### Components

#### InstructionAssembler (`src/instructions/InstructionAssembler.ts`)

Main class that handles:
- Loading markdown files from each layer
- Combining layers in priority order
- Preserving project-specific sections
- Writing assembled CLAUDE.md
- Extracting and saving project content

#### Scripts

1. **assemble-claude.ts** - Generate fresh CLAUDE.md
2. **regenerate-claude.ts** - Regenerate while preserving project content
3. **update-all-supervisors.ts** - Update all projects in /home/samuel/sv/

#### Layer Directories

1. **.supervisor-core/** - Core instructions shared by all supervisors
   - `01-identity.md` - Supervisor role and identity
   - `02-workflow.md` - Standard operating procedures
   - `03-structure.md` - Directory organization
   - `04-tools.md` - Available tools and commands

2. **.supervisor-meta/** - Meta-service specific instructions
   - `01-meta-focus.md` - Meta-specific responsibilities
   - `02-dependencies.md` - Technology stack
   - `03-patterns.md` - Code patterns and conventions

3. **.claude-specific/** - Project-specific preserved content
   - Auto-generated during regeneration
   - Contains sections marked with project-specific markers

## Usage

### Generate New CLAUDE.md

For initial generation or complete rebuild:

```bash
cd /home/samuel/sv/supervisor-service
npm run assemble
```

This creates a fresh CLAUDE.md from core and meta layers only.

### Regenerate Preserving Content

When you have project-specific customizations to preserve:

```bash
npm run regenerate
```

This:
1. Extracts sections marked as project-specific
2. Saves them to `.claude-specific/`
3. Reassembles CLAUDE.md with all three layers

### Update All Projects

To update CLAUDE.md for all projects:

```bash
npm run update-all -- --dry-run  # Preview changes
npm run update-all               # Actually update
```

### Command-Line Options

#### assemble-claude.ts

```bash
tsx src/scripts/assemble-claude.ts [options]

Options:
  -o, --output <path>          Output path (default: ./CLAUDE.md)
  -p, --preserve-project       Include project-specific layer
  -v, --verbose                Verbose output
  -h, --help                   Show help
```

#### regenerate-claude.ts

```bash
tsx src/scripts/regenerate-claude.ts [options]

Options:
  -t, --target <path>          CLAUDE.md to regenerate (default: ./CLAUDE.md)
  -v, --verbose                Verbose output
  -h, --help                   Show help
```

#### update-all-supervisors.ts

```bash
tsx src/scripts/update-all-supervisors.ts [options]

Options:
  -d, --dry-run                Preview without writing
  -v, --verbose                Verbose output
  -h, --help                   Show help
```

## Programmatic API

### Basic Usage

```typescript
import { InstructionAssembler } from './src/instructions/InstructionAssembler.js';

const assembler = new InstructionAssembler('/home/samuel/sv/supervisor-service');

// Simple assembly
const result = await assembler.assembleAndWrite('./CLAUDE.md', {
  includeMetadata: true,
});

console.log(`Generated with ${result.sections.length} sections`);
```

### Regeneration with Preservation

```typescript
// Extract, save, and reassemble
const result = await assembler.regenerate('./CLAUDE.md');

console.log(`Preserved ${result.sections.length} sections`);
```

### Custom Assembly

```typescript
// Assemble without writing
const result = await assembler.assemble({
  preserveProjectSpecific: true,
  includeMetadata: true,
});

// Process or transform content
const customContent = transformContent(result.content);

// Write manually
await assembler.writeToFile('./CLAUDE.md', {
  ...result,
  content: customContent,
});
```

## Adding Instructions

### To Core Layer (Affects All Supervisors)

1. Create new markdown file in `.supervisor-core/`:

```bash
cd /home/samuel/sv/supervisor-service
cat > .supervisor-core/05-new-section.md << 'EOF'
# New Section

Content here...
EOF
```

2. Regenerate CLAUDE.md:

```bash
npm run assemble
```

3. **IMPORTANT**: This affects all supervisors. Test thoroughly!

### To Meta Layer (Meta-Service Only)

1. Create new markdown file in `.supervisor-meta/`:

```bash
cat > .supervisor-meta/04-new-section.md << 'EOF'
# Meta-Specific Section

Content here...
EOF
```

2. Regenerate:

```bash
npm run assemble
```

### Project-Specific Content

Mark sections in CLAUDE.md for preservation:

```markdown
<!-- project-specific:start -->
## My Custom Section

This will be preserved during regeneration.
<!-- project-specific:end -->
```

Then regenerate:

```bash
npm run regenerate
```

The section will be extracted to `.claude-specific/section-1.md`.

## File Structure

```
/home/samuel/sv/supervisor-service/
├── .supervisor-core/              # Core instructions (shared)
│   ├── 01-identity.md
│   ├── 02-workflow.md
│   ├── 03-structure.md
│   └── 04-tools.md
├── .supervisor-meta/              # Meta-specific instructions
│   ├── 01-meta-focus.md
│   ├── 02-dependencies.md
│   └── 03-patterns.md
├── .claude-specific/              # Project-specific (auto-generated)
│   ├── section-1.md               # Preserved content
│   └── section-2.md
├── src/
│   ├── instructions/
│   │   ├── InstructionAssembler.ts    # Main assembler class
│   │   └── README.md                  # Instruction system docs
│   ├── scripts/
│   │   ├── assemble-claude.ts         # Assembly script
│   │   ├── regenerate-claude.ts       # Regeneration script
│   │   └── update-all-supervisors.ts  # Batch update script
│   └── types/
│       └── instruction-types.ts       # TypeScript types
└── CLAUDE.md                      # Auto-generated output
```

## Generated CLAUDE.md Format

```markdown
<!-- AUTO-GENERATED CLAUDE.md -->
<!-- Do not edit this file directly. Edit source files in: -->
<!--   - /path/to/.supervisor-core/01-identity.md -->
<!--   - /path/to/.supervisor-meta/01-meta-focus.md -->
<!-- Generated: 2026-01-18T12:00:00.000Z -->

[Content from 01-identity.md]

[Content from 02-workflow.md]

[Content from 03-structure.md]

...
```

## Best Practices

### 1. Ordering

Use numeric prefixes for consistent ordering:
- `01-`, `02-`, `03-`, etc.
- Assembled alphabetically

### 2. Modularity

Keep each file focused:
- One topic per file
- Clear, descriptive filename
- Self-contained content

### 3. Testing

Always test after changes:
```bash
# Regenerate
npm run assemble

# Test with supervisor
cd /home/samuel/sv/supervisor-service
# Ask Claude to perform a task
```

### 4. Version Control

Commit instruction changes separately:
```bash
git add .supervisor-core/05-new-section.md
git commit -m "Add new section to core instructions"

git add CLAUDE.md
git commit -m "Regenerate CLAUDE.md with new section"
```

### 5. Documentation

Document rationale for major changes:
- Why the instruction was added
- What behavior it changes
- Impact on supervisors

## Metadata and Tracking

### Metadata Header

Every generated CLAUDE.md includes:
- Auto-generated marker
- List of source files
- Generation timestamp

### Assembly Result

`AssemblyResult` object contains:
```typescript
{
  content: string;           // Final assembled content
  sections: Section[];       // All sections with metadata
  timestamp: Date;           // When generated
  sources: string[];         // Source file paths
}
```

## Error Handling

### Missing Directories

If a layer directory doesn't exist, it's skipped:
```
// .supervisor-core/ missing
→ Only meta layer included
```

### Invalid Markdown

Markdown is passed through as-is. No validation or transformation.

### File System Errors

Errors during read/write throw with helpful messages:
```
Error: Failed to read instruction file
  Path: /path/to/file.md
  Cause: ENOENT: no such file or directory
```

## Future Enhancements

See EPIC-008 for planned features:

### MCP Tools

Expose via supervisor-service MCP:
- `mcp__meta__regenerate_supervisor` - Regenerate CLAUDE.md remotely
- `mcp__meta__update_core_instruction` - Update core instruction file
- `mcp__meta__adapt_local_claude` - Auto-adapt to codebase changes

### AdaptLocalClaude Agent

Automatic instruction adaptation:
- Analyze codebase on changes
- Detect tech stack updates
- Update instructions accordingly
- Generate project-specific sections

### Automatic Triggers

Auto-regenerate on:
- Epic completion
- PR merge
- Monthly schedule
- Manual trigger

### Git Integration

Automatic commits:
```bash
npm run regenerate
# → Auto-commits CLAUDE.md with message
```

### Diff Preview

Preview changes before regeneration:
```bash
npm run regenerate -- --diff
# Shows what would change
```

## Troubleshooting

### CLAUDE.md not updating

1. Check source files exist:
   ```bash
   ls -la .supervisor-core/
   ls -la .supervisor-meta/
   ```

2. Run with verbose:
   ```bash
   npm run assemble -- --verbose
   ```

3. Check for errors in output

### Project-specific sections lost

1. Ensure markers are correct:
   ```markdown
   <!-- project-specific:start -->
   Content
   <!-- project-specific:end -->
   ```

2. Use `regenerate` not `assemble`:
   ```bash
   npm run regenerate  # ✓ Preserves
   npm run assemble    # ✗ Doesn't preserve
   ```

### Changes not reflected

1. Verify file is in correct directory
2. Check numeric prefix for ordering
3. Re-run assembly script
4. Check CLAUDE.md for new content

## Support

For issues or questions:
1. Check this documentation
2. Review EPIC-008 specification
3. Examine InstructionAssembler source code
4. Check script output with `--verbose`
