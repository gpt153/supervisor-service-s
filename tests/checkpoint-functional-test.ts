/**
 * Functional Tests for Checkpoint System (Epic 007-D)
 * Validates core functionality
 * Run with: npx tsx tests/checkpoint-functional-test.ts
 */

import { pool } from '../src/db/client.js';
import {
  registerInstance,
  getCheckpointManager,
  getWorkStateSerializer,
  getResumeInstructionGenerator,
} from '../src/session/index.js';
import { WorkState, CheckpointType } from '../src/types/checkpoint.js';

const testWorkState: WorkState = {
  current_epic: {
    epic_id: 'epic-001',
    feature_name: 'test-feature',
    status: 'implementation',
  },
  files_modified: [
    {
      path: 'src/test.ts',
      status: 'modified',
      lines_changed: 42,
      last_modified: new Date().toISOString(),
    },
  ],
  git_status: {
    branch: 'feat/test',
    staged_files: 1,
    unstaged_files: 0,
    untracked_files: 0,
    commit_count: 5,
  },
  last_commands: [
    {
      command_id: 'cmd_1',
      type: 'test',
      action: 'Run tests',
      timestamp: new Date().toISOString(),
    },
  ],
  prd_status: { version: '1.0.0' },
  environment: { project: 'test', working_directory: '/work', hostname: 'test' },
  snapshot_at: new Date().toISOString(),
};

