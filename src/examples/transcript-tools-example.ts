/**
 * Example usage of TranscriptFileService and transcript MCP tools
 * Epic 009-C: Transcript Lookup Tools
 *
 * This example demonstrates:
 * 1. Using TranscriptFileService to read transcript metadata
 * 2. Listing project sessions
 * 3. Reading head/tail of transcript files
 * 4. Using MCP tools for database-backed lookups
 */

import { TranscriptFileService } from '../session/TranscriptFileService.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Example 1: Basic file service usage
 */
async function example1_BasicFileService() {
  console.log('\n=== Example 1: Basic File Service Usage ===\n');

  const service = new TranscriptFileService();

  // Create a temporary test file
  const tempDir = path.join(os.tmpdir(), 'transcript-example');
  const testFile = path.join(tempDir, 'test.jsonl');

  try {
    await fs.mkdir(tempDir, { recursive: true });

    // Create a sample transcript
    const sampleMessages = [
      { role: 'user', content: 'Hello, how are you?' },
      { role: 'assistant', content: 'I am doing well, thank you for asking!' },
      { role: 'user', content: 'Can you help me with TypeScript?' },
      { role: 'assistant', content: 'Of course! What would you like to know about TypeScript?' },
    ];

    const content = sampleMessages.map((m) => JSON.stringify(m)).join('\n') + '\n';
    await fs.writeFile(testFile, content);

    // Get file metadata
    const metadata = await service.getFileMetadata(testFile);
    console.log('File Metadata:');
    console.log(`  Path: ${testFile}`);
    console.log(`  Exists: ${metadata.exists}`);
    console.log(`  Size: ${metadata.size_human}`);
    console.log(`  Modified: ${metadata.modified_at.toISOString()}`);
    console.log(`  Estimated Lines: ${metadata.line_count}`);

    // Read head and tail
    const summary = await service.readHeadTail(testFile, 2, 2);
    console.log('\nTranscript Summary:');
    console.log(`  Total Lines: ${summary.total_lines}`);
    console.log('\n  Head:');
    summary.head.forEach((line) => {
      console.log(`    Line ${line.line}: [${line.role}] ${line.content_preview.substring(0, 50)}`);
    });
    console.log('\n  Tail:');
    summary.tail.forEach((line) => {
      console.log(`    Line ${line.line}: [${line.role}] ${line.content_preview.substring(0, 50)}`);
    });
  } finally {
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Example 2: Format size examples
 */
function example2_FormatSize() {
  console.log('\n=== Example 2: Size Formatting ===\n');

  const service = new TranscriptFileService();

  const sizes = [100, 1024, 1024 * 10, 1024 * 1024, 1024 * 1024 * 5, 1024 * 1024 * 1024];

  console.log('Size formatting examples:');
  sizes.forEach((size) => {
    console.log(`  ${size} bytes = ${service.formatSize(size)}`);
  });
}

/**
 * Example 3: Path resolution
 */
function example3_PathResolution() {
  console.log('\n=== Example 3: Path Resolution ===\n');

  const service = new TranscriptFileService();

  const projects = ['odin', 'consilio', 'openhorizon'];
  const uuid = 'abc123-def456-ghi789';

  console.log(`Resolving paths for UUID: ${uuid}\n`);

  projects.forEach((project) => {
    const resolvedPath = service.resolvePath(project, uuid);
    console.log(`  ${project}: ${resolvedPath}`);
  });
}

/**
 * Example 4: Machine detection
 */
function example4_MachineDetection() {
  console.log('\n=== Example 4: Machine Detection ===\n');

  const service = new TranscriptFileService();

  const currentMachine = service.getCurrentMachine();
  console.log(`Current machine: ${currentMachine}`);

  const machines = ['odin3', 'odin4', 'laptop', 'unknown-machine'];

  console.log('\nHome directories by machine:');
  machines.forEach((machine) => {
    const homeDir = service.getHomeForMachine(machine);
    console.log(`  ${machine}: ${homeDir}`);
  });
}

/**
 * Example 5: Project sessions discovery
 */
async function example5_ProjectSessions() {
  console.log('\n=== Example 5: Project Sessions Discovery ===\n');

  const service = new TranscriptFileService();

  // Create a temporary project directory structure
  const tempDir = path.join(os.tmpdir(), 'claude-projects');
  const projectDir = path.join(tempDir, '.claude', 'projects', 'example-project');

  try {
    await fs.mkdir(projectDir, { recursive: true });

    // Create some sample session files
    const sessionUuids = ['session-001', 'session-002', 'session-003'];
    for (const uuid of sessionUuids) {
      const content = JSON.stringify({
        role: 'user',
        content: `Session ${uuid}`,
      }) + '\n';
      await fs.writeFile(path.join(projectDir, `${uuid}.jsonl`), content);
    }

    // Override HOME for discovery
    const originalHome = process.env.HOME;
    process.env.HOME = tempDir;

    // Discover sessions
    const sessions = await service.listProjectSessions('example-project');

    console.log(`Found ${sessions.length} sessions in example-project:\n`);
    sessions.forEach((session) => {
      console.log(`  ${session.filename}`);
      console.log(`    UUID: ${session.uuid}`);
      console.log(`    Size: ${session.size_human}`);
      console.log(`    Modified: ${session.modified_at.toISOString()}`);
    });

    // Restore HOME
    process.env.HOME = originalHome;
  } finally {
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        TranscriptFileService Examples (Epic 009-C)         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await example1_BasicFileService();
    example2_FormatSize();
    example3_PathResolution();
    example4_MachineDetection();
    await example5_ProjectSessions();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                 All examples completed!                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run examples if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  example1_BasicFileService,
  example2_FormatSize,
  example3_PathResolution,
  example4_MachineDetection,
  example5_ProjectSessions,
};
