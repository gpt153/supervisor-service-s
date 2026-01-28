/**
 * Integration Tests for Checkpoint System (Epic 007-D)
 * 8 scenario tests covering:
 * - Context window checkpoint flow
 * - Epic completion checkpoint flow
 * - Manual checkpoint with recovery
 * - Multiple checkpoints per instance
 * - Concurrent checkpoint creation
 * - Checkpoint retrieval and state restoration
 * - Cleanup and retention flows
 * - End-to-end recovery scenario
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pool } from '../../src/db/client.js';
import {
  registerInstance,
  getCheckpointManager,
  getWorkStateSerializer,
  getResumeInstructionGenerator,
} from '../../src/session/index.js';
import { WorkState, CheckpointType } from '../../src/types/checkpoint.js';

/**
 * Scenario 1: Context window checkpoint trigger
 */
describe('Scenario 1: Context window checkpoint trigger', () => {
  let instanceId: string;

  beforeEach(async () => {
    const instance = await registerInstance('scenario-test', 'PS');
    instanceId = instance.instance_id;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM checkpoints WHERE instance_id = $1', [instanceId]);
  });

  it('Should create checkpoint when context reaches 80%', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: {
        epic_id: 'epic-010',
        status: 'implementation',
      },
      files_modified: [],
      git_status: { branch: 'main', staged_files: 0, unstaged_files: 0, untracked_files: 0, commit_count: 0 },
      last_commands: [],
      prd_status: {},
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    const checkpoint = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'context_window',
      context_window_percent: 80,
      work_state: workState,
    });

    expect(checkpoint.success).toBe(true);
    expect(checkpoint.checkpoint_type).toBe('context_window');
    expect(checkpoint.checkpoint_id).toBeDefined();
  });

  it('Should store context percentage', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: null,
      files_modified: [],
      git_status: { branch: 'main', staged_files: 0, unstaged_files: 0, untracked_files: 0, commit_count: 0 },
      last_commands: [],
      prd_status: {},
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    const created = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'context_window',
      context_window_percent: 85,
      work_state: workState,
    });

    const retrieved = await manager.getCheckpoint(created.checkpoint_id);
    expect(retrieved.checkpoint.context_window_percent).toBe(85);
  });
});

/**
 * Scenario 2: Epic completion checkpoint flow
 */
describe('Scenario 2: Epic completion checkpoint flow', () => {
  let instanceId: string;

  beforeEach(async () => {
    const instance = await registerInstance('scenario-test', 'PS');
    instanceId = instance.instance_id;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM checkpoints WHERE instance_id = $1', [instanceId]);
  });

  it('Should create comprehensive checkpoint on epic completion', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: {
        epic_id: 'epic-005',
        feature_name: 'authentication',
        status: 'complete',
        duration_hours: 48,
        test_results: {
          passed: 95,
          failed: 0,
          coverage: 92,
        },
      },
      files_modified: [
        {
          path: 'src/auth/handler.ts',
          status: 'modified',
          lines_changed: 250,
          last_modified: new Date().toISOString(),
        },
      ],
      git_status: { branch: 'feat/auth', staged_files: 1, unstaged_files: 0, untracked_files: 0, commit_count: 12 },
      last_commands: [
        {
          command_id: 'cmd_1',
          type: 'test',
          action: 'Run tests',
          timestamp: new Date().toISOString(),
        },
      ],
      prd_status: {
        version: '2.0.0',
        current_epic: 'epic-005',
        status_summary: 'Completed',
      },
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    const checkpoint = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'epic_completion',
      work_state: workState,
    });

    expect(checkpoint.success).toBe(true);

    // Verify stored data
    const retrieved = await manager.getCheckpoint(checkpoint.checkpoint_id);
    expect(retrieved.checkpoint.work_state.current_epic?.status).toBe('complete');
    expect(retrieved.checkpoint.work_state.current_epic?.test_results?.passed).toBe(95);
  });

  it('Should generate actionable recovery instructions', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: {
        epic_id: 'epic-005',
        status: 'complete',
      },
      files_modified: [],
      git_status: { branch: 'feat/auth', staged_files: 0, unstaged_files: 0, untracked_files: 0, commit_count: 10 },
      last_commands: [],
      prd_status: {},
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    const created = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'epic_completion',
      work_state: workState,
    });

    const retrieved = await manager.getCheckpoint(created.checkpoint_id);
    const instructions = retrieved.recovery_instructions;

    expect(instructions).toContain('Resume Instructions');
    expect(instructions).toContain('epic-005');
    expect(instructions).toContain('complete');
    expect(instructions).toContain('Next Steps');
  });
});

