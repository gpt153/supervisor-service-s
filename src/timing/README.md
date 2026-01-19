# Task Timing & Estimation System

**EPIC-007 Implementation**

## Overview

The Task Timing & Estimation system provides data-driven time estimates based on historical task execution data. It tracks:

- Task execution times
- Estimation accuracy
- Parallel execution efficiency
- Statistical trends and patterns

## Architecture

```
┌─────────────────┐
│   TaskTimer     │ ← Core timing logic
│   (TypeScript)  │
└────────┬────────┘
         │
         ├─── Database (PostgreSQL)
         │    ├─── task_executions
         │    ├─── estimation_patterns
         │    └─── time_tracking_sessions
         │
         └─── MCP Tools
              ├─── mcp__meta__estimate_task
              ├─── mcp__meta__start_task_timer
              ├─── mcp__meta__complete_task_timer
              ├─── mcp__meta__get_task_stats
              └─── mcp__meta__get_project_stats
```

## Usage

### 1. Estimating a Task

```typescript
import { TaskTimer } from './timing/TaskTimer.js';
import { pool } from './db/client.js';

const taskTimer = new TaskTimer(pool);

// Get estimate based on historical data
const estimate = await taskTimer.estimateTask({
  taskDescription: 'Implement authentication system with JWT',
  taskType: 'epic',
  projectName: 'consilio',
  complexity: 'complex'
});

console.log(`Estimated time: ${estimate.estimatedSeconds / 60} minutes`);
console.log(`Range: ${estimate.confidenceIntervalLow / 60} - ${estimate.confidenceIntervalHigh / 60} minutes`);
console.log(`Based on ${estimate.sampleSize} similar tasks`);
```

**Output:**
```
Estimated time: 22 minutes
Range: 18 - 28 minutes (95% confidence)
Based on 15 similar tasks
```

### 2. Timing a Task

```typescript
// Start timing
await taskTimer.startTask({
  taskId: 'epic-007-auth',
  taskType: 'epic',
  taskDescription: 'Implement authentication system with JWT',
  projectName: 'consilio',
  agentType: 'piv-agent',
  agentModel: 'haiku',
  estimatedSeconds: 1320, // 22 minutes
  complexity: 'complex'
});

// ... do the work ...

// Complete timing
const metrics = await taskTimer.completeTask({
  taskId: 'epic-007-auth',
  success: true,
  linesOfCodeChanged: 450,
  filesChanged: 12,
  testsWritten: 8,
  tokensUsed: 125000
});

console.log(`Actual time: ${metrics.durationSeconds / 60} minutes`);
console.log(`Estimation error: ${(metrics.estimationError * 100).toFixed(1)}%`);
```

**Output:**
```
Actual time: 21.5 minutes
Estimation error: -2.3% (very accurate!)
```

### 3. Tracking Parallel Execution

```typescript
// Multiple tasks running in parallel
const childTaskIds = ['issue-42', 'issue-43', 'issue-44'];
const sequentialEstimate = 80 * 60; // 80 minutes if sequential

// Track parallel execution
await taskTimer.trackParallelExecution({
  parentTaskId: 'epic-008-dashboard',
  childTaskIds,
  sequentialEstimate
});

// Start all tasks in parallel
await Promise.all(childTaskIds.map(id =>
  taskTimer.startTask({
    taskId: id,
    taskType: 'issue',
    taskDescription: `Implement ${id}`,
    projectName: 'consilio',
    agentType: 'piv-agent',
    agentModel: 'haiku',
    parentTaskId: 'epic-008-dashboard'
  })
));

// ... all tasks complete ...

// Get parallel metrics
const parallelMetrics = await taskTimer.completeParallelExecution('epic-008-dashboard');

console.log(`Sequential estimate: ${parallelMetrics.sequentialEstimate / 60} minutes`);
console.log(`Parallel actual: ${parallelMetrics.parallelActual / 60} minutes`);
console.log(`Time saved: ${parallelMetrics.timeSaved / 60} minutes`);
console.log(`Efficiency: ${(parallelMetrics.efficiency * 100).toFixed(1)}%`);
```

**Output:**
```
Sequential estimate: 80 minutes
Parallel actual: 26 minutes
Time saved: 54 minutes (via parallelism!)
Efficiency: 77%
```

### 4. Getting Project Statistics

```typescript
const stats = await taskTimer.getProjectStats('consilio');

console.log(`Total tasks: ${stats.totalTasks}`);
console.log(`Average duration: ${stats.averageDuration / 60} minutes`);
console.log(`Estimation accuracy: ${(stats.estimationAccuracy.avgError * 100).toFixed(1)}%`);

// By task type
for (const [type, typeStats] of Object.entries(stats.byType)) {
  console.log(`${type}: ${typeStats.count} tasks, avg ${typeStats.avgDuration / 60}min`);
}
```

**Output:**
```
Total tasks: 142
Average duration: 21 minutes
Estimation accuracy: 8% average error

epic: 12 tasks, avg 64min
issue: 48 tasks, avg 22min
feature: 82 tasks, avg 14min
```

## MCP Tools

