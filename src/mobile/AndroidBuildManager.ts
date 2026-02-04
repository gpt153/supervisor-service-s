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
import * as fs from 'fs/promises';
import * as path from 'path';

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
