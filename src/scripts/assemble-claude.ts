#!/usr/bin/env tsx

/**
 * Assembly script for generating CLAUDE.md from layered instructions
 *
 * Usage:
 *   npm run assemble              # Generate CLAUDE.md in current directory
 *   tsx src/scripts/assemble-claude.ts --output /path/to/CLAUDE.md
 *   tsx src/scripts/assemble-claude.ts --preserve-project
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { InstructionAssembler } from '../instructions/InstructionAssembler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CliArgs {
  output?: string;
  preserveProject?: boolean;
  verbose?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    switch (arg) {
      case '--output':
      case '-o':
        args.output = process.argv[++i];
        break;
      case '--preserve-project':
      case '-p':
        args.preserveProject = true;
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
CLAUDE.md Assembly Script

Usage:
  npm run assemble              # Generate CLAUDE.md in supervisor-service/
  tsx src/scripts/assemble-claude.ts [options]

Options:
  -o, --output <path>          Output path for CLAUDE.md (default: ./CLAUDE.md)
  -p, --preserve-project       Preserve project-specific sections
  -v, --verbose                Verbose output
  -h, --help                   Show this help message

Examples:
  # Generate with defaults
  npm run assemble

  # Generate to specific location
  tsx src/scripts/assemble-claude.ts -o /path/to/CLAUDE.md

  # Preserve project-specific content
  tsx src/scripts/assemble-claude.ts --preserve-project

  # Verbose mode
  tsx src/scripts/assemble-claude.ts --verbose
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  // Determine base path (supervisor-service root)
  const basePath = resolve(__dirname, '../..');

  // Determine output path
  const outputPath = args.output
    ? resolve(args.output)
    : resolve(basePath, 'CLAUDE.md');

  if (args.verbose) {
    console.log('Assembly Configuration:');
    console.log('  Base Path:', basePath);
    console.log('  Output Path:', outputPath);
    console.log('  Preserve Project:', args.preserveProject ?? false);
    console.log();
  }

  try {
    const assembler = new InstructionAssembler(basePath);

    console.log('Assembling CLAUDE.md...');

    const result = await assembler.assembleAndWrite(outputPath, {
      preserveProjectSpecific: args.preserveProject,
      includeMetadata: true,
    });

    console.log('✓ CLAUDE.md generated successfully');
    console.log(`  Location: ${outputPath}`);
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
    console.log('Generated:', result.timestamp.toISOString());
  } catch (error) {
    console.error('✗ Assembly failed:', error);
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

export { main as assembleClaude };
