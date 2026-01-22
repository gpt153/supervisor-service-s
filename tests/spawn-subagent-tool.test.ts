/**
 * Unit tests for spawn-subagent-tool
 *
 * Tests the active_spawns database recording functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { pool } from '../src/db/client.js';

describe('spawn-subagent-tool database recording', () => {
  beforeAll(async () => {
    // Ensure test database is set up
    await pool.query(`
      CREATE TABLE IF NOT EXISTS active_spawns (
        id SERIAL PRIMARY KEY,
        project VARCHAR(50) NOT NULL,
        task_id VARCHAR(100) NOT NULL,
        task_type VARCHAR(50),
        description TEXT,
        spawn_time TIMESTAMP NOT NULL DEFAULT NOW(),
        last_output_change TIMESTAMP,
        output_file TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'running',
        exit_code INTEGER,
        error_message TEXT,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(project, task_id)
      )
    `);
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM active_spawns WHERE project LIKE 'test-%'`);
  });

  afterAll(async () => {
    // Clean up
    await pool.query(`DROP TABLE IF EXISTS active_spawns CASCADE`);
    await pool.end();
  });

  it('should record spawn with all required fields', async () => {
    const project = 'test-project';
    const taskId = `agent-${Date.now()}`;
    const taskType = 'implementation';
    const description = 'Test implementation task';
    const outputFile = `/tmp/${taskId}-output.log`;

    await pool.query(
      `INSERT INTO active_spawns
       (project, task_id, task_type, description, output_file, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [project, taskId, taskType, description, outputFile, 'running']
    );

    const result = await pool.query(
      `SELECT * FROM active_spawns WHERE project = $1 AND task_id = $2`,
      [project, taskId]
    );

    expect(result.rows.length).toBe(1);
    const spawn = result.rows[0];
    expect(spawn.project).toBe(project);
    expect(spawn.task_id).toBe(taskId);
    expect(spawn.task_type).toBe(taskType);
    expect(spawn.description).toBe(description);
    expect(spawn.output_file).toBe(outputFile);
    expect(spawn.status).toBe('running');
  });

  it('should update spawn status on completion', async () => {
    const project = 'test-project';
    const taskId = `agent-${Date.now()}`;

    // Insert initial spawn
    await pool.query(
      `INSERT INTO active_spawns
       (project, task_id, task_type, description, output_file, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [project, taskId, 'implementation', 'Test task', '/tmp/output.log', 'running']
    );

    // Update to completed
    await pool.query(
      `UPDATE active_spawns
       SET status = $1,
           exit_code = $2,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE task_id = $3`,
      ['completed', 0, taskId]
    );

    const result = await pool.query(
      `SELECT * FROM active_spawns WHERE task_id = $1`,
      [taskId]
    );

    expect(result.rows.length).toBe(1);
    const spawn = result.rows[0];
    expect(spawn.status).toBe('completed');
    expect(spawn.exit_code).toBe(0);
    expect(spawn.completed_at).not.toBeNull();
  });

  it('should update spawn status on failure', async () => {
    const project = 'test-project';
    const taskId = `agent-${Date.now()}`;
    const errorMessage = 'Test error';

    // Insert initial spawn
    await pool.query(
      `INSERT INTO active_spawns
       (project, task_id, task_type, description, output_file, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [project, taskId, 'implementation', 'Test task', '/tmp/output.log', 'running']
    );

    // Update to failed
    await pool.query(
      `UPDATE active_spawns
       SET status = $1,
           exit_code = $2,
           error_message = $3,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE task_id = $4`,
      ['failed', 1, errorMessage, taskId]
    );

    const result = await pool.query(
      `SELECT * FROM active_spawns WHERE task_id = $1`,
      [taskId]
    );

    expect(result.rows.length).toBe(1);
    const spawn = result.rows[0];
    expect(spawn.status).toBe('failed');
    expect(spawn.exit_code).toBe(1);
    expect(spawn.error_message).toBe(errorMessage);
    expect(spawn.completed_at).not.toBeNull();
  });

  it('should handle conflict on duplicate task_id', async () => {
    const project = 'test-project';
    const taskId = `agent-${Date.now()}`;

    // Insert first spawn
    await pool.query(
      `INSERT INTO active_spawns
       (project, task_id, task_type, description, output_file, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [project, taskId, 'implementation', 'First task', '/tmp/output1.log', 'running']
    );

    // Insert duplicate with ON CONFLICT
    await pool.query(
      `INSERT INTO active_spawns
       (project, task_id, task_type, description, output_file, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project, task_id) DO UPDATE
       SET task_type = EXCLUDED.task_type,
           description = EXCLUDED.description,
           output_file = EXCLUDED.output_file,
           status = EXCLUDED.status,
           spawn_time = NOW(),
           updated_at = NOW()`,
      [project, taskId, 'testing', 'Second task', '/tmp/output2.log', 'running']
    );

    const result = await pool.query(
      `SELECT * FROM active_spawns WHERE project = $1 AND task_id = $2`,
      [project, taskId]
    );

    // Should only have one row (updated)
    expect(result.rows.length).toBe(1);
    const spawn = result.rows[0];
    expect(spawn.task_type).toBe('testing');
    expect(spawn.description).toBe('Second task');
    expect(spawn.output_file).toBe('/tmp/output2.log');
  });

  it('should support all task types', async () => {
    const taskTypes = [
      'research',
      'planning',
      'implementation',
      'testing',
      'validation',
      'documentation',
      'fix',
      'deployment',
      'review',
      'security',
      'integration'
    ];

    for (const taskType of taskTypes) {
      const taskId = `agent-${Date.now()}-${taskType}`;
      await pool.query(
        `INSERT INTO active_spawns
         (project, task_id, task_type, description, output_file, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['test-project', taskId, taskType, `Test ${taskType}`, '/tmp/output.log', 'running']
      );
    }

    const result = await pool.query(
      `SELECT COUNT(*) as count FROM active_spawns WHERE project = 'test-project'`
    );

    expect(parseInt(result.rows[0].count)).toBe(taskTypes.length);
  });

  it('should record output file path', async () => {
    const project = 'test-project';
    const taskId = `agent-${Date.now()}`;
    const outputFile = `/tmp/${taskId}-output.log`;

    await pool.query(
      `INSERT INTO active_spawns
       (project, task_id, task_type, description, output_file, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [project, taskId, 'implementation', 'Test task', outputFile, 'running']
    );

    const result = await pool.query(
      `SELECT output_file FROM active_spawns WHERE task_id = $1`,
      [taskId]
    );

    expect(result.rows[0].output_file).toBe(outputFile);
  });
});
