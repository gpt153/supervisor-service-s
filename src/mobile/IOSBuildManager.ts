/**
 * IOSBuildManager - Manages iOS build lifecycle
 *
 * Handles local iOS builds, IPA generation, simulator management,
 * and fastlane integration. Designed to run commands on macOS
 * (either locally if on Mac, or via SSH to remote Mac).
 *
 * @module mobile
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface IOSBuildResult {
  success: boolean;
  app_path?: string;
  ipa_path?: string;
  build_duration_ms?: number;
  error?: string;
  xcodebuild_output?: string;
}

export interface SimulatorStatus {
  available: boolean;
  simulators: Array<{
    name: string;
    udid: string;
    state: string;
    runtime: string;
  }>;
}

export class IOSBuildManager {
  private macHost: string | null;
  private sshKey: string | null;

  /**
   * @param macHost - If running on Linux, SSH host for Mac (e.g., "macbook.local")
   * @param sshKey - Path to SSH key for Mac connection
   */
  constructor(macHost?: string, sshKey?: string) {
    this.macHost = macHost || null;
    this.sshKey = sshKey || null;
  }

  /**
   * Execute command on Mac (locally or via SSH)
   */
  private async execOnMac(
    command: string,
    options: { cwd?: string; timeout?: number } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    const timeout = options.timeout || 300000; // 5 min default

    if (this.macHost) {
      // Remote execution via SSH
      const sshCmd = this.sshKey
        ? `ssh -i "${this.sshKey}" ${this.macHost}`
        : `ssh ${this.macHost}`;
      const remoteCmd = options.cwd
        ? `cd "${options.cwd}" && ${command}`
        : command;
      return execAsync(`${sshCmd} '${remoteCmd}'`, { timeout });
    } else {
      // Local execution (already on Mac)
      return execAsync(command, { cwd: options.cwd, timeout });
    }
  }

  /**
   * Check if macOS build environment is ready
   */
  async checkEnvironment(): Promise<{
    ready: boolean;
    xcode_version?: string;
    cocoapods_version?: string;
    fastlane_version?: string;
    missing: string[];
  }> {
    const missing: string[] = [];

    let xcodeVersion: string | undefined;
    try {
      const { stdout } = await this.execOnMac('xcodebuild -version | head -1');
      xcodeVersion = stdout.trim();
    } catch {
      missing.push('Xcode');
    }

    let podVersion: string | undefined;
    try {
      const { stdout } = await this.execOnMac('pod --version');
      podVersion = stdout.trim();
    } catch {
      missing.push('CocoaPods');
    }

    let fastlaneVersion: string | undefined;
    try {
      const { stdout } = await this.execOnMac('fastlane --version 2>&1 | tail -1');
      fastlaneVersion = stdout.trim();
    } catch {
      missing.push('fastlane');
    }

    return {
      ready: missing.length === 0,
      xcode_version: xcodeVersion,
      cocoapods_version: podVersion,
      fastlane_version: fastlaneVersion,
      missing,
    };
  }

  /**
   * Run Expo prebuild for iOS
   */
  async runPrebuild(projectPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.execOnMac(
        'npx expo prebuild --platform ios --no-install',
        { cwd: projectPath, timeout: 120000 }
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Install CocoaPods dependencies
   */
  async podInstall(projectPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.execOnMac(
        'pod install',
        { cwd: path.join(projectPath, 'ios'), timeout: 300000 }
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Build iOS app using xcodebuild
   */
  async buildForSimulator(projectPath: string, schemeName?: string): Promise<IOSBuildResult> {
    const startTime = Date.now();
    const iosDir = path.join(projectPath, 'ios');
    const scheme = schemeName || path.basename(projectPath).replace(/-s$/, '');

    try {
      // Find workspace file
      const { stdout: workspaceList } = await this.execOnMac(
        `ls *.xcworkspace 2>/dev/null | head -1`,
        { cwd: iosDir }
      );
      const workspace = workspaceList.trim();

      if (!workspace) {
        return { success: false, error: 'No .xcworkspace found. Run expo prebuild and pod install first.' };
      }

      // Build for simulator
      const buildCmd = `xcodebuild \
        -workspace "${workspace}" \
        -scheme "${scheme}" \
        -configuration Debug \
        -sdk iphonesimulator \
        -destination "platform=iOS Simulator,name=iPhone 15" \
        -derivedDataPath build \
        clean build 2>&1 | tail -20`;

      const { stdout } = await this.execOnMac(buildCmd, {
        cwd: iosDir,
        timeout: 600000, // 10 min
      });

      // Find built app
      const { stdout: appPath } = await this.execOnMac(
        `find build -name "*.app" -type d | head -1`,
        { cwd: iosDir }
      );

      return {
        success: true,
        app_path: appPath.trim() ? path.join(iosDir, appPath.trim()) : undefined,
        build_duration_ms: Date.now() - startTime,
        xcodebuild_output: stdout,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        build_duration_ms: Date.now() - startTime,
        xcodebuild_output: error.stderr || error.stdout || '',
      };
    }
  }

  /**
   * Build IPA for device/TestFlight using fastlane
   */
  async buildIPA(projectPath: string): Promise<IOSBuildResult> {
    const startTime = Date.now();

    try {
      const { stdout } = await this.execOnMac(
        'fastlane build_ios',
        { cwd: projectPath, timeout: 900000 } // 15 min
      );

      // Find IPA
      const { stdout: ipaPath } = await this.execOnMac(
        `find . -name "*.ipa" -newer Fastfile | head -1`,
        { cwd: projectPath }
      );

      return {
        success: true,
        ipa_path: ipaPath.trim() ? path.join(projectPath, ipaPath.trim()) : undefined,
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
   * List available iOS simulators
   */
  async listSimulators(): Promise<SimulatorStatus> {
    try {
      const { stdout } = await this.execOnMac(
        'xcrun simctl list devices available --json',
        { timeout: 10000 }
      );
      const data = JSON.parse(stdout);
      const simulators: SimulatorStatus['simulators'] = [];

      for (const [runtime, devices] of Object.entries(data.devices as Record<string, any[]>)) {
        if (runtime.includes('iOS')) {
          for (const device of devices) {
            simulators.push({
              name: device.name,
              udid: device.udid,
              state: device.state,
              runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', ''),
            });
          }
        }
      }

      return { available: simulators.length > 0, simulators };
    } catch {
      return { available: false, simulators: [] };
    }
  }
}
