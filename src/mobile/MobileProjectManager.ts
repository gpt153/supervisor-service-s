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
import * as fs from 'fs/promises';
import * as path from 'path';

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

    // Set up GitHub Actions workflows
    await this.setupGitHubWorkflows(projectDir);

    // Copy fastlane template
    await this.setupFastlane(projectDir);

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

  /**
   * Set up GitHub Actions CI/CD workflows for the project
   */
  private async setupGitHubWorkflows(projectDir: string): Promise<void> {
    const workflowDir = path.join(projectDir, '.github/workflows');
    await fs.mkdir(workflowDir, { recursive: true });

    const templateDir = path.join(
      '/home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows'
    );

    try {
      const templates = await fs.readdir(templateDir);
      for (const template of templates) {
        if (template.endsWith('.yml') || template.endsWith('.yaml')) {
          await fs.copyFile(
            path.join(templateDir, template),
            path.join(workflowDir, template)
          );
        }
      }
    } catch {
      // Templates may not exist yet, skip silently
    }
  }

  /**
   * Set up fastlane configuration for the project
   */
  private async setupFastlane(projectDir: string): Promise<void> {
    const fastlaneDir = path.join(projectDir, 'fastlane');
    await fs.mkdir(fastlaneDir, { recursive: true });

    const templatePath = path.join(
      '/home/samuel/sv/supervisor-service-s/src/mobile/templates/fastlane/Fastfile'
    );

    try {
      await fs.copyFile(templatePath, path.join(fastlaneDir, 'Fastfile'));
    } catch {
      // Template may not exist yet, skip silently
    }
  }
}
