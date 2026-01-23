/**
 * UI-First Development Workflow MCP Tools
 * Epic: UI-001 - Requirements Analysis Engine
 * Epic: UI-002 - Design System Foundation
 * Epic: UI-007 - Dev Environment Deployment
 */

import { DesignSystemManager } from '../../ui/DesignSystemManager.js';
import { StorybookDeployer } from '../../ui/StorybookDeployer.js';
import { EpicParser } from '../../ui/EpicParser.js';
import { RequirementsAnalyzer } from '../../ui/RequirementsAnalyzer.js';
import { UISpecMapper } from '../../ui/UISpecMapper.js';
import { DevEnvironmentDeployer } from '../../ui/DevEnvironmentDeployer.js';
import { upsertUIRequirement } from '../../db/queries.js';
import type { ToolDefinition, ProjectContext } from '../../types/project.js';
import type {
  CreateDesignSystemParams,
  UpdateDesignSystemParams,
  GetDesignSystemParams,
  DeleteDesignSystemParams,
  DeployStorybookParams,
} from '../../types/design-system.js';
import type { AnalyzeEpicParams, AnalyzeEpicResult } from '../../types/ui-001.js';
import type {
  DeployMockupParams,
  DeployMockupResult,
  GetPreviewUrlsParams,
  GetPreviewUrlsResult,
} from '../../types/ui-007.js';

// Service instances
const designSystemManager = new DesignSystemManager();
const storybookDeployer = new StorybookDeployer();
const epicParser = new EpicParser();
const requirementsAnalyzer = new RequirementsAnalyzer();
const uiSpecMapper = new UISpecMapper();
const devEnvironmentDeployer = new DevEnvironmentDeployer();

/**
 * Analyze epic to extract UI requirements
 * Epic: UI-001 - Requirements Analysis Engine
 */
export const uiAnalyzeEpic: ToolDefinition = {
  name: 'ui_analyze_epic',
  description: 'Parse epic markdown file to extract UI requirements (acceptance criteria, user stories, data needs, navigation)',
  inputSchema: {
    type: 'object',
    properties: {
      epicId: {
        type: 'string',
        description: 'Epic identifier (e.g., "epic-003-user-management" or "ui-001")',
      },
      projectName: {
        type: 'string',
        description: 'Project name (optional, will be extracted from epic if not provided)',
      },
      reanalyze: {
        type: 'boolean',
        description: 'Force re-analysis even if requirements already exist (default: false)',
      },
    },
    required: ['epicId'],
  },
  handler: async (input: AnalyzeEpicParams, context: ProjectContext): Promise<AnalyzeEpicResult> => {
    try {
      const warnings: string[] = [];

      // Parse epic markdown file
      const parseResult = await epicParser.parseEpic(input.epicId);

      if ('error' in parseResult) {
        return {
          success: false,
          error: parseResult.error,
        };
      }

      const parsedEpic = parseResult;

      // Add validation warnings if any
      const validation = epicParser.validateEpicFormat(JSON.stringify(parsedEpic));
      if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings.map(w => w.message));
      }

      // Analyze requirements
      const analysis = requirementsAnalyzer.analyze(parsedEpic.acceptanceCriteria);

      // Map to UI specification
      const uiSpec = uiSpecMapper.mapToUISpec(parsedEpic, analysis);

      // Override project name if provided
      if (input.projectName) {
        uiSpec.project_name = input.projectName;
      }

      // Store in database (upsert)
      const uiRequirement = await upsertUIRequirement(uiSpec);

      return {
        success: true,
        uiRequirement,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error analyzing epic',
      };
    }
  },
};

/**
 * Create a design system
 */
