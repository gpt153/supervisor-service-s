#!/usr/bin/env tsx

/**
 * Initialize Project Supervisors
 *
 * This script initializes or updates CLAUDE.md for all project supervisors.
 * It uses the layered instruction system:
 * - Core instructions from supervisor-service
 * - Project-specific instructions from .supervisor-specific/
 *
 * Usage:
 *   tsx src/scripts/init-project-supervisors.ts [--dry-run] [--project <name>]
 */

import { readdir, stat, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { InstructionAssembler } from '../instructions/InstructionAssembler.js';

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

interface CliArgs {
  dryRun?: boolean;
  project?: string;
  verbose?: boolean;
}

interface InitResult {
  project: string;
  path: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  message?: string;
  sectionsCount?: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    switch (arg) {
      case '--dry-run':
      case '-d':
        args.dryRun = true;
        break;
      case '--project':
      case '-p':
        args.project = process.argv[++i];
        break;
      case '--verbose':
      case '-v':
        args.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
Initialize Project Supervisors

Initializes or updates CLAUDE.md for project supervisors using the layered
instruction system. Creates .supervisor-specific/ directories if needed.

Usage:
  tsx src/scripts/init-project-supervisors.ts [options]

Options:
  -d, --dry-run          Don't write files, just show what would happen
  -p, --project <name>   Only initialize/update specific project
  -v, --verbose          Verbose output
  -h, --help             Show this help message

Projects Processed:
  - All directories in /home/samuel/sv/
  - Excluding: ${EXCLUDED_DIRS.join(', ')}

Examples:
  # Dry run to see what would happen
  tsx src/scripts/init-project-supervisors.ts --dry-run

  # Initialize all projects
  tsx src/scripts/init-project-supervisors.ts

  # Update only consilio
  tsx src/scripts/init-project-supervisors.ts --project consilio

  # Verbose mode
  tsx src/scripts/init-project-supervisors.ts --verbose
`);
}

/**
 * Find all project directories
 */
async function findProjects(): Promise<string[]> {
  const entries = await readdir(SV_ROOT);
  const projects: string[] = [];

  for (const entry of entries) {
    if (EXCLUDED_DIRS.includes(entry)) continue;

    const fullPath = join(SV_ROOT, entry);
    const stats = await stat(fullPath);

    if (!stats.isDirectory()) continue;

    projects.push(entry);
  }

  return projects.sort();
}

/**
 * Initialize or update a single project
 */
async function initProject(
  projectName: string,
  args: CliArgs
): Promise<InitResult> {
  const projectPath = join(SV_ROOT, projectName);
  const claudeMdPath = join(projectPath, 'CLAUDE.md');
  const supervisorSpecificPath = join(projectPath, '.supervisor-specific');

  const result: InitResult = {
    project: projectName,
    path: projectPath,
    status: 'skipped',
  };

  try {
    const claudeMdExists = existsSync(claudeMdPath);
    const supervisorSpecificExists = existsSync(supervisorSpecificPath);

    if (args.verbose) {
      console.log(`  Processing ${projectName}...`);
      console.log(`    CLAUDE.md exists: ${claudeMdExists}`);
      console.log(`    .supervisor-specific exists: ${supervisorSpecificExists}`);
    }

    if (args.dryRun) {
      if (!claudeMdExists) {
        result.status = 'created';
        result.message = 'Would create CLAUDE.md';
      } else {
        result.status = 'updated';
        result.message = 'Would update CLAUDE.md';
      }

      if (!supervisorSpecificExists) {
        result.message += ' and create .supervisor-specific/';
      }

      return result;
    }

    // Create .supervisor-specific if it doesn't exist
    if (!supervisorSpecificExists) {
      await mkdir(supervisorSpecificPath, { recursive: true });

      if (args.verbose) {
        console.log(`    Created .supervisor-specific/ directory`);
      }
    }

    // Create assembler for this project
    const assembler = new InstructionAssembler(projectPath);

    // If CLAUDE.md exists, extract project-specific sections
    let preservedSections: string[] = [];
    if (claudeMdExists) {
      preservedSections = await assembler.extractProjectSpecific(claudeMdPath);

      if (preservedSections.length > 0) {
        await assembler.saveProjectSpecific(preservedSections);

        if (args.verbose) {
          console.log(`    Preserved ${preservedSections.length} project-specific sections`);
        }
      }
    }

    // Assemble and write CLAUDE.md
    const assemblyResult = await assembler.assembleAndWrite(claudeMdPath, {
      preserveProjectSpecific: true,
      includeMetadata: true,
    });

    result.status = claudeMdExists ? 'updated' : 'created';
    result.sectionsCount = assemblyResult.sections.length;
    result.message = `${result.status === 'created' ? 'Created' : 'Updated'} with ${assemblyResult.sections.length} sections`;

    if (preservedSections.length > 0) {
      result.message += ` (preserved ${preservedSections.length} project sections)`;
    }

  } catch (error) {
    result.status = 'failed';
    result.message = error instanceof Error ? error.message : 'Unknown error';
  }

  return result;
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('Initialize Project Supervisors');
  console.log('==============================\n');

  if (args.dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

  // If specific project specified
  if (args.project) {
    console.log(`Processing project: ${args.project}\n`);

    const projectPath = join(SV_ROOT, args.project);
    if (!existsSync(projectPath)) {
      console.error(`❌ Project not found: ${args.project}`);
      process.exit(1);
    }

    const result = await initProject(args.project, args);

    console.log('\nResult:');
    console.log(`  Project: ${result.project}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Message: ${result.message}`);

    if (result.status === 'failed') {
      process.exit(1);
    }

    return;
  }

  // Process all projects
  console.log('Finding projects...');
  const projects = await findProjects();
  console.log(`Found ${projects.length} project(s): ${projects.join(', ')}\n`);

  const results: InitResult[] = [];

  for (const project of projects) {
    const result = await initProject(project, args);
    results.push(result);
  }

  // Print results
  console.log('\nResults:');
  console.log('--------\n');

  const created = results.filter(r => r.status === 'created');
  const updated = results.filter(r => r.status === 'updated');
  const skipped = results.filter(r => r.status === 'skipped');
  const failed = results.filter(r => r.status === 'failed');

  if (created.length > 0) {
    console.log('✓ Created:');
    created.forEach(r => {
      console.log(`  - ${r.project}: ${r.message}`);
    });
    console.log();
  }

  if (updated.length > 0) {
    console.log('✓ Updated:');
    updated.forEach(r => {
      console.log(`  - ${r.project}: ${r.message}`);
    });
    console.log();
  }

  if (skipped.length > 0) {
    console.log('⊘ Skipped:');
    skipped.forEach(r => {
      console.log(`  - ${r.project}: ${r.message}`);
    });
    console.log();
  }

  if (failed.length > 0) {
    console.log('✗ Failed:');
    failed.forEach(r => {
      console.log(`  - ${r.project}: ${r.message}`);
    });
    console.log();
  }

  // Summary
  console.log('Summary:');
  console.log(`  Total: ${results.length}`);
  console.log(`  Created: ${created.length}`);
  console.log(`  Updated: ${updated.length}`);
  console.log(`  Skipped: ${skipped.length}`);
  console.log(`  Failed: ${failed.length}`);

  if (args.dryRun) {
    console.log('\n💡 This was a dry run. Use without --dry-run to actually update files.');
  }

  // Exit with error if any failed
  if (failed.length > 0) {
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

export { main as initProjectSupervisors };
