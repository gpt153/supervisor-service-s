/**
 * Dev Environment Deployer
 * Deploys interactive UI mockups to dev environments with hot reload
 * Epic: UI-007 - Dev Environment Deployment
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { pool } from '../db/client.js';
import type {
  DevDeployment,
  DeployMockupParams,
  DeployMockupResult,
  GetPreviewUrlsParams,
  GetPreviewUrlsResult,
  ViteConfig,
  ViteTemplateVars,
  PreviewUrl,
  PreviewDeployment,
  DevFramework,
  DeploymentStatus,
  ProcessResult,
  DevServerProcess,
} from '../types/ui-007.js';
import type { UIMockup } from '../types/ui-003.js';

const execAsync = promisify(exec);

/**
 * Dev Environment Deployer class
 */
export class DevEnvironmentDeployer {
  private readonly templatesDir: string;
  private readonly deploymentsDir: string;
  private readonly processes: Map<string, DevServerProcess>;

  constructor(templatesDir?: string, deploymentsDir?: string) {
    this.templatesDir = templatesDir || join(process.cwd(), 'templates');
    this.deploymentsDir = deploymentsDir || join(process.cwd(), '.dev-deployments');
    this.processes = new Map();
  }

  /**
   * Deploy a UI mockup to dev environment
   *
   * @param params - Deployment parameters
   * @returns Deployment result with URL and status
   */
  async deployMockup(params: DeployMockupParams): Promise<DeployMockupResult> {
    try {
      // 1. Get mockup from database
      const mockup = await this.getMockup(params.epicId);
      if (!mockup) {
        return {
          success: false,
          error: `Mockup not found for epic: ${params.epicId}`,
        };
      }

      // 2. Allocate port if not provided
      const port = params.port || (await this.allocatePort(mockup.project_name));
      if (!port) {
        return {
          success: false,
          error: 'Failed to allocate port for deployment',
        };
      }

      // 3. Determine framework (default: vite)
      const framework = params.framework || 'vite';

      // 4. Generate base path
      const basePath = params.basePath || `/${mockup.project_name}/dev`;

      // 5. Create deployment directory
      const deploymentDir = join(this.deploymentsDir, mockup.project_name, params.epicId);
      await mkdir(deploymentDir, { recursive: true });

      // 6. Generate component code from mockup
      const codeGenResult = await this.generateComponentCode(mockup, deploymentDir);
      if (!codeGenResult.success) {
        return {
          success: false,
          error: `Code generation failed: ${codeGenResult.error}`,
        };
      }

      // 7. Generate config files based on framework
      if (framework === 'vite') {
        await this.generateViteConfig(mockup, port, basePath, deploymentDir);
      } else if (framework === 'nextjs') {
        await this.generateNextConfig(mockup, port, basePath, deploymentDir);
      }

      // 8. Inject mock data if enabled
      if (params.mockDataInjection !== false) {
        await this.injectMockData(mockup, deploymentDir);
      }

      // 9. Install dependencies
      const installResult = await this.installDependencies(deploymentDir);
      if (!installResult.success) {
        return {
          success: false,
          error: `Dependency installation failed: ${installResult.error}`,
          buildLog: installResult.output,
        };
      }

      // 10. Start dev server
      const serverResult = await this.startDevServer(
        mockup,
        framework,
        port,
        deploymentDir,
        params.hotReload !== false
      );
      if (!serverResult.success) {
        return {
          success: false,
          error: `Failed to start dev server: ${serverResult.error}`,
          buildLog: serverResult.output,
        };
      }

      // 11. Create deployment record in database
      const devUrl = `https://ui.153.se${basePath}`;
      const deployment = await this.createDeploymentRecord(
        mockup,
        framework,
        port,
        basePath,
        devUrl,
        serverResult.process!.pid,
        params.hotReload !== false,
        params.mockDataInjection !== false
      );

      // 12. Generate preview URLs
      const previewUrls = await this.generatePreviewUrls(mockup, devUrl);

      return {
        success: true,
        deployment,
        devUrl,
        previewUrls,
        buildLog: installResult.output,
      };
    } catch (error) {
      console.error('Deployment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error',
      };
    }
  }