export const uiCreateDesignSystem: ToolDefinition = {
  name: 'ui_create_design_system',
  description: 'Create a new design system with style configuration and component library',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: { type: 'string', description: 'Project name (e.g., "consilio", "odin")' },
      name: { type: 'string', description: 'Design system name (e.g., "default", "admin-theme")' },
      description: { type: 'string', description: 'Optional description of the design system' },
      styleConfig: { type: 'object', description: 'Design tokens (colors, typography, spacing)' },
      componentLibrary: { type: 'object', description: 'Component definitions (optional)' },
    },
    required: ['projectName', 'name', 'styleConfig'],
  },
  handler: async (input: CreateDesignSystemParams, context: ProjectContext) => {
    const result = await designSystemManager.createDesignSystem(input);
    return result;
  },
};

/**
 * Get design system(s) for a project
 */
export const uiGetDesignSystem: ToolDefinition = {
  name: 'ui_get_design_system',
  description: 'Get design system(s) for a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: { type: 'string', description: 'Project name' },
      name: { type: 'string', description: 'Design system name (optional, returns all if omitted)' },
    },
    required: ['projectName'],
  },
  handler: async (input: GetDesignSystemParams, context: ProjectContext) => {
    const result = await designSystemManager.getDesignSystem(input);

    if (!result) {
      return {
        success: false,
        error: `No design systems found for project '${input.projectName}'`,
      };
    }

    return {
      success: true,
      designSystems: Array.isArray(result) ? result : [result],
    };
  },
};

/**
 * Update a design system
 */
export const uiUpdateDesignSystem: ToolDefinition = {
  name: 'ui_update_design_system',
  description: 'Update an existing design system',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Design system ID' },
      name: { type: 'string', description: 'New name' },
      description: { type: 'string', description: 'New description' },
      styleConfig: { type: 'object', description: 'Updated style configuration' },
      componentLibrary: { type: 'object', description: 'Updated component library' },
    },
    required: ['id'],
  },
  handler: async (input: UpdateDesignSystemParams, context: ProjectContext) => {
    try {
      const result = await designSystemManager.updateDesignSystem(input);

      if (!result) {
        return {
          success: false,
          error: `Design system with ID ${input.id} not found`,
        };
      }

      return {
        success: true,
        designSystem: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating design system',
      };
    }
  },
};

/**
 * Delete a design system
 */
export const uiDeleteDesignSystem: ToolDefinition = {
  name: 'ui_delete_design_system',
  description: 'Delete a design system',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Design system ID' },
    },
    required: ['id'],
  },
  handler: async (input: DeleteDesignSystemParams, context: ProjectContext) => {
    try {
      const result = await designSystemManager.deleteDesignSystem(input);

      if (!result) {
        return {
          success: false,
          error: `Design system with ID ${input.id} not found`,
        };
      }

      return {
        success: true,
        message: 'Design system deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deleting design system',
      };
    }
  },
};

/**
 * Deploy Storybook for a design system
 */
export const uiDeployStorybook: ToolDefinition = {
  name: 'ui_deploy_storybook',
  description: 'Deploy Storybook instance for a design system',
  inputSchema: {
    type: 'object',
    properties: {
      designSystemId: { type: 'number', description: 'Design system ID' },
      port: { type: 'number', description: 'Port to deploy on (optional, uses design system port if omitted)' },
      publicUrl: { type: 'string', description: 'Public URL (optional, defaults to localhost:port)' },
    },
    required: ['designSystemId'],
  },
  handler: async (input: DeployStorybookParams, context: ProjectContext) => {
    try {
      // Get design system by ID
      const designSystem = await designSystemManager.getDesignSystemById(input.designSystemId);

      if (!designSystem) {
        return {
          success: false,
          error: `Design system with ID ${input.designSystemId} not found`,
        };
      }

      // Deploy Storybook
      const result = await storybookDeployer.deployStorybook(designSystem, input);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deploying Storybook',
      };
    }
  },
};

/**
 * Stop a Storybook deployment
 */
