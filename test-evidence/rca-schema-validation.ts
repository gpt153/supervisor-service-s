/**
 * Validation script for RCA & Fix tables
 * Verifies database schema is correct
 */

import { pool } from '../src/db/client.js';

async function validateSchema() {
  console.log('Validating RCA & Fix database schema...\n');

  try {
    // Check root_cause_analyses table
    const rcaCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'root_cause_analyses'
      ORDER BY ordinal_position
    `);

    if (rcaCheck.rows.length === 0) {
      console.log('❌ root_cause_analyses table not found');
      console.log('   Run migration: npm run migrate:up');
    } else {
      console.log('✅ root_cause_analyses table exists');
      console.log(`   Columns: ${rcaCheck.rows.length}`);
    }

    // Check fix_attempts table
    const attemptsCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'fix_attempts'
      ORDER BY ordinal_position
    `);

    if (attemptsCheck.rows.length === 0) {
      console.log('❌ fix_attempts table not found');
    } else {
      console.log('✅ fix_attempts table exists');
      console.log(`   Columns: ${attemptsCheck.rows.length}`);
    }

    // Check fix_learnings table
    const learningsCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'fix_learnings'
      ORDER BY ordinal_position
    `);

    if (learningsCheck.rows.length === 0) {
      console.log('❌ fix_learnings table not found');
    } else {
      console.log('✅ fix_learnings table exists');
      console.log(`   Columns: ${learningsCheck.rows.length}`);
    }

    console.log('\n✅ Schema validation complete');

  } catch (error) {
    console.error('❌ Validation failed:', error);
  } finally {
    await pool.end();
  }
}

validateSchema();