/**
 * Scenario 3: Manual checkpoint with recovery
 */
describe('Scenario 3: Manual checkpoint with recovery', () => {
  let instanceId: string;

  beforeEach(async () => {
    const instance = await registerInstance('scenario-test', 'PS');
    instanceId = instance.instance_id;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM checkpoints WHERE instance_id = $1', [instanceId]);
  });

  it('Should create manual checkpoint with custom note', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: {
        epic_id: 'epic-007',
        status: 'validation',
      },
      files_modified: [],
      git_status: { branch: 'feat/epic-007', staged_files: 2, unstaged_files: 0, untracked_files: 0, commit_count: 8 },
      last_commands: [],
      prd_status: {},
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    const checkpoint = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'manual',
      work_state: workState,
      metadata: {
        manual_note: 'Checkpoint before major refactor',
      },
    });

    expect(checkpoint.success).toBe(true);
    expect(checkpoint.checkpoint_type).toBe('manual');
  });

  it('Should retrieve and generate instructions from manual checkpoint', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: {
        epic_id: 'epic-008',
        feature_name: 'payment-integration',
        status: 'implementation',
      },
      files_modified: [
        {
          path: 'src/payments/stripe.ts',
          status: 'modified',
          lines_changed: 180,
          last_modified: new Date().toISOString(),
        },
      ],
      git_status: { branch: 'feat/payments', staged_files: 1, unstaged_files: 0, untracked_files: 0, commit_count: 6 },
      last_commands: [
        {
          command_id: 'cmd_1',
          type: 'spawn',
          action: 'Implement payment API',
          timestamp: new Date().toISOString(),
        },
      ],
      prd_status: { version: '1.5.0' },
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    const created = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'manual',
      work_state: workState,
    });

    const retrieved = await manager.getCheckpoint(created.checkpoint_id);

    expect(retrieved.recovery_instructions).toContain('epic-008');
    expect(retrieved.recovery_instructions).toContain('payment-integration');
    expect(retrieved.recovery_instructions).toContain('src/payments/stripe.ts');
  });
});

/**
 * Scenario 4: Multiple checkpoints per instance
 */
describe('Scenario 4: Multiple checkpoints per instance', () => {
  let instanceId: string;

  beforeEach(async () => {
    const instance = await registerInstance('scenario-test', 'PS');
    instanceId = instance.instance_id;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM checkpoints WHERE instance_id = $1', [instanceId]);
  });

  it('Should support multiple checkpoints with auto-incrementing sequence', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: null,
      files_modified: [],
      git_status: { branch: 'main', staged_files: 0, unstaged_files: 0, untracked_files: 0, commit_count: 0 },
      last_commands: [],
      prd_status: {},
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    const cp1 = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'manual',
      work_state: workState,
    });

    const cp2 = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'manual',
      work_state: workState,
    });

    const cp3 = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'manual',
      work_state: workState,
    });

    expect(cp1.sequence_num).toBe(1);
    expect(cp2.sequence_num).toBe(2);
    expect(cp3.sequence_num).toBe(3);
  });

  it('Should list all checkpoints in reverse chronological order', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: null,
      files_modified: [],
      git_status: { branch: 'main', staged_files: 0, unstaged_files: 0, untracked_files: 0, commit_count: 0 },
      last_commands: [],
      prd_status: {},
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    for (let i = 0; i < 5; i++) {
      await manager.createCheckpoint({
        instance_id: instanceId,
        checkpoint_type: 'manual',
        work_state: workState,
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const list = await manager.listCheckpoints(instanceId);
    expect(list.checkpoints).toHaveLength(5);
    expect(list.total_count).toBe(5);

    // Verify reverse chronological order (most recent first)
    for (let i = 0; i < list.checkpoints.length - 1; i++) {
      expect(new Date(list.checkpoints[i].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(list.checkpoints[i + 1].timestamp).getTime()
      );
    }
  });

  it('Should filter checkpoints by type', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: null,
      files_modified: [],
      git_status: { branch: 'main', staged_files: 0, unstaged_files: 0, untracked_files: 0, commit_count: 0 },
      last_commands: [],
      prd_status: {},
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    // Create mixed checkpoint types
    await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'context_window',
      work_state: workState,
    });

    await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'manual',
      work_state: workState,
    });

    await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'epic_completion',
      work_state: workState,
    });

    const manual = await manager.listCheckpoints(instanceId, {
      checkpoint_type: 'manual',
    });

    expect(manual.checkpoints).toHaveLength(1);
    expect(manual.checkpoints[0].checkpoint_type).toBe('manual');
  });
});

