# Instruction System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Instruction Management System                 │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │   InstructionAssembler    │
                    │   (Core Engine)           │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  .supervisor-    │   │  .supervisor-    │   │  .claude-        │
│  core/           │   │  meta/           │   │  specific/       │
│                  │   │                  │   │                  │
│  Shared by all   │   │  Service-        │   │  Project         │
│  supervisors     │   │  specific        │   │  customizations  │
│                  │   │                  │   │  (preserved)     │
└──────────────────┘   └──────────────────┘   └──────────────────┘
          │                       │                       │
          │   Priority: 1         │   Priority: 2         │   Priority: 3
          │   (Lowest)            │   (Medium)            │   (Highest)
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │   CLAUDE.md     │
                        │  (Generated)    │
                        └─────────────────┘
```

## Component Architecture

```
supervisor-service/
│
├── Instruction Sources (Input)
│   ├── .supervisor-core/        [Layer 1: Shared]
│   │   ├── 01-identity.md       → Supervisor role
│   │   ├── 02-workflow.md       → Standard procedures
│   │   ├── 03-structure.md      → Directory layout
│   │   └── 04-tools.md          → Available tools
│   │
│   ├── .supervisor-meta/        [Layer 2: Meta-specific]
│   │   ├── 01-meta-focus.md     → Meta responsibilities
│   │   ├── 02-dependencies.md   → Tech stack
│   │   └── 03-patterns.md       → Code patterns
│   │
│   └── .claude-specific/        [Layer 3: Project]
│       └── section-*.md         → Preserved sections
│
├── Processing Engine
│   ├── src/instructions/
│   │   ├── InstructionAssembler.ts    [Core class]
│   │   │   ├── loadLayer()           → Read layer files
│   │   │   ├── assemble()            → Combine layers
│   │   │   ├── assembleAndWrite()    → Generate file
│   │   │   ├── extractProjectSpecific() → Extract sections
│   │   │   ├── saveProjectSpecific() → Save sections
│   │   │   └── regenerate()          → Full regen flow
│   │   │
│   │   └── index.ts                   [Exports]
│   │
│   └── src/types/
│       └── instruction-types.ts       [Type definitions]
│
├── Scripts (User Interface)
│   └── src/scripts/
│       ├── assemble-claude.ts         [Generate fresh]
│       ├── regenerate-claude.ts       [Preserve & regen]
│       ├── update-all-supervisors.ts  [Batch update]
│       └── verify-instruction-system.ts [Validation]
│
└── Output
    └── CLAUDE.md                      [Final assembled file]
