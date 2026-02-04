# Epic M-002: Android Local Build & Emulator Testing

**Epic ID:** M-002
**Created:** 2026-02-04
**Status:** Pending
**Complexity Level:** 3
**Feature:** Mobile App Development Platform
**Estimated Effort:** 8 hours (1 day)
**Model:** Haiku

---

## Prerequisites

- [ ] Epic M-001 complete (database schema, MCP tools, project template)
- [ ] Java Development Kit (JDK) 17+ installed
- [ ] Android SDK installed (command-line tools)
- [ ] Android emulator created OR physical device connected via USB

**MANUAL PREREQUISITES (must be done before this epic):**

```bash
# Install JDK 17 (if not present)
sudo apt update && sudo apt install -y openjdk-17-jdk

# Install Android command-line tools
mkdir -p /home/samuel/Android/Sdk/cmdline-tools
cd /tmp
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip
mv cmdline-tools /home/samuel/Android/Sdk/cmdline-tools/latest

# Set environment variables (add to ~/.bashrc)
export ANDROID_HOME=/home/samuel/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

# Accept licenses and install SDK components
sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" "emulator" "system-images;android-34;google_apis;x86_64"

# Create emulator (for headless testing)
avdmanager create avd -n test_pixel5 -k "system-images;android-34;google_apis;x86_64" -d pixel_5 --force
```

---

## Acceptance Criteria

- [ ] A test mobile project can be created using `mobile_create_project` MCP tool
- [ ] `npx expo prebuild --platform android` generates the `android/` directory
- [ ] `cd android && ./gradlew assembleDebug` builds a debug APK successfully
- [ ] APK file exists at `android/app/build/outputs/apk/debug/app-debug.apk`
- [ ] APK file size is between 1MB and 100MB
- [ ] `./gradlew assembleDebug` test APK builds for instrumented tests
- [ ] MCP tool `mobile_run_local_tests` executes tests on emulator (if available)
- [ ] Build configuration supports both debug and release variants

---

## Implementation Steps

