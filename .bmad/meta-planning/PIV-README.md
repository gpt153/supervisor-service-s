# PIV Loop Implementation

**Plan → Implement → Validate**

A local implementation of the PIV methodology for the supervisor-service, adapted from Cole Medin's remote SCAR agent approach.

## Overview

The PIV loop is a three-phase workflow for implementing features with high quality and validation rigor:

1. **Prime** - Deep codebase research and context generation
2. **Plan** - Detailed implementation design with prescriptive instructions
3. **Execute** - Validation-driven implementation with automatic testing

## Architecture

### Key Differences from Cole Medin's SCAR

| Aspect | Cole's SCAR | Our PIV |
|--------|-------------|---------|
| Communication | GitHub issues/comments | MCP tools → direct returns |
| Execution | Remote webhooks | Local TypeScript classes |
| Task Management | Archon MCP | GitHub issues + local state |
| Workspace | Git worktrees | Feature branches |
| Codebase Detection | GitHub repo | Project context parameter |

See `/home/samuel/sv/.bmad/system-design/piv-loop-adaptation-guide.md` for detailed comparison.

## Components

### Phase Classes

- **PrimePhase** (`src/agents/phases/PrimePhase.ts`)
  - Analyzes codebase structure
  - Detects naming conventions
  - Finds integration points
  - Searches local RAG for patterns
  - Generates context document

- **PlanPhase** (`src/agents/phases/PlanPhase.ts`)
  - Reads context from Prime
  - Designs solution approach
  - Breaks down into phases and tasks
  - Creates prescriptive instructions
  - Defines validation commands

- **ExecutePhase** (`src/agents/phases/ExecutePhase.ts`)
  - Reads implementation plan
  - Executes tasks with validation
  - Runs tests after each task
  - Creates feature branch
  - Creates pull request

### Orchestrator

- **PIVAgent** (`src/agents/PIVAgent.ts`)
  - Coordinates all three phases
  - Manages configuration
  - Provides individual phase access
  - Tracks overall progress

### Utilities

- **CodebaseAnalyzer** (`src/utils/codebase-analyzer.ts`)
  - Tech stack detection
  - Convention analysis
  - Dependency mapping
  - Integration point discovery

- **PIVStorage** (`src/utils/storage.ts`)
  - Context document management
  - Implementation plan storage
  - JSON/Markdown serialization

## Usage

### Basic Example

```typescript
import { createPIVAgent } from './agents/PIVAgent.js';

const agent = createPIVAgent({
  project: {
    name: 'consilio',
    path: '/home/samuel/supervisor/consilio',
  },
  epic: {
    id: 'EPIC-007',
    title: 'Implement Dark Mode',
    description: 'Add dark mode toggle to application',
    acceptanceCriteria: [
      'Dark mode toggle in settings',
      'All components support dark mode',
      'User preference persisted',
      'Tests pass',
    ],
  },
  workingDirectory: '/home/samuel/supervisor/consilio',
  git: {
    createBranch: true,
    createPR: true,
    baseBranch: 'main',
  },
});

// Run complete PIV loop
const result = await agent.run();

console.log(`Success: ${result.success}`);
console.log(`PR: ${result.execute.prUrl}`);
```

### Running Individual Phases

```typescript
// Run only Prime phase
const primeResult = await agent.runPrimeOnly();
console.log(`Context saved: ${primeResult.contextPath}`);

// Run only Plan phase (requires Prime first)
const planResult = await agent.runPlanOnly(primeResult.contextPath);
console.log(`Plan saved: ${planResult.planPath}`);

// Run only Execute phase (requires Plan first)
const executeResult = await agent.runExecuteOnly();
console.log(`PR created: ${executeResult.prUrl}`);
```

## Configuration

### PIVConfig Options

```typescript
interface PIVConfig {
  // Project context
  project: {
    name: string;           // Project name
    path: string;           // Absolute path to project
    techStack?: string[];   // Known tech stack
    conventions?: {         // Known conventions
      fileNaming: string;
      classNaming: string;
      functionNaming: string;
    };
  };

  // Epic to implement
  epic: {
    id: string;                   // Epic identifier
    title: string;                // Short title
    description: string;          // Detailed description
    acceptanceCriteria: string[]; // Success criteria
    tasks?: string[];             // Optional task hints
  };

  // Working directory
  workingDirectory: string;

  // Model selection (optional)
  models?: {
    prime?: string;    // Default: claude-sonnet-4.5
    plan?: string;     // Default: claude-sonnet-4.5
    execute?: string;  // Default: claude-haiku-4
  };

  // Storage options (optional)
  storage?: {
    plansDir?: string;    // Default: .agents/plans
    contextDir?: string;  // Default: .agents/context
  };

  // Git options (optional)
  git?: {
    createBranch?: boolean;  // Default: true
    createPR?: boolean;      // Default: true
    baseBranch?: string;     // Default: main
  };
}
```

