/**
 * Storybook Deployer
 * Handles deployment and lifecycle of Storybook instances
 * Epic: UI-002 - Design System Foundation
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pool } from '../db/client.js';
import { NginxConfigManager } from './NginxConfigManager.js';
import type {
  DesignSystem,
  StorybookConfig,
  StorybookDeployment,
  StorybookStatus,
  DeployStorybookParams,
  DeployStorybookResult,
} from '../types/design-system.js';

const execAsync = promisify(exec);

/**
 * Deployer class for Storybook instances
 */
export class StorybookDeployer {
  private readonly templatesDir: string;
  private readonly storybooksDir: string;
  private readonly nginxManager: NginxConfigManager;

  constructor(templatesDir?: string, storybooksDir?: string, nginxPort?: number) {
    this.templatesDir = templatesDir || join(process.cwd(), 'templates', 'storybook');
    this.storybooksDir = storybooksDir || join(process.cwd(), '.storybooks');
    this.nginxManager = new NginxConfigManager(nginxPort);
  }

  /**
   * Deploy Storybook for a design system
   *
   * @param designSystem - Design system to deploy Storybook for
   * @param params - Deployment parameters
   * @returns Deployment result
   */
  async deployStorybook(
    designSystem: DesignSystem,
    params: DeployStorybookParams
  ): Promise<DeployStorybookResult> {
    try {
      const port = params.port || designSystem.storybook_port;
      if (!port) {
        return {
          success: false,
          error: 'Port is required for Storybook deployment',
        };
      }

      const publicUrl = params.publicUrl || `http://localhost:${port}`;
      const projectDir = join(this.storybooksDir, designSystem.project_name);
      const buildDir = join(projectDir, 'storybook-static');

      // Create Storybook project directory
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, 'src'), { recursive: true });
      await mkdir(join(projectDir, '.storybook'), { recursive: true });

      // Generate config files from templates
      await this.generateConfigFiles(designSystem, projectDir, port, publicUrl, buildDir);

      // Create deployment record
      const deployment = await this.createDeploymentRecord(
        designSystem.id,
        port,
        publicUrl,
        buildDir
      );

      // Install dependencies
      await this.updateDeploymentStatus(deployment.id, 'building');
      await this.installDependencies(projectDir);

      // Start Storybook process
      await this.startStorybookProcess(deployment.id, projectDir, port);

      // Create ui_deployments record for nginx integration
      await this.createUIDeploymentRecord(
        designSystem.project_name,
        port,
        deployment.id
      );

      // Update nginx configuration
      const nginxResult = await this.nginxManager.updateAndReload();
      if (!nginxResult.success) {
        console.warn('Nginx update failed:', nginxResult.error);
        // Continue anyway - Storybook is running even if nginx failed
      }

      const updatedDeployment = await this.getDeployment(deployment.id);

