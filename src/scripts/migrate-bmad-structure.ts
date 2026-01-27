#!/usr/bin/env node

/**
 * BMAD Structure Migration Tool
 *
 * Converts flat .bmad/ directory structure to feature-based organization.
 *
 * Usage:
 *   npm run migrate-bmad -- --project /path/to/project [--dry-run]
 *
 * @example
 *   npm run migrate-bmad -- --project /home/samuel/sv/consilio-s --dry-run
 *   npm run migrate-bmad -- --project /home/samuel/sv/consilio-s
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface ArtifactInfo {
  path: string;
  type: 'feature-request' | 'prd' | 'epic' | 'adr' | 'other';
  feature: string | null;
  filename: string;
}

interface FeatureGroup {
  feature: string;
  artifacts: ArtifactInfo[];
}

interface MigrationReport {
  projectPath: string;
  timestamp: string;
  dryRun: boolean;
  backupPath: string | null;
  featuresCreated: string[];
  artifactsMoved: { from: string; to: string }[];
  errors: string[];
  warnings: string[];
}

interface EpicFrontmatter {
  parent_feature?: string;
  feature?: string;
  title?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const BMAD_DIR = '.bmad';
const FEATURES_DIR = 'features';
const BACKUP_SUFFIX = '.bmad.backup';

const ARTIFACT_PATTERNS = {
  featureRequest: /^FR-(\d{8})-(.+)\.md$/i,
  prd: /^PRD-(\d{8})-(.+)\.md$/i,
  epic: /^(?:epic-)?(\d+)-(.+)\.md$/i,
  adr: /^ADR-(\d+)-(.+)\.md$/i,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if path exists
 */
function exists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read file content safely
 */
function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Write file content safely
 */
function writeFile(filePath: string, content: string): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!exists(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    return false;
  }
}

/**
 * Copy directory recursively
 */
function copyDir(src: string, dest: string): void {
  if (!exists(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }

  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Get all files recursively
 */
function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];

  if (!exists(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Slugify text for feature names
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract frontmatter from markdown file
 */
function extractFrontmatter(content: string): EpicFrontmatter | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatterText = frontmatterMatch[1];
  const frontmatter: EpicFrontmatter = {};

  const lines = frontmatterText.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      if (key === 'parent_feature' || key === 'feature') {
        frontmatter[key] = value.trim();
      } else if (key === 'title') {
        frontmatter.title = value.trim();
      }
    }
  }

  return frontmatter;
}

/**
 * Extract feature from epic title
 */
