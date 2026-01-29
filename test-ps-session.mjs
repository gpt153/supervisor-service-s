#!/usr/bin/env node
/**
 * Test PS Session Continuity Integration
 * Simulates what a PS would do when integrated with session continuity
 */

import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection - hardcoded to supervisor_service
const poolConfig = {
  user: 'supervisor',
  host: 'localhost',
  database: 'supervisor_service',
  password: process.env.PGPASSWORD,
  port: 5434,
};

console.log('🔌 Database config:', { ...poolConfig, password: poolConfig.password ? '***' : 'NOT SET' });

const pool = new pg.Pool(poolConfig);

// Utility: Generate instance ID
function generateInstanceId(project, type) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${project}-${type}-${random}`;
}

// Simulate PS Bootstrap workflow
async function testPSSession() {
  const project = 'health-agent';
  let instanceId = null;

  try {
    console.log('🧪 Testing PS Session Continuity Integration\n');
    console.log('=' .repeat(60));

    // STEP 1: Register instance (what bootstrap.initialize() would do)
    console.log('\n📝 STEP 1: Register Instance');
    console.log('-'.repeat(60));

    instanceId = generateInstanceId(project, 'PS');
    console.log(`Generated instance ID: ${instanceId}`);

    const registerResult = await pool.query(
      `INSERT INTO supervisor_sessions (
        instance_id, project, instance_type, status, context_percent,
        created_at, last_heartbeat
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING instance_id, project, status, created_at`,
      [instanceId, project, 'PS', 'active', 0]
    );

    console.log('✅ Registration successful:');
    console.log(`   Instance: ${registerResult.rows[0].instance_id}`);
    console.log(`   Project: ${registerResult.rows[0].project}`);
    console.log(`   Status: ${registerResult.rows[0].status}`);
    console.log(`   Created: ${registerResult.rows[0].created_at}`);

    // STEP 2: Send heartbeat (what bootstrap.updateContext() would do)
    console.log('\n💓 STEP 2: Send Heartbeat');
    console.log('-'.repeat(60));

    const heartbeatResult = await pool.query(
      `UPDATE supervisor_sessions
       SET context_percent = $1, current_epic = $2, last_heartbeat = CURRENT_TIMESTAMP
       WHERE instance_id = $3
       RETURNING context_percent, current_epic, last_heartbeat`,
      [25, 'epic-001', instanceId]
    );

    console.log('✅ Heartbeat sent:');
    console.log(`   Context: ${heartbeatResult.rows[0].context_percent}%`);
    console.log(`   Epic: ${heartbeatResult.rows[0].current_epic}`);
    console.log(`   Timestamp: ${heartbeatResult.rows[0].last_heartbeat}`);

    // STEP 3: Log a command (what bootstrap.logSpawn() would do)
    console.log('\n📋 STEP 3: Log Command');
    console.log('-'.repeat(60));

    const logResult = await pool.query(
      `INSERT INTO command_log (
        instance_id, command_type, action, tool_name, parameters, result, success,
        execution_time_ms, tags, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, action, created_at`,
      [
        instanceId,
        'spawn',
        'spawn_subagent',
        'Task',
        JSON.stringify({ subagent_type: 'general-purpose', model: 'haiku' }),
        JSON.stringify({ success: true, task_id: 'task-123' }),
        true,
        150,
        JSON.stringify(['spawn', 'subagent']),
        'explicit',
      ]
    );

    console.log('✅ Command logged:');
    console.log(`   Log ID: ${logResult.rows[0].id}`);
    console.log(`   Action: ${logResult.rows[0].action}`);
    console.log(`   Timestamp: ${logResult.rows[0].created_at}`);

    // STEP 4: Create checkpoint
    console.log('\n💾 STEP 4: Create Checkpoint');
    console.log('-'.repeat(60));

    const checkpointResult = await pool.query(
      `INSERT INTO checkpoints (
        instance_id, checkpoint_type, sequence_num,
        context_window_percent, work_state, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING checkpoint_id, checkpoint_type, timestamp`,
      [
        instanceId,
        'manual',
        1,
        25,
        JSON.stringify({
          epic: 'epic-001',
          files_modified: ['src/app.ts', 'tests/app.test.ts'],
          git_status: 'clean',
        }),
        JSON.stringify({ trigger: 'manual_test', note: 'Testing checkpoint' }),
      ]
    );

    console.log('✅ Checkpoint created:');
    console.log(`   Checkpoint ID: ${checkpointResult.rows[0].checkpoint_id}`);
    console.log(`   Type: ${checkpointResult.rows[0].checkpoint_type}`);
    console.log(`   Timestamp: ${checkpointResult.rows[0].timestamp}`);

    // STEP 5: Emit event
    console.log('\n📡 STEP 5: Emit Event');
    console.log('-'.repeat(60));

    const eventResult = await pool.query(
      `INSERT INTO event_store (
        instance_id, event_type, sequence_num, event_data, metadata
      )
      SELECT $1::varchar, $2, COALESCE(MAX(sequence_num), 0) + 1, $3::jsonb, $4::jsonb
      FROM event_store WHERE instance_id = $1::varchar
      RETURNING event_id, event_type, sequence_num, timestamp`,
      [
        instanceId,
        'epic_started',
        JSON.stringify({ epic_id: 'epic-001', epic_name: 'Test Epic' }),
        JSON.stringify({ source: 'test' }),
      ]
    );

    console.log('✅ Event emitted:');
    console.log(`   Event ID: ${eventResult.rows[0].event_id}`);
    console.log(`   Type: ${eventResult.rows[0].event_type}`);
    console.log(`   Sequence: ${eventResult.rows[0].sequence_num}`);

    // STEP 6: Query current state
    console.log('\n🔍 STEP 6: Query Current State');
    console.log('-'.repeat(60));

    const stateResult = await pool.query(
      `SELECT
        s.instance_id,
        s.project,
        s.status,
        s.context_percent,
        s.current_epic,
        s.created_at,
        s.last_heartbeat,
        (SELECT COUNT(*) FROM command_log WHERE instance_id = s.instance_id) as command_count,
        (SELECT COUNT(*) FROM checkpoints WHERE instance_id = s.instance_id) as checkpoint_count,
        (SELECT COUNT(*) FROM event_store WHERE instance_id = s.instance_id) as event_count
       FROM supervisor_sessions s
       WHERE s.instance_id = $1`,
      [instanceId]
    );

    const state = stateResult.rows[0];
    console.log('✅ Current state:');
    console.log(`   Instance: ${state.instance_id}`);
    console.log(`   Project: ${state.project}`);
    console.log(`   Status: ${state.status}`);
    console.log(`   Context: ${state.context_percent}%`);
    console.log(`   Epic: ${state.current_epic}`);
    console.log(`   Age: ${Math.floor((Date.now() - new Date(state.created_at).getTime()) / 1000)}s`);
    console.log(`   Commands logged: ${state.command_count}`);
    console.log(`   Checkpoints: ${state.checkpoint_count}`);
    console.log(`   Events: ${state.event_count}`);

    // STEP 7: Simulate footer output
    console.log('\n📊 STEP 7: Generate Footer');
    console.log('-'.repeat(60));

    const ageHours = ((Date.now() - new Date(state.created_at).getTime()) / (1000 * 60 * 60)).toFixed(1);
    const footer = `
────────────────────────────────────────
Instance: ${state.instance_id} | Epic: ${state.current_epic || '—'} | Context: ${state.context_percent}% | Active: ${ageHours}h
[Use "resume ${state.instance_id}" to restore this session]
`;

    console.log('✅ Footer generated:');
    console.log(footer);

    // STEP 8: Test resume query
    console.log('\n🔄 STEP 8: Test Resume Query');
    console.log('-'.repeat(60));

    const resumeResult = await pool.query(
      `SELECT
        s.instance_id,
        s.project,
        s.current_epic,
        s.context_percent,
        s.last_heartbeat,
        s.created_at,
        c.checkpoint_id,
        c.work_state,
        (SELECT json_agg(json_build_object('action', action, 'timestamp', created_at)
                         ORDER BY created_at DESC)
         FROM (SELECT action, created_at FROM command_log
               WHERE instance_id = s.instance_id
               ORDER BY created_at DESC LIMIT 5) recent) as recent_commands
       FROM supervisor_sessions s
       LEFT JOIN LATERAL (
         SELECT checkpoint_id, work_state
         FROM checkpoints
         WHERE instance_id = s.instance_id
         ORDER BY timestamp DESC LIMIT 1
       ) c ON true
       WHERE s.instance_id = $1`,
      [instanceId]
    );

    const resume = resumeResult.rows[0];
    console.log('✅ Resume data retrieved:');
    console.log(`   Instance: ${resume.instance_id}`);
    console.log(`   Project: ${resume.project}`);
    console.log(`   Latest checkpoint: ${resume.checkpoint_id}`);
    console.log(`   Recent commands: ${resume.recent_commands ? resume.recent_commands.length : 0}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    console.log('\n🎯 Summary:');
    console.log(`   ✅ Instance registered: ${instanceId}`);
    console.log(`   ✅ Heartbeat tracking: Working`);
    console.log(`   ✅ Command logging: Working`);
    console.log(`   ✅ Checkpoints: Working`);
    console.log(`   ✅ Events: Working`);
    console.log(`   ✅ Resume data: Available`);

    console.log('\n📝 Next Steps:');
    console.log('   1. Integrate these calls into health-agent PS');
    console.log('   2. Replace fake footer with real database-backed footer');
    console.log('   3. Implement resume command handler');
    console.log('   4. Test full resume workflow');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await pool.query('DELETE FROM supervisor_sessions WHERE instance_id = $1', [instanceId]);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);

    // Cleanup on error
    if (instanceId) {
      try {
        await pool.query('DELETE FROM supervisor_sessions WHERE instance_id = $1', [instanceId]);
        console.log('🧹 Test data cleaned up after error');
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError.message);
      }
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run test
testPSSession();
