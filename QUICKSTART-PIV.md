# PIV Loop - Quick Start Guide

Get started with the PIV (Plan → Implement → Validate) loop in 5 minutes.

## What is PIV?

A three-phase workflow for implementing features:

1. **Prime** - Analyzes your codebase (tech stack, conventions, patterns)
2. **Plan** - Creates detailed implementation plan with validations
3. **Execute** - Implements with automatic testing and PR creation

## Installation

PIV is built into supervisor-service. No additional installation needed.

```bash
cd /home/samuel/sv/supervisor-service
npm install
npm run build
```

## Basic Usage

### Option 1: Complete PIV Loop

```typescript
import { createPIVAgent } from './src/agents/PIVAgent.js';

const result = await createPIVAgent({
  project: {
    name: 'my-app',
    path: '/path/to/my-app',
  },
  epic: {
    id: 'EPIC-001',
    title: 'Add Dark Mode',
    description: 'Implement dark mode toggle in settings',
    acceptanceCriteria: [
      'Toggle visible in settings',
      'All components support dark mode',
      'Tests pass',
    ],
  },
  workingDirectory: '/path/to/my-app',
}).run();

console.log(`Success: ${result.success}`);
console.log(`PR: ${result.execute.prUrl}`);
```

### Option 2: Run Example

```bash
# Run built-in dark mode example
cd /home/samuel/sv/supervisor-service
tsx src/examples/piv-example.ts dark-mode

# Or individual phases
tsx src/examples/piv-example.ts individual

# Or custom config
tsx src/examples/piv-example.ts custom
```

## Configuration

### Minimal Config

```typescript
{
  project: { name: 'app', path: '/path' },
  epic: {
    id: 'EPIC-001',
    title: 'Feature',
    description: 'Add feature',
    acceptanceCriteria: ['Works'],
  },
  workingDirectory: '/path',
}
```

### Full Config

```typescript
{
  project: {
    name: 'my-app',
    path: '/home/user/my-app',
    techStack: ['TypeScript', 'React'],     // Optional
    conventions: {                           // Optional
      fileNaming: 'kebab-case',
      classNaming: 'PascalCase',
      functionNaming: 'camelCase',
    },
  },
  epic: {
    id: 'EPIC-001',
    title: 'Add Feature',
    description: 'Detailed description...',
    acceptanceCriteria: ['...'],
    tasks: ['Optional task hints'],         // Optional
  },
  workingDirectory: '/home/user/my-app',
  models: {                                  // Optional
    prime: 'claude-sonnet-4.5',             // Research model
    plan: 'claude-sonnet-4.5',              // Planning model
    execute: 'claude-haiku-4',              // Execution model
  },
  storage: {                                 // Optional
    plansDir: '.agents/plans',              // Default
    contextDir: '.agents/context',          // Default
  },
  git: {                                     // Optional
    createBranch: true,                     // Default
    createPR: true,                         // Default
    baseBranch: 'main',                     // Default
  },
}
```

## Individual Phases

### Run Prime Only (Research)

```typescript
const agent = createPIVAgent(config);
const primeResult = await agent.runPrimeOnly();

console.log(`Tech Stack: ${primeResult.techStack}`);
console.log(`Context: ${primeResult.contextPath}`);
```

### Run Plan Only (Design)

```typescript
const agent = createPIVAgent(config);
const primeResult = await agent.runPrimeOnly();
const planResult = await agent.runPlanOnly(primeResult.contextPath);

console.log(`Tasks: ${planResult.totalTasks}`);
console.log(`Estimated: ${planResult.estimatedHours} hours`);
```

### Run Execute Only (Implement)

```typescript
const agent = createPIVAgent(config);
// ... run Prime and Plan first ...
const executeResult = await agent.runExecuteOnly();

console.log(`Branch: ${executeResult.branch}`);
console.log(`Tests: ${executeResult.testsPass ? 'PASS' : 'FAIL'}`);
```

## Output Files

PIV creates files in your project's `.agents/` directory:

