/**
 * MCP tools for mobile app development platform
 *
 * Provides tools for creating, managing, and testing mobile projects.
 * Integrates with Firebase Test Lab, fastlane, and GitHub Actions.
 *
 * @module mcp/tools/mobile-tools
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { MobileProjectManager } from '../../mobile/MobileProjectManager.js';
import { AndroidBuildManager } from '../../mobile/AndroidBuildManager.js';
import { FirebaseTestLabClient } from '../../mobile/FirebaseTestLabClient.js';
import { pool } from '../../db/client.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Get all mobile development MCP tools
 *
 * @returns Array of mobile tool definitions
 */
export function getMobileTools(): ToolDefinition[] {
  return [
    mobileCreateProjectTool,
    mobileListProjectsTool,
    mobileGetProjectTool,
    mobileListDevicesTool,
    mobileCheckQuotaTool,
    mobileCheckSdkTool,
    mobileBuildAndroidTool,
    mobileEmulatorStatusTool,
    mobileGithubStatusTool,
    mobileSetupCITool,
    mobileRunTestsTool,
    mobileGetTestResultsTool,
  ];
}

/**
 * mobile_create_project - Create a new mobile project with scaffold
 */
const mobileCreateProjectTool: ToolDefinition = {
  name: 'mobile_create_project',
  description: 'Create a new mobile project with React Native or Flutter scaffold, .bmad structure, and database tracking. Creates the project directory at /home/samuel/sv/{project_name}-s/',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project (e.g., "my-app"). Will create directory at /home/samuel/sv/{project_name}-s/',
      },
      framework: {
        type: 'string',
        enum: ['react-native', 'flutter'],
        description: 'Mobile framework to use. Default: react-native',
      },
      android_package_id: {
        type: 'string',
        description: 'Android package ID (e.g., com.company.app). Auto-generated if not provided.',
      },
      ios_bundle_id: {
        type: 'string',
        description: 'iOS bundle ID (e.g., com.company.app). Auto-generated if not provided.',
      },
    },
    required: ['project_name'],
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      const manager = new MobileProjectManager(pool);

      const project = await manager.createProject({
        project_name: params.project_name,
        framework: params.framework || 'react-native',
        android_package_id: params.android_package_id,
        ios_bundle_id: params.ios_bundle_id,
      });

      return {
        success: true,
        project: {
          id: project.id,
          name: project.project_name,
          framework: project.framework,
          path: project.project_path,
          android_package_id: project.android_package_id,
          ios_bundle_id: project.ios_bundle_id,
        },
        next_steps: [
          `cd ${project.project_path} && npm install`,
          'npx expo start (to run Metro bundler)',
          'Create epics in .bmad/epics/ for your features',
        ],
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
 * mobile_list_projects - List all mobile projects
 */
const mobileListProjectsTool: ToolDefinition = {
  name: 'mobile_list_projects',
  description: 'List all mobile projects tracked in the database',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'archived', 'error'],
        description: 'Filter by project status. Omit for all projects.',
      },
    },
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      const manager = new MobileProjectManager(pool);
      const projects = await manager.listProjects(params.status);

      return {
        success: true,
        count: projects.length,
        projects: projects.map(p => ({
          id: p.id,
          name: p.project_name,
          framework: p.framework,
          path: p.project_path,
          status: p.status,
          created_at: p.created_at,
        })),
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
 * mobile_get_project - Get details of a specific mobile project
 */
const mobileGetProjectTool: ToolDefinition = {
  name: 'mobile_get_project',
  description: 'Get detailed information about a specific mobile project',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project',
      },
    },
    required: ['project_name'],
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      const manager = new MobileProjectManager(pool);
      const project = await manager.getProject(params.project_name);

      if (!project) {
        return { success: false, error: `Project "${params.project_name}" not found` };
      }

      // Get recent test runs
      const testRuns = await pool.query(
        'SELECT * FROM mobile_test_runs WHERE project_id = $1 ORDER BY started_at DESC LIMIT 5',
        [project.id]
      );

      // Get recent deployments
      const deployments = await pool.query(
        'SELECT * FROM mobile_deployments WHERE project_id = $1 ORDER BY deployed_at DESC LIMIT 5',
        [project.id]
      );

      return {
        success: true,
        project,
        recent_test_runs: testRuns.rows,
        recent_deployments: deployments.rows,
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
 * mobile_list_devices - List available Firebase Test Lab devices
 */
const mobileListDevicesTool: ToolDefinition = {
  name: 'mobile_list_devices',
  description: 'List available devices in Firebase Test Lab for testing',
  inputSchema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['android', 'ios'],
        description: 'Filter by platform. Omit for all devices.',
      },
      form_factor: {
        type: 'string',
        enum: ['phone', 'tablet'],
        description: 'Filter by form factor. Omit for all.',
      },
    },
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      let query = 'SELECT * FROM mobile_devices WHERE available = true';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (params.platform) {
        query += ` AND platform = $${paramIndex++}`;
        queryParams.push(params.platform);
      }
      if (params.form_factor) {
        query += ` AND form_factor = $${paramIndex++}`;
        queryParams.push(params.form_factor);
      }
      query += ' ORDER BY platform, model_name';

      const result = await pool.query(query, queryParams);
      return {
        success: true,
        count: result.rows.length,
        devices: result.rows,
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
 * mobile_check_quota - Check Firebase Test Lab free tier usage
 */
const mobileCheckQuotaTool: ToolDefinition = {
  name: 'mobile_check_quota',
  description: 'Check Firebase Test Lab free tier quota usage for today',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      // Calculate today's usage from test runs
      const result = await pool.query(`
        SELECT
          COALESCE(SUM(test_duration_seconds), 0) as total_seconds,
          COUNT(*) as total_runs,
          COUNT(*) FILTER (WHERE status = 'passed') as passed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE status = 'running') as running
        FROM mobile_test_runs
        WHERE started_at >= CURRENT_DATE
      `);

      const usage = result.rows[0];
      const usedMinutes = Math.ceil(usage.total_seconds / 60);
      const dailyLimitMinutes = 60; // Firebase free tier

      return {
        success: true,
        quota: {
          minutes_used_today: usedMinutes,
          minutes_remaining: Math.max(0, dailyLimitMinutes - usedMinutes),
          daily_limit_minutes: dailyLimitMinutes,
          percentage_used: Math.round((usedMinutes / dailyLimitMinutes) * 100),
          resets_at: 'midnight UTC',
        },
        today_runs: {
          total: parseInt(usage.total_runs),
          passed: parseInt(usage.passed),
          failed: parseInt(usage.failed),
          running: parseInt(usage.running),
        },
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
 * mobile_check_sdk - Check Android SDK installation status
 */
const mobileCheckSdkTool: ToolDefinition = {
  name: 'mobile_check_sdk',
  description: 'Check if Android SDK, JDK, and build tools are properly installed on the host machine',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params: any, context: ProjectContext) => {
    const manager = new AndroidBuildManager();
    return await manager.checkSdkInstallation();
  },
};

/**
 * mobile_build_android - Build Android APK locally
 */
const mobileBuildAndroidTool: ToolDefinition = {
  name: 'mobile_build_android',
  description: 'Build Android APK from a React Native project. Runs expo prebuild if needed, then Gradle assembleDebug.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project',
      },
      build_type: {
        type: 'string',
        enum: ['debug', 'release'],
        description: 'Build type. Default: debug',
      },
      skip_prebuild: {
        type: 'boolean',
        description: 'Skip expo prebuild step if android/ already exists. Default: false',
      },
    },
    required: ['project_name'],
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      const projectManager = new MobileProjectManager(pool);
      const project = await projectManager.getProject(params.project_name);

      if (!project) {
        return { success: false, error: `Project "${params.project_name}" not found` };
      }

      const buildManager = new AndroidBuildManager();

      // Check SDK first
      const sdk = await buildManager.checkSdkInstallation();
      if (!sdk.installed) {
        return {
          success: false,
          error: 'Android SDK not properly installed',
          missing: sdk.missing,
          instructions: [
            'sudo apt install -y openjdk-17-jdk',
            'Install Android SDK command-line tools',
            'Set ANDROID_HOME and JAVA_HOME',
          ],
        };
      }

      // Run prebuild if needed
      if (!params.skip_prebuild) {
        const prebuild = await buildManager.runPrebuild(project.project_path);
        if (!prebuild.success) {
          return { success: false, error: `Prebuild failed: ${prebuild.error}` };
        }
      }

      // Build APK
      const buildType = params.build_type || 'debug';
      const result = buildType === 'release'
        ? await buildManager.buildReleaseApk(project.project_path)
        : await buildManager.buildDebugApk(project.project_path);

      // Update last_build in database
      if (result.success) {
        await pool.query(
          'UPDATE mobile_projects SET last_build = NOW() WHERE id = $1',
          [project.id]
        );
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
 * mobile_emulator_status - Check Android emulator status
 */
const mobileEmulatorStatusTool: ToolDefinition = {
  name: 'mobile_emulator_status',
  description: 'Check if an Android emulator is currently running',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params: any, context: ProjectContext) => {
    const manager = new AndroidBuildManager();
    return await manager.getEmulatorStatus();
  },
};

/**
 * mobile_github_status - Check GitHub Actions build status
 */
const mobileGithubStatusTool: ToolDefinition = {
  name: 'mobile_github_status',
  description: 'Check the latest GitHub Actions build status for a mobile project. Requires gh CLI installed.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project',
      },
      workflow: {
        type: 'string',
        description: 'Workflow name to check. Default: "Android CI"',
      },
    },
    required: ['project_name'],
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      const projectManager = new MobileProjectManager(pool);
      const project = await projectManager.getProject(params.project_name);

      if (!project) {
        return { success: false, error: `Project "${params.project_name}" not found` };
      }

      // Use gh CLI to check workflow runs
      const workflowName = params.workflow || 'Android CI';
      try {
        const { stdout } = await execAsync(
          `cd "${project.project_path}" && gh run list --workflow="${workflowName}" --limit=5 --json status,conclusion,createdAt,headBranch,databaseId 2>&1`,
          { timeout: 15000 }
        );
        const runs = JSON.parse(stdout);
        return {
          success: true,
          workflow: workflowName,
          recent_runs: runs,
        };
      } catch (error: any) {
        return {
          success: false,
          error: 'gh CLI not available or not in a git repo',
          hint: 'Ensure gh CLI is installed and project has a GitHub remote',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * mobile_setup_ci - Set up GitHub Actions CI/CD for a mobile project
 */
const mobileSetupCITool: ToolDefinition = {
  name: 'mobile_setup_ci',
  description: 'Copy GitHub Actions workflow templates to a mobile project. Sets up Android CI pipeline.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project',
      },
    },
    required: ['project_name'],
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      const projectManager = new MobileProjectManager(pool);
      const project = await projectManager.getProject(params.project_name);

      if (!project) {
        return { success: false, error: `Project "${params.project_name}" not found` };
      }

      // Run setup script
      const { stdout, stderr } = await execAsync(
        `/home/samuel/sv/supervisor-service-s/src/mobile/scripts/setup-github-workflows.sh "${project.project_path}"`,
        { timeout: 10000 }
      );

      return {
        success: true,
        output: stdout,
        workflows_installed: ['android-ci.yml'],
        next_steps: [
          'git add .github/workflows/',
          'git commit -m "ci: add Android CI pipeline"',
          'git push origin main',
          'Check GitHub Actions tab for build status',
        ],
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
 * mobile_run_tests - Submit APK to Firebase Test Lab
 */
const mobileRunTestsTool: ToolDefinition = {
  name: 'mobile_run_tests',
  description: 'Submit an Android APK to Firebase Test Lab for testing on virtual or physical devices. Free tier: 60 min/day.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project',
      },
      apk_path: {
        type: 'string',
        description: 'Path to the APK file to test. If omitted, uses latest debug build.',
      },
      device_model: {
        type: 'string',
        description: 'Firebase device model ID (e.g., "redfin" for Pixel 5). Default: redfin',
      },
      os_version: {
        type: 'string',
        description: 'Android API level (e.g., "30"). Default: 30',
      },
      test_type: {
        type: 'string',
        enum: ['robo', 'instrumentation'],
        description: 'Type of test. "robo" requires no test code. Default: robo',
      },
    },
    required: ['project_name'],
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      const projectManager = new MobileProjectManager(pool);
      const project = await projectManager.getProject(params.project_name);

      if (!project) {
        return { success: false, error: `Project "${params.project_name}" not found` };
      }

      // Get Firebase project ID from environment or vault
      const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
      if (!firebaseProjectId) {
        return {
          success: false,
          error: 'FIREBASE_PROJECT_ID not set. Configure in .env or vault.',
        };
      }

      const client = new FirebaseTestLabClient(pool, firebaseProjectId);

      // Authenticate
      const auth = await client.authenticate();
      if (!auth.success) {
        return { success: false, error: `Authentication failed: ${auth.error}` };
      }

      // Check quota
      const quota = await client.getQuotaUsage();
      if (quota.minutes_remaining <= 0) {
        return {
          success: false,
          error: 'Firebase Test Lab daily quota exceeded (60 min/day)',
          quota,
        };
      }

      // Determine APK path
      const apkPath = params.apk_path ||
        `${project.project_path}/android/app/build/outputs/apk/debug/app-debug.apk`;

      const result = await client.submitTest({
        project_id: project.id,
        apk_path: apkPath,
        device_model: params.device_model || 'redfin',
        os_version: params.os_version || '30',
        test_type: params.test_type || 'robo',
      });

      return {
        ...result,
        quota_remaining_minutes: quota.minutes_remaining,
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
 * mobile_get_test_results - Get Firebase Test Lab results
 */
const mobileGetTestResultsTool: ToolDefinition = {
  name: 'mobile_get_test_results',
  description: 'Get test results from Firebase Test Lab by test run ID',
  inputSchema: {
    type: 'object',
    properties: {
      test_run_id: {
        type: 'number',
        description: 'Test run ID from mobile_run_tests response',
      },
    },
    required: ['test_run_id'],
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
      if (!firebaseProjectId) {
        return { success: false, error: 'FIREBASE_PROJECT_ID not set' };
      }

      const client = new FirebaseTestLabClient(pool, firebaseProjectId);
      const result = await client.getTestResults(params.test_run_id);

      if (!result) {
        return { success: false, error: `Test run ${params.test_run_id} not found` };
      }

      return { success: true, ...result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
