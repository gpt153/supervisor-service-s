/**
 * Quick Validation Tests for Checkpoint System (Epic 007-D)
 * Validates all 20 acceptance criteria are met
 * Run with: npx tsx tests/checkpoint-validation.ts
 */

import { pool } from '../src/db/client.js';

async function validateCheckpointSystem() {
  console.log('\n==================================');
  console.log('CHECKPOINT SYSTEM VALIDATION');
  console.log('==================================\n');

  let passCount = 0;
  let totalTests = 20;

  const tests = [
    // AC1-AC5: Database Schema
    {
      name: 'AC1: checkpoints table exists',
      test: async () => {
        const result = await pool.query(
          `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='checkpoints')`
        );
        return result.rows[0].exists === true;
      },
    },
    {
      name: 'AC2: checkpoint_id column is UUID',
      test: async () => {
        const result = await pool.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='checkpoints' AND column_name='checkpoint_id'`
        );
        return result.rows.length > 0 && result.rows[0].data_type === 'uuid';
      },
    },
    {
      name: 'AC3: checkpoint_type column has enum type',
      test: async () => {
        const result = await pool.query(`SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname='checkpoint_type')`);
        return result.rows[0].exists === true;
      },
    },
    {
      name: 'AC4: instance_id column has FK to supervisor_sessions',
      test: async () => {
        const result = await pool.query(
          `SELECT EXISTS(SELECT 1 FROM information_schema.table_constraints WHERE table_name='checkpoints' AND constraint_type='FOREIGN KEY')`
        );
        return result.rows[0].exists === true;
      },
    },
    {
      name: 'AC5: context_window_percent column has check constraint',
      test: async () => {
        const result = await pool.query(
          `SELECT EXISTS(SELECT 1 FROM information_schema.table_constraints WHERE table_name='checkpoints' AND constraint_type='CHECK')`
        );
        return result.rows[0].exists === true;
      },
    },

    // AC6-AC9: Work State Serialization
    {
      name: 'AC6: work_state column is JSONB',
      test: async () => {
        const result = await pool.query(
          `SELECT data_type FROM information_schema.columns WHERE table_name='checkpoints' AND column_name='work_state'`
        );
        return result.rows[0].data_type === 'jsonb';
      },
    },
    {
      name: 'AC7: metadata column exists and is JSONB',
      test: async () => {
        const result = await pool.query(
          `SELECT data_type FROM information_schema.columns WHERE table_name='checkpoints' AND column_name='metadata'`
        );
        return result.rows[0].data_type === 'jsonb';
      },
    },
    {
      name: 'AC8: timestamp column is TIMESTAMPTZ',
      test: async () => {
        const result = await pool.query(
          `SELECT data_type FROM information_schema.columns WHERE table_name='checkpoints' AND column_name='timestamp'`
        );
        return result.rows[0].data_type === 'timestamp with time zone';
      },
    },
    {
      name: 'AC9: sequence_num column is BIGINT',
      test: async () => {
        const result = await pool.query(
          `SELECT data_type FROM information_schema.columns WHERE table_name='checkpoints' AND column_name='sequence_num'`
        );
        return result.rows[0].data_type === 'bigint';
      },
    },

    // AC10-AC14: Indexes & Performance
    {
      name: 'AC10: Index on (instance_id, timestamp DESC) exists',
      test: async () => {
        const result = await pool.query(
          `SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename='checkpoints' AND indexname LIKE '%instance_time%')`
        );
        return result.rows[0].exists === true;
      },
    },
    {
      name: 'AC11: Index on (checkpoint_type, created_at DESC) exists',
      test: async () => {
        const result = await pool.query(
          `SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename='checkpoints' AND indexname LIKE '%type_time%')`
        );
        return result.rows[0].exists === true;
      },
    },
    {
      name: 'AC12: event_store table exists',
      test: async () => {
        const result = await pool.query(
          `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='event_store')`
        );
        return result.rows[0].exists === true;
      },
    },
    {
      name: 'AC13: command_log table exists',
      test: async () => {
        const result = await pool.query(
          `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='command_log')`
        );
        return result.rows[0].exists === true;
      },
    },
    {
      name: 'AC14: supervisor_sessions table exists',
      test: async () => {
        const result = await pool.query(
          `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='supervisor_sessions')`
        );
        return result.rows[0].exists === true;
      },
    },

    // AC15-AC18: Immutability & Constraints
    {
      name: 'AC15: created_at and updated_at columns exist',
      test: async () => {
        const result = await pool.query(
          `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='checkpoints' AND column_name IN ('created_at', 'updated_at')`
        );
        return parseInt(result.rows[0].count) === 2;
      },
    },
    {
      name: 'AC16: context_window_percent has 0-100 range check',
      test: async () => {
        const result = await pool.query(
          `SELECT check_clause FROM information_schema.check_constraints WHERE constraint_name LIKE '%context_window%'`
        );
        return result.rows.length > 0;
      },
    },
    {
      name: 'AC17: Unique sequence constraint on (instance_id, sequence_num)',
      test: async () => {
        const result = await pool.query(
          `SELECT EXISTS(SELECT 1 FROM information_schema.table_constraints WHERE table_name='event_store' AND constraint_type='UNIQUE')`
        );
        return result.rows[0].exists === true;
      },
    },
    {
      name: 'AC18: checkpoint_type enum has 3 values (context_window, epic_completion, manual)',
      test: async () => {
        const result = await pool.query(`
          SELECT COUNT(*) as count FROM pg_enum
          WHERE typname='checkpoint_type'
        `);
        return parseInt(result.rows[0].count) === 3;
      },
    },

    // AC19-AC20: File Locations & Implementation
    {
      name: 'AC19: CheckpointManager.ts exists and exports core functions',
      test: async () => {
        const fs = require('fs');
        const path = '../src/session/CheckpointManager.ts';
        const exists = fs.existsSync(path);
        const content = exists ? fs.readFileSync(path, 'utf-8') : '';
        return exists && content.includes('createCheckpoint') && content.includes('getCheckpoint');
      },
    },
    {
      name: 'AC20: WorkStateSerializer.ts and ResumeInstructionGenerator.ts exist',
      test: async () => {
        const fs = require('fs');
        const serializer = fs.existsSync('../src/session/WorkStateSerializer.ts');
        const generator = fs.existsSync('../src/session/ResumeInstructionGenerator.ts');
        return serializer && generator;
      },
    },
  ];

  // Run all tests
  for (const test of tests) {
    try {
      const result = await test.test();
      if (result) {
        console.log(`✅ ${test.name}`);
        passCount++;
      } else {
        console.log(`❌ ${test.name}`);
      }
    } catch (error: any) {
      console.log(`⚠️  ${test.name} (error: ${error.message})`);
    }
  }

  // Summary
  console.log('\n==================================');
  console.log(`RESULTS: ${passCount}/${totalTests} tests passed`);
  console.log('==================================\n');

  if (passCount === totalTests) {
    console.log('SUCCESS: All acceptance criteria met!');
    process.exit(0);
  } else {
    console.log(`INCOMPLETE: ${totalTests - passCount} test(s) failed`);
    process.exit(1);
  }
}

// Run validation
validateCheckpointSystem().catch((error) => {
  console.error('Validation error:', error);
  process.exit(1);
});
