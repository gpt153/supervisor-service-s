/**
 * TaskTimer - Task timing and estimation system
 * EPIC-007: Task Timing & Estimation
 *
 * Tracks task execution times, provides data-driven estimates,
 * and monitors parallel execution efficiency.
 */

import { Pool } from 'pg';
import {
  TaskExecution,
  TaskMetrics,
  TaskEstimate,
  ParallelMetrics,
  StartTaskOptions,
  CompleteTaskOptions,
  EstimateTaskOptions,
  ParallelExecutionOptions,
  ProjectStats,
  TaskTypeStats,
} from '../types/timing.js';

export class TaskTimer {
  private db: Pool;
  private activeTimers: Map<string, TaskExecution>;

  constructor(db: Pool) {
    this.db = db;
    this.activeTimers = new Map();
  }

  /**
   * Start timing a task
   *
   * @param options - Task start options
   * @returns Promise that resolves when timer is started
   */
  async startTask(options: StartTaskOptions): Promise<void> {
    const execution: TaskExecution = {
      taskId: options.taskId,
      taskType: options.taskType,
      taskDescription: options.taskDescription,
      projectName: options.projectName,
      agentType: options.agentType,
      agentModel: options.agentModel || 'unknown',
      parentTaskId: options.parentTaskId,
      estimatedSeconds: options.estimatedSeconds,
      complexity: options.complexity,
      startedAt: new Date(),
      status: 'running',
    };

    // Store in memory
    this.activeTimers.set(options.taskId, execution);

    // Get project ID first
    const projectResult = await this.db.query(
      'SELECT id FROM projects WHERE name = $1',
      [options.projectName]
    );

    if (projectResult.rows.length === 0) {
      throw new Error(`Project not found: ${options.projectName}`);
    }

    const projectId = projectResult.rows[0].id;

    // Get or create task record
    let taskId: string;
    const taskResult = await this.db.query(
      'SELECT id FROM tasks WHERE title = $1 AND project_id = $2',
      [options.taskDescription, projectId]
    );

    if (taskResult.rows.length > 0) {
      taskId = taskResult.rows[0].id;
    } else {
      // Create new task
      const newTaskResult = await this.db.query(
        `INSERT INTO tasks (project_id, title, description, task_type, status)
         VALUES ($1, $2, $3, $4, 'in_progress')
         RETURNING id`,
        [projectId, options.taskDescription, options.taskDescription, options.taskType]
      );
      taskId = newTaskResult.rows[0].id;
    }

    // Get execution number
    const execCountResult = await this.db.query(
      'SELECT COALESCE(MAX(execution_number), 0) + 1 as next_num FROM task_executions WHERE task_id = $1',
      [taskId]
    );
    const executionNumber = execCountResult.rows[0].next_num;

    // Store in database
    await this.db.query(
      `INSERT INTO task_executions (
        task_id,
        project_id,
        execution_number,
        started_at,
        estimated_minutes,
        complexity,
        status,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        taskId,
        projectId,
        executionNumber,
        execution.startedAt,
        options.estimatedSeconds ? Math.round(options.estimatedSeconds / 60) : null,
        execution.complexity,
        execution.status,
        JSON.stringify(options.metadata || {}),
      ]
    );
  }

  /**
   * Complete a task and record metrics
   *
   * @param options - Task completion options
   * @returns Task metrics
   */
  async completeTask(options: CompleteTaskOptions): Promise<TaskMetrics> {
    const execution = this.activeTimers.get(options.taskId);
    if (!execution) {
      throw new Error(`No active timer for task ${options.taskId}`);
    }

    const completedAt = new Date();
    const durationSeconds = Math.floor((completedAt.getTime() - execution.startedAt.getTime()) / 1000);
    const durationMinutes = Math.round(durationSeconds / 60);

    // Calculate estimation error
    let estimationError: number | null = null;
    if (execution.estimatedSeconds) {
      estimationError = (durationSeconds - execution.estimatedSeconds) / execution.estimatedSeconds;
    }

    // Get project and task IDs
    const projectResult = await this.db.query(
      'SELECT id FROM projects WHERE name = $1',
      [execution.projectName]
    );

    if (projectResult.rows.length === 0) {
      throw new Error(`Project not found: ${execution.projectName}`);
    }

    const projectId = projectResult.rows[0].id;

    const taskResult = await this.db.query(
      'SELECT id FROM tasks WHERE title = $1 AND project_id = $2',
      [execution.taskDescription, projectId]
    );

    if (taskResult.rows.length === 0) {
      throw new Error(`Task not found: ${execution.taskDescription}`);
    }

    const taskId = taskResult.rows[0].id;

    // Update database
    await this.db.query(
      `UPDATE task_executions
       SET
         completed_at = $1,
         status = $2,
         notes = $3,
         metadata = metadata || $4::jsonb
       WHERE task_id = $5
         AND status = 'running'`,
      [
        completedAt,
        options.success ? 'completed' : 'failed',
        options.errorMessage || options.outputSummary,
        JSON.stringify({
          success: options.success,
          linesOfCodeChanged: options.linesOfCodeChanged,
          filesChanged: options.filesChanged,
          testsWritten: options.testsWritten,
          tokensUsed: options.tokensUsed,
          ...(options.metadata || {}),
        }),
        taskId,
      ]
    );

    // Update task status
    await this.db.query(
      `UPDATE tasks
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [options.success ? 'done' : 'failed', taskId]
    );

    // Update aggregate statistics
    await this.updateStats(execution.taskType, execution.projectName);

    // Remove from active timers
    this.activeTimers.delete(options.taskId);

    return {
      taskId: options.taskId,
      durationSeconds,
      estimatedSeconds: execution.estimatedSeconds,
      estimationError: estimationError || undefined,
      success: options.success,
    };
  }

