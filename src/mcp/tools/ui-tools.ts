/**
 * UI-First Development Workflow MCP Tools
 * Epic: UI-002 - Design System Foundation
 */

import { DesignSystemManager } from '../../ui/DesignSystemManager.js';
import { StorybookDeployer } from '../../ui/StorybookDeployer.js';
import type { ToolDefinition, ProjectContext } from '../../types/project.js';
import type {
  CreateDesignSystemParams,
  UpdateDesignSystemParams,
  GetDesignSystemParams,
  DeleteDesignSystemParams,
  DeployStorybookParams,
} from '../../types/design-system.js';

// Service instances
const designSystemManager = new DesignSystemManager();
const storybookDeployer = new StorybookDeployer();

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

// Export all tools
export const uiTools: ToolDefinition[] = [
  uiCreateDesignSystem,
  uiGetDesignSystem,
  uiUpdateDesignSystem,
  uiDeleteDesignSystem,
  uiDeployStorybook,
  uiStopStorybook,
  uiRestartStorybook,
];