### Step 1: Create Android Build Configuration Helper

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/AndroidBuildManager.ts`
**Action:** Create new file

```typescript
/**
 * AndroidBuildManager - Manages Android build lifecycle
 *
 * Handles local Android builds, APK generation, emulator management,
 * and integration with Gradle build system.
 *
 * @module mobile
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface BuildResult {
  success: boolean;
  apk_path?: string;
  apk_size_bytes?: number;
  build_duration_ms?: number;
  error?: string;
  gradle_output?: string;
}

export interface EmulatorStatus {
  running: boolean;
  device_name?: string;
  api_level?: string;
  port?: number;
}

export class AndroidBuildManager {
  private androidHome: string;
  private javaHome: string;

  constructor() {
    this.androidHome = process.env.ANDROID_HOME || '/home/samuel/Android/Sdk';
    this.javaHome = process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64';
  }

  /**
   * Check if Android SDK is properly installed
   *
   * @returns Object with installation status details
   */
  async checkSdkInstallation(): Promise<{
    installed: boolean;
    java_version?: string;
    sdk_path?: string;
    build_tools?: string[];
    missing: string[];
  }> {
    const missing: string[] = [];

    // Check Java
    let javaVersion: string | undefined;
    try {
      const { stdout } = await execAsync('java --version 2>&1 | head -1');
      javaVersion = stdout.trim();
    } catch {
      missing.push('JDK 17+');
    }

    // Check Android SDK
    let sdkExists = false;
    try {
      await fs.access(this.androidHome);
      sdkExists = true;
    } catch {
      missing.push('Android SDK');
    }

    // Check build tools
    let buildTools: string[] = [];
    if (sdkExists) {
      try {
        const btDir = path.join(this.androidHome, 'build-tools');
        const entries = await fs.readdir(btDir);
        buildTools = entries;
      } catch {
        missing.push('Android Build Tools');
      }
    }

    // Check platform tools (adb)
    try {
      await execAsync('which adb');
    } catch {
      missing.push('Platform Tools (adb)');
    }

    return {
      installed: missing.length === 0,
      java_version: javaVersion,
      sdk_path: sdkExists ? this.androidHome : undefined,
      build_tools: buildTools,
      missing,
    };
  }

  /**
   * Run Expo prebuild to generate Android project files
   *
   * @param projectPath - Path to the React Native project
   * @returns Success status
   */
  async runPrebuild(projectPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync(
        'npx expo prebuild --platform android --no-install',
        {
          cwd: projectPath,
          env: {
            ...process.env,
            ANDROID_HOME: this.androidHome,
            JAVA_HOME: this.javaHome,
          },
          timeout: 120000, // 2 minutes
        }
      );
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Prebuild failed',
      };
    }
  }

  /**
   * Build debug APK using Gradle
   *
   * @param projectPath - Path to the React Native project
   * @returns Build result with APK path and size
   */
  async buildDebugApk(projectPath: string): Promise<BuildResult> {
    const startTime = Date.now();
    const androidDir = path.join(projectPath, 'android');

    try {
      // Verify android directory exists
      await fs.access(androidDir);
    } catch {
      return {
        success: false,
        error: 'android/ directory not found. Run expo prebuild first.',
      };
    }

    try {
      // Make gradlew executable
      await execAsync(`chmod +x ${path.join(androidDir, 'gradlew')}`);

      // Build debug APK
      const { stdout, stderr } = await execAsync(
        './gradlew assembleDebug',
        {
          cwd: androidDir,
          env: {
            ...process.env,
            ANDROID_HOME: this.androidHome,
            JAVA_HOME: this.javaHome,
          },
          timeout: 600000, // 10 minutes for first build
        }
      );

      const apkPath = path.join(
        androidDir,
        'app/build/outputs/apk/debug/app-debug.apk'
      );

      // Check APK exists
      const stats = await fs.stat(apkPath);

      return {
        success: true,
        apk_path: apkPath,
        apk_size_bytes: stats.size,
        build_duration_ms: Date.now() - startTime,
        gradle_output: stdout.split('\n').slice(-5).join('\n'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Build failed',
        build_duration_ms: Date.now() - startTime,
        gradle_output: error.stderr || error.stdout || '',
      };
    }
  }

  /**
   * Build release APK (unsigned, for testing)
   */
  async buildReleaseApk(projectPath: string): Promise<BuildResult> {
    const startTime = Date.now();
    const androidDir = path.join(projectPath, 'android');

    try {
      await execAsync(`chmod +x ${path.join(androidDir, 'gradlew')}`);
      const { stdout } = await execAsync(
        './gradlew assembleRelease',
        {
          cwd: androidDir,
          env: {
            ...process.env,
            ANDROID_HOME: this.androidHome,
            JAVA_HOME: this.javaHome,
          },
          timeout: 600000,
        }
      );

      const apkPath = path.join(
        androidDir,
        'app/build/outputs/apk/release/app-release.apk'
      );

      const stats = await fs.stat(apkPath);

      return {
        success: true,
        apk_path: apkPath,
        apk_size_bytes: stats.size,
        build_duration_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        build_duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if an Android emulator is running
   */
  async getEmulatorStatus(): Promise<EmulatorStatus> {
    try {
      const { stdout } = await execAsync(
        `${this.androidHome}/platform-tools/adb devices -l`,
        { timeout: 10000 }
      );

      const lines = stdout.trim().split('\n').filter(l => l.includes('emulator'));
      if (lines.length === 0) {
        return { running: false };
      }

      // Parse emulator info
      const match = lines[0].match(/emulator-(\d+)/);
      return {
        running: true,
        port: match ? parseInt(match[1]) : undefined,
        device_name: 'Android Emulator',
      };
    } catch {
      return { running: false };
    }
  }

  /**
   * Install APK on connected device/emulator
   */
  async installApk(apkPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(
        `${this.androidHome}/platform-tools/adb install -r "${apkPath}"`,
        { timeout: 60000 }
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit src/mobile/AndroidBuildManager.ts 2>&1 | head -10
```

### Step 2: Add Android Build MCP Tools

**File:** `/home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts`
**Action:** Modify - Add new tools to the existing file

Add these tools to the `getMobileTools()` return array and define them:

```typescript
// Add import at top:
import { AndroidBuildManager } from '../../mobile/AndroidBuildManager.js';

// Add to getMobileTools() array:
    mobileCheckSdkTool,
    mobileBuildAndroidTool,
    mobileEmulatorStatusTool,

// Add tool definitions:

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
      const pool = getPool();
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
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit 2>&1 | tail -5
```

### Step 3: Create Android Build Workflow Script

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/scripts/build-android.sh`
**Action:** Create new file

```bash
#!/bin/bash
# Android Build Script for SV Mobile Projects
# Usage: ./build-android.sh <project-path> [debug|release]
#
# Handles: prebuild, gradle build, APK verification
# Designed to be called by MCP tools or CI/CD

set -euo pipefail

PROJECT_PATH="${1:?Usage: $0 <project-path> [debug|release]}"
BUILD_TYPE="${2:-debug}"

# Environment
export ANDROID_HOME="${ANDROID_HOME:-/home/samuel/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

echo "=== Android Build ==="
echo "Project: $PROJECT_PATH"
echo "Build Type: $BUILD_TYPE"
echo "ANDROID_HOME: $ANDROID_HOME"
echo "JAVA_HOME: $JAVA_HOME"

# Verify prerequisites
if ! command -v java &>/dev/null; then
  echo "ERROR: Java not found. Install: sudo apt install openjdk-17-jdk"
  exit 1
fi

if [ ! -d "$ANDROID_HOME" ]; then
  echo "ERROR: Android SDK not found at $ANDROID_HOME"
  exit 1
fi

cd "$PROJECT_PATH"

# Step 1: Expo prebuild (generates android/ directory)
if [ ! -d "android" ]; then
  echo "--- Running expo prebuild ---"
  npx expo prebuild --platform android --no-install
fi

# Step 2: Navigate to android dir
cd android

# Step 3: Make gradlew executable
chmod +x gradlew

# Step 4: Build
echo "--- Building $BUILD_TYPE APK ---"
START_TIME=$(date +%s)

if [ "$BUILD_TYPE" = "release" ]; then
  ./gradlew assembleRelease
  APK_PATH="app/build/outputs/apk/release/app-release.apk"
else
  ./gradlew assembleDebug
  APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Step 5: Verify APK
if [ -f "$APK_PATH" ]; then
  APK_SIZE=$(stat --format=%s "$APK_PATH")
  echo "=== Build Successful ==="
  echo "APK: $APK_PATH"
  echo "Size: $APK_SIZE bytes ($(( APK_SIZE / 1024 / 1024 ))MB)"
  echo "Duration: ${DURATION}s"
else
  echo "ERROR: APK not found at $APK_PATH"
  exit 1
fi
```

**Verify:**
```bash
chmod +x /home/samuel/sv/supervisor-service-s/src/mobile/scripts/build-android.sh
test -x /home/samuel/sv/supervisor-service-s/src/mobile/scripts/build-android.sh && echo "Script executable" || echo "NOT executable"
```

### Step 4: Create Jest Test Configuration for Mobile Projects

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/templates/jest.config.js`
**Action:** Create new file (template for scaffolded projects)

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterSetup: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
};
```

**Verify:**
```bash
test -f /home/samuel/sv/supervisor-service-s/src/mobile/templates/jest.config.js && echo "Template exists" || echo "MISSING"
```

---

## Validation Checklist

- [ ] `AndroidBuildManager.ts` compiles without errors
- [ ] `mobile_check_sdk` MCP tool returns SDK installation status
- [ ] `mobile_build_android` MCP tool orchestrates prebuild + Gradle build
- [ ] `mobile_emulator_status` MCP tool checks emulator state
- [ ] `build-android.sh` script is executable and handles both debug/release
- [ ] Jest config template exists for scaffolded projects
- [ ] Full project `tsc --noEmit` passes

---

## Rollback

If this epic fails:

```bash
# Remove new files
rm -f /home/samuel/sv/supervisor-service-s/src/mobile/AndroidBuildManager.ts
rm -rf /home/samuel/sv/supervisor-service-s/src/mobile/scripts/
rm -rf /home/samuel/sv/supervisor-service-s/src/mobile/templates/

# Revert mobile-tools.ts to M-001 version
git checkout -- /home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts
```

---

## Dependencies

**Blocked By:** Epic M-001 (Project Template)
**Blocks:** Epic M-003 (GitHub Actions Android CI/CD)
**External:** JDK 17+, Android SDK (manual install required)