```
your-project/
├── .agents/
│   ├── context/
│   │   └── context-EPIC-001.json    # Prime output
│   └── plans/
│       └── EPIC-001-implementation.json  # Plan output
```

### Context Document

```json
{
  "project": "my-app",
  "epicId": "EPIC-001",
  "techStack": {
    "languages": ["TypeScript"],
    "frameworks": ["React"],
    "packageManager": "npm"
  },
  "conventions": {
    "fileNaming": "kebab-case",
    "classNaming": "PascalCase"
  },
  "dependencies": [...],
  "recommendations": [...]
}
```

### Implementation Plan

```json
{
  "epicId": "EPIC-001",
  "phases": [
    {
      "name": "Setup",
      "tasks": [
        {
          "id": "EPIC-001-setup-1",
          "title": "Create types",
          "files": ["src/types/feature.ts"],
          "prescriptiveInstructions": "...",
          "validations": [...]
        }
      ]
    }
  ]
}
```

## Common Patterns

### Dark Mode Implementation

```typescript
const agent = createPIVAgent({
  project: { name: 'app', path: '/path' },
  epic: {
    id: 'dark-mode',
    title: 'Dark Mode',
    description: 'Add theme toggle',
    acceptanceCriteria: [
      'Toggle in settings',
      'All components styled',
      'Preference persists',
    ],
  },
  workingDirectory: '/path',
});

await agent.run();
```

### Authentication

```typescript
const agent = createPIVAgent({
  project: { name: 'app', path: '/path' },
  epic: {
    id: 'auth',
    title: 'Authentication',
    description: 'Add user login/logout',
    acceptanceCriteria: [
      'Login form works',
      'Sessions persist',
      'Protected routes',
    ],
  },
  workingDirectory: '/path',
});

await agent.run();
```

### Search Feature

```typescript
const agent = createPIVAgent({
  project: { name: 'app', path: '/path' },
  epic: {
    id: 'search',
    title: 'Search',
    description: 'Full-text search',
    acceptanceCriteria: [
      'Search input visible',
      'Results update live',
      'Handles empty query',
    ],
  },
  workingDirectory: '/path',
});

await agent.run();
```

## Troubleshooting

### Build Errors

```bash
npm run build
# If errors, check TypeScript configuration
```

### Git Errors

Ensure working directory is a git repository:

```bash
cd /path/to/project
git status
```

### Context Not Found

Prime phase must run first:

```typescript
const primeResult = await agent.runPrimeOnly();
if (!primeResult.readyForPlan) {
  console.error('Prime failed');
}
```

### Validation Failures

Check validation commands in plan:

```typescript
const plan = await storage.loadPlanJSON('EPIC-001');
console.log(plan.overallValidation);
```

## Next Steps

1. **Read full docs**: `PIV-README.md`
2. **See examples**: `src/examples/piv-example.ts`
3. **Check types**: `src/types/piv.ts`
4. **Implementation details**: `IMPLEMENTATION-SUMMARY.md`

## API Reference

### PIVAgent

```typescript
class PIVAgent {
  constructor(config: PIVConfig)
  run(): Promise<PIVResult>
  runPrimeOnly(): Promise<PrimeResult>
  runPlanOnly(contextPath: string): Promise<PlanResult>
  runExecuteOnly(options?: ExecuteOptions): Promise<ExecuteResult>
  getConfig(): PIVConfig
  updateConfig(config: Partial<PIVConfig>): void
}
```

### Factory Functions

```typescript
createPIVAgent(config: PIVConfig): PIVAgent
runPIVLoop(config: PIVConfig): Promise<PIVResult>
```

## Support

- **Documentation**: `/home/samuel/sv/supervisor-service/PIV-README.md`
- **Examples**: `/home/samuel/sv/supervisor-service/src/examples/`
- **Epic**: `/home/samuel/sv/.bmad/epics/EPIC-BREAKDOWN.md` (lines 481-533)

---

**Happy coding with PIV!** 🚀