All timing functionality is exposed via MCP tools for use by supervisors.

### `mcp__meta__estimate_task`

Get time estimate for a task based on historical data.

```json
{
  "taskDescription": "Implement real-time notifications",
  "taskType": "feature",
  "projectName": "consilio",
  "complexity": "medium"
}
```

**Response:**
```json
{
  "estimate": {
    "estimated": "22m",
    "range": "18m - 28m",
    "confidence": "95% confidence based on 15 similar tasks",
    "sampleSize": 15,
    "similarTasks": [
      { "description": "Implement real-time chat", "duration": 1320 },
      { "description": "Add WebSocket support", "duration": 1380 }
    ]
  }
}
```

### `mcp__meta__start_task_timer`

Start timing a task execution.

```json
{
  "taskId": "feat-notifications-1",
  "taskType": "feature",
  "taskDescription": "Implement real-time notifications",
  "projectName": "consilio",
  "agentType": "piv-agent",
  "agentModel": "haiku",
  "estimatedSeconds": 1320
}
```

### `mcp__meta__complete_task_timer`

Complete task timing and record metrics.

```json
{
  "taskId": "feat-notifications-1",
  "success": true,
  "linesOfCodeChanged": 250,
  "filesChanged": 6,
  "testsWritten": 4
}
```

**Response:**
```json
{
  "metrics": {
    "duration": "21m",
    "estimated": "22m",
    "estimationError": -0.045
  },
  "message": "Task completed in 21m, estimated 22m (4.5% under estimate)"
}
```

### `mcp__meta__get_task_stats`

Get statistics for a specific task type.

```json
{
  "taskType": "feature",
  "projectName": "consilio"
}
```

### `mcp__meta__get_project_stats`

Get comprehensive project statistics dashboard.

```json
{
  "projectName": "consilio"
}
```

## Database Schema

### task_executions

Tracks every task execution with timing data.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| task_id | UUID | Reference to tasks table |
| project_id | UUID | Reference to projects table |
| execution_number | INTEGER | Nth execution of this task |
| started_at | TIMESTAMP | When task started |
| completed_at | TIMESTAMP | When task completed |
| duration_minutes | INTEGER | Actual duration |
| estimated_minutes | INTEGER | Estimated duration |
| variance_percent | NUMERIC | Estimation error % |
| status | VARCHAR | running, completed, failed |
| complexity | VARCHAR | simple, medium, complex |
| metadata | JSONB | Additional context |

### estimation_patterns

Learned patterns for better estimates.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Reference to projects |
| pattern_name | VARCHAR | Pattern identifier |
| task_type | VARCHAR | Type of task |
| complexity | VARCHAR | Complexity level |
| avg_duration_minutes | NUMERIC | Average duration |
| std_deviation | NUMERIC | Standard deviation |
| sample_count | INTEGER | Number of samples |
| confidence_score | NUMERIC | 0.0 to 1.0 |

## Learning Over Time

The system improves estimates as more data is collected:

**1st time (no data):**
```
Estimate: 60 minutes (conservative, no data)
Actual: 22 minutes
```

**2nd time (1 sample):**
```
Estimate: 22 minutes (based on 1 similar task)
Actual: 21 minutes
```

**10th time (10 samples):**
```
Estimate: 23 minutes (19-27 min range, 95% confidence)
Actual: 24 minutes
Accuracy: Very high!
```

## Benefits

1. **Accurate Estimates**: No more "5-6 hours" when it takes 20 minutes
2. **Data-Driven**: Based on actual historical performance
3. **Confidence Intervals**: Know the likely range, not just a point estimate
4. **Parallelism Tracking**: Account for multiple agents running simultaneously
5. **Continuous Improvement**: Estimates get better over time
6. **Transparency**: See which similar tasks the estimate is based on

## Integration

The timing system is automatically integrated into the supervisor workflow. Every task is:

1. Estimated before starting
2. Timed during execution
3. Analyzed after completion
4. Used to improve future estimates

No manual intervention required - it just works!

## Example: Real Improvement

**Traditional estimate:**
```
"This authentication system will take 6-8 weeks to develop"
```

**AI without data:**
```
"This will take 5-6 hours"
[Actually takes 20 minutes]
User: 😠 "Why did you say 5-6 hours?!"
```

**AI with timing data:**
```
"Based on 12 similar tasks: 18-25 minutes (95% confidence)

Similar tasks:
  • OAuth implementation: 21 min
  • JWT token system: 19 min
  • Session management: 24 min

Running PIV agent now..."

[22 minutes later]

"✅ Complete in 22 minutes (estimated 18-25 min)
  • Files changed: 12
  • Lines of code: 450
  • Tests added: 8
  • Estimate accuracy: 98%"

User: 😊 "Perfect! Exactly as expected."
```

## Future Enhancements

- [ ] Factor analysis (what makes tasks take longer?)
- [ ] Learning rate tracking (how fast are estimates improving?)
- [ ] Cross-project estimation (use data from similar projects)
- [ ] Agent performance comparison (which agent is fastest for what?)
- [ ] Cost estimation (based on token usage)
- [ ] Predictive scheduling (when will task complete?)
