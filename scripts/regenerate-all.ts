#!/usr/bin/env tsx

/**
 * Regenerate all CLAUDE.md files in the SV system
 */

import { InstructionAssembler } from '../src/instructions/InstructionAssembler.js';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const SV_ROOT = '/home/samuel/sv';
const EXCLUDED_DIRS = [
  'supervisor-service',
  '.claude',
  'templates',
  'docs',
  '.bmad',
  'node_modules',
  '.git',
];

async function regenerateAll() {
  console.log('🔄 Regenerating all CLAUDE.md files...\n');

  // First, regenerate supervisor-service itself
  console.log('1. supervisor-service (meta)');
  const supervisorServicePath = join(SV_ROOT, 'supervisor-service');
  const supervisorAssembler = new InstructionAssembler(supervisorServicePath);
  const supervisorClaudeMd = join(supervisorServicePath, 'CLAUDE.md');

  await supervisorAssembler.assembleAndWrite(supervisorClaudeMd, {
    preserveProjectSpecific: true,
    includeMetadata: true,
  });
  console.log('   ✅ Regenerated\n');

  // Then regenerate all project supervisors
  const entries = await readdir(SV_ROOT);
  let count = 1;

  for (const entry of entries) {
    if (EXCLUDED_DIRS.includes(entry)) continue;

    const fullPath = join(SV_ROOT, entry);
    const stats = await stat(fullPath);
    if (!stats.isDirectory()) continue;

    const claudeMdPath = join(fullPath, 'CLAUDE.md');
    if (!existsSync(claudeMdPath)) {
      console.log(`${count + 1}. ${entry}`);
      console.log('   ⏭️  No CLAUDE.md found, skipped\n');
      count++;
      continue;
    }

    console.log(`${count + 1}. ${entry}`);
    try {
      const assembler = new InstructionAssembler(fullPath);

      // Extract and preserve project-specific sections
      const projectSections = await assembler.extractProjectSpecific(claudeMdPath);
      if (projectSections.length > 0) {
        await assembler.saveProjectSpecific(projectSections);
        console.log(`   📝 Preserved ${projectSections.length} project-specific sections`);
      }

      // Regenerate
      await assembler.assembleAndWrite(claudeMdPath, {
        preserveProjectSpecific: true,
        includeMetadata: true,
      });

      console.log('   ✅ Regenerated\n');
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    count++;
  }

  console.log('✅ All CLAUDE.md files regenerated!\n');
  console.log('📋 What was updated:');
  console.log('  - Core instructions from .supervisor-core/');
  console.log('  - Including NEW 05-autonomous-supervision.md');
  console.log('  - Meta instructions from .supervisor-meta/ (for supervisor-service)');
  console.log('  - Project-specific sections preserved\n');
  console.log('🚀 Next: Restart supervisor-service to pick up changes');
}

regenerateAll().catch(console.error);
