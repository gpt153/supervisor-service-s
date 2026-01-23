/**
 * Nginx Configuration Manager
 * Handles nginx configuration for path-based routing to Storybook deployments
 * Epic: UI-006 - Complete Storybook Deployment
 */

import { readFile, writeFile, access } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pool } from '../db/client.js';
import type { StorybookDeployment } from '../types/design-system.js';

const execAsync = promisify(exec);

export interface NginxLocation {
  path: string; // e.g., /consilio/storybook/
  proxyPass: string; // e.g., http://localhost:5050/
  projectName: string;
}

export interface NginxConfig {
  port: number;
  locations: NginxLocation[];
  configPath: string;
}

/**
 * Manager class for nginx configuration
 */
export class NginxConfigManager {
  private readonly configPath: string;
  private readonly sitesAvailablePath: string;
  private readonly sitesEnabledPath: string;
  private readonly port: number;

  constructor(
    port: number = 8080,
    configPath: string = '/etc/nginx/sites-available/ui-proxy'
  ) {
    this.port = port;
    this.configPath = configPath;
    this.sitesAvailablePath = '/etc/nginx/sites-available';
    this.sitesEnabledPath = '/etc/nginx/sites-enabled';
  }

  /**
   * Generate nginx configuration for all active Storybook deployments
   *
   * @returns Generated nginx configuration content
   */
  async generateConfig(): Promise<string> {
    // Get all active Storybook deployments
    const deployments = await this.getActiveDeployments();

    // Build location blocks
    const locations = deployments
      .map(deployment => this.generateLocationBlock(deployment))
      .join('\n\n  ');

    // Build full config
    const config = `# Auto-generated nginx configuration for UI deployments
# Managed by supervisor-service NginxConfigManager
# DO NOT EDIT MANUALLY - changes will be overwritten

server {
  listen ${this.port};
  server_name _;

  # Root location (landing page)
  location = / {
    return 200 'UI Design Systems Dashboard\\n\\nAvailable Storybooks:\\n${deployments.map(d => `  - /${d.project_name}/storybook/`).join('\\n')}\\n';
    add_header Content-Type text/plain;
  }

  ${locations}

  # Fallback for unknown paths
  location / {
    return 404 'Not Found: No Storybook deployed at this path\\n';
    add_header Content-Type text/plain;
  }
}
`;

    return config;
  }

  /**
   * Generate location block for a single deployment
   */
  private generateLocationBlock(deployment: StorybookDeployment & { project_name: string }): string {
    const path = `/${deployment.project_name}/storybook/`;
    const proxyPass = `http://localhost:${deployment.port}/`;

    return `  # ${deployment.project_name} Storybook
  location ${path} {
    proxy_pass ${proxyPass};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;

    # WebSocket support for hot reload
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Rewrite path to remove project prefix
    rewrite ^/${deployment.project_name}/storybook(/(.*))?$ /$2 break;
  }`;
  }

  /**
   * Get all active Storybook deployments with project names
   */
  private async getActiveDeployments(): Promise<
    Array<StorybookDeployment & { project_name: string }>
  > {
    const query = `
      SELECT
        sd.*,
        ds.project_name
      FROM storybook_deployments sd
      JOIN design_systems ds ON sd.design_system_id = ds.id
      WHERE sd.status = 'running'
      ORDER BY ds.project_name
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Write nginx configuration to file
   *
   * @param content - Configuration content to write
   * @returns True if successful
   */
  async writeConfig(content: string): Promise<boolean> {
    try {
      await writeFile(this.configPath, content, { encoding: 'utf-8' });
      return true;
    } catch (error) {
      console.error('Error writing nginx config:', error);
      return false;
    }
  }

  /**
   * Test nginx configuration validity
   *
   * @returns True if configuration is valid
   */
  async testConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      await execAsync('sudo nginx -t');
      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Nginx config test failed:', errorMessage);
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Reload nginx to apply configuration changes
   *
   * @returns True if reload successful
   */
  async reloadNginx(): Promise<boolean> {
    try {
      await execAsync('sudo systemctl reload nginx');
      return true;
    } catch (error) {
      console.error('Error reloading nginx:', error);
      return false;
    }
  }

  /**
   * Enable nginx site configuration (symlink to sites-enabled)
   *
   * @returns True if successful
   */
  async enableSite(): Promise<boolean> {
    try {
      const enabledPath = `${this.sitesEnabledPath}/ui-proxy`;

      // Check if already enabled
      try {
        await access(enabledPath);
        return true; // Already enabled
      } catch {
        // Not enabled, create symlink
        await execAsync(`sudo ln -s ${this.configPath} ${enabledPath}`);
        return true;
      }
    } catch (error) {
      console.error('Error enabling nginx site:', error);
      return false;
    }
  }

  /**
   * Full update workflow: generate, write, test, reload
   *
   * @returns Result with success status and any errors
   */
  async updateAndReload(): Promise<{
    success: boolean;
    error?: string;
    config?: string;
  }> {
    try {
      // Generate new config
      const config = await this.generateConfig();

      // Write config
      const written = await this.writeConfig(config);
      if (!written) {
        return {
          success: false,
          error: 'Failed to write nginx configuration file',
        };
      }

      // Enable site if not already enabled
      await this.enableSite();

      // Test config
      const testResult = await this.testConfig();
      if (!testResult.valid) {
        return {
          success: false,
          error: `Nginx configuration test failed: ${testResult.error}`,
        };
      }

      // Reload nginx
      const reloaded = await this.reloadNginx();
      if (!reloaded) {
        return {
          success: false,
          error: 'Failed to reload nginx',
        };
      }

      return {
        success: true,
        config,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating nginx config:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Read current nginx configuration
   *
   * @returns Current configuration content or null if not found
   */
  async readCurrentConfig(): Promise<string | null> {
    try {
      const content = await readFile(this.configPath, 'utf-8');
      return content;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get nginx configuration for a specific project
   *
   * @param projectName - Project name
   * @returns Location configuration or null if not found
   */
  async getProjectLocation(projectName: string): Promise<NginxLocation | null> {
    const deployments = await this.getActiveDeployments();
    const deployment = deployments.find(d => d.project_name === projectName);

    if (!deployment) {
      return null;
    }

    return {
      path: `/${deployment.project_name}/storybook/`,
      proxyPass: `http://localhost:${deployment.port}/`,
      projectName: deployment.project_name,
    };
  }
}
