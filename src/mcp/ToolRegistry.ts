/**
 * ToolRegistry - Manages tool definitions and scoping per project
 */

import { ToolDefinition, ProjectContext } from '../types/project.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private projectTools: Map<string, Set<string>> = new Map();

  /**
   * Register a tool globally
   */
  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
    console.log(`Registered tool: ${tool.name}`);
  }

  /**
   * Register multiple tools at once
   */
  registerTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Associate tools with a specific project
   */
  setProjectTools(projectName: string, toolNames: string[]): void {
    const toolSet = new Set<string>();

    // Handle "*" wildcard to assign all tools
    if (toolNames.length === 1 && toolNames[0] === '*') {
      for (const toolName of this.tools.keys()) {
        toolSet.add(toolName);
      }
      this.projectTools.set(projectName, toolSet);
      console.log(`Scoped ${toolSet.size} tools (ALL) to project: ${projectName}`);
      return;
    }

    // Otherwise, add specified tools
    for (const toolName of toolNames) {
      if (!this.tools.has(toolName)) {
        console.warn(`Tool ${toolName} not found in registry for project ${projectName}`);
        continue;
      }
      toolSet.add(toolName);
    }

    this.projectTools.set(projectName, toolSet);
    console.log(`Scoped ${toolSet.size} tools to project: ${projectName}`);
  }

  /**
   * Get all tools available for a specific project
   */
  getProjectTools(projectName: string): ToolDefinition[] {
    const toolNames = this.projectTools.get(projectName);
    if (!toolNames) {
      return [];
    }

    const tools: ToolDefinition[] = [];
    for (const toolName of toolNames) {
      const tool = this.tools.get(toolName);
      if (tool) {
        tools.push(tool);
      }
    }

    return tools;
  }

  /**
   * Get a specific tool by name
   */
  getTool(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Check if a tool is available for a project
   */
  isToolAvailableForProject(projectName: string, toolName: string): boolean {
    const projectToolSet = this.projectTools.get(projectName);
    return projectToolSet?.has(toolName) ?? false;
  }

  /**
   * Execute a tool in the context of a project
   */
  async executeTool(
    toolName: string,
    params: any,
    context: ProjectContext
  ): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Verify tool is scoped to this project
    if (!this.isToolAvailableForProject(context.project.name, toolName)) {
      throw new Error(
        `Tool ${toolName} is not available for project ${context.project.name}`
      );
    }

    try {
      return await tool.handler(params, context);
    } catch (error) {
      throw new Error(`Tool execution failed: ${error}`);
    }
  }

  /**
   * Get all registered tool names
   */
  getAllToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get statistics about registered tools
   */
  getStats(): {
    totalTools: number;
    projectsWithTools: number;
    toolsPerProject: Map<string, number>;
  } {
    const toolsPerProject = new Map<string, number>();

    for (const [projectName, toolSet] of this.projectTools.entries()) {
      toolsPerProject.set(projectName, toolSet.size);
    }

    return {
      totalTools: this.tools.size,
      projectsWithTools: this.projectTools.size,
      toolsPerProject,
    };
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): boolean {
    const removed = this.tools.delete(toolName);

    // Remove from all project scopes
    for (const toolSet of this.projectTools.values()) {
      toolSet.delete(toolName);
    }

    return removed;
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
    this.projectTools.clear();
  }
}