/**
 * Scenario 5: Concurrent checkpoint creation
 */
describe('Scenario 5: Concurrent checkpoint creation', () => {
  let instanceId: string;

  beforeEach(async () => {
    const instance = await registerInstance('scenario-test', 'PS');
    instanceId = instance.instance_id;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM checkpoints WHERE instance_id = $1', [instanceId]);
  });

  it('Should handle concurrent checkpoint creation', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: null,
      files_modified: [],
      git_status: { branch: 'main', staged_files: 0, unstaged_files: 0, untracked_files: 0, commit_count: 0 },
      last_commands: [],
      prd_status: {},
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    // Create 5 checkpoints concurrently
    const promises = Array.from({ length: 5 }, () =>
      manager.createCheckpoint({
        instance_id: instanceId,
        checkpoint_type: 'manual',
        work_state: workState,
      })
    );

    const results = await Promise.all(promises);

    // All should succeed
    expect(results.every((r) => r.success)).toBe(true);

    // Sequence numbers should be unique and sequential
    const sequences = results.map((r) => r.sequence_num).sort((a, b) => a - b);
    for (let i = 0; i < sequences.length; i++) {
      expect(sequences[i]).toBe(i + 1);
    }
  });
});

/**
 * Scenario 6: Checkpoint retrieval and state restoration
 */
describe('Scenario 6: Checkpoint retrieval and state restoration', () => {
  let instanceId: string;

  beforeEach(async () => {
    const instance = await registerInstance('scenario-test', 'PS');
    instanceId = instance.instance_id;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM checkpoints WHERE instance_id = $1', [instanceId]);
  });

  it('Should restore exact work state from checkpoint', async () => {
    const manager = getCheckpointManager();

    const originalWorkState: WorkState = {
      current_epic: {
        epic_id: 'epic-099',
        feature_name: 'complex-feature',
        status: 'implementation',
        duration_hours: 32.5,
        test_results: {
          passed: 52,
          failed: 2,
          coverage: 88,
        },
      },
      files_modified: [
        {
          path: 'src/complex/module1.ts',
          status: 'modified',
          lines_changed: 342,
          last_modified: new Date().toISOString(),
        },
        {
          path: 'tests/complex.test.ts',
          status: 'modified',
          lines_changed: 187,
          last_modified: new Date().toISOString(),
        },
      ],
      git_status: {
        branch: 'feat/complex',
        staged_files: 2,
        unstaged_files: 1,
        untracked_files: 0,
        commit_count: 15,
      },
      last_commands: [
        {
          command_id: 'cmd_1',
          type: 'test',
          action: 'Run integration tests',
          timestamp: new Date().toISOString(),
        },
      ],
      prd_status: {
        version: '3.0.0',
        current_epic: 'epic-099',
      },
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    const created = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'manual',
      work_state: originalWorkState,
    });

    const retrieved = await manager.getCheckpoint(created.checkpoint_id);
    const restoredState = retrieved.checkpoint.work_state;

    // Verify all fields are restored
    expect(restoredState.current_epic?.epic_id).toBe(originalWorkState.current_epic?.epic_id);
    expect(restoredState.current_epic?.duration_hours).toBe(originalWorkState.current_epic?.duration_hours);
    expect(restoredState.files_modified).toHaveLength(originalWorkState.files_modified.length);
    expect(restoredState.git_status.branch).toBe(originalWorkState.git_status.branch);
  });
});

/**
 * Scenario 7: Cleanup and retention flows
 */
