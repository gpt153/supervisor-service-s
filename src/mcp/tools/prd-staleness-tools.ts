/**
 * PRD Staleness Monitoring Tool
 *
 * Detects PRDs that haven't been updated despite epic completions, helping identify
 * when the auto-update workflow isn't working.
 *
 * Detection logic:
 * 1. Find all PRDs across projects
 * 2. Check for required sections (Document History, Epic Status)
 * 3. Compare epic completion status in filesystem vs PRD
 * 4. Flag PRDs with version 1.0 but completed epics
 */

import fs from 'fs/promises';
import path from 'path';

const SV_ROOT = '/home/samuel/sv';
const PROJECTS = ['consilio-s', 'odin-s', 'openhorizon-s', 'health-agent-s'];

interface StalePRD {
  project: string;
  feature: string;
  prd_path: string;
  version: string;
  completed_epics: number;
  total_epics: number;
  issues: string[];
  recommendation: string;
}

interface PRDMetadata {
  version: string;
  hasDocumentHistory: boolean;
  hasEpicStatus: boolean;
  completedInTable: number;
  totalInTable: number;
  epicIds: string[];
}

interface EpicMetadata {
  id: string;
  status: string;
  file_path: string;
}

interface CheckPRDStalenessParams {
  projects?: string[];
}

interface CheckPRDStalenessResult {
  stale_prds: StalePRD[];
  healthy_prds: number;
  total_prds: number;
  summary: string;
}

/**
 * Extract version from PRD frontmatter or metadata
 */
function extractVersion(content: string): string {
  // YAML frontmatter format
  const yamlMatch = content.match(/^---\s*\nversion:\s*([^\n]+)/m);
  if (yamlMatch) return yamlMatch[1].trim();

  // Markdown bold format
  const boldMatch = content.match(/\*\*Version:\*\*\s*([^\n]+)/);
  if (boldMatch) return boldMatch[1].trim();

  return '1.0'; // Default if not found
}

/**
 * Check if Document History section exists
 */
function hasDocumentHistorySection(content: string): boolean {
  return content.includes('## Document History') || content.includes('## Revision History');
}

/**
 * Check if Epic Status section exists
 */
function hasEpicStatusSection(content: string): boolean {
  return content.includes('## Epic Status Tracking') || content.includes('## Epic Status');
}

/**
 * Count completed epics in Epic Status table
 */
function countCompletedInEpicStatusTable(content: string): number {
  const epicStatusSection = extractSection(content, '## Epic Status Tracking') ||
                            extractSection(content, '## Epic Status');

  if (!epicStatusSection) return 0;

  // Count rows with ✅ completed status
  const lines = epicStatusSection.split('\n');
  let completedCount = 0;

  for (const line of lines) {
    if (line.includes('✅') || line.includes('completed')) {
      completedCount++;
    }
  }

  return completedCount;
}

/**
 * Count total epics in Epic Status table
 */
function countTotalInEpicStatusTable(content: string): number {
  const epicStatusSection = extractSection(content, '## Epic Status Tracking') ||
                            extractSection(content, '## Epic Status');

  if (!epicStatusSection) return 0;

  // Count table rows (excluding header and separator)
  const lines = epicStatusSection.split('\n').filter(l => l.trim().startsWith('|'));

  // First 2 lines are header and separator
  return Math.max(0, lines.length - 2);
}

/**
 * Extract epic IDs mentioned in Epic Status table
 */
function extractEpicIds(content: string): string[] {
  const epicStatusSection = extractSection(content, '## Epic Status Tracking') ||
                            extractSection(content, '## Epic Status') ||
                            extractSection(content, '## Epic Overview') ||
                            extractSection(content, '## Epic Breakdown');

  if (!epicStatusSection) return [];

  const epicIds: string[] = [];
  const lines = epicStatusSection.split('\n');

  for (const line of lines) {
    // Match epic-NNN or epic-NNN-description patterns
    const matches = line.match(/epic-\d{3}(?:-[a-z-]+)?/gi);
    if (matches) {
      epicIds.push(...matches.map(id => id.toLowerCase()));
    }
  }

  return Array.from(new Set(epicIds)); // Remove duplicates
}