  /**
   * Track parallel execution
   *
   * @param options - Parallel execution options
   */
  async trackParallelExecution(options: ParallelExecutionOptions): Promise<void> {
    // Note: This stores metadata about parallel execution
    // The actual tracking happens when individual tasks complete

    // Store marker for parallel execution
    await this.db.query(
      `INSERT INTO task_executions (
        task_id,
        project_id,
        execution_number,
        started_at,
        status,
        metadata
      )
      SELECT t.id, t.project_id, 1, NOW(), 'running', $3::jsonb
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.title = $1 AND p.name = $2
      LIMIT 1`,
      [
        options.parentTaskId,
        'meta', // Parallel execution tracking uses meta project
        JSON.stringify({
          parallel: true,
          childTaskIds: options.childTaskIds,
          sequentialEstimate: options.sequentialEstimate,
          agentCount: options.childTaskIds.length,
        }),
      ]
    );
  }

  /**
   * Complete parallel execution tracking
   *
   * @param parentTaskId - Parent task ID
   * @returns Parallel execution metrics or null if not all tasks complete
   */
  async completeParallelExecution(parentTaskId: string): Promise<ParallelMetrics | null> {
    // Get the parallel execution record
    const result = await this.db.query(
      `SELECT te.metadata
       FROM task_executions te
       JOIN tasks t ON te.task_id = t.id
       WHERE t.title = $1
         AND te.metadata->>'parallel' = 'true'
       ORDER BY te.started_at DESC
       LIMIT 1`,
      [parentTaskId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const metadata = result.rows[0].metadata;
    const childTaskIds = metadata.childTaskIds || [];
    const sequentialEstimate = metadata.sequentialEstimate || 0;
    const agentCount = metadata.agentCount || childTaskIds.length;

    // Get completion times for all child tasks
    const tasksResult = await this.db.query(
      `SELECT te.started_at, te.completed_at, te.duration_minutes
       FROM task_executions te
       JOIN tasks t ON te.task_id = t.id
       WHERE t.title = ANY($1)
         AND te.status = 'completed'
       ORDER BY te.completed_at`,
      [childTaskIds]
    );

    const tasks = tasksResult.rows;

    if (tasks.length === 0 || tasks.length < childTaskIds.length) {
      // Not all tasks completed yet
      return null;
    }

    // Calculate actual parallel time (time from first start to last completion)
    const firstStart = new Date(Math.min(...tasks.map((t: any) => new Date(t.started_at).getTime())));
    const lastCompletion = new Date(Math.max(...tasks.map((t: any) => new Date(t.completed_at).getTime())));
    const parallelActual = Math.floor((lastCompletion.getTime() - firstStart.getTime()) / 1000);

    // Calculate time saved
    const timeSaved = sequentialEstimate - parallelActual;

    // Calculate efficiency (ideal parallel time = sequential / count)
    const idealParallel = sequentialEstimate / agentCount;
    const efficiency = Math.min(1.0, idealParallel / parallelActual);

    return {
      sequentialEstimate,
      parallelActual,
      timeSaved,
      efficiency,
      agentCount,
    };
  }

  /**
   * Get estimate for a task based on historical data
   *
   * @param options - Estimation options
   * @returns Task estimate
   */
  async estimateTask(options: EstimateTaskOptions): Promise<TaskEstimate> {
    // Get project ID
    const projectResult = await this.db.query(
      'SELECT id FROM projects WHERE name = $1',
      [options.projectName]
    );

    if (projectResult.rows.length === 0) {
      // No project data, return conservative estimate
      return this.getConservativeEstimate();
    }

    const projectId = projectResult.rows[0].id;

    // 1. Find similar tasks using text search
    const similarTasks = await this.db.query(
      `SELECT
         t.title as task_description,
         te.duration_minutes,
         te.complexity,
         ts_rank(to_tsvector('english', t.title),
                 plainto_tsquery('english', $1)) AS relevance
       FROM task_executions te
       JOIN tasks t ON te.task_id = t.id
       WHERE
         t.task_type = $2
         AND te.project_id = $3
         AND te.status = 'completed'
         AND te.duration_minutes IS NOT NULL
         ${options.complexity ? 'AND te.complexity = $4' : ''}
       ORDER BY relevance DESC
       LIMIT 20`,
      options.complexity
        ? [options.taskDescription, options.taskType, projectId, options.complexity]
        : [options.taskDescription, options.taskType, projectId]
    );

    if (similarTasks.rows.length === 0) {
      // No similar tasks, fall back to type average
      return await this.getTypeAverage(options.taskType, projectId);
    }

    // 2. Calculate statistics from similar tasks
    const durations = similarTasks.rows
      .map((t: any) => t.duration_minutes * 60) // Convert to seconds
      .sort((a: number, b: number) => a - b);

    const avg = durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length;
    const median = durations[Math.floor(durations.length / 2)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const min = durations[0];
    const max = durations[durations.length - 1];

    // 3. Calculate confidence interval (95%)
    const stdDev = Math.sqrt(
      durations.reduce((sum: number, d: number) => sum + Math.pow(d - avg, 2), 0) / durations.length
    );
    const confidenceLow = Math.max(min, avg - 1.96 * stdDev);
    const confidenceHigh = Math.min(max, avg + 1.96 * stdDev);

    return {
      estimatedSeconds: Math.round(avg),
      confidenceIntervalLow: Math.round(confidenceLow),
      confidenceIntervalHigh: Math.round(confidenceHigh),
      medianSeconds: Math.round(median),
      p95Seconds: Math.round(p95),
      sampleSize: similarTasks.rows.length,
      similarTasks: similarTasks.rows.slice(0, 5).map((t: any) => ({
        description: t.task_description,
        duration: t.duration_minutes * 60,
      })),
    };
  }

  /**
   * Get type average as fallback
   *
   * @param taskType - Task type
   * @param projectId - Project ID
   * @returns Task estimate
   */
  private async getTypeAverage(taskType: string, projectId: string): Promise<TaskEstimate> {
    const result = await this.db.query(
      `SELECT
         AVG(te.duration_minutes) as avg_duration,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY te.duration_minutes) as median_duration,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY te.duration_minutes) as p95_duration,
         COUNT(*) as total_executions
       FROM task_executions te
       JOIN tasks t ON te.task_id = t.id
       WHERE t.task_type = $1
         AND te.project_id = $2
         AND te.status = 'completed'
         AND te.duration_minutes IS NOT NULL`,
      [taskType, projectId]
    );

    if (result.rows.length === 0 || result.rows[0].total_executions === 0) {
      // No data at all, return conservative estimate
      return this.getConservativeEstimate();
    }

    const stats = result.rows[0];
    const avgSeconds = stats.avg_duration * 60;

    return {
      estimatedSeconds: Math.round(avgSeconds),
      confidenceIntervalLow: Math.round(avgSeconds * 0.5),
      confidenceIntervalHigh: Math.round(stats.p95_duration * 60),
      medianSeconds: Math.round(stats.median_duration * 60),
      p95Seconds: Math.round(stats.p95_duration * 60),
      sampleSize: parseInt(stats.total_executions),
      similarTasks: [],
      note: 'Based on task type average (no similar tasks found)',
    };
  }

  /**
   * Get conservative estimate when no data available
   *
   * @returns Conservative task estimate
   */
  private getConservativeEstimate(): TaskEstimate {
    return {
      estimatedSeconds: 3600, // 1 hour default
      confidenceIntervalLow: 1800,
      confidenceIntervalHigh: 7200,
      medianSeconds: 3600,
      p95Seconds: 7200,
      sampleSize: 0,
      similarTasks: [],
      note: 'No historical data - conservative estimate',
    };
  }

  /**
   * Update aggregate statistics for a task type
   *
   * @param taskType - Task type
   * @param projectName - Project name
   */
  private async updateStats(taskType: string, projectName: string): Promise<void> {
    // Get project ID
    const projectResult = await this.db.query(
      'SELECT id FROM projects WHERE name = $1',
      [projectName]
    );

    if (projectResult.rows.length === 0) {
      return;
    }

    const projectId = projectResult.rows[0].id;

    // Update or insert estimation pattern
    await this.db.query(
      `INSERT INTO estimation_patterns (
        project_id,
        pattern_name,
        task_type,
        complexity,
        avg_duration_minutes,
        sample_count,
        confidence_score
      )
      SELECT
        $1,
        $2 || '_' || COALESCE(te.complexity, 'medium'),
        $2,
        COALESCE(te.complexity, 'medium'),
        AVG(te.duration_minutes),
        COUNT(*),
        LEAST(1.0, COUNT(*)::NUMERIC / 10.0)
      FROM task_executions te
      JOIN tasks t ON te.task_id = t.id
      WHERE t.task_type = $2
        AND te.project_id = $1
        AND te.status = 'completed'
        AND te.duration_minutes IS NOT NULL
      GROUP BY te.complexity
      ON CONFLICT (project_id, pattern_name, task_type, complexity)
      DO UPDATE SET
        avg_duration_minutes = EXCLUDED.avg_duration_minutes,
        sample_count = EXCLUDED.sample_count,
        confidence_score = EXCLUDED.confidence_score,
        updated_at = NOW()`,
      [projectId, taskType]
    );
  }

  /**
   * Get project statistics
   *
   * @param projectName - Project name
   * @returns Project statistics
   */
  async getProjectStats(projectName: string): Promise<ProjectStats> {
    // Get project ID
    const projectResult = await this.db.query(
      'SELECT id FROM projects WHERE name = $1',
      [projectName]
    );

    if (projectResult.rows.length === 0) {
      throw new Error(`Project not found: ${projectName}`);
    }

    const projectId = projectResult.rows[0].id;

    // Get overall stats
    const overallResult = await this.db.query(
      `SELECT
         COUNT(*) as total_tasks,
         COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
         AVG(duration_minutes) FILTER (WHERE status = 'completed') as avg_duration
       FROM task_executions
       WHERE project_id = $1`,
      [projectId]
    );

    const overall = overallResult.rows[0];

    // Get stats by type
    const byTypeResult = await this.db.query(
      `SELECT
         t.task_type,
         COUNT(te.id) as count,
         AVG(te.duration_minutes) as avg_duration,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY te.duration_minutes) as median_duration,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY te.duration_minutes) as p95_duration,
         COUNT(*) FILTER (WHERE te.status = 'completed') * 1.0 / COUNT(*) as success_rate
       FROM tasks t
       JOIN task_executions te ON t.id = te.task_id
       WHERE te.project_id = $1
         AND te.status IN ('completed', 'failed')
       GROUP BY t.task_type`,
      [projectId]
    );

    const byType: Record<string, TaskTypeStats> = {};
    for (const row of byTypeResult.rows) {
      byType[row.task_type] = {
        count: parseInt(row.count),
        avgDuration: Math.round(row.avg_duration * 60), // Convert to seconds
        medianDuration: Math.round(row.median_duration * 60),
        p95Duration: Math.round(row.p95_duration * 60),
        successRate: parseFloat(row.success_rate),
      };
    }

    // Get estimation accuracy
    const accuracyResult = await this.db.query(
      `SELECT
         AVG(ABS(variance_percent)) as avg_error,
         COUNT(*) FILTER (WHERE ABS(variance_percent) <= 20) * 1.0 / COUNT(*) as within_20_percent
       FROM task_executions
       WHERE project_id = $1
         AND status = 'completed'
         AND variance_percent IS NOT NULL`,
      [projectId]
    );

    const accuracy = accuracyResult.rows[0];

    return {
      totalTasks: parseInt(overall.total_tasks),
      completedTasks: parseInt(overall.completed_tasks),
      averageDuration: Math.round((overall.avg_duration || 0) * 60), // Convert to seconds
      byType,
      estimationAccuracy: {
        avgError: parseFloat(accuracy.avg_error || 0) / 100,
        within20Percent: parseFloat(accuracy.within_20_percent || 0),
        improving: true, // TODO: Calculate trend
      },
      parallelism: {
        avgAgents: 1, // TODO: Calculate from parallel executions
        avgEfficiency: 0.75, // TODO: Calculate from parallel executions
        avgTimeSaved: 0, // TODO: Calculate from parallel executions
      },
    };
  }

  /**
   * Get task statistics for a specific task type
   *
   * @param taskType - Task type
   * @param projectName - Project name (optional)
   * @returns Task type statistics
   */
  async getTaskTypeStats(taskType: string, projectName?: string): Promise<TaskTypeStats> {
    const projectFilter = projectName
      ? `AND p.name = '${projectName}'`
      : '';

    const result = await this.db.query(
      `SELECT
         COUNT(te.id) as count,
         AVG(te.duration_minutes) as avg_duration,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY te.duration_minutes) as median_duration,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY te.duration_minutes) as p95_duration,
         COUNT(*) FILTER (WHERE te.status = 'completed') * 1.0 / COUNT(*) as success_rate
       FROM tasks t
       JOIN task_executions te ON t.id = te.task_id
       JOIN projects p ON te.project_id = p.id
       WHERE t.task_type = $1
         AND te.status IN ('completed', 'failed')
         ${projectFilter}`,
      [taskType]
    );

    if (result.rows.length === 0) {
      throw new Error(`No data found for task type: ${taskType}`);
    }

    const stats = result.rows[0];

    return {
      count: parseInt(stats.count),
      avgDuration: Math.round(stats.avg_duration * 60),
      medianDuration: Math.round(stats.median_duration * 60),
      p95Duration: Math.round(stats.p95_duration * 60),
      successRate: parseFloat(stats.success_rate),
    };
  }
}
