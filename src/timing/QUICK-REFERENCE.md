# Task Timing & Estimation - Quick Reference

**EPIC-007 Implementation**

---

## 🚀 Quick Start

```typescript
import { TaskTimer } from './timing/TaskTimer.js';
import { pool } from './db/client.js';

const taskTimer = new TaskTimer(pool);
```

---

## 📊 Core Operations

### 1. Get Estimate

```typescript
const estimate = await taskTimer.estimateTask({
  taskDescription: 'Implement authentication with JWT',
  taskType: 'epic',
  projectName: 'consilio',
  complexity: 'complex'
});

// Returns:
{
  estimatedSeconds: 1320,        // 22 minutes
  confidenceIntervalLow: 1080,   // 18 minutes
  confidenceIntervalHigh: 1680,  // 28 minutes
  medianSeconds: 1260,
  p95Seconds: 1740,
  sampleSize: 15,
  similarTasks: [...]
}
```

### 2. Start Timer

```typescript
await taskTimer.startTask({
  taskId: 'epic-007-auth',
  taskType: 'epic',
  taskDescription: 'Implement authentication with JWT',
  projectName: 'consilio',
  agentType: 'piv-agent',
  agentModel: 'haiku',
  estimatedSeconds: 1320,
  complexity: 'complex'
});
```

### 3. Complete Timer

```typescript
const metrics = await taskTimer.completeTask({
  taskId: 'epic-007-auth',
  success: true,
  linesOfCodeChanged: 450,
  filesChanged: 12,
  testsWritten: 8,
  tokensUsed: 125000
});

// Returns:
{
  taskId: 'epic-007-auth',
  durationSeconds: 1290,
  estimatedSeconds: 1320,
  estimationError: -0.023,  // 2.3% under estimate
  success: true
}
```

---

## 🔧 MCP Tools

### Estimate Task
```json
Tool: mcp__meta__estimate_task
{
  "taskDescription": "Implement real-time notifications",
  "taskType": "feature",
  "projectName": "consilio"
}
```

### Start Timer
```json
Tool: mcp__meta__start_task_timer
{
  "taskId": "feat-notif-1",
  "taskType": "feature",
  "taskDescription": "Implement real-time notifications",
  "projectName": "consilio",
  "agentType": "piv-agent"
}
```

### Complete Timer
```json
Tool: mcp__meta__complete_task_timer
{
  "taskId": "feat-notif-1",
  "success": true,
  "filesChanged": 6
}
```

### Get Stats
```json
Tool: mcp__meta__get_task_stats
{
  "taskType": "feature",
  "projectName": "consilio"
}
```

### Project Dashboard
```json
Tool: mcp__meta__get_project_stats
{
  "projectName": "consilio"
}
```

---

## 📈 Parallel Execution

```typescript
// Track parallel execution
await taskTimer.trackParallelExecution({
  parentTaskId: 'epic-008',
  childTaskIds: ['issue-1', 'issue-2', 'issue-3'],
  sequentialEstimate: 4800  // 80 minutes
});

// Start all child tasks...
// ... tasks complete ...

// Get efficiency metrics
const metrics = await taskTimer.completeParallelExecution('epic-008');

// Returns:
{
  sequentialEstimate: 4800,
  parallelActual: 1560,    // 26 minutes
  timeSaved: 3240,         // 54 minutes saved!
  efficiency: 0.77,        // 77% efficiency
  agentCount: 3
}
```

---

## 📊 Statistics

### Project Stats
```typescript
const stats = await taskTimer.getProjectStats('consilio');

// Returns:
{
  totalTasks: 142,
  completedTasks: 130,
  averageDuration: 1245,  // seconds
  byType: {
    epic: { count: 12, avgDuration: 3840, successRate: 0.92 },
    issue: { count: 48, avgDuration: 1320, successRate: 0.96 },
    feature: { count: 82, avgDuration: 840, successRate: 0.98 }
  },
  estimationAccuracy: {
    avgError: 0.08,         // 8% average error
    within20Percent: 0.85,  // 85% within ±20%
    improving: true
  },
  parallelism: {
    avgAgents: 3.2,
    avgEfficiency: 0.73,
    avgTimeSaved: 2640
  }
}
```

### Task Type Stats
```typescript
const stats = await taskTimer.getTaskTypeStats('feature', 'consilio');

// Returns:
{
  count: 82,
  avgDuration: 840,     // 14 minutes
  medianDuration: 780,
  p95Duration: 1560,
  successRate: 0.98
}
```

