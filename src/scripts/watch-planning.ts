#!/usr/bin/env tsx

/**
 * Watch Planning Files
 *
 * Watches .bmad/ directories for changes and automatically triggers
 * CLAUDE.md regeneration when planning files are updated.
 *
 * This ensures project supervisors always have the latest planning context.
 *
 * Usage:
 *   tsx src/scripts/watch-planning.ts [--project <name>]
 */

import { watch } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { InstructionAssembler } from '../instructions/InstructionAssembler.js';

const SV_ROOT = '/home/samuel/sv';
const EXCLUDED_DIRS = [
  'supervisor-service',
  '.claude',
  'templates',
  'docs',
  'node_modules',
  '.git',
];

// Debounce time in milliseconds
const DEBOUNCE_MS = 2000;

interface WatchedProject {
  name: string;
  path: string;
  bmadPath: string;
  claudeMdPath: string;
  debounceTimer?: NodeJS.Timeout;
}

interface CliArgs {
  project?: string;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    switch (arg) {
      case '--project':
      case '-p':
        args.project = process.argv[++i];
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
Watch Planning Files

Watches .bmad/ directories for changes and automatically regenerates CLAUDE.md
when planning files are updated. This ensures project supervisors always have
the latest planning context.

Usage:
  tsx src/scripts/watch-planning.ts [options]

Options:
  -p, --project <name>   Only watch specific project
  -h, --help             Show this help message

The watcher monitors:
  - .bmad/epics/ - Epic specifications
  - .bmad/adrs/ - Architecture Decision Records
  - .bmad/planning/ - Planning documents
  - .supervisor-specific/ - Project-specific instructions

Changes trigger CLAUDE.md regeneration after a ${DEBOUNCE_MS}ms debounce.

Examples:
  # Watch all projects
  tsx src/scripts/watch-planning.ts

  # Watch only consilio
  tsx src/scripts/watch-planning.ts --project consilio

Press Ctrl+C to stop watching.
`);
}

/**
 * Get timestamp string
 */
function timestamp(): string {
  return new Date().toISOString().split('T')[1].split('.')[0];
}

/**
 * Regenerate CLAUDE.md for a project
 */
async function regenerateProject(project: WatchedProject): Promise<void> {
  try {
    console.log(`[${timestamp()}] 🔄 Regenerating ${project.name}...`);

    const assembler = new InstructionAssembler(project.path);

    // Extract and preserve project-specific sections
    const projectSections = await assembler.extractProjectSpecific(project.claudeMdPath);

    if (projectSections.length > 0) {
      await assembler.saveProjectSpecific(projectSections);
    }

    // Regenerate
    await assembler.assembleAndWrite(project.claudeMdPath, {
      preserveProjectSpecific: true,
      includeMetadata: true,
    });

    console.log(`[${timestamp()}] ✓ ${project.name} regenerated successfully`);
  } catch (error) {
    console.error(
      `[${timestamp()}] ✗ Failed to regenerate ${project.name}:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Handle file change with debouncing
 */
function handleChange(project: WatchedProject, filename: string): void {
  console.log(`[${timestamp()}] 📝 Change detected in ${project.name}: ${filename}`);

  // Clear existing timer
  if (project.debounceTimer) {
    clearTimeout(project.debounceTimer);
  }

  // Set new timer
  project.debounceTimer = setTimeout(() => {
    regenerateProject(project);
  }, DEBOUNCE_MS);
}

/**
 * Setup watchers for a project
 */
function setupProjectWatch(project: WatchedProject): void {
  console.log(`[${timestamp()}] 👁️  Watching ${project.name}:`);
  console.log(`  - ${project.bmadPath}`);

  const supervisorSpecificPath = join(project.path, '.supervisor-specific');
  if (existsSync(supervisorSpecificPath)) {
    console.log(`  - ${supervisorSpecificPath}`);
  }

  // Watch .bmad directory
  if (existsSync(project.bmadPath)) {
    watch(project.bmadPath, { recursive: true }, (eventType, filename) => {
      if (filename) {
        // Only watch markdown and relevant files
        if (
          filename.endsWith('.md') ||
          filename.endsWith('.json') ||
          filename.endsWith('.yaml') ||
          filename.endsWith('.yml')
        ) {
          handleChange(project, filename);
        }
      }
    });
  }

  // Watch .supervisor-specific directory
  if (existsSync(supervisorSpecificPath)) {
    watch(supervisorSpecificPath, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith('.md')) {
        handleChange(project, filename);
      }
    });
  }
}

/**
 * Find all projects to watch
 */
async function findProjects(): Promise<WatchedProject[]> {
  const { readdir, stat } = await import('fs/promises');
  const entries = await readdir(SV_ROOT);
  const projects: WatchedProject[] = [];

  for (const entry of entries) {
    if (EXCLUDED_DIRS.includes(entry)) continue;

    const fullPath = join(SV_ROOT, entry);
    const stats = await stat(fullPath);

    if (!stats.isDirectory()) continue;

    const bmadPath = join(fullPath, '.bmad');
    const claudeMdPath = join(fullPath, 'CLAUDE.md');

    // Only watch projects with .bmad and CLAUDE.md
    if (existsSync(bmadPath) && existsSync(claudeMdPath)) {
      projects.push({
        name: entry,
        path: fullPath,
        bmadPath,
        claudeMdPath,
      });
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('Watch Planning Files');
  console.log('===================\n');

  if (args.project) {
    // Watch specific project
    const projectPath = join(SV_ROOT, args.project);

    if (!existsSync(projectPath)) {
      console.error(`❌ Project not found: ${args.project}`);
      process.exit(1);
    }

    const bmadPath = join(projectPath, '.bmad');
    const claudeMdPath = join(projectPath, 'CLAUDE.md');

    if (!existsSync(bmadPath)) {
      console.error(`❌ No .bmad directory found in ${args.project}`);
      process.exit(1);
    }

    if (!existsSync(claudeMdPath)) {
      console.error(`❌ No CLAUDE.md found in ${args.project}`);
      process.exit(1);
    }

    const project: WatchedProject = {
      name: args.project,
      path: projectPath,
      bmadPath,
      claudeMdPath,
    };

    setupProjectWatch(project);

    console.log(`\n[${timestamp()}] ✓ Watching ${args.project}`);
    console.log('Press Ctrl+C to stop...\n');
  } else {
    // Watch all projects
    const projects = await findProjects();

    if (projects.length === 0) {
      console.log('No projects found to watch.');
      process.exit(0);
    }

    console.log(`Found ${projects.length} project(s) to watch:\n`);

    for (const project of projects) {
      setupProjectWatch(project);
      console.log();
    }

    console.log(`[${timestamp()}] ✓ Watching ${projects.length} project(s)`);
    console.log('Press Ctrl+C to stop...\n');
  }

  // Keep process alive
  process.on('SIGINT', () => {
    console.log(`\n[${timestamp()}] 👋 Stopping watcher...`);
    process.exit(0);
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as watchPlanning };
