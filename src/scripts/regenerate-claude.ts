#!/usr/bin/env tsx

/**
 * Regenerate CLAUDE.md while preserving project-specific sections
 *
 * This script:
 * 1. Extracts project-specific sections from existing CLAUDE.md
 * 2. Saves them to .claude-specific/
 * 3. Reassembles CLAUDE.md with core + meta + project layers
 *
 * Usage:
 *   npm run regenerate            # Regenerate CLAUDE.md in current directory
 *   tsx src/scripts/regenerate-claude.ts --target /path/to/CLAUDE.md
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { InstructionAssembler } from '../instructions/InstructionAssembler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CliArgs {
  target?: string;
  verbose?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    switch (arg) {
      case '--target':
      case '-t':
        args.target = process.argv[++i];
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
CLAUDE.md Regeneration Script

This script regenerates CLAUDE.md while preserving project-specific sections.

Usage:
  npm run regenerate              # Regenerate CLAUDE.md in supervisor-service/
  tsx src/scripts/regenerate-claude.ts [options]

Options:
  -t, --target <path>            Path to CLAUDE.md to regenerate (default: ./CLAUDE.md)
  -v, --verbose                  Verbose output
  -h, --help                     Show this help message

Examples:
  # Regenerate with defaults
  npm run regenerate

  # Regenerate specific file
  tsx src/scripts/regenerate-claude.ts -t /path/to/CLAUDE.md

  # Verbose mode
  tsx src/scripts/regenerate-claude.ts --verbose
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  // Determine base path (supervisor-service root)
  const basePath = resolve(__dirname, '../..');

  // Determine target path
  const targetPath = args.target
    ? resolve(args.target)
    : resolve(basePath, 'CLAUDE.md');

  if (args.verbose) {
    console.log('Regeneration Configuration:');
    console.log('  Base Path:', basePath);
    console.log('  Target Path:', targetPath);
    console.log();
  }

  // Check if target exists
  if (!existsSync(targetPath)) {
    console.warn(`Warning: ${targetPath} does not exist.`);
    console.log('Creating new CLAUDE.md...');
  }

  try {
    const assembler = new InstructionAssembler(basePath);

    console.log('Regenerating CLAUDE.md...');

    // Extract project-specific sections
    console.log('  1. Extracting project-specific sections...');
    const projectSections = await assembler.extractProjectSpecific(targetPath);

    if (projectSections.length > 0) {
      console.log(`     Found ${projectSections.length} project-specific section(s)`);

      if (args.verbose) {
        projectSections.forEach((section, idx) => {
          const preview = section.substring(0, 60).replace(/\n/g, ' ');
          console.log(`       [${idx + 1}] ${preview}...`);
        });
      }

      // Save project-specific sections
      console.log('  2. Saving project-specific sections...');
      await assembler.saveProjectSpecific(projectSections);
      console.log('     Saved to .claude-specific/');
    } else {
      console.log('     No project-specific sections found');
    }

    // Reassemble
    console.log('  3. Reassembling CLAUDE.md...');
    const result = await assembler.assembleAndWrite(targetPath, {
      preserveProjectSpecific: true,
      includeMetadata: true,
    });

    console.log('✓ CLAUDE.md regenerated successfully');
    console.log(`  Location: ${targetPath}`);
    console.log(`  Sections: ${result.sections.length}`);
    console.log(`  Sources: ${result.sources.length}`);

    if (args.verbose) {
      console.log('\nSources:');
      result.sources.forEach(source => {
        console.log(`  - ${source}`);
      });

      console.log('\nSections:');
      result.sections.forEach(section => {
        console.log(`  - [${section.source}] ${section.marker}`);
      });
    }

    console.log();
    console.log('Regenerated:', result.timestamp.toISOString());
  } catch (error) {
    console.error('✗ Regeneration failed:', error);
    if (error instanceof Error) {
      console.error('  Error:', error.message);
      if (args.verbose && error.stack) {
        console.error('  Stack:', error.stack);
      }
    }
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

export { main as regenerateClaude };
