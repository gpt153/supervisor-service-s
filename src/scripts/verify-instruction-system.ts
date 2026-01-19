#!/usr/bin/env tsx

/**
 * Verification script for instruction management system
 *
 * Checks that:
 * 1. All required directories exist
 * 2. Core instruction files are present
 * 3. InstructionAssembler can load and assemble
 * 4. Generated CLAUDE.md is valid
 */

import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { InstructionAssembler } from '../instructions/InstructionAssembler.js';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const BASE_PATH = '/home/samuel/sv/supervisor-service';

const checks: CheckResult[] = [];

function check(name: string, condition: boolean, message: string): void {
  checks.push({ name, passed: condition, message });

  const icon = condition ? '✓' : '✗';
  const status = condition ? 'PASS' : 'FAIL';
  console.log(`${icon} ${status}: ${name}`);
  if (!condition || process.argv.includes('--verbose')) {
    console.log(`  ${message}`);
  }
}

function directoryExists(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log('Instruction System Verification');
  console.log('================================\n');

  // Check 1: Directory structure
  console.log('Checking directory structure...');

  const coreDir = join(BASE_PATH, '.supervisor-core');
  check(
    'Core directory exists',
    directoryExists(coreDir),
    `Expected: ${coreDir}`
  );

  const metaDir = join(BASE_PATH, '.supervisor-meta');
  check(
    'Meta directory exists',
    directoryExists(metaDir),
    `Expected: ${metaDir}`
  );

  const srcInstructionsDir = join(BASE_PATH, 'src', 'instructions');
  check(
    'Source instructions directory exists',
    directoryExists(srcInstructionsDir),
    `Expected: ${srcInstructionsDir}`
  );

  // Check 2: Core instruction files
  console.log('\nChecking core instruction files...');

  const coreFiles = [
    '01-identity.md',
    '02-workflow.md',
    '03-structure.md',
    '04-tools.md',
  ];

  for (const file of coreFiles) {
    const filePath = join(coreDir, file);
    check(
      `Core file: ${file}`,
      fileExists(filePath),
      `Expected: ${filePath}`
    );
  }

  // Check 3: Meta instruction files
  console.log('\nChecking meta instruction files...');

  const metaFiles = [
    '01-meta-focus.md',
    '02-dependencies.md',
    '03-patterns.md',
  ];

  for (const file of metaFiles) {
    const filePath = join(metaDir, file);
    check(
      `Meta file: ${file}`,
      fileExists(filePath),
      `Expected: ${filePath}`
    );
  }

  // Check 4: Source files
  console.log('\nChecking source files...');

  const sourceFiles = [
    'src/instructions/InstructionAssembler.ts',
    'src/types/instruction-types.ts',
    'src/scripts/assemble-claude.ts',
    'src/scripts/regenerate-claude.ts',
  ];

  for (const file of sourceFiles) {
    const filePath = join(BASE_PATH, file);
    check(
      `Source file: ${file}`,
      fileExists(filePath),
      `Expected: ${filePath}`
    );
  }

  // Check 5: Assembly test
  console.log('\nTesting assembly...');

  try {
    const assembler = new InstructionAssembler(BASE_PATH);
    const result = await assembler.assemble({ includeMetadata: true });

    check(
      'Assembly succeeds',
      true,
      `Generated ${result.sections.length} sections from ${result.sources.length} sources`
    );

    check(
      'Content generated',
      result.content.length > 0,
      `Generated ${result.content.length} characters`
    );

    check(
      'Has core sections',
      result.sections.some(s => s.source === 'core'),
      'Found core instruction sections'
    );

    check(
      'Has meta sections',
      result.sections.some(s => s.source === 'meta'),
      'Found meta instruction sections'
    );

    check(
      'Includes metadata',
      result.content.includes('AUTO-GENERATED'),
      'Found metadata header in output'
    );

  } catch (error) {
    check(
      'Assembly succeeds',
      false,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  // Check 6: Generated CLAUDE.md
  console.log('\nChecking generated CLAUDE.md...');

  const claudeMdPath = join(BASE_PATH, 'CLAUDE.md');
  const claudeMdExists = fileExists(claudeMdPath);

  check(
    'CLAUDE.md exists',
    claudeMdExists,
    `Expected: ${claudeMdPath}`
  );

  if (claudeMdExists) {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(claudeMdPath, 'utf-8');

      check(
        'CLAUDE.md has content',
        content.length > 0,
        `File size: ${content.length} characters`
      );

      check(
        'CLAUDE.md has metadata header',
        content.includes('AUTO-GENERATED'),
        'Found auto-generation marker'
      );

      check(
        'CLAUDE.md has core content',
        content.includes('Supervisor Identity') || content.includes('Meta Supervisor'),
        'Found core instruction content'
      );

    } catch (error) {
      check(
        'CLAUDE.md is readable',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // Summary
  console.log('\n================================');
  console.log('Summary\n');

  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;
  const total = checks.length;

  console.log(`Total checks: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✓ All checks passed! Instruction system is ready.');
    process.exit(0);
  } else {
    console.log('\n✗ Some checks failed. Review errors above.');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as verifyInstructionSystem };