/**
 * Extract a section's content
 */
function extractSection(content: string, header: string): string | null {
  const lines = content.split('\n');
  const startIdx = lines.findIndex(l => l.trim() === header);

  if (startIdx === -1) return null;

  const endIdx = lines.findIndex((l, idx) => {
    return idx > startIdx && l.match(/^##\s+/);
  });

  const sectionLines = lines.slice(
    startIdx + 1,
    endIdx === -1 ? undefined : endIdx
  );

  return sectionLines.join('\n').trim();
}

/**
 * Parse PRD metadata
 */
function parsePRDMetadata(content: string): PRDMetadata {
  return {
    version: extractVersion(content),
    hasDocumentHistory: hasDocumentHistorySection(content),
    hasEpicStatus: hasEpicStatusSection(content),
    completedInTable: countCompletedInEpicStatusTable(content),
    totalInTable: countTotalInEpicStatusTable(content),
    epicIds: extractEpicIds(content),
  };
}

/**
 * Parse epic frontmatter to extract status
 */
function parseEpicMetadata(content: string, filePath: string): EpicMetadata | null {
  // Extract YAML frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];

  // Extract epic_id
  const idMatch = frontmatter.match(/epic_id:\s*([^\n]+)/);
  if (!idMatch) return null;

  const id = idMatch[1].trim();

  // Extract status
  const statusMatch = frontmatter.match(/status:\s*([^\n]+)/);
  const status = statusMatch ? statusMatch[1].trim() : 'unknown';

  return { id, status, file_path: filePath };
}

/**
 * Find all epic files for a feature
 */
async function findEpicFiles(featurePath: string): Promise<string[]> {
  const epicsDir = path.join(featurePath, 'epics');

  try {
    const files = await fs.readdir(epicsDir);
    return files
      .filter(f => f.endsWith('.md') && f.startsWith('epic-'))
      .map(f => path.join(epicsDir, f));
  } catch (error) {
    // No epics directory
    return [];
  }
}

/**
 * Count completed epics in filesystem
 */
async function countCompletedEpics(epicFiles: string[]): Promise<number> {
  let completedCount = 0;

  for (const epicFile of epicFiles) {
    try {
      const content = await fs.readFile(epicFile, 'utf-8');
      const metadata = parseEpicMetadata(content, epicFile);

      if (metadata && (metadata.status === 'completed' || metadata.status === 'done')) {
        completedCount++;
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  return completedCount;
}

/**
 * Find all PRD files in a project
 */
async function findPRDFiles(projectPath: string): Promise<string[]> {
  const prdPaths: string[] = [];

  // Check .bmad/features/*/prd.md
  const bmadFeaturesPath = path.join(projectPath, '.bmad', 'features');
  try {
    const features = await fs.readdir(bmadFeaturesPath);

    for (const feature of features) {
      const prdPath = path.join(bmadFeaturesPath, feature, 'prd.md');
      try {
        await fs.access(prdPath);
        prdPaths.push(prdPath);
      } catch {
        // No prd.md in this feature
      }
    }
  } catch {
    // No .bmad/features directory
  }

  // Check .bmad/prd/*.md (legacy)
  const bmadPrdPath = path.join(projectPath, '.bmad', 'prd');
  try {
    const files = await fs.readdir(bmadPrdPath);

    for (const file of files) {
      if (file.endsWith('.md')) {
        prdPaths.push(path.join(bmadPrdPath, file));
      }
    }
  } catch {
    // No .bmad/prd directory
  }

  return prdPaths;
}

/**
 * Analyze a single PRD for staleness
 */
async function analyzePRD(
  prdPath: string,
  projectName: string
): Promise<StalePRD | null> {
  try {
    const content = await fs.readFile(prdPath, 'utf-8');
    const metadata = parsePRDMetadata(content);

    // Determine feature name from path
    const pathParts = prdPath.split('/');
    const featuresIdx = pathParts.indexOf('features');
    const featureName = featuresIdx >= 0 ? pathParts[featuresIdx + 1] : 'unknown';

    // Find epic files for this feature
    const featurePath = path.dirname(prdPath);
    const epicFiles = await findEpicFiles(featurePath);
    const completedInFiles = await countCompletedEpics(epicFiles);

    // Detect staleness issues
    const issues: string[] = [];
    let recommendation = '';

    // Check 1: Version staleness
    if (metadata.version === '1.0' && completedInFiles > 0) {
      issues.push(`Version still 1.0 despite ${completedInFiles} completed epic(s)`);
      recommendation = 'Run validate-acceptance-criteria on completed epics to trigger PRD update';
    }

    // Check 2: Missing required sections
    if (!metadata.hasDocumentHistory) {
      issues.push('Missing Document History table');
      if (!recommendation) {
        recommendation = 'Regenerate PRD using current template';
      }
    }

    if (!metadata.hasEpicStatus) {
      issues.push('Missing Epic Status table');
      if (!recommendation) {
        recommendation = 'Regenerate PRD using current template';
      }
    }

    // Check 3: Epic status mismatch
    if (metadata.hasEpicStatus && completedInFiles > metadata.completedInTable) {
      issues.push(
        `${completedInFiles} epic(s) completed in filesystem but only ${metadata.completedInTable} marked in PRD`
      );
      if (!recommendation) {
        recommendation = 'Re-validate completed epics to update PRD';
      }
    }

    // If no issues, PRD is healthy
    if (issues.length === 0) {
      return null;
    }

    return {
      project: projectName,
      feature: featureName,
      prd_path: prdPath,
      version: metadata.version,
      completed_epics: completedInFiles,
      total_epics: epicFiles.length,
      issues,
      recommendation,
    };
  } catch (error) {
    console.error(`Error analyzing PRD ${prdPath}:`, error);
    return null;
  }
}

/**
 * Check for stale PRDs across all projects
 */
async function checkPRDStaleness(
  params: CheckPRDStalenessParams
): Promise<CheckPRDStalenessResult> {
  const projectsToCheck = params.projects || PROJECTS;
  const stalePRDs: StalePRD[] = [];
  let totalPRDs = 0;
  let healthyPRDs = 0;

  for (const projectName of projectsToCheck) {
    const projectPath = path.join(SV_ROOT, projectName);

    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch {
      console.warn(`Project ${projectName} not found at ${projectPath}`);
      continue;
    }

    // Find all PRD files
    const prdFiles = await findPRDFiles(projectPath);
    totalPRDs += prdFiles.length;

    // Analyze each PRD
    for (const prdFile of prdFiles) {
      const result = await analyzePRD(prdFile, projectName);

      if (result) {
        stalePRDs.push(result);
      } else {
        healthyPRDs++;
      }
    }
  }

  // Generate summary
  const summary = stalePRDs.length === 0
    ? `All ${totalPRDs} PRD(s) are up-to-date across ${projectsToCheck.length} project(s)`
    : `Found ${stalePRDs.length} stale PRD(s) requiring attention across ${projectsToCheck.length} project(s)`;

  return {
    stale_prds: stalePRDs,
    healthy_prds: healthyPRDs,
    total_prds: totalPRDs,
    summary,
  };
}

/**
 * Get PRD staleness monitoring tool definitions for MCP server
 */
export function getPRDStalenessTools() {
  return [
    {
      name: 'mcp_meta_check_prd_staleness',
      description: 'Detect PRDs that haven\'t been updated despite epic completions. Identifies PRDs with version 1.0 but completed epics, missing Document History or Epic Status tables, or mismatches between filesystem epic status and PRD tables. Use this to identify when the validation → PRD update workflow isn\'t working.',
      inputSchema: {
        type: 'object',
        properties: {
          projects: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of project names to check (e.g., ["odin-s", "consilio-s"]). If not provided, checks all projects.',
          },
        },
      },
      handler: checkPRDStaleness,
    },
  ];
}