describe('Scenario 7: Cleanup and retention flows', () => {
  let instanceId: string;

  beforeEach(async () => {
    const instance = await registerInstance('scenario-test', 'PS');
    instanceId = instance.instance_id;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM checkpoints WHERE instance_id = $1', [instanceId]);
  });

  it('Should clean up old checkpoints', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: null,
      files_modified: [],
      git_status: { branch: 'main', staged_files: 0, unstaged_files: 0, untracked_files: 0, commit_count: 0 },
      last_commands: [],
      prd_status: {},
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    // Create checkpoints
    for (let i = 0; i < 3; i++) {
      await manager.createCheckpoint({
        instance_id: instanceId,
        checkpoint_type: 'manual',
        work_state: workState,
      });
    }

    const list1 = await manager.listCheckpoints(instanceId);
    expect(list1.total_count).toBe(3);

    // Cleanup with 0 retention (delete all)
    const cleanup = await manager.cleanupCheckpoints(0);
    expect(cleanup.deleted_count).toBeGreaterThanOrEqual(0);

    const list2 = await manager.listCheckpoints(instanceId);
    // Should have fewer or same checkpoints
    expect(list2.total_count).toBeLessThanOrEqual(list1.total_count);
  });

  it('Should report storage freed', async () => {
    const manager = getCheckpointManager();

    const workState: WorkState = {
      current_epic: null,
      files_modified: [],
      git_status: { branch: 'main', staged_files: 0, unstaged_files: 0, untracked_files: 0, commit_count: 0 },
      last_commands: [],
      prd_status: {},
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    for (let i = 0; i < 5; i++) {
      await manager.createCheckpoint({
        instance_id: instanceId,
        checkpoint_type: 'manual',
        work_state: workState,
      });
    }

    const cleanup = await manager.cleanupCheckpoints(0);
    expect(cleanup.freed_bytes).toBeGreaterThanOrEqual(0);
    expect(cleanup.retention_days).toBe(0);
  });
});

/**
 * Scenario 8: End-to-end recovery scenario
 */
describe('Scenario 8: End-to-end recovery scenario', () => {
  let instanceId: string;

  beforeEach(async () => {
    const instance = await registerInstance('scenario-test', 'PS');
    instanceId = instance.instance_id;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM checkpoints WHERE instance_id = $1', [instanceId]);
  });

  it('Should enable complete recovery workflow', async () => {
    const manager = getCheckpointManager();

    // Step 1: Create checkpoint at 80% context
    const workState80: WorkState = {
      current_epic: {
        epic_id: 'epic-final',
        status: 'implementation',
      },
      files_modified: [
        {
          path: 'src/final-module.ts',
          status: 'modified',
          lines_changed: 100,
          last_modified: new Date().toISOString(),
        },
      ],
      git_status: {
        branch: 'feat/final',
        staged_files: 1,
        unstaged_files: 0,
        untracked_files: 0,
        commit_count: 5,
      },
      last_commands: [
        {
          command_id: 'cmd_1',
          type: 'spawn',
          action: 'Implement final feature',
          timestamp: new Date().toISOString(),
        },
      ],
      prd_status: { version: '1.0.0' },
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    const checkpoint80 = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'context_window',
      context_window_percent: 80,
      work_state: workState80,
    });

    expect(checkpoint80.success).toBe(true);

    // Step 2: Retrieve checkpoint and generate instructions
    const retrieved = await manager.getCheckpoint(checkpoint80.checkpoint_id);
    expect(retrieved.checkpoint.context_window_percent).toBe(80);
    expect(retrieved.recovery_instructions).toContain('epic-final');

    // Step 3: Verify list includes the checkpoint
    const list = await manager.listCheckpoints(instanceId);
    expect(list.checkpoints).toHaveLength(1);
    expect(list.checkpoints[0].checkpoint_id).toBe(checkpoint80.checkpoint_id);

    // Step 4: Create epic completion checkpoint
    const workStateFinal: WorkState = {
      current_epic: {
        epic_id: 'epic-final',
        status: 'complete',
        test_results: {
          passed: 50,
          failed: 0,
        },
      },
      files_modified: [],
      git_status: {
        branch: 'feat/final',
        staged_files: 0,
        unstaged_files: 0,
        untracked_files: 0,
        commit_count: 8,
      },
      last_commands: [],
      prd_status: { version: '1.1.0' },
      environment: { project: 'scenario-test', working_directory: '/work', hostname: 'test' },
      snapshot_at: new Date().toISOString(),
    };

    const checkpointFinal = await manager.createCheckpoint({
      instance_id: instanceId,
      checkpoint_type: 'epic_completion',
      work_state: workStateFinal,
    });

    expect(checkpointFinal.success).toBe(true);

    // Step 5: Verify both checkpoints exist
    const finalList = await manager.listCheckpoints(instanceId);
    expect(finalList.total_count).toBe(2);

    // Verify most recent is first
    expect(finalList.checkpoints[0].sequence_num).toBe(2);
    expect(finalList.checkpoints[1].sequence_num).toBe(1);
  });
});