export const uiStopStorybook: ToolDefinition = {
  name: 'ui_stop_storybook',
  description: 'Stop a running Storybook deployment',
  inputSchema: {
    type: 'object',
    properties: {
      deploymentId: { type: 'number', description: 'Storybook deployment ID' },
    },
    required: ['deploymentId'],
  },
  handler: async (input: { deploymentId: number }, context: ProjectContext) => {
    try {
      const result = await storybookDeployer.stopStorybook(input.deploymentId);

      if (!result) {
        return {
          success: false,
          error: `Deployment with ID ${input.deploymentId} not found`,
        };
      }

      return {
        success: true,
        message: 'Storybook stopped successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error stopping Storybook',
      };
    }
  },
};

/**
 * Restart a Storybook deployment
 */
export const uiRestartStorybook: ToolDefinition = {
  name: 'ui_restart_storybook',
  description: 'Restart a Storybook deployment',
  inputSchema: {
    type: 'object',
    properties: {
      deploymentId: { type: 'number', description: 'Storybook deployment ID' },
    },
    required: ['deploymentId'],
  },
  handler: async (input: { deploymentId: number }, context: ProjectContext) => {
    try {
      const result = await storybookDeployer.restartStorybook(input.deploymentId);

      if (!result) {
        return {
          success: false,
          error: `Deployment with ID ${input.deploymentId} not found`,
        };
      }

      return {
        success: true,
        message: 'Storybook restarted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error restarting Storybook',
      };
    }
  },
};

/**
 * Deploy UI mockup to dev environment
 * Epic: UI-007 - Dev Environment Deployment
 */
export const uiDeployMockup: ToolDefinition = {
  name: 'ui_deploy_mockup',
  description: 'Deploy interactive UI mockup to dev environment with hot reload over HTTPS. URL pattern: ui.153.se/[project]/dev',
  inputSchema: {
    type: 'object',
    properties: {
      epicId: {
        type: 'string',
        description: 'Epic identifier (e.g., "epic-003-user-management")',
      },
      framework: {
        type: 'string',
        description: 'Dev framework: "vite" or "nextjs" (default: vite)',
        enum: ['vite', 'nextjs'],
      },
      port: {
        type: 'number',
        description: 'Port for dev server (auto-allocated if not provided)',
      },
      hotReload: {
        type: 'boolean',
        description: 'Enable hot reload (default: true)',
      },
      mockDataInjection: {
        type: 'boolean',
        description: 'Inject mock data into components (default: true)',
      },
      basePath: {
        type: 'string',
        description: 'Base path for routing (default: /[project]/dev)',
      },
    },
    required: ['epicId'],
  },
  handler: async (input: DeployMockupParams, context: ProjectContext): Promise<DeployMockupResult> => {
    try {
      const result = await devEnvironmentDeployer.deployMockup(input);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deploying mockup',
      };
    }
  },
};

/**
 * Get preview URLs for deployed mockups
 * Epic: UI-007 - Dev Environment Deployment
 */
export const uiGetPreviewUrls: ToolDefinition = {
  name: 'ui_get_preview_urls',
  description: 'Get preview URLs for deployed UI mockups. Filter by epic ID, project name, or status.',
  inputSchema: {
    type: 'object',
    properties: {
      epicId: {
        type: 'string',
        description: 'Filter by epic identifier',
      },
      projectName: {
        type: 'string',
        description: 'Filter by project name',
      },
      status: {
        type: 'string',
        description: 'Filter by deployment status',
        enum: ['pending', 'building', 'running', 'stopped', 'failed'],
      },
    },
  },
  handler: async (input: GetPreviewUrlsParams, context: ProjectContext): Promise<GetPreviewUrlsResult> => {
    try {
      const result = await devEnvironmentDeployer.getPreviewUrls(input);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting preview URLs',
      };
    }
  },
};

// Export all tools
export const uiTools: ToolDefinition[] = [
  uiAnalyzeEpic,
  uiCreateDesignSystem,
  uiGetDesignSystem,
  uiUpdateDesignSystem,
  uiDeleteDesignSystem,
  uiDeployStorybook,
  uiStopStorybook,
  uiRestartStorybook,
  uiDeployMockup,
  uiGetPreviewUrls,
];