function extractFeatureFromTitle(content: string): string | null {
  // Try to get first H1 heading
  const h1Match = content.match(/^#\s+(?:Epic:\s*)?(.+)$/m);
  if (h1Match) {
    const title = h1Match[1].trim();
    // Remove epic ID prefix like "001 - " or "Epic 001: "
    const cleanTitle = title.replace(/^(?:Epic\s*)?\d+\s*[-:]\s*/i, '');
    return slugify(cleanTitle);
  }

  return null;
}

// ============================================================================
// Artifact Detection
// ============================================================================

/**
 * Detect artifact type and feature from filename
 */
function detectArtifact(relativePath: string, bmadDir: string): ArtifactInfo | null {
  const filename = path.basename(relativePath);
  const fullPath = path.join(bmadDir, relativePath);

  // Feature request
  const frMatch = filename.match(ARTIFACT_PATTERNS.featureRequest);
  if (frMatch) {
    const [, , slug] = frMatch;
    return {
      path: relativePath,
      type: 'feature-request',
      feature: slug,
      filename,
    };
  }

  // PRD
  const prdMatch = filename.match(ARTIFACT_PATTERNS.prd);
  if (prdMatch) {
    const [, , slug] = prdMatch;
    return {
      path: relativePath,
      type: 'prd',
      feature: slug,
      filename,
    };
  }

  // Epic
  const epicMatch = filename.match(ARTIFACT_PATTERNS.epic);
  if (epicMatch) {
    const [, id, slug] = epicMatch;
    const content = readFile(fullPath);
    let feature = slug;

    if (content) {
      // Try frontmatter first
      const frontmatter = extractFrontmatter(content);
      if (frontmatter?.parent_feature) {
        feature = frontmatter.parent_feature;
      } else if (frontmatter?.feature) {
        feature = frontmatter.feature;
      } else {
        // Try extracting from title
        const titleFeature = extractFeatureFromTitle(content);
        if (titleFeature) {
          feature = titleFeature;
        }
      }
    }

    return {
      path: relativePath,
      type: 'epic',
      feature: slugify(feature),
      filename,
    };
  }

  // ADR
  const adrMatch = filename.match(ARTIFACT_PATTERNS.adr);
  if (adrMatch) {
    const [, id, slug] = adrMatch;
    // ADRs need to be mapped to features via epic references
    // For now, keep feature as slug from filename
    return {
      path: relativePath,
      type: 'adr',
      feature: slug,
      filename,
    };
  }

  return null;
}

/**
 * Scan .bmad directory and group artifacts by feature
 */
function scanArtifacts(bmadDir: string): FeatureGroup[] {
  const files = getAllFiles(bmadDir);
  const artifacts: ArtifactInfo[] = [];

  for (const file of files) {
    const artifact = detectArtifact(file, bmadDir);
    if (artifact) {
      artifacts.push(artifact);
    }
  }

  // Group by feature
  const featureMap = new Map<string, ArtifactInfo[]>();

  for (const artifact of artifacts) {
    if (!artifact.feature) {
      continue;
    }

    const feature = artifact.feature;
    if (!featureMap.has(feature)) {
      featureMap.set(feature, []);
    }
    featureMap.get(feature)!.push(artifact);
  }

  // Convert to array
  const groups: FeatureGroup[] = [];
  for (const [feature, artifacts] of featureMap.entries()) {
    groups.push({ feature, artifacts });
  }

  return groups.sort((a, b) => a.feature.localeCompare(b.feature));
}

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Create backup of .bmad directory
 */
function createBackup(projectPath: string): string {
  const bmadDir = path.join(projectPath, BMAD_DIR);
  const backupDir = path.join(projectPath, BMAD_DIR + BACKUP_SUFFIX);

  if (exists(backupDir)) {
    // Add timestamp to backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDirWithTimestamp = `${backupDir}-${timestamp}`;
    copyDir(bmadDir, backupDirWithTimestamp);
    return backupDirWithTimestamp;
  } else {
    copyDir(bmadDir, backupDir);
    return backupDir;
  }
}

/**
 * Get target path for artifact in feature-based structure
 */
function getTargetPath(artifact: ArtifactInfo, featuresDir: string): string {
  const featureDir = path.join(featuresDir, artifact.feature!);

  switch (artifact.type) {
    case 'feature-request':
      return path.join(featureDir, 'feature-request.md');

    case 'prd':
      return path.join(featureDir, 'prd.md');

    case 'epic': {
      const epicsDir = path.join(featureDir, 'epics');
      return path.join(epicsDir, artifact.filename);
    }

    case 'adr': {
      const adrDir = path.join(featureDir, 'adr');
      return path.join(adrDir, artifact.filename);
    }

    default:
      return path.join(featureDir, artifact.filename);
  }
}

/**
 * Move artifact to feature directory
 */
function moveArtifact(
  artifact: ArtifactInfo,
  bmadDir: string,
  featuresDir: string,
  dryRun: boolean
): { from: string; to: string } | null {
  const sourcePath = path.join(bmadDir, artifact.path);
  const targetPath = getTargetPath(artifact, featuresDir);

  if (dryRun) {
    return { from: sourcePath, to: targetPath };
  }

  try {
    // Create target directory
    const targetDir = path.dirname(targetPath);
    if (!exists(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Copy file (not move, in case of errors)
    fs.copyFileSync(sourcePath, targetPath);

    return { from: sourcePath, to: targetPath };
  } catch (error) {
    console.error(`Error moving ${sourcePath} to ${targetPath}:`, error);
    return null;
  }
}

/**
 * Perform migration
 */
function migrate(projectPath: string, dryRun: boolean): MigrationReport {
  const report: MigrationReport = {
    projectPath,
    timestamp: new Date().toISOString(),
    dryRun,
    backupPath: null,
    featuresCreated: [],
    artifactsMoved: [],
    errors: [],
    warnings: [],
  };

  const bmadDir = path.join(projectPath, BMAD_DIR);
  const featuresDir = path.join(bmadDir, FEATURES_DIR);

  // Validate project path
  if (!exists(projectPath)) {
    report.errors.push(`Project path does not exist: ${projectPath}`);
    return report;
  }

  if (!exists(bmadDir)) {
    report.errors.push(`No .bmad directory found at: ${bmadDir}`);
    return report;
  }

  if (exists(featuresDir)) {
    report.warnings.push(`Features directory already exists: ${featuresDir}`);
  }

  // Create backup
  if (!dryRun) {
    try {
      report.backupPath = createBackup(projectPath);
      console.log(`✓ Backup created: ${report.backupPath}`);
    } catch (error) {
      report.errors.push(`Failed to create backup: ${error}`);
      return report;
    }
  }

  // Scan artifacts
  const featureGroups = scanArtifacts(bmadDir);

  if (featureGroups.length === 0) {
    report.warnings.push('No artifacts found to migrate');
    return report;
  }

  console.log(`\nFound ${featureGroups.length} feature(s):\n`);

  // Migrate each feature group
  for (const group of featureGroups) {
    console.log(`  ${group.feature} (${group.artifacts.length} artifact(s))`);

    const featureDir = path.join(featuresDir, group.feature);

    // Create feature directory
    if (!dryRun && !exists(featureDir)) {
      fs.mkdirSync(featureDir, { recursive: true });
    }

    report.featuresCreated.push(group.feature);

    // Move artifacts
    for (const artifact of group.artifacts) {
      const result = moveArtifact(artifact, bmadDir, featuresDir, dryRun);
      if (result) {
        report.artifactsMoved.push(result);
        console.log(`    ${dryRun ? '[DRY]' : '✓'} ${artifact.type}: ${artifact.filename}`);
      } else {
        report.errors.push(`Failed to move: ${artifact.path}`);
      }
    }
  }

  return report;
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate migration report file
 */
function generateReportFile(report: MigrationReport, projectPath: string): void {
  const reportPath = path.join(
    projectPath,
    BMAD_DIR,
    'reports',
    `migration-${Date.now()}.md`
  );

  const content = `# BMAD Structure Migration Report

**Project**: ${report.projectPath}
**Timestamp**: ${report.timestamp}
**Mode**: ${report.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}
**Backup**: ${report.backupPath || 'N/A'}

---

## Summary

- **Features Created**: ${report.featuresCreated.length}
- **Artifacts Moved**: ${report.artifactsMoved.length}
- **Errors**: ${report.errors.length}
- **Warnings**: ${report.warnings.length}

---

## Features Created

${report.featuresCreated.map(f => `- \`${f}\``).join('\n')}

---

## Artifacts Moved

${report.artifactsMoved.map(m => {
  const from = path.relative(report.projectPath, m.from);
  const to = path.relative(report.projectPath, m.to);
  return `- \`${from}\` → \`${to}\``;
}).join('\n')}

${report.errors.length > 0 ? `
---

## Errors

${report.errors.map(e => `- ${e}`).join('\n')}
` : ''}

${report.warnings.length > 0 ? `
---

## Warnings

${report.warnings.map(w => `- ${w}`).join('\n')}
` : ''}

---

## Next Steps

${report.dryRun ? `
1. Review this report
2. Run migration without \`--dry-run\` flag to execute
` : `
1. Verify moved artifacts at \`.bmad/features/\`
2. Update any references to old paths
3. Delete backup after verification: \`${report.backupPath}\`
4. Commit changes to git
`}
`;

  writeFile(reportPath, content);
  console.log(`\n✓ Report saved: ${reportPath}`);
}

/**
 * Print migration summary
 */
function printSummary(report: MigrationReport): void {
  console.log('\n' + '='.repeat(70));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(70));

  console.log(`\nMode: ${report.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  console.log(`Project: ${report.projectPath}`);

  if (report.backupPath) {
    console.log(`Backup: ${report.backupPath}`);
  }

  console.log(`\nFeatures: ${report.featuresCreated.length}`);
  console.log(`Artifacts: ${report.artifactsMoved.length}`);

  if (report.errors.length > 0) {
    console.log(`\n⚠️  Errors: ${report.errors.length}`);
    report.errors.forEach(e => console.log(`   - ${e}`));
  }

  if (report.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${report.warnings.length}`);
    report.warnings.forEach(w => console.log(`   - ${w}`));
  }

  console.log('\n' + '='.repeat(70) + '\n');

  if (report.dryRun) {
    console.log('ℹ️  This was a dry run. No files were modified.');
    console.log('   Run without --dry-run to execute migration.\n');
  } else if (report.errors.length === 0) {
    console.log('✓ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Review .bmad/features/ directory');
    console.log('  2. Update any references to old paths');
    console.log('  3. Test your workflows');
    console.log('  4. Delete backup after verification');
    console.log('  5. Commit changes to git\n');
  }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): { projectPath: string; dryRun: boolean } | null {
  const args = process.argv.slice(2);

  let projectPath: string | null = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--project') {
      projectPath = args[++i];
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
BMAD Structure Migration Tool

Usage:
  npm run migrate-bmad -- --project <path> [--dry-run]

Options:
  --project <path>   Path to project directory (required)
  --dry-run          Preview changes without modifying files
  --help, -h         Show this help message

Examples:
  # Preview migration
  npm run migrate-bmad -- --project /home/samuel/sv/consilio-s --dry-run

  # Execute migration
  npm run migrate-bmad -- --project /home/samuel/sv/consilio-s
`);
      return null;
    }
  }

  if (!projectPath) {
    console.error('Error: --project flag is required\n');
    console.error('Run with --help for usage information');
    return null;
  }

  return { projectPath, dryRun };
}

/**
 * Main entry point
 */
function main(): void {
  console.log('\n' + '='.repeat(70));
  console.log('BMAD STRUCTURE MIGRATION TOOL');
  console.log('='.repeat(70) + '\n');

  const args = parseArgs();
  if (!args) {
    process.exit(1);
  }

  const { projectPath, dryRun } = args;

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No files will be modified\n');
  }

  const report = migrate(projectPath, dryRun);

  printSummary(report);

  // Generate report file
  if (!dryRun && report.errors.length === 0) {
    generateReportFile(report, projectPath);
  }

  // Exit with error code if there were errors
  if (report.errors.length > 0) {
    process.exit(1);
  }
}

// Run if executed directly (ES module check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}

export { migrate, scanArtifacts, detectArtifact };
