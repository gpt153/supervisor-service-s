# Epic M-001: React Native Project Template & Database Schema

**Epic ID:** M-001
**Created:** 2026-02-04
**Status:** Pending
**Complexity Level:** 3
**Feature:** Mobile App Development Platform
**Estimated Effort:** 8 hours (1 day)
**Model:** Haiku

---

## Prerequisites

- [ ] Node.js v20+ installed (VERIFIED: v22.22.0 on odin3)
- [ ] PostgreSQL running (VERIFIED: supervisor_service on odin3:5434)
- [ ] No prior epics required (this is foundational)

---

## Acceptance Criteria

- [ ] Database migration creates `mobile_projects`, `mobile_test_runs`, `mobile_deployments`, `mobile_devices` tables
- [ ] `npm run migrate` completes without errors
- [ ] MCP tool `mobile_create_project` is registered and callable
- [ ] Calling `mobile_create_project({ project_name: "test-app", framework: "react-native" })` creates project scaffold at `/home/samuel/sv/test-app-s/`
- [ ] Scaffold includes: `package.json`, `tsconfig.json`, `app.json`, `src/` structure, `.bmad/` structure
- [ ] Project record inserted into `mobile_projects` table
- [ ] Port allocated from correct range for Metro bundler

---

## Implementation Steps

### Step 1: Create Database Migration

**File:** `/home/samuel/sv/supervisor-service-s/migrations/1770200000000_mobile_platform.sql`
**Action:** Create new file

```sql
-- Mobile Platform Database Schema
-- Epic M-001: Foundation tables for mobile app development

-- Track mobile projects
CREATE TABLE IF NOT EXISTS mobile_projects (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL UNIQUE,
  framework TEXT NOT NULL CHECK (framework IN ('react-native', 'flutter')),
  project_path TEXT NOT NULL,
  android_package_id TEXT,
  ios_bundle_id TEXT,
  metro_port INTEGER,
  port_range_start INTEGER,
  port_range_end INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  last_build TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'error'))
);

-- Track test runs on Firebase Test Lab
CREATE TABLE IF NOT EXISTS mobile_test_runs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES mobile_projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  test_matrix_id TEXT,
  device_model TEXT,
  os_version TEXT,
  test_type TEXT CHECK (test_type IN ('instrumentation', 'robo', 'xctest')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed', 'error')),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  test_duration_seconds INTEGER,
  results_url TEXT,
  artifacts_path TEXT,
  failure_reason TEXT
);

-- Track deployments to TestFlight/Play Store
CREATE TABLE IF NOT EXISTS mobile_deployments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES mobile_projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  version_code INTEGER NOT NULL,
  version_name TEXT NOT NULL,
  build_number INTEGER NOT NULL,
  deployment_type TEXT CHECK (deployment_type IN ('testflight', 'play-internal', 'play-beta', 'play-production')),
  deployed_at TIMESTAMP DEFAULT NOW(),
  deployed_by TEXT,
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'available', 'failed')),
  distribution_url TEXT,
  release_notes TEXT,
  commit_hash TEXT
);

-- Firebase Test Lab device catalog
CREATE TABLE IF NOT EXISTS mobile_devices (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  model_name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  os_version TEXT NOT NULL,
  is_virtual BOOLEAN DEFAULT false,
  firebase_device_id TEXT UNIQUE,
  available BOOLEAN DEFAULT true,
  last_used TIMESTAMP,
  form_factor TEXT CHECK (form_factor IN ('phone', 'tablet'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mobile_test_runs_project ON mobile_test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_mobile_test_runs_status ON mobile_test_runs(status);
CREATE INDEX IF NOT EXISTS idx_mobile_deployments_project ON mobile_deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_platform ON mobile_devices(platform);

-- Seed common Android virtual devices
INSERT INTO mobile_devices (platform, model_name, model_id, os_version, is_virtual, firebase_device_id, form_factor)
VALUES
  ('android', 'Pixel 5', 'redfin', '30', true, 'redfin', 'phone'),
  ('android', 'Pixel 6', 'oriole', '33', true, 'oriole', 'phone'),
  ('android', 'Pixel 7', 'panther', '33', true, 'panther', 'phone'),
  ('android', 'Samsung Galaxy S21', 'x1q', '31', false, 'x1q', 'phone'),
  ('android', 'Pixel Tablet', 'tangorpro', '33', true, 'tangorpro', 'tablet')
ON CONFLICT (firebase_device_id) DO NOTHING;
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npm run migrate 2>&1 | tail -5
psql -U supervisor -d supervisor_service -h localhost -p 5434 -c "\dt mobile_*"
```