```

## Data Flow

### Assembly Flow

```
Start
  │
  ├─→ Load Core Layer (.supervisor-core/*.md)
  │     │
  │     ├─→ Read 01-identity.md
  │     ├─→ Read 02-workflow.md
  │     ├─→ Read 03-structure.md
  │     └─→ Read 04-tools.md
  │
  ├─→ Load Meta Layer (.supervisor-meta/*.md)
  │     │
  │     ├─→ Read 01-meta-focus.md
  │     ├─→ Read 02-dependencies.md
  │     └─→ Read 03-patterns.md
  │
  ├─→ Load Project Layer (.claude-specific/*.md) [Optional]
  │     │
  │     └─→ Read section-*.md (if present)
  │
  ├─→ Generate Metadata Header
  │     │
  │     ├─→ Add source file list
  │     ├─→ Add timestamp
  │     └─→ Add auto-generated marker
  │
  ├─→ Combine All Sections
  │     │
  │     └─→ Join with double newlines
  │
  └─→ Write CLAUDE.md
        │
        └─→ Success
```

### Regeneration Flow

```
Start
  │
  ├─→ Read Existing CLAUDE.md
  │
  ├─→ Extract Project-Specific Sections
  │     │
  │     ├─→ Find <!-- project-specific:start -->
  │     ├─→ Extract content
  │     └─→ Find <!-- project-specific:end -->
  │
  ├─→ Save to .claude-specific/
  │     │
  │     ├─→ Create directory if needed
  │     └─→ Write section-*.md files
  │
  ├─→ Run Standard Assembly
  │     │
  │     └─→ Include .claude-specific/ layer
  │
  └─→ Write New CLAUDE.md
        │
        └─→ Success (Project sections preserved)
```

## Class Structure

### InstructionAssembler

```typescript
class InstructionAssembler {
  // Properties
  private corePath: string;          // Path to core layer
  private metaPath: string;          // Path to meta layer
  private projectPath: string;       // Path to project layer

  // Constructor
  constructor(basePath: string)

  // Public Methods
  async assemble(options?): Promise<AssemblyResult>
    // Combine all layers into content

  async assembleAndWrite(targetPath, options?): Promise<AssemblyResult>
    // Assemble and write to file

  async extractProjectSpecific(claudeMdPath): Promise<string[]>
    // Extract marked sections

  async saveProjectSpecific(sections): Promise<void>
    // Save sections to .claude-specific/

  async regenerate(claudeMdPath): Promise<AssemblyResult>
    // Full regeneration with preservation

  async writeToFile(targetPath, result): Promise<void>
    // Write assembled content

  // Private Methods
  private async loadLayer(layerPath, source)
    // Load markdown files from layer

  private generateMetadataHeader(sources): string
    // Generate metadata header
}
```

## Type System

```typescript
// Layer definition
interface InstructionLayer {
  name: string;        // Layer name
  path: string;        // File system path
  priority: number;    // Override priority
}

// Individual section
interface InstructionSection {
  marker: string;      // Source marker comment
  content: string;     // Actual content
  source: 'core' | 'meta' | 'project';  // Layer source
}

// Assembly result
interface AssemblyResult {
  content: string;           // Final assembled content
  sections: InstructionSection[];  // All sections
  timestamp: Date;           // Generation time
  sources: string[];         // Source file paths
}

// Assembly options
interface AssemblyOptions {
  preserveProjectSpecific?: boolean;  // Include project layer
  includeMetadata?: boolean;          // Add metadata header
  targetPath?: string;                // Output path
}

// Generated file metadata
interface InstructionMetadata {
  version: string;           // System version
  lastUpdated: Date;         // Last generation time
  layers: string[];          // Source layers
  autoGenerated: boolean;    // Is auto-generated
}
```

## Script Interface

### CLI Commands

```bash
# Assembly (fresh generation)
npm run assemble
  └─→ tsx src/scripts/assemble-claude.ts
      └─→ InstructionAssembler.assembleAndWrite()

# Regeneration (preserve content)
npm run regenerate
  └─→ tsx src/scripts/regenerate-claude.ts
      └─→ InstructionAssembler.regenerate()

# Update all projects
npm run update-all
  └─→ tsx src/scripts/update-all-supervisors.ts
      └─→ For each project:
          └─→ InstructionAssembler.regenerate()

# Verification
npm run verify
  └─→ tsx src/scripts/verify-instruction-system.ts
      └─→ Run 23 checks
```

## File Format

### Instruction Files (.md)

```markdown
# Section Title

Content in standard markdown format.

## Subsection

- Bullet points
- Clear structure
- Actionable items

**Bold text** for emphasis
`code` for commands
```

### Generated CLAUDE.md

```markdown
<!-- AUTO-GENERATED CLAUDE.md -->
<!-- Do not edit this file directly. Edit source files in: -->
<!--   - /path/to/.supervisor-core/01-identity.md -->
<!--   - /path/to/.supervisor-meta/01-meta-focus.md -->
<!-- Generated: 2026-01-18T14:00:00.000Z -->

[Content from all layers combined]
```

### Project-Specific Markers

```markdown
<!-- project-specific:start -->
Custom content that will be preserved during regeneration.
<!-- project-specific:end -->
```

## Extension Points

### Adding New Layers

```typescript
// Future: Add project-specific layer
const projectAssembler = new InstructionAssembler(projectPath);

// Custom layer priority
const layers = [
  { name: 'core', path: corePath, priority: 1 },
  { name: 'meta', path: metaPath, priority: 2 },
  { name: 'project', path: projectPath, priority: 3 },
  { name: 'custom', path: customPath, priority: 4 },  // New layer
];
```

### Custom Processors

```typescript
// Future: Add custom processing
class CustomAssembler extends InstructionAssembler {
  protected async processSection(section: InstructionSection): Promise<InstructionSection> {
    // Custom transformation
    return transformedSection;
  }
}
```

### MCP Integration

```typescript
// Future: Expose via MCP
registerTool({
  name: 'mcp__meta__regenerate_supervisor',
  handler: async (args) => {
    const assembler = new InstructionAssembler(args.basePath);
    return await assembler.regenerate(args.targetPath);
  }
});
```

## Performance Characteristics

### Time Complexity

- Load layer: O(n) where n = number of files
- Assemble: O(m) where m = total content size
- Write: O(m) where m = total content size
- Overall: O(n + m) - linear

### Space Complexity

- In-memory sections: O(m) where m = total content
- Metadata: O(n) where n = number of sources
- Overall: O(n + m) - linear

### Typical Performance

```
Operation               Time       Files
─────────────────────   ────────   ─────
Load core layer         ~10ms      4 files
Load meta layer         ~10ms      3 files
Load project layer      ~10ms      0-5 files
Assemble content        ~20ms      N/A
Write to file           ~10ms      1 file
─────────────────────   ────────   ─────
Total (assembly)        ~60ms      7-12 files

Verification            ~500ms     23 checks
Update all projects     ~500ms     4 projects
```

## Error Handling

```
Error Type                    Handling
────────────────────────────  ──────────────────────────
Missing layer directory       Skip gracefully
Empty layer directory         No sections added
Invalid markdown syntax       Pass through as-is
File system permission error  Throw with message
Missing target path           Use default
Invalid options               Use defaults
```

## Security Considerations

1. **File System Access**: Only reads from designated directories
2. **Path Validation**: No path traversal outside base path
3. **Content Sanitization**: No code execution, pure text
4. **Permissions**: Respects file system permissions

## Future Architecture

### Phase 2: MCP Tools

```
MCP Server
  │
  ├─→ mcp__meta__regenerate_supervisor
  ├─→ mcp__meta__update_core_instruction
  └─→ mcp__meta__adapt_local_claude
```

### Phase 3: Automation

```
Trigger System
  │
  ├─→ Epic Complete → Regenerate all
  ├─→ PR Merge → Regenerate affected
  └─→ Monthly → Review and update
```

### Phase 4: Intelligence

```
AdaptLocalClaude Agent
  │
  ├─→ Analyze Codebase
  ├─→ Detect Patterns
  ├─→ Generate Instructions
  └─→ Update CLAUDE.md
```

## Dependencies

### Runtime
- `fs/promises` - File system operations
- `path` - Path manipulation

### Development
- TypeScript - Type safety
- tsx - Script execution
- Node.js v20+ - Runtime

### Zero External Dependencies
- No npm packages required for core functionality
- Self-contained implementation
- Minimal surface area

## Testing Strategy

### Current
- Verification script (23 checks)
- Manual testing

### Future
- Unit tests for InstructionAssembler
- Integration tests for scripts
- End-to-end tests for full flow
- Performance benchmarks
- Regression tests

## Monitoring

### Metrics to Track
- Assembly time per operation
- Number of sections generated
- File sizes
- Error rates
- Usage patterns

### Logging
- Info: Assembly operations
- Debug: File loads, section counts
- Error: File system errors, assembly failures

## Conclusion

The instruction management system provides a solid, extensible foundation for managing supervisor instructions across multiple projects while preserving project-specific customizations.

Key strengths:
- Simple, understandable architecture
- Linear time complexity
- No external dependencies
- Easy to extend
- Well-documented
- Fully verified