      return {
        success: true,
        deployment: updatedDeployment || undefined,
        url: publicUrl,
        nginxUrl: nginxResult.success
          ? `http://localhost:8080/${designSystem.project_name}/storybook/`
          : undefined,
      };
    } catch (error) {
      console.error('Error deploying Storybook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deploying Storybook',
      };
    }
  }

  /**
   * Stop a Storybook deployment
   *
   * @param deploymentId - Deployment ID
   * @returns True if stopped successfully
   */
  async stopStorybook(deploymentId: number): Promise<boolean> {
    try {
      const deployment = await this.getDeployment(deploymentId);
      if (!deployment) {
        return false;
      }

      if (deployment.process_id) {
        try {
          process.kill(deployment.process_id, 'SIGTERM');
        } catch (error) {
          console.error('Error killing process:', error);
        }
      }

      await this.updateDeploymentStatus(deploymentId, 'stopped');
      return true;
    } catch (error) {
      console.error('Error stopping Storybook:', error);
      return false;
    }
  }

  /**
   * Restart a Storybook deployment
   *
   * @param deploymentId - Deployment ID
   * @returns True if restarted successfully
   */
  async restartStorybook(deploymentId: number): Promise<boolean> {
    try {
      const deployment = await this.getDeployment(deploymentId);
      if (!deployment) {
        return false;
      }

      // Stop existing process
      await this.stopStorybook(deploymentId);

      // Get design system info
      const designSystem = await this.getDesignSystemById(deployment.design_system_id);
      if (!designSystem) {
        return false;
      }

      // Start new process
      const projectDir = join(this.storybooksDir, designSystem.project_name);
      await this.startStorybookProcess(deploymentId, projectDir, deployment.port);

      // Update ui_deployments status
      await pool.query(
        `UPDATE ui_deployments SET status = 'active' WHERE project_name = $1 AND deployment_type = 'storybook'`,
        [designSystem.project_name]
      );

      // Update nginx configuration
      await this.nginxManager.updateAndReload();

      return true;
    } catch (error) {
      console.error('Error restarting Storybook:', error);
      return false;
    }
  }

  /**
   * Generate config files from templates
   */
  private async generateConfigFiles(
    designSystem: DesignSystem,
    projectDir: string,
    port: number,
    publicUrl: string,
    buildDir: string
  ): Promise<void> {
    // Load templates
    const packageJsonTemplate = await readFile(
      join(this.templatesDir, 'package.json.template'),
      'utf-8'
    );
    const mainTsTemplate = await readFile(join(this.templatesDir, 'main.ts.template'), 'utf-8');
    const previewTsTemplate = await readFile(
      join(this.templatesDir, 'preview.ts.template'),
      'utf-8'
    );
    const tsconfigTemplate = await readFile(
      join(this.templatesDir, 'tsconfig.json.template'),
      'utf-8'
    );
    const readmeTemplate = await readFile(join(this.templatesDir, 'README.md.template'), 'utf-8');

    // Replace placeholders
    const replacements: Record<string, string> = {
      '{{PROJECT_NAME}}': designSystem.project_name,
      '{{PORT}}': String(port),
      '{{BUILD_DIR}}': buildDir,
      '{{STYLE_CONFIG}}': JSON.stringify(designSystem.style_config, null, 2),
      '{{STORYBOOK_URL}}': publicUrl,
    };

    const replaceAll = (content: string): string => {
      let result = content;
      for (const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(key, 'g'), value);
      }
      return result;
    };

    // Write config files
    await writeFile(join(projectDir, 'package.json'), replaceAll(packageJsonTemplate));
    await writeFile(join(projectDir, '.storybook', 'main.ts'), replaceAll(mainTsTemplate));
    await writeFile(join(projectDir, '.storybook', 'preview.ts'), replaceAll(previewTsTemplate));
    await writeFile(join(projectDir, 'tsconfig.json'), replaceAll(tsconfigTemplate));
    await writeFile(join(projectDir, 'README.md'), replaceAll(readmeTemplate));
  }

  /**
   * Install npm dependencies
   */
  private async installDependencies(projectDir: string): Promise<void> {
    try {
      await execAsync('npm install', { cwd: projectDir });
    } catch (error) {
      console.error('Error installing dependencies:', error);
      throw new Error('Failed to install dependencies');
    }
  }

  /**
   * Start Storybook process
   */
  private async startStorybookProcess(
    deploymentId: number,
    projectDir: string,
    port: number
  ): Promise<void> {
    try {
      // Start Storybook in background
      const child = exec(`npm run storybook`, {
        cwd: projectDir,
        env: { ...process.env, PORT: String(port) },
      });

      // Update deployment with process ID
      await pool.query(
        `
        UPDATE storybook_deployments
        SET process_id = $1, status = $2, last_deployed_at = NOW()
        WHERE id = $3
      `,
        [child.pid, 'running', deploymentId]
      );

      // Handle process events
      child.on('error', async error => {
        console.error('Storybook process error:', error);
        await this.updateDeploymentStatus(deploymentId, 'failed');
      });

      child.on('exit', async (code, signal) => {
        console.log(`Storybook process exited with code ${code}, signal ${signal}`);
        if (code !== 0) {
          await this.updateDeploymentStatus(deploymentId, 'failed');
        } else {
          await this.updateDeploymentStatus(deploymentId, 'stopped');
        }
      });
    } catch (error) {
      console.error('Error starting Storybook process:', error);
      await this.updateDeploymentStatus(deploymentId, 'failed');
      throw error;
    }
  }

  /**
   * Create deployment record in database
   */
  private async createDeploymentRecord(
    designSystemId: number,
    port: number,
    url: string,
    buildDirectory: string
  ): Promise<StorybookDeployment> {
    const query = `
      INSERT INTO storybook_deployments (
        design_system_id,
        port,
        url,
        status,
        build_directory
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (design_system_id)
      DO UPDATE SET
        port = EXCLUDED.port,
        url = EXCLUDED.url,
        status = EXCLUDED.status,
        build_directory = EXCLUDED.build_directory,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [designSystemId, port, url, 'pending', buildDirectory]);
    return result.rows[0];
  }

  /**
   * Update deployment status
   */
  private async updateDeploymentStatus(
    deploymentId: number,
    status: StorybookStatus
  ): Promise<void> {
    await pool.query(
      `
      UPDATE storybook_deployments
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [status, deploymentId]
    );
  }

  /**
   * Get deployment by ID
   */
  private async getDeployment(deploymentId: number): Promise<StorybookDeployment | null> {
    const result = await pool.query(
      `
      SELECT * FROM storybook_deployments
      WHERE id = $1
    `,
      [deploymentId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get design system by ID
   */
  private async getDesignSystemById(designSystemId: number): Promise<DesignSystem | null> {
    const result = await pool.query(
      `
      SELECT * FROM design_systems
      WHERE id = $1
    `,
      [designSystemId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Create ui_deployments record for nginx integration
   */
  private async createUIDeploymentRecord(
    projectName: string,
    port: number,
    designSystemId: number
  ): Promise<void> {
    const nginxLocation = `/${projectName}/storybook/`;
    const url = `http://localhost:8080${nginxLocation}`;

    await pool.query(
      `
      INSERT INTO ui_deployments (
        project_name,
        deployment_type,
        port,
        url,
        nginx_location,
        status,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (project_name, deployment_type)
      DO UPDATE SET
        port = EXCLUDED.port,
        url = EXCLUDED.url,
        nginx_location = EXCLUDED.nginx_location,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
      [
        projectName,
        'storybook',
        port,
        url,
        nginxLocation,
        'active',
        { design_system_id: designSystemId },
      ]
    );
  }

  /**
   * Update nginx configuration for all deployments
   *
   * @returns Result of nginx update
   */
  async updateNginxConfig(): Promise<{
    success: boolean;
    error?: string;
    config?: string;
  }> {
    return await this.nginxManager.updateAndReload();
  }
}