### Step 2: Create Mobile Project Manager

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/MobileProjectManager.ts`
**Action:** Create new file

```typescript
/**
 * MobileProjectManager - Manages mobile project lifecycle
 *
 * Handles creation, tracking, and status of mobile projects.
 * Integrates with port allocation and project template systems.
 *
 * @module mobile
 */

import { Pool } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface CreateProjectOptions {
  project_name: string;
  framework: 'react-native' | 'flutter';
  android_package_id?: string;
  ios_bundle_id?: string;
}

export interface MobileProject {
  id: number;
  project_name: string;
  framework: string;
  project_path: string;
  android_package_id: string | null;
  ios_bundle_id: string | null;
  metro_port: number | null;
  status: string;
  created_at: Date;
}

export class MobileProjectManager {
  private pool: Pool;
  private svRoot: string;

  constructor(pool: Pool, svRoot: string = '/home/samuel/sv') {
    this.pool = pool;
    this.svRoot = svRoot;
  }

  /**
   * Create a new mobile project with scaffold and database entry
   *
   * @param options - Project creation options
   * @returns Created project record
   * @throws Error if project name already exists
   */
  async createProject(options: CreateProjectOptions): Promise<MobileProject> {
    const projectDir = path.join(this.svRoot, `${options.project_name}-s`);
    const packageId = options.android_package_id || `com.sv.${options.project_name.replace(/-/g, '')}`;
    const bundleId = options.ios_bundle_id || `com.sv.${options.project_name.replace(/-/g, '')}`;

    // Check if project already exists
    const existing = await this.pool.query(
      'SELECT id FROM mobile_projects WHERE project_name = $1',
      [options.project_name]
    );
    if (existing.rows.length > 0) {
      throw new Error(`Project "${options.project_name}" already exists`);
    }

    // Check if directory exists
    try {
      await fs.access(projectDir);
      throw new Error(`Directory "${projectDir}" already exists`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }

    // Create project scaffold
    await this.scaffoldReactNativeProject(projectDir, options.project_name, packageId, bundleId);

    // Create .bmad structure
    await this.createBmadStructure(projectDir, options.project_name);

    // Insert database record
    const result = await this.pool.query(
      `INSERT INTO mobile_projects
       (project_name, framework, project_path, android_package_id, ios_bundle_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [options.project_name, options.framework, projectDir, packageId, bundleId]
    );

    return result.rows[0];
  }

  /**
   * Scaffold a React Native project using Expo (managed workflow)
   */
  private async scaffoldReactNativeProject(
    projectDir: string,
    projectName: string,
    packageId: string,
    bundleId: string
  ): Promise<void> {
    // Create directory structure
    await fs.mkdir(projectDir, { recursive: true });

    // Create package.json
    const packageJson = {
      name: projectName,
      version: '1.0.0',
      main: 'expo/AppEntry.js',
      scripts: {
        start: 'expo start',
        android: 'expo start --android',
        ios: 'expo start --ios',
        web: 'expo start --web',
        test: 'jest',
        lint: 'eslint . --ext .ts,.tsx',
        'type-check': 'tsc --noEmit',
        'android:build': 'eas build --platform android --profile preview',
        'ios:build': 'eas build --platform ios --profile preview',
        'android:build-local': 'cd android && ./gradlew assembleDebug',
      },
      dependencies: {
        expo: '~52.0.0',
        'expo-status-bar': '~2.0.0',
        react: '18.3.1',
        'react-native': '0.76.0',
        '@react-navigation/native': '^7.0.0',
        '@react-navigation/native-stack': '^7.0.0',
        'react-native-screens': '~4.4.0',
        'react-native-safe-area-context': '~5.0.0',
      },
      devDependencies: {
        '@babel/core': '^7.24.0',
        '@types/react': '~18.3.0',
        typescript: '^5.3.0',
        'jest': '^29.7.0',
        'jest-expo': '~52.0.0',
        '@testing-library/react-native': '^12.0.0',
        eslint: '^8.57.0',
        'eslint-config-expo': '~8.0.0',
      },
    };
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create app.json (Expo config)
    const appJson = {
      expo: {
        name: projectName,
        slug: projectName,
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'light',
        newArchEnabled: true,
        splash: {
          image: './assets/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
        ios: {
          supportsTablet: true,
          bundleIdentifier: bundleId,
        },
        android: {
          adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: '#ffffff',
          },
          package: packageId,
        },
        web: {
          favicon: './assets/favicon.png',
        },
      },
    };
    await fs.writeFile(
      path.join(projectDir, 'app.json'),
      JSON.stringify(appJson, null, 2)
    );

    // Create tsconfig.json
    const tsconfig = {
      extends: 'expo/tsconfig.base',
      compilerOptions: {
        strict: true,
        paths: {
          '@/*': ['./src/*'],
        },
      },
    };
    await fs.writeFile(
      path.join(projectDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

    // Create directory structure
    const dirs = [
      'src/components',
      'src/screens',
      'src/services',
      'src/hooks',
      'src/types',
      'src/navigation',
      'src/utils',
      'assets',
      '__tests__',
    ];
    for (const dir of dirs) {
      await fs.mkdir(path.join(projectDir, dir), { recursive: true });
    }

    // Create App.tsx entry point
    const appTsx = `import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <RootNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
`;
    await fs.writeFile(path.join(projectDir, 'App.tsx'), appTsx);

    // Create RootNavigator
    const rootNavigator = `import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';

export type RootStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
}
`;
    await fs.mkdir(path.join(projectDir, 'src/navigation'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'src/navigation/RootNavigator.tsx'),
      rootNavigator
    );

    // Create HomeScreen
    const homeScreen = `import { View, Text, StyleSheet } from 'react-native';

export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to ${projectName}</Text>
      <Text style={styles.subtitle}>Built with the SV Supervisor System</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
`;
    await fs.mkdir(path.join(projectDir, 'src/screens'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'src/screens/HomeScreen.tsx'),
      homeScreen
    );

    // Create .gitignore
    const gitignore = `node_modules/
.expo/
dist/
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
android/app/build/
ios/Pods/
.env
.env.local
`;
    await fs.writeFile(path.join(projectDir, '.gitignore'), gitignore);

    // Create basic test
    const basicTest = `import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { HomeScreen } from '../src/screens/HomeScreen';

describe('HomeScreen', () => {
  it('renders welcome text', () => {
    render(<HomeScreen />);
    expect(screen.getByText(/Welcome to/)).toBeTruthy();
  });
});
`;
    await fs.writeFile(path.join(projectDir, '__tests__/HomeScreen.test.tsx'), basicTest);
  }

  /**
   * Create .bmad directory structure for the mobile project
   */
  private async createBmadStructure(projectDir: string, projectName: string): Promise<void> {
    const bmadDirs = [
      '.bmad/features',
      '.bmad/epics',
      '.bmad/adr',
      '.supervisor-core',
      '.supervisor-specific',
    ];
    for (const dir of bmadDirs) {
      await fs.mkdir(path.join(projectDir, dir), { recursive: true });
    }

    // Create workflow-status.yaml
    const workflowStatus = `# Workflow Status for ${projectName}
project: ${projectName}
type: mobile
framework: react-native
status: active
created: ${new Date().toISOString().split('T')[0]}

epics: []
`;
    await fs.writeFile(
      path.join(projectDir, '.bmad/workflow-status.yaml'),
      workflowStatus
    );
  }

  /**
   * Get project by name
   */
  async getProject(projectName: string): Promise<MobileProject | null> {
    const result = await this.pool.query(
      'SELECT * FROM mobile_projects WHERE project_name = $1',
      [projectName]
    );
    return result.rows[0] || null;
  }

  /**
   * List all mobile projects
   */
  async listProjects(status?: string): Promise<MobileProject[]> {
    const query = status
      ? 'SELECT * FROM mobile_projects WHERE status = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM mobile_projects ORDER BY created_at DESC';
    const params = status ? [status] : [];
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Update project status
   */
  async updateStatus(projectName: string, status: string): Promise<void> {
    await this.pool.query(
      'UPDATE mobile_projects SET status = $1 WHERE project_name = $2',
      [status, projectName]
    );
  }
}
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit src/mobile/MobileProjectManager.ts 2>&1 | head -10
```

### Step 3: Create MCP Tool - mobile_create_project

**File:** `/home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts`
**Action:** Create new file

```typescript
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
import { getPool } from '../../db/client.js';

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
      const pool = getPool();
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
      const pool = getPool();
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
      const pool = getPool();
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
      const pool = getPool();
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
      const pool = getPool();

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
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit src/mcp/tools/mobile-tools.ts 2>&1 | head -10
```

### Step 4: Register Mobile Tools in Tool Index

**File:** `/home/samuel/sv/supervisor-service-s/src/mcp/tools/index.ts`
**Action:** Modify - Add import and registration

Add after the last import line:
```typescript
import { getMobileTools } from './mobile-tools.js';
```

Add to the `getAllTools()` return array (before the closing bracket):
```typescript
    // Mobile app development platform tools (Epic M-001)
    ...getMobileTools(),
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit 2>&1 | head -20
```

### Step 5: Create Mobile Project Template for CLAUDE.md Generation

**File:** `/home/samuel/sv/templates/mobile-claude-template.md`
**Action:** Create new file

```markdown
# Mobile Project: {{PROJECT_NAME}}

**Framework:** React Native (Expo)
**Created:** {{DATE}}
**Platform Target:** Android (primary), iOS (future)

## Quick Start

\`\`\`bash
cd /home/samuel/sv/{{PROJECT_NAME}}-s
npm install
npx expo start
\`\`\`

## Structure

\`\`\`
src/
  components/   - Reusable UI components
  screens/      - Screen components
  navigation/   - React Navigation setup
  services/     - API clients, business logic
  hooks/        - Custom React hooks
  types/        - TypeScript types
  utils/        - Utility functions
\`\`\`

## Build Commands

\`\`\`bash
# Development
npx expo start                    # Start Metro bundler
npx expo start --android          # Open in Android emulator
npx expo start --ios              # Open in iOS simulator

# Testing
npm test                          # Run Jest tests
npm run lint                      # Run ESLint
npm run type-check                # TypeScript check

# Build
npm run android:build             # Build Android APK (EAS)
npm run ios:build                 # Build iOS IPA (EAS)
\`\`\`

## Testing on Devices

Tests run via Firebase Test Lab (free tier: 60 min/day).
Use MCP tool `mobile_run_tests` to submit test runs.
```

**Verify:**
```bash
test -f /home/samuel/sv/templates/mobile-claude-template.md && echo "Template created" || echo "MISSING"
```

### Step 6: Run Database Migration

**Action:** Execute migration

```bash
cd /home/samuel/sv/supervisor-service-s && npm run migrate
```

**Verify:**
```bash
psql -U supervisor -d supervisor_service -h localhost -p 5434 -c "\dt mobile_*"
# Should show 4 tables: mobile_projects, mobile_test_runs, mobile_deployments, mobile_devices

psql -U supervisor -d supervisor_service -h localhost -p 5434 -c "SELECT COUNT(*) FROM mobile_devices;"
# Should show 5 (seeded devices)
```

### Step 7: Verify Full Integration

**Action:** Build and type-check the entire project

```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit 2>&1 | tail -5
# Should output: no errors

# Verify tools are registered
grep -c "mobile_" src/mcp/tools/mobile-tools.ts
# Should show 5+ (tool names)
```

---

## Validation Checklist

- [ ] Migration creates 4 tables without error
- [ ] 5 Android virtual devices seeded into mobile_devices
- [ ] MobileProjectManager.ts compiles without errors
- [ ] mobile-tools.ts compiles without errors
- [ ] 5 MCP tools registered: mobile_create_project, mobile_list_projects, mobile_get_project, mobile_list_devices, mobile_check_quota
- [ ] Full project `tsc --noEmit` passes
- [ ] Template file created at /home/samuel/sv/templates/mobile-claude-template.md

---

## Rollback

If this epic fails, revert with:

```bash
# Drop database tables
psql -U supervisor -d supervisor_service -h localhost -p 5434 -c "
  DROP TABLE IF EXISTS mobile_deployments CASCADE;
  DROP TABLE IF EXISTS mobile_test_runs CASCADE;
  DROP TABLE IF EXISTS mobile_devices CASCADE;
  DROP TABLE IF EXISTS mobile_projects CASCADE;
"

# Remove files
rm -f /home/samuel/sv/supervisor-service-s/src/mobile/MobileProjectManager.ts
rm -f /home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts
rm -f /home/samuel/sv/supervisor-service-s/migrations/1770200000000_mobile_platform.sql
rm -f /home/samuel/sv/templates/mobile-claude-template.md

# Revert index.ts changes
git checkout -- /home/samuel/sv/supervisor-service-s/src/mcp/tools/index.ts
```

---

## Dependencies

**Blocked By:** None (foundational epic)
**Blocks:** M-002 (Android Local Build), M-003 (GitHub Actions), M-004 (Firebase), M-005 (iOS), M-006 (iOS CI/CD)