---

## 🎯 Common Patterns

### Pattern 1: Estimate Before Starting
```typescript
// Always get estimate first
const estimate = await taskTimer.estimateTask({...});

// Tell user the estimate
console.log(`Estimated: ${estimate.estimatedSeconds/60} minutes`);

// Start with estimate
await taskTimer.startTask({
  ...,
  estimatedSeconds: estimate.estimatedSeconds
});
```

### Pattern 2: Full Workflow
```typescript
// 1. Estimate
const estimate = await taskTimer.estimateTask({...});

// 2. Start
await taskTimer.startTask({...});

// 3. Do work
await doTheActualWork();

// 4. Complete
const metrics = await taskTimer.completeTask({...});

// 5. Report accuracy
console.log(`Done in ${metrics.durationSeconds/60}min`);
console.log(`Error: ${(metrics.estimationError * 100).toFixed(1)}%`);
```

### Pattern 3: Parallel Tasks
```typescript
// 1. Get estimates for all tasks
const estimates = await Promise.all(
  taskIds.map(id => taskTimer.estimateTask({...}))
);

// 2. Track parallel execution
const sequentialTotal = estimates.reduce((sum, e) => sum + e.estimatedSeconds, 0);
await taskTimer.trackParallelExecution({
  parentTaskId: 'parent',
  childTaskIds: taskIds,
  sequentialEstimate: sequentialTotal
});

// 3. Start all in parallel
await Promise.all(
  taskIds.map(id => taskTimer.startTask({...}))
);

// 4. Wait for all to complete
// ... tasks complete ...

// 5. Get parallel metrics
const metrics = await taskTimer.completeParallelExecution('parent');
console.log(`Saved ${metrics.timeSaved/60} minutes via parallelism!`);
```

---

## 🔍 Troubleshooting

### No historical data
```typescript
// First time - conservative estimate
{
  estimatedSeconds: 3600,  // 1 hour
  note: 'No historical data - conservative estimate',
  sampleSize: 0
}
```

### After some data
```typescript
// Better estimate based on task type
{
  estimatedSeconds: 1320,
  note: 'Based on task type average (no similar tasks found)',
  sampleSize: 5
}
```

### With similar tasks
```typescript
// Best estimate - similar tasks found
{
  estimatedSeconds: 1320,
  confidenceIntervalLow: 1080,
  confidenceIntervalHigh: 1680,
  sampleSize: 15,
  similarTasks: [...]
}
```

---

## ⚡ Performance Tips

1. **Use complexity levels** - helps find better matches
2. **Descriptive task names** - better text search results
3. **Consistent naming** - similar tasks group together
4. **Complete all tasks** - more data = better estimates
5. **Track metadata** - helps with future analysis

---

## 📝 Best Practices

### ✅ DO
- Always get estimate before starting
- Use the estimate when starting timer
- Complete timer even on failure
- Include metadata (LOC, files, etc)
- Use consistent task types

### ❌ DON'T
- Skip estimation step
- Forget to complete timer
- Use vague task descriptions
- Mix task types inconsistently
- Ignore estimation errors

---

## 🎓 Learning Curve

```
1st task:   Conservative estimate (60 min)
           ↓
           Actual: 22 min
           ↓
2nd task:   Better estimate (22 min, 1 sample)
           ↓
           Actual: 21 min
           ↓
10th task:  Accurate estimate (23 min ±4, 95% conf)
           ↓
           Actual: 24 min
           ↓
           ✅ System now provides reliable estimates!
```

---

## 📞 Quick Help

**File locations:**
- Core class: `src/timing/TaskTimer.ts`
- Types: `src/types/timing.ts`
- MCP tools: `src/mcp/tools/timing-tools.ts`
- Examples: `src/examples/timing-usage.ts`
- Tests: `src/__tests__/timing.test.ts`

**Run examples:**
```bash
tsx src/examples/timing-usage.ts
```

**Run tests:**
```bash
tsx src/__tests__/timing.test.ts
```

**Documentation:**
- Full guide: `src/timing/README.md`
- Implementation: `EPIC-007-IMPLEMENTATION.md`
- This file: `src/timing/QUICK-REFERENCE.md`

---

**Remember:** The system learns from every task. The more you use it, the better the estimates become!
