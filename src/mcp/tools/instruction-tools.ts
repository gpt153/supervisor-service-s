/**
 * MCP Tools for Instruction Management
 *
 * These tools allow supervisors to manage their instruction system:
 * - Regenerate CLAUDE.md files
 * - Update core instruction files
 * - List and manage projects
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { InstructionAssembler } from '../../instructions/InstructionAssembler.js';
import { readdir, stat, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const SV_ROOT = '/home/samuel/sv';
const SUPERVISOR_SERVICE_PATH = join(SV_ROOT, 'supervisor-service');
const EXCLUDED_DIRS = [
  'supervisor-service',
  '.claude',
  'templates',
  'docs',
  '.bmad',
  'node_modules',
  '.git',
];

/**
 * List all projects in the SV system
 */
export const listProjectsTool: ToolDefinition = {
  name: 'mcp__meta__list_projects',
  description: 'List all projects in the SV supervisor system',
  inputSchema: {
    type: 'object',
    properties: {
      includeDetails: {
        type: 'boolean',
        description: 'Include detailed information about each project',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const entries = await readdir(SV_ROOT);
      const projects: Array<{
        name: string;
        path: string;
        hasClaudeMd: boolean;
        hasSupervisorSpecific?: boolean;
        hasBmad?: boolean;
      }> = [];

      for (const entry of entries) {
        if (EXCLUDED_DIRS.includes(entry)) continue;

        const fullPath = join(SV_ROOT, entry);
        const stats = await stat(fullPath);

        if (!stats.isDirectory()) continue;

        const projectInfo = {
          name: entry,
          path: fullPath,
          hasClaudeMd: existsSync(join(fullPath, 'CLAUDE.md')),
        };

        if (params.includeDetails) {
          Object.assign(projectInfo, {
            hasSupervisorSpecific: existsSync(join(fullPath, '.supervisor-specific')),
            hasBmad: existsSync(join(fullPath, '.bmad')),
          });
        }

        projects.push(projectInfo);
      }

      return {
        success: true,
        count: projects.length,
        projects: projects.sort((a, b) => a.name.localeCompare(b.name)),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Regenerate CLAUDE.md for one or all projects
 */
export const regenerateSupervisorTool: ToolDefinition = {
  name: 'mcp__meta__regenerate_supervisor',
  description: 'Regenerate CLAUDE.md for one or all projects using the layered instruction system',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project name to regenerate (e.g., "consilio", "odin"). Omit to regenerate all projects.',
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, show what would be regenerated without writing files',
      },
      preserveProjectSpecific: {
        type: 'boolean',
        description: 'Preserve project-specific sections from existing CLAUDE.md',
        default: true,
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    const dryRun = params.dryRun ?? false;
    const preserveProjectSpecific = params.preserveProjectSpecific ?? true;

    try {
      // If project specified, regenerate just that one
      if (params.project) {
        const projectPath = join(SV_ROOT, params.project);

        // Verify project exists
        if (!existsSync(projectPath)) {
          return {
            success: false,
            error: `Project "${params.project}" not found at ${projectPath}`,
          };
        }

        const claudeMdPath = join(projectPath, 'CLAUDE.md');

        if (dryRun) {
          const hasClaudeMd = existsSync(claudeMdPath);
          const hasSupervisorSpecific = existsSync(join(projectPath, '.supervisor-specific'));

          return {
            success: true,
            dryRun: true,
            project: params.project,
            wouldUpdate: hasClaudeMd,
            hasSupervisorSpecific,
            message: hasClaudeMd
              ? `Would regenerate CLAUDE.md for ${params.project}`
              : `No CLAUDE.md found for ${params.project}`,
          };
        }

        // Create assembler with project-specific paths
        const assembler = new InstructionAssembler(projectPath);

        // Check if CLAUDE.md exists
        if (!existsSync(claudeMdPath)) {
          return {
            success: false,
            error: `No CLAUDE.md found for project "${params.project}"`,
            hint: 'Create initial CLAUDE.md before regenerating',
          };
        }

        // Extract and preserve project-specific sections
        const projectSections = await assembler.extractProjectSpecific(claudeMdPath);

        if (preserveProjectSpecific && projectSections.length > 0) {
          await assembler.saveProjectSpecific(projectSections);
        }

        // Regenerate
        const result = await assembler.assembleAndWrite(claudeMdPath, {
          preserveProjectSpecific,
          includeMetadata: true,
        });

        return {
          success: true,
          project: params.project,
          sectionsCount: result.sections.length,
          projectSpecificCount: projectSections.length,
          timestamp: result.timestamp,
          message: `Successfully regenerated CLAUDE.md for ${params.project}`,
        };
      }

      // Regenerate all projects
      const entries = await readdir(SV_ROOT);
      const results: Array<{
        project: string;
        success: boolean;
        message?: string;
        error?: string;
      }> = [];

      for (const entry of entries) {
        if (EXCLUDED_DIRS.includes(entry)) continue;

        const fullPath = join(SV_ROOT, entry);
        const stats = await stat(fullPath);
        if (!stats.isDirectory()) continue;

        const claudeMdPath = join(fullPath, 'CLAUDE.md');
        if (!existsSync(claudeMdPath)) {
          results.push({
            project: entry,
            success: false,
            message: 'No CLAUDE.md found, skipped',
          });
          continue;
        }

        if (dryRun) {
          results.push({
            project: entry,
            success: true,
            message: 'Would regenerate',
          });
          continue;
        }

        try {
          const assembler = new InstructionAssembler(fullPath);
          const projectSections = await assembler.extractProjectSpecific(claudeMdPath);

          if (preserveProjectSpecific && projectSections.length > 0) {
            await assembler.saveProjectSpecific(projectSections);
          }

          await assembler.assembleAndWrite(claudeMdPath, {
            preserveProjectSpecific,
            includeMetadata: true,
          });

          results.push({
            project: entry,
            success: true,
            message: `Regenerated (${projectSections.length} project sections)`,
          });
        } catch (error) {
          results.push({
            project: entry,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return {
        success: true,
        dryRun,
        totalProjects: results.length,
        successCount,
        failCount,
        results,
        message: dryRun
          ? `Dry run: would regenerate ${successCount} projects`
          : `Regenerated ${successCount} projects (${failCount} failed/skipped)`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Update a core instruction file
 */
export const updateCoreInstructionTool: ToolDefinition = {
  name: 'mcp__meta__update_core_instruction',
  description: 'Update a core instruction file in the supervisor-service. This affects all projects that use these core instructions.',
  inputSchema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Name of the instruction file to update (e.g., "01-identity.md", "02-workflow.md")',
      },
      content: {
        type: 'string',
        description: 'New content for the instruction file',
      },
      layer: {
        type: 'string',
        description: 'Which layer to update: "core" (shared by all) or "meta" (supervisor-service specific)',
        enum: ['core', 'meta'],
        default: 'core',
      },
      regenerateAll: {
        type: 'boolean',
        description: 'After updating, regenerate CLAUDE.md for all projects',
        default: false,
      },
    },
    required: ['filename', 'content'],
  },
  handler: async (params, context: ProjectContext) => {
    const layer = params.layer || 'core';
    const layerPath = join(
      SUPERVISOR_SERVICE_PATH,
      layer === 'core' ? '.supervisor-core' : '.supervisor-meta'
    );

    try {
      // Ensure filename ends with .md
      const filename = params.filename.endsWith('.md')
        ? params.filename
        : `${params.filename}.md`;

      const filePath = join(layerPath, filename);

      // Create directory if it doesn't exist
      await mkdir(layerPath, { recursive: true });

      // Write the file
      await writeFile(filePath, params.content, 'utf-8');

      const result: any = {
        success: true,
        layer,
        filename,
        path: filePath,
        message: `Successfully updated ${layer} instruction: ${filename}`,
      };

      // Regenerate supervisor-service's own CLAUDE.md
      const assembler = new InstructionAssembler(SUPERVISOR_SERVICE_PATH);
      const supervisorClaudeMd = join(SUPERVISOR_SERVICE_PATH, 'CLAUDE.md');

      await assembler.assembleAndWrite(supervisorClaudeMd, {
        preserveProjectSpecific: true,
        includeMetadata: true,
      });

      result.supervisorServiceRegenerated = true;

      // Optionally regenerate all projects
      if (params.regenerateAll) {
        const entries = await readdir(SV_ROOT);
        let regeneratedCount = 0;

        for (const entry of entries) {
          if (EXCLUDED_DIRS.includes(entry)) continue;

          const fullPath = join(SV_ROOT, entry);
          const stats = await stat(fullPath);
          if (!stats.isDirectory()) continue;

          const claudeMdPath = join(fullPath, 'CLAUDE.md');
          if (!existsSync(claudeMdPath)) continue;

          try {
            const projectAssembler = new InstructionAssembler(fullPath);
            await projectAssembler.regenerate(claudeMdPath);
            regeneratedCount++;
          } catch (error) {
            // Continue with other projects
          }
        }

        result.allProjectsRegenerated = true;
        result.projectsRegeneratedCount = regeneratedCount;
        result.message += ` and regenerated ${regeneratedCount} projects`;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Read a core instruction file
 */
export const readCoreInstructionTool: ToolDefinition = {
  name: 'mcp__meta__read_core_instruction',
  description: 'Read a core instruction file from supervisor-service',
  inputSchema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Name of the instruction file to read (e.g., "01-identity.md")',
      },
      layer: {
        type: 'string',
        description: 'Which layer to read from: "core" or "meta"',
        enum: ['core', 'meta'],
        default: 'core',
      },
    },
    required: ['filename'],
  },
  handler: async (params, context: ProjectContext) => {
    const layer = params.layer || 'core';
    const layerPath = join(
      SUPERVISOR_SERVICE_PATH,
      layer === 'core' ? '.supervisor-core' : '.supervisor-meta'
    );

    try {
      const filename = params.filename.endsWith('.md')
        ? params.filename
        : `${params.filename}.md`;

      const filePath = join(layerPath, filename);

      if (!existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filename} in ${layer} layer`,
        };
      }

      const content = await readFile(filePath, 'utf-8');

      return {
        success: true,
        layer,
        filename,
        path: filePath,
        content,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * List all core instruction files
 */
export const listCoreInstructionsTool: ToolDefinition = {
  name: 'mcp__meta__list_core_instructions',
  description: 'List all core instruction files in supervisor-service',
  inputSchema: {
    type: 'object',
    properties: {
      layer: {
        type: 'string',
        description: 'Which layer to list: "core", "meta", or "all"',
        enum: ['core', 'meta', 'all'],
        default: 'all',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    const layer = params.layer || 'all';

    try {
      const results: any = {
        success: true,
      };

      if (layer === 'core' || layer === 'all') {
        const corePath = join(SUPERVISOR_SERVICE_PATH, '.supervisor-core');
        if (existsSync(corePath)) {
          const files = await readdir(corePath);
          results.coreInstructions = files
            .filter(f => f.endsWith('.md'))
            .sort();
        }
      }

      if (layer === 'meta' || layer === 'all') {
        const metaPath = join(SUPERVISOR_SERVICE_PATH, '.supervisor-meta');
        if (existsSync(metaPath)) {
          const files = await readdir(metaPath);
          results.metaInstructions = files
            .filter(f => f.endsWith('.md'))
            .sort();
        }
      }

      return results;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Get all instruction management tools
 */
export function getInstructionTools(): ToolDefinition[] {
  return [
    listProjectsTool,
    regenerateSupervisorTool,
    updateCoreInstructionTool,
    readCoreInstructionTool,
    listCoreInstructionsTool,
  ];
}
