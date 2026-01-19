/**
 * MCP Tools for Task Timing and Estimation
 * EPIC-007: Task Timing & Estimation
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { TaskTimer } from '../../timing/TaskTimer.js';
import { Pool } from 'pg';

// Database pool will be injected
let dbPool: Pool;
let taskTimer: TaskTimer;

/**
 * Initialize timing tools with database pool
 */
export function initializeTimingTools(pool: Pool): void {
  dbPool = pool;
  taskTimer = new TaskTimer(pool);
}

/**
 * Estimate task duration based on historical data
 */
export const estimateTaskTool: ToolDefinition = {
  name: 'mcp__meta__estimate_task',
  description: 'Get time estimate for task based on historical data and similar past tasks',
  inputSchema: {
    type: 'object',
    properties: {
      taskDescription: {
        type: 'string',
        description: 'Description of the task to estimate',
      },
      taskType: {
        type: 'string',
        description: 'Type of task (epic, issue, feature, bugfix, etc.)',
      },
      projectName: {
        type: 'string',
        description: 'Project name',
      },
      complexity: {
        type: 'string',
        description: 'Task complexity (simple, medium, complex)',
        enum: ['simple', 'medium', 'complex'],
      },
    },
    required: ['taskDescription', 'taskType', 'projectName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      if (!taskTimer) {
        return {
          error: 'Timing system not initialized',
        };
      }

      const estimate = await taskTimer.estimateTask({
        taskDescription: params.taskDescription,
        taskType: params.taskType,
        projectName: params.projectName,
        complexity: params.complexity,
      });

      // Format for human readability
      const formatSeconds = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (hours > 0) {
          return `${hours}h ${remainingMinutes}m`;
        }
        return `${minutes}m`;
      };

      return {
        estimate: {
          estimated: formatSeconds(estimate.estimatedSeconds),
          estimatedSeconds: estimate.estimatedSeconds,
          range: `${formatSeconds(estimate.confidenceIntervalLow)} - ${formatSeconds(estimate.confidenceIntervalHigh)}`,
          confidenceIntervalLow: estimate.confidenceIntervalLow,
          confidenceIntervalHigh: estimate.confidenceIntervalHigh,
          median: formatSeconds(estimate.medianSeconds),
          medianSeconds: estimate.medianSeconds,
          p95: formatSeconds(estimate.p95Seconds),
          p95Seconds: estimate.p95Seconds,
          confidence: `95% confidence based on ${estimate.sampleSize} similar tasks`,
          sampleSize: estimate.sampleSize,
          similarTasks: estimate.similarTasks,
          note: estimate.note,
        },
        message: estimate.sampleSize > 0
          ? `Estimated ${formatSeconds(estimate.estimatedSeconds)} (${formatSeconds(estimate.confidenceIntervalLow)}-${formatSeconds(estimate.confidenceIntervalHigh)}) based on ${estimate.sampleSize} similar tasks`
          : estimate.note || 'No historical data available',
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Start timing a task
 */
export const startTaskTimerTool: ToolDefinition = {
  name: 'mcp__meta__start_task_timer',
  description: 'Start timing a task execution',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Unique identifier for the task',
      },
      taskType: {
        type: 'string',
        description: 'Type of task (epic, issue, feature, etc.)',
      },
      taskDescription: {
        type: 'string',
        description: 'Description of the task',
      },
      projectName: {
        type: 'string',
        description: 'Project name',
      },
      agentType: {
        type: 'string',
        description: 'Type of agent executing the task (supervisor, piv-agent, scar, etc.)',
      },
      agentModel: {
        type: 'string',
        description: 'AI model being used (sonnet, haiku, opus)',
      },
      parentTaskId: {
        type: 'string',
        description: 'Parent task ID if this is a subtask',
      },
      estimatedSeconds: {
        type: 'number',
        description: 'Estimated duration in seconds',
      },
      complexity: {
        type: 'string',
        description: 'Task complexity',
        enum: ['simple', 'medium', 'complex'],
      },
    },
    required: ['taskId', 'taskType', 'taskDescription', 'projectName', 'agentType'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      if (!taskTimer) {
        return {
          error: 'Timing system not initialized',
        };
      }

      await taskTimer.startTask({
        taskId: params.taskId,
        taskType: params.taskType,
        taskDescription: params.taskDescription,
        projectName: params.projectName,
        agentType: params.agentType,
        agentModel: params.agentModel,
        parentTaskId: params.parentTaskId,
        estimatedSeconds: params.estimatedSeconds,
        complexity: params.complexity,
      });

      return {
        success: true,
        taskId: params.taskId,
        message: `Timer started for task: ${params.taskId}`,
        startedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Complete task timing and record metrics
 */
export const completeTaskTimerTool: ToolDefinition = {
  name: 'mcp__meta__complete_task_timer',
  description: 'Complete task timing and record execution metrics',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Task identifier',
      },
      success: {
        type: 'boolean',
        description: 'Whether the task completed successfully',
      },
      linesOfCodeChanged: {
        type: 'number',
        description: 'Number of lines of code added/modified/deleted',
      },
      filesChanged: {
        type: 'number',
        description: 'Number of files modified',
      },
      testsWritten: {
        type: 'number',
        description: 'Number of tests added',
      },
      tokensUsed: {
        type: 'number',
        description: 'API tokens consumed',
      },
      errorMessage: {
        type: 'string',
        description: 'Error message if task failed',
      },
      outputSummary: {
        type: 'string',
        description: 'Summary of task output',
      },
    },
    required: ['taskId', 'success'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      if (!taskTimer) {
        return {
          error: 'Timing system not initialized',
        };
      }

      const metrics = await taskTimer.completeTask({
        taskId: params.taskId,
        success: params.success,
        linesOfCodeChanged: params.linesOfCodeChanged,
        filesChanged: params.filesChanged,
        testsWritten: params.testsWritten,
        tokensUsed: params.tokensUsed,
        errorMessage: params.errorMessage,
        outputSummary: params.outputSummary,
      });

      const formatSeconds = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (hours > 0) {
          return `${hours}h ${remainingMinutes}m`;
        }
        return `${minutes}m`;
      };

      const actualTime = formatSeconds(metrics.durationSeconds);
      const estimatedTime = metrics.estimatedSeconds
        ? formatSeconds(metrics.estimatedSeconds)
        : 'not estimated';

      let accuracyMessage = '';
      if (metrics.estimationError !== undefined) {
        const errorPercent = Math.abs(metrics.estimationError * 100).toFixed(1);
        const direction = metrics.estimationError > 0 ? 'over' : 'under';
        accuracyMessage = ` (${errorPercent}% ${direction} estimate)`;
      }

      return {
        success: true,
        metrics: {
          taskId: metrics.taskId,
          duration: actualTime,
          durationSeconds: metrics.durationSeconds,
          estimated: estimatedTime,
          estimatedSeconds: metrics.estimatedSeconds,
          estimationError: metrics.estimationError,
          taskSuccess: metrics.success,
        },
        message: `Task completed in ${actualTime}${metrics.estimatedSeconds ? `, estimated ${estimatedTime}${accuracyMessage}` : ''}`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Get task statistics
 */
export const getTaskStatsTool: ToolDefinition = {
  name: 'mcp__meta__get_task_stats',
  description: 'Get statistics for a task type or project',
  inputSchema: {
    type: 'object',
    properties: {
      taskType: {
        type: 'string',
        description: 'Task type to get statistics for',
      },
      projectName: {
        type: 'string',
        description: 'Project name to filter by',
      },
    },
    required: ['taskType'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      if (!taskTimer) {
        return {
          error: 'Timing system not initialized',
        };
      }

      const stats = await taskTimer.getTaskTypeStats(
        params.taskType,
        params.projectName
      );

      const formatSeconds = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (hours > 0) {
          return `${hours}h ${remainingMinutes}m`;
        }
        return `${minutes}m`;
      };

      return {
        taskType: params.taskType,
        projectName: params.projectName || 'all projects',
        statistics: {
          count: stats.count,
          average: formatSeconds(stats.avgDuration),
          avgDurationSeconds: stats.avgDuration,
          median: formatSeconds(stats.medianDuration),
          medianSeconds: stats.medianDuration,
          p95: formatSeconds(stats.p95Duration),
          p95Seconds: stats.p95Duration,
          successRate: `${(stats.successRate * 100).toFixed(1)}%`,
          successRateDecimal: stats.successRate,
        },
        message: `${stats.count} ${params.taskType} tasks completed, avg ${formatSeconds(stats.avgDuration)}`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Get project statistics dashboard
 */
export const getProjectStatsTool: ToolDefinition = {
  name: 'mcp__meta__get_project_stats',
  description: 'Get comprehensive statistics dashboard for a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Project name',
      },
    },
    required: ['projectName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      if (!taskTimer) {
        return {
          error: 'Timing system not initialized',
        };
      }

      const stats = await taskTimer.getProjectStats(params.projectName);

      const formatSeconds = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (hours > 0) {
          return `${hours}h ${remainingMinutes}m`;
        }
        return `${minutes}m`;
      };

      // Format by-type stats
      const byTypeFormatted: Record<string, any> = {};
      for (const [type, typeStats] of Object.entries(stats.byType)) {
        byTypeFormatted[type] = {
          count: typeStats.count,
          average: formatSeconds(typeStats.avgDuration),
          median: formatSeconds(typeStats.medianDuration),
          p95: formatSeconds(typeStats.p95Duration),
          successRate: `${(typeStats.successRate * 100).toFixed(1)}%`,
        };
      }

      return {
        project: params.projectName,
        overview: {
          totalTasks: stats.totalTasks,
          completedTasks: stats.completedTasks,
          averageDuration: formatSeconds(stats.averageDuration),
          completionRate: `${((stats.completedTasks / stats.totalTasks) * 100).toFixed(1)}%`,
        },
        byType: byTypeFormatted,
        estimationAccuracy: {
          averageError: `${(stats.estimationAccuracy.avgError * 100).toFixed(1)}%`,
          within20Percent: `${(stats.estimationAccuracy.within20Percent * 100).toFixed(1)}%`,
          improving: stats.estimationAccuracy.improving,
        },
        parallelism: {
          averageAgents: stats.parallelism.avgAgents.toFixed(1),
          averageEfficiency: `${(stats.parallelism.avgEfficiency * 100).toFixed(1)}%`,
          averageTimeSaved: formatSeconds(stats.parallelism.avgTimeSaved),
        },
        message: `Project statistics for ${params.projectName}`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Track parallel execution
 */
export const trackParallelExecutionTool: ToolDefinition = {
  name: 'mcp__meta__track_parallel_execution',
  description: 'Track parallel execution of multiple tasks',
  inputSchema: {
    type: 'object',
    properties: {
      parentTaskId: {
        type: 'string',
        description: 'Parent task ID that spawned parallel tasks',
      },
      childTaskIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of child task IDs running in parallel',
      },
      sequentialEstimate: {
        type: 'number',
        description: 'Estimated time if tasks ran sequentially (in seconds)',
      },
    },
    required: ['parentTaskId', 'childTaskIds', 'sequentialEstimate'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      if (!taskTimer) {
        return {
          error: 'Timing system not initialized',
        };
      }

      await taskTimer.trackParallelExecution({
        parentTaskId: params.parentTaskId,
        childTaskIds: params.childTaskIds,
        sequentialEstimate: params.sequentialEstimate,
      });

      const formatSeconds = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m`;
      };

      return {
        success: true,
        parentTaskId: params.parentTaskId,
        agentCount: params.childTaskIds.length,
        sequentialEstimate: formatSeconds(params.sequentialEstimate),
        message: `Tracking ${params.childTaskIds.length} parallel tasks (sequential estimate: ${formatSeconds(params.sequentialEstimate)})`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Complete parallel execution tracking
 */
export const completeParallelExecutionTool: ToolDefinition = {
  name: 'mcp__meta__complete_parallel_execution',
  description: 'Complete parallel execution tracking and calculate efficiency',
  inputSchema: {
    type: 'object',
    properties: {
      parentTaskId: {
        type: 'string',
        description: 'Parent task ID',
      },
    },
    required: ['parentTaskId'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      if (!taskTimer) {
        return {
          error: 'Timing system not initialized',
        };
      }

      const metrics = await taskTimer.completeParallelExecution(params.parentTaskId);

      if (!metrics) {
        return {
          success: false,
          message: 'Not all parallel tasks have completed yet',
        };
      }

      const formatSeconds = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m`;
      };

      return {
        success: true,
        metrics: {
          sequentialEstimate: formatSeconds(metrics.sequentialEstimate),
          parallelActual: formatSeconds(metrics.parallelActual),
          timeSaved: formatSeconds(metrics.timeSaved),
          efficiency: `${(metrics.efficiency * 100).toFixed(1)}%`,
          agentCount: metrics.agentCount,
        },
        message: `Parallel execution complete: ${formatSeconds(metrics.parallelActual)} (saved ${formatSeconds(metrics.timeSaved)}, ${(metrics.efficiency * 100).toFixed(1)}% efficiency)`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Get all timing tools
 */
export function getTimingTools(): ToolDefinition[] {
  return [
    estimateTaskTool,
    startTaskTimerTool,
    completeTaskTimerTool,
    getTaskStatsTool,
    getProjectStatsTool,
    trackParallelExecutionTool,
    completeParallelExecutionTool,
  ];
}