## Output Files

### Context Document

Saved to `.agents/context/context-{epic-id}.json`:

```json
{
  "project": "consilio",
  "epicId": "EPIC-007",
  "generated": "2026-01-18T...",
  "techStack": {
    "languages": ["TypeScript"],
    "frameworks": ["React"],
    "packageManager": "npm",
    "testingFramework": "Jest"
  },
  "conventions": {
    "fileNaming": "kebab-case",
    "classNaming": "PascalCase",
    "functionNaming": "camelCase"
  },
  "dependencies": [...],
  "integrationPoints": [...],
  "ragInsights": [...],
  "existingPatterns": [...],
  "recommendations": [...]
}
```

### Implementation Plan

Saved to `.agents/plans/{epic-id}-implementation.json`:

```json
{
  "epicId": "EPIC-007",
  "projectName": "consilio",
  "generated": "2026-01-18T...",
  "approach": "...",
  "phases": [
    {
      "name": "Setup",
      "description": "Create types and structure",
      "tasks": [
        {
          "id": "EPIC-007-setup-1",
          "title": "Define TypeScript interfaces",
          "description": "...",
          "files": ["src/types/dark-mode.ts"],
          "prescriptiveInstructions": "...",
          "validations": [
            {
              "description": "TypeScript compiles",
              "command": "npm run build",
              "failureAction": "retry"
            }
          ],
          "estimatedMinutes": 15
        }
      ],
      "dependencies": []
    }
  ],
  "overallValidation": [...],
  "acceptanceCriteria": [...],
  "notes": [...]
}
```

## Validation Strategy

Each task includes validation commands:

```typescript
{
  description: "All tests pass",
  command: "npm test",
  expectedOutput: "all tests passed",
  failureAction: "retry" | "escalate" | "skip"
}
```

**Failure actions:**
- `retry` - Retry task once
- `escalate` - Stop and report to supervisor
- `skip` - Continue to next task

## Future Enhancements

### Database Integration (EPIC-007)

- Track task timing and estimates
- Learn from past implementations
- Improve time predictions

### RAG Integration

- Index past implementations
- Search for similar patterns
- Suggest code snippets

### AI Agent Integration

Currently, ExecutePhase is a placeholder. Future:

```typescript
// Spawn Claude agent (Haiku) for implementation
const agent = await spawnClaudeAgent({
  model: 'claude-haiku-4',
  instructions: task.prescriptiveInstructions,
  workingDirectory: this.workingDirectory,
});

const result = await agent.execute();
```

## Testing

### Unit Tests

```bash
npm test src/__tests__/PIVAgent.test.ts
```

### Integration Tests

Requires:
- Test project with code
- Git repository
- Mock AI agent responses

```bash
npm test src/__tests__/integration/PIVLoop.test.ts
```

## Troubleshooting

### Context Document Not Found

Ensure Prime phase completed successfully:

```typescript
const primeResult = await agent.runPrimeOnly();
if (!primeResult.readyForPlan) {
  console.error('Prime phase failed');
}
```

### Validation Failures

Check validation commands in plan:

```typescript
const plan = await storage.loadPlanJSON(epic.id);
console.log(plan.overallValidation);
```

### Git Errors

Ensure working directory is a git repository:

```bash
cd /path/to/project
git status
```

## References

- **Epic**: `/home/samuel/sv/.bmad/epics/EPIC-BREAKDOWN.md` (lines 481-533)
- **Adaptation Guide**: `/home/samuel/sv/.bmad/system-design/piv-loop-adaptation-guide.md`
- **Cole Medin's PIV**: Original inspiration for methodology

## Contributing

When modifying the PIV loop:

1. Update type definitions in `src/types/piv.ts`
2. Update phase classes as needed
3. Add tests in `src/__tests__/`
4. Update this README
5. Create migration if database changes needed

## License

Internal tool for supervisor-service. Not for external distribution.