  /**
   * Get preview URLs for deployed mockups
   *
   * @param params - Filter parameters
   * @returns List of preview deployments
   */
  async getPreviewUrls(params: GetPreviewUrlsParams): Promise<GetPreviewUrlsResult> {
    try {
      let query = 'SELECT * FROM dev_deployments WHERE 1=1';
      const queryParams: any[] = [];

      if (params.epicId) {
        queryParams.push(params.epicId);
        query += ` AND epic_id = $${queryParams.length}`;
      }

      if (params.projectName) {
        queryParams.push(params.projectName);
        query += ` AND project_name = $${queryParams.length}`;
      }

      if (params.status) {
        queryParams.push(params.status);
        query += ` AND status = $${queryParams.length}`;
      }

      query += ' ORDER BY updated_at DESC';

      const result = await pool.query<DevDeployment>(query, queryParams);
      const deployments: PreviewDeployment[] = [];

      for (const deployment of result.rows) {
        const mockup = await this.getMockup(deployment.epic_id);
        if (mockup) {
          const previewUrls = await this.generatePreviewUrls(mockup, deployment.dev_url);
          deployments.push({
            epicId: deployment.epic_id,
            projectName: deployment.project_name,
            framework: deployment.framework,
            devUrl: deployment.dev_url,
            status: deployment.status,
            previewUrls,
            lastUpdated: deployment.updated_at.toISOString(),
          });
        }
      }

      return {
        success: true,
        deployments,
      };
    } catch (error) {
      console.error('Error getting preview URLs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Stop a dev server deployment
   *
   * @param epicId - Epic ID to stop
   * @returns Success status
   */
  async stopDeployment(epicId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get deployment from database
      const result = await pool.query<DevDeployment>(
        'SELECT * FROM dev_deployments WHERE epic_id = $1',
        [epicId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Deployment not found' };
      }

      const deployment = result.rows[0];

      // Kill process if running
      if (deployment.process_id) {
        try {
          process.kill(deployment.process_id, 'SIGTERM');
        } catch (error) {
          console.warn(`Failed to kill process ${deployment.process_id}:`, error);
        }
      }

      // Update database
      await pool.query(
        'UPDATE dev_deployments SET status = $1, process_id = NULL, updated_at = NOW() WHERE epic_id = $2',
        ['stopped', epicId]
      );

      // Remove from process map
      this.processes.delete(epicId);

      return { success: true };
    } catch (error) {
      console.error('Error stopping deployment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get mockup from database
   */
  private async getMockup(epicId: string): Promise<UIMockup | null> {
    const result = await pool.query<UIMockup>('SELECT * FROM ui_mockups WHERE epic_id = $1', [epicId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Allocate a port for deployment
   */
  private async allocatePort(projectName: string): Promise<number | null> {
    // Query for next available port in range 5260-5279
    const result = await pool.query<{ port: number }>(
      `SELECT port FROM dev_deployments
       WHERE port BETWEEN 5260 AND 5279
       ORDER BY port DESC LIMIT 1`
    );

    if (result.rows.length === 0) {
      return 5260; // Start of range
    }

    const lastPort = result.rows[0].port;
    const nextPort = lastPort + 1;

    if (nextPort > 5279) {
      console.error('No available ports in range 5260-5279');
      return null;
    }

    return nextPort;
  }

  /**
   * Generate React component code from mockup design
   */
  private async generateComponentCode(
    mockup: UIMockup,
    deploymentDir: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const srcDir = join(deploymentDir, 'src');
      await mkdir(srcDir, { recursive: true });

      // Generate App.tsx (main component)
      const appCode = this.generateAppComponent(mockup);
      await writeFile(join(srcDir, 'App.tsx'), appCode);

      // Generate components for each design element
      if (mockup.design_data && mockup.design_data.frames) {
        for (const frame of mockup.design_data.frames) {
          const componentCode = this.generateFrameComponent(frame);
          await writeFile(join(srcDir, `${frame.name}.tsx`), componentCode);
        }
      }

      // Generate main.tsx (entry point)
      const mainCode = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;
      await writeFile(join(srcDir, 'main.tsx'), mainCode);

      // Generate basic CSS
      const cssCode = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;
      await writeFile(join(srcDir, 'index.css'), cssCode);

      return { success: true };
    } catch (error) {
      console.error('Code generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate App component code
   */
  private generateAppComponent(mockup: UIMockup): string {
    const imports: string[] = [];
    const components: string[] = [];

    if (mockup.design_data && mockup.design_data.frames) {
      mockup.design_data.frames.forEach((frame) => {
        imports.push(`import ${frame.name} from './${frame.name}'`);
        components.push(`      <${frame.name} />`);
      });
    }

    return `import React from 'react'
${imports.join('\n')}

function App() {
  return (
    <div className="app">
      <h1>${mockup.epic_id} - Feature Mockup</h1>
${components.join('\n')}
    </div>
  )
}

export default App
`;
  }

  /**
   * Generate component code for a Frame0 frame
   */
  private generateFrameComponent(frame: any): string {
    return `import React from 'react'

function ${frame.name}() {
  return (
    <div className="${frame.name.toLowerCase()}" style={{
      width: ${frame.width}px,
      height: ${frame.height}px,
      border: '1px solid #ccc',
      padding: '16px',
    }}>
      <h2>${frame.name}</h2>
      {/* TODO: Generate components from frame.components */}
    </div>
  )
}

export default ${frame.name}
`;
  }

  /**
   * Generate Vite configuration files
   */
  private async generateViteConfig(
    mockup: UIMockup,
    port: number,
    basePath: string,
    deploymentDir: string
  ): Promise<void> {
    // vite.config.ts
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '${basePath}',
  server: {
    port: ${port},
    strictPort: true,
    host: '0.0.0.0',
    hmr: {
      protocol: 'wss',
      host: 'ui.153.se',
      port: 443,
      clientPort: 443,
      path: '${basePath}/__vite_hmr',
    },
  },
})
`;
    await writeFile(join(deploymentDir, 'vite.config.ts'), viteConfig);

    // package.json
    const packageJson = {
      name: `${mockup.project_name}-${mockup.epic_id}`,
      version: '0.0.1',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@types/react': '^18.2.43',
        '@types/react-dom': '^18.2.17',
        '@vitejs/plugin-react': '^4.2.1',
        typescript: '^5.3.3',
        vite: '^5.0.8',
      },
    };
    await writeFile(join(deploymentDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }],
    };
    await writeFile(join(deploymentDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

    // index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${mockup.epic_id} - Dev Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
    await writeFile(join(deploymentDir, 'index.html'), indexHtml);
  }

  /**
   * Generate Next.js configuration files
   */
  private async generateNextConfig(
    mockup: UIMockup,
    port: number,
    basePath: string,
    deploymentDir: string
  ): Promise<void> {
    // next.config.js
    const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '${basePath}',
  assetPrefix: '${basePath}',
}

module.exports = nextConfig
`;
    await writeFile(join(deploymentDir, 'next.config.js'), nextConfig);

    // package.json
    const packageJson = {
      name: `${mockup.project_name}-${mockup.epic_id}`,
      version: '0.0.1',
      scripts: {
        dev: `next dev -p ${port}`,
        build: 'next build',
        start: `next start -p ${port}`,
      },
      dependencies: {
        next: '^14.0.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        typescript: '^5.3.0',
      },
    };
    await writeFile(join(deploymentDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  }

  /**
   * Inject mock data into deployment
   */
  private async injectMockData(mockup: UIMockup, deploymentDir: string): Promise<void> {
    const mockDataDir = join(deploymentDir, 'src', 'mock-data');
    await mkdir(mockDataDir, { recursive: true });

    // Generate mock data file
    const mockData = {
      users: [
        { id: 1, name: 'Test User 1', email: 'test1@example.com' },
        { id: 2, name: 'Test User 2', email: 'test2@example.com' },
      ],
      // Add more mock data as needed
    };

    await writeFile(join(mockDataDir, 'data.json'), JSON.stringify(mockData, null, 2));
  }

  /**
   * Install npm dependencies
   */
  private async installDependencies(deploymentDir: string): Promise<ProcessResult> {
    try {
      const { stdout, stderr } = await execAsync('npm install', {
        cwd: deploymentDir,
        timeout: 120000, // 2 minutes
      });

      return {
        success: true,
        output: stdout + stderr,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        output: error.stdout + error.stderr,
      };
    }
  }

  /**
   * Start dev server
   */
  private async startDevServer(
    mockup: UIMockup,
    framework: DevFramework,
    port: number,
    deploymentDir: string,
    hotReload: boolean
  ): Promise<ProcessResult> {
    try {
      const command = framework === 'vite' ? 'npm run dev' : 'npm run dev';
      const child = spawn('sh', ['-c', command], {
        cwd: deploymentDir,
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      // Wait for server to start (check if port is listening)
      await this.waitForServer(port);

      const processInfo: DevServerProcess = {
        pid: child.pid!,
        port,
        epicId: mockup.epic_id,
        framework,
        startTime: new Date(),
        status: 'running',
      };

      this.processes.set(mockup.epic_id, processInfo);

      return {
        success: true,
        process: processInfo,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Wait for server to start listening on port
   */
  private async waitForServer(port: number, timeout = 30000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        await execAsync(`nc -z localhost ${port}`);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw new Error(`Server failed to start on port ${port} within ${timeout}ms`);
  }

  /**
   * Create deployment record in database
   */
  private async createDeploymentRecord(
    mockup: UIMockup,
    framework: DevFramework,
    port: number,
    basePath: string,
    devUrl: string,
    processId: number,
    hotReload: boolean,
    mockDataInjected: boolean
  ): Promise<DevDeployment> {
    const result = await pool.query<DevDeployment>(
      `INSERT INTO dev_deployments
       (epic_id, project_name, framework, port, base_path, dev_url, process_id, status, hot_reload_enabled, mock_data_injected, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       ON CONFLICT (epic_id) DO UPDATE SET
         framework = $3,
         port = $4,
         base_path = $5,
         dev_url = $6,
         process_id = $7,
         status = $8,
         hot_reload_enabled = $9,
         mock_data_injected = $10,
         updated_at = NOW()
       RETURNING *`,
      [
        mockup.epic_id,
        mockup.project_name,
        framework,
        port,
        basePath,
        devUrl,
        processId,
        'running',
        hotReload,
        mockDataInjected,
      ]
    );

    return result.rows[0];
  }

  /**
   * Generate preview URLs for mockup pages
   */
  private async generatePreviewUrls(mockup: UIMockup, devUrl: string): Promise<PreviewUrl[]> {
    const urls: PreviewUrl[] = [
      {
        path: '/',
        fullUrl: devUrl,
        description: 'Main page',
        acceptanceCriteria: [],
      },
    ];

    // Add more URLs based on design data
    if (mockup.design_data && mockup.design_data.frames) {
      mockup.design_data.frames.forEach((frame) => {
        urls.push({
          path: `/${frame.name.toLowerCase()}`,
          fullUrl: `${devUrl}/${frame.name.toLowerCase()}`,
          description: frame.name,
          acceptanceCriteria: [],
        });
      });
    }

    return urls;
  }
}