async function runTests() {
  console.log('\n==================================');
  console.log('CHECKPOINT FUNCTIONAL TESTS');
  console.log('==================================\n');

  let passCount = 0;
  const totalTests = 12;

  try {
    // Test 1: Schema validation
    {
      const result = await pool.query(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='checkpoints')"
      );
      const pass = result.rows[0].exists === true;
      console.log(`${pass ? '✅' : '❌'} Test 1: checkpoints table exists`);
      if (pass) passCount++;
    }

    // Test 2: Register test instance
    let testInstanceId = '';
    {
      try {
        const instance = await registerInstance('checkpoint-test', 'PS');
        testInstanceId = instance.instance_id;
        const pass = !!testInstanceId;
        console.log(`${pass ? '✅' : '❌'} Test 2: Register test instance`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 2: Register test instance - ${error.message}`);
      }
    }

    if (!testInstanceId) {
      console.log('\nFailed: Cannot continue without test instance');
      process.exit(1);
    }

    // Test 3: Create checkpoint
    let checkpointId = '';
    {
      try {
        const manager = getCheckpointManager();
        const result = await manager.createCheckpoint({
          instance_id: testInstanceId,
          checkpoint_type: 'manual',
          work_state: testWorkState,
        });
        checkpointId = result.checkpoint_id;
        const pass = !!checkpointId && result.sequence_num === 1;
        console.log(`${pass ? '✅' : '❌'} Test 3: Create first checkpoint (sequence=1)`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 3: Create checkpoint - ${error.message}`);
      }
    }

    // Test 4: Create second checkpoint with auto-increment
    {
      try {
        const manager = getCheckpointManager();
        const result = await manager.createCheckpoint({
          instance_id: testInstanceId,
          checkpoint_type: 'manual',
          work_state: testWorkState,
        });
        const pass = result.sequence_num === 2;
        console.log(`${pass ? '✅' : '❌'} Test 4: Create second checkpoint (sequence=2)`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 4: Create second checkpoint - ${error.message}`);
      }
    }

    // Test 5: Get checkpoint
    {
      try {
        const manager = getCheckpointManager();
        const result = await manager.getCheckpoint(checkpointId);
        const pass =
          result.checkpoint.checkpoint_id === checkpointId &&
          result.checkpoint.work_state.current_epic?.epic_id === 'epic-001';
        console.log(`${pass ? '✅' : '❌'} Test 5: Retrieve checkpoint and verify data`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 5: Get checkpoint - ${error.message}`);
      }
    }

    // Test 6: Generate recovery instructions
    {
      try {
        const manager = getCheckpointManager();
        const result = await manager.getCheckpoint(checkpointId);
        const pass =
          result.recovery_instructions.includes('Resume Instructions') &&
          result.recovery_instructions.includes('epic-001');
        console.log(`${pass ? '✅' : '❌'} Test 6: Generate recovery instructions`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 6: Generate instructions - ${error.message}`);
      }
    }

    // Test 7: List checkpoints
    {
      try {
        const manager = getCheckpointManager();
        const result = await manager.listCheckpoints(testInstanceId);
        const pass = result.checkpoints.length === 2 && result.total_count === 2;
        console.log(`${pass ? '✅' : '❌'} Test 7: List checkpoints (count=2)`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 7: List checkpoints - ${error.message}`);
      }
    }

    // Test 8: Filter by checkpoint type
    {
      try {
        const manager = getCheckpointManager();
        // First create a context_window checkpoint
        await manager.createCheckpoint({
          instance_id: testInstanceId,
          checkpoint_type: 'context_window',
          context_window_percent: 80,
          work_state: testWorkState,
        });
        // Then filter
        const result = await manager.listCheckpoints(testInstanceId, {
          checkpoint_type: 'context_window',
        });
        const pass =
          result.checkpoints.length === 1 &&
          result.checkpoints[0].checkpoint_type === 'context_window';
        console.log(`${pass ? '✅' : '❌'} Test 8: Filter checkpoints by type`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 8: Filter checkpoints - ${error.message}`);
      }
    }

    // Test 9: Checkpoint size tracking
    {
      try {
        const manager = getCheckpointManager();
        const result = await manager.getCheckpoint(checkpointId);
        const pass = result.checkpoint.metadata.size_bytes > 0;
        console.log(`${pass ? '✅' : '❌'} Test 9: Track checkpoint size (${result.checkpoint.metadata.size_bytes} bytes)`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 9: Track size - ${error.message}`);
      }
    }

    // Test 10: Instance storage stats
    {
      try {
        const manager = getCheckpointManager();
        const stats = await manager.getInstanceStats(testInstanceId);
        const pass =
          stats.total_checkpoints >= 3 &&
          stats.total_storage_bytes > 0 &&
          stats.average_checkpoint_size > 0;
        console.log(`${pass ? '✅' : '❌'} Test 10: Get instance storage stats (${stats.total_checkpoints} checkpoints)`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 10: Get stats - ${error.message}`);
      }
    }

    // Test 11: Work state serialization
    {
      try {
        const serializer = getWorkStateSerializer();
        const state = await serializer.serialize(testInstanceId);
        const pass =
          state.environment.project === 'checkpoint-test' &&
          state.git_status !== undefined;
        console.log(`${pass ? '✅' : '❌'} Test 11: Serialize work state`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 11: Serialize state - ${error.message}`);
      }
    }

    // Test 12: Resume instruction generation
    {
      try {
        const generator = getResumeInstructionGenerator();
        const instructions = generator.generate(testWorkState, 'manual');
        const pass =
          instructions.includes('Resume Instructions') &&
          instructions.includes('Next Steps');
        console.log(`${pass ? '✅' : '❌'} Test 12: Generate resume instructions with sections`);
        if (pass) passCount++;
      } catch (error: any) {
        console.log(`❌ Test 12: Generate instructions - ${error.message}`);
      }
    }

    // Cleanup
    try {
      await pool.query('DELETE FROM checkpoints WHERE instance_id = $1', [testInstanceId]);
    } catch (e) {
      // Ignore cleanup errors
    }

    // Summary
    console.log('\n==================================');
    console.log(`RESULTS: ${passCount}/${totalTests} tests passed`);
    console.log('==================================\n');

    if (passCount === totalTests) {
      console.log('SUCCESS: All functional tests passed!');
      process.exit(0);
    } else {
      console.log(`WARNING: ${totalTests - passCount} test(s) failed`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

runTests();
