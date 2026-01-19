/**
 * ProjectContextManager - Manages project contexts and ensures isolation
 */

import { ProjectConfig, ProjectContext, ProjectsConfig } from '../types/project.js';
import fs from 'fs/promises';
import path from 'path';

export class ProjectContextManager {
  private contexts: Map<string, ProjectContext> = new Map();
  private projectConfigs: ProjectsConfig = {};
  private configPath: string;

  constructor(configPath: string = 'config/projects.json') {
    this.configPath = configPath;
  }

  /**
   * Initialize the context manager by loading project configurations
   */
  async initialize(): Promise<void> {
    await this.loadProjectConfigs();
    this.createContexts();
  }

  /**
   * Load project configurations from JSON file
   */
  private async loadProjectConfigs(): Promise<void> {
    try {
      const configFilePath = path.resolve(this.configPath);
      const configData = await fs.readFile(configFilePath, 'utf-8');
      this.projectConfigs = JSON.parse(configData);
      console.log(`Loaded ${Object.keys(this.projectConfigs).length} project configurations`);
    } catch (error) {
      throw new Error(`Failed to load project configurations: ${error}`);
    }
  }

  /**
   * Create isolated contexts for each enabled project
   */
  private createContexts(): void {
    for (const [projectName, config] of Object.entries(this.projectConfigs)) {
      if (!config.enabled) {
        console.log(`Skipping disabled project: ${projectName}`);
        continue;
      }

      const context: ProjectContext = {
        project: config,
        workingDirectory: config.path,
        isolatedState: new Map(),
      };

      this.contexts.set(projectName, context);
      console.log(`Created context for project: ${projectName}`);
    }
  }

  /**
   * Get context for a specific project
   */
  getContext(projectName: string): ProjectContext | undefined {
    return this.contexts.get(projectName);
  }

  /**
   * Get all project contexts
   */
  getAllContexts(): Map<string, ProjectContext> {
    return new Map(this.contexts);
  }

  /**
   * Get project configuration by name
   */
  getProjectConfig(projectName: string): ProjectConfig | undefined {
    return this.projectConfigs[projectName];
  }

  /**
   * Get all enabled projects
   */
  getEnabledProjects(): ProjectConfig[] {
    return Object.values(this.projectConfigs).filter(config => config.enabled);
  }

  /**
   * Detect project from endpoint path
   */
  detectProjectFromPath(endpointPath: string): string | null {
    // Expected format: /mcp/{project}
    const match = endpointPath.match(/^\/mcp\/([a-z0-9-]+)$/i);
    if (!match) {
      return null;
    }

    const projectName = match[1];
    return this.contexts.has(projectName) ? projectName : null;
  }

  /**
   * Validate that a project exists and is enabled
   */
  validateProject(projectName: string): boolean {
    const config = this.projectConfigs[projectName];
    return config !== undefined && config.enabled;
  }

  /**
   * Set state value in project's isolated context
   */
  setState(projectName: string, key: string, value: any): void {
    const context = this.contexts.get(projectName);
    if (!context) {
      throw new Error(`Project context not found: ${projectName}`);
    }
    context.isolatedState.set(key, value);
  }

  /**
   * Get state value from project's isolated context
   */
  getState(projectName: string, key: string): any {
    const context = this.contexts.get(projectName);
    if (!context) {
      throw new Error(`Project context not found: ${projectName}`);
    }
    return context.isolatedState.get(key);
  }

  /**
   * Clear state for a project
   */
  clearState(projectName: string): void {
    const context = this.contexts.get(projectName);
    if (!context) {
      throw new Error(`Project context not found: ${projectName}`);
    }
    context.isolatedState.clear();
  }

  /**
   * Reload project configurations (for hot-reloading)
   */
  async reload(): Promise<void> {
    this.contexts.clear();
    await this.initialize();
  }

  /**
   * Get statistics about managed projects
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    contexts: number;
  } {
    const allProjects = Object.values(this.projectConfigs);
    return {
      total: allProjects.length,
      enabled: allProjects.filter(p => p.enabled).length,
      disabled: allProjects.filter(p => !p.enabled).length,
      contexts: this.contexts.size,
    };
  }
}
