# Epic M-005: iOS Local Build & Simulator Testing

**Epic ID:** M-005
**Created:** 2026-02-04
**Status:** Pending
**Complexity Level:** 3
**Feature:** Mobile App Development Platform
**Estimated Effort:** 8 hours (1 day)
**Model:** Haiku

---

## Prerequisites

- [ ] Epic M-001 complete (project template, database schema)
- [ ] Epic M-002 complete (Android build verified working)
- [ ] macOS machine available (MacBook Intel 2019 or equivalent)
- [ ] Xcode installed (v15+ recommended, ~25GB download)
- [ ] CocoaPods installed (`sudo gem install cocoapods`)
- [ ] Apple Developer account ($99/year) enrolled
- [ ] fastlane installed (`sudo gem install fastlane -NV`)

**MANUAL PREREQUISITES (must be done on the Mac before this epic):**

```bash
# 1. Install Xcode from App Store (25GB+ download, takes 1-4 hours)
# 2. Accept Xcode license
sudo xcodebuild -license accept

# 3. Install Xcode command-line tools
xcode-select --install

# 4. Install CocoaPods
sudo gem install cocoapods

# 5. Install fastlane
sudo gem install fastlane -NV

# 6. Verify
xcodebuild -version   # Should show Xcode 15+
pod --version          # Should show 1.14+
fastlane --version     # Should show 2.220+

# 7. Create iOS simulator
xcrun simctl list devices | grep "iPhone 15"
# If not listed:
# Open Xcode > Settings > Platforms > iOS > Download latest simulator runtime
```

**IMPORTANT:** This epic runs on the Mac, not on odin3. The MCP tools/TypeScript code is still in supervisor-service-s on odin3, but the actual iOS build commands execute on the Mac (via SSH or directly).

---

## Acceptance Criteria

- [ ] `npx expo prebuild --platform ios` generates the `ios/` directory
- [ ] `cd ios && pod install` completes without errors
- [ ] Xcode can build the project (via xcodebuild CLI)
- [ ] IPA file generated for simulator testing
- [ ] App launches in iOS Simulator
- [ ] `IOSBuildManager.ts` provides programmatic build interface
- [ ] MCP tool `mobile_build_ios` orchestrates the build process
- [ ] fastlane Fastfile configured with `build_ios` lane

---

## Implementation Steps

### Step 1: Create iOS Build Manager

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/IOSBuildManager.ts`
**Action:** Create new file

```typescript
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
import fs from 'fs/promises';
import path from 'path';

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
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit src/mobile/IOSBuildManager.ts 2>&1 | head -10
```

### Step 2: Create fastlane Fastfile Template

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/templates/fastlane/Fastfile`
**Action:** Create new file

```ruby
# Fastfile for SV Mobile Projects
# Managed by the SV Supervisor System

default_platform(:ios)

platform :ios do
  desc "Build iOS app for testing (simulator)"
  lane :build_ios do
    build_ios_app(
      workspace: "ios/#{ENV['PROJECT_NAME'] || Dir['ios/*.xcworkspace'].first&.gsub('ios/', '')&.gsub('.xcworkspace', '')}.xcworkspace",
      scheme: ENV['PROJECT_NAME'] || Dir['ios/*.xcworkspace'].first&.gsub('ios/', '')&.gsub('.xcworkspace', ''),
      configuration: "Debug",
      export_method: "development",
      output_directory: "./build",
      output_name: "app.ipa",
      clean: true
    )
  end

  desc "Build and upload to TestFlight"
  lane :beta do
    increment_build_number
    build_ios_app(
      workspace: "ios/#{ENV['PROJECT_NAME']}.xcworkspace",
      scheme: ENV['PROJECT_NAME'],
      export_method: "app-store",
      output_directory: "./build",
      clean: true
    )
    upload_to_testflight(
      skip_waiting_for_build_processing: true
    )
  end

  desc "Run tests"
  lane :test_ios do
    run_tests(
      workspace: "ios/#{ENV['PROJECT_NAME']}.xcworkspace",
      scheme: ENV['PROJECT_NAME'],
      devices: ["iPhone 15"],
      clean: true
    )
  end
end

platform :android do
  desc "Build Android APK for testing"
  lane :build_android do
    gradle(
      project_dir: "android",
      task: "assembleDebug"
    )
  end

  desc "Build and deploy to Play Store Internal"
  lane :beta do
    gradle(
      project_dir: "android",
      task: "bundleRelease"
    )
    upload_to_play_store(
      track: "internal",
      aab: "android/app/build/outputs/bundle/release/app-release.aab"
    )
  end
end
```

**Verify:**
```bash
test -f /home/samuel/sv/supervisor-service-s/src/mobile/templates/fastlane/Fastfile && echo "Fastfile template exists" || echo "MISSING"
```

### Step 3: Add iOS Build MCP Tool

**File:** `/home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts`
**Action:** Modify - Add iOS build tool

Add import:
```typescript
import { IOSBuildManager } from '../../mobile/IOSBuildManager.js';
```

Add to `getMobileTools()` return array:
```typescript
    mobileBuildIOSTool,
    mobileListSimulatorsTool,
```

Add tool definitions:

```typescript
/**
 * mobile_build_ios - Build iOS app
 */
const mobileBuildIOSTool: ToolDefinition = {
  name: 'mobile_build_ios',
  description: 'Build iOS app from a React Native project. Requires macOS with Xcode. Can run locally on Mac or via SSH.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project',
      },
      build_target: {
        type: 'string',
        enum: ['simulator', 'device'],
        description: 'Build for simulator (Debug) or device/TestFlight (Release). Default: simulator',
      },
      mac_host: {
        type: 'string',
        description: 'SSH host for Mac (e.g., "macbook.local"). Omit if running on Mac.',
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

      const buildManager = new IOSBuildManager(params.mac_host);

      // Check environment
      const env = await buildManager.checkEnvironment();
      if (!env.ready) {
        return {
          success: false,
          error: 'iOS build environment not ready',
          missing: env.missing,
          instructions: [
            'Install Xcode from App Store',
            'sudo xcodebuild -license accept',
            'sudo gem install cocoapods',
            'sudo gem install fastlane -NV',
          ],
        };
      }

      const buildTarget = params.build_target || 'simulator';

      if (buildTarget === 'simulator') {
        // Prebuild if needed
        const prebuild = await buildManager.runPrebuild(project.project_path);
        if (!prebuild.success) {
          return { success: false, error: `Prebuild failed: ${prebuild.error}` };
        }

        // Pod install
        const pods = await buildManager.podInstall(project.project_path);
        if (!pods.success) {
          return { success: false, error: `Pod install failed: ${pods.error}` };
        }

        // Build
        return await buildManager.buildForSimulator(project.project_path);
      } else {
        // Build IPA via fastlane
        return await buildManager.buildIPA(project.project_path);
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
 * mobile_list_simulators - List available iOS simulators
 */
const mobileListSimulatorsTool: ToolDefinition = {
  name: 'mobile_list_simulators',
  description: 'List available iOS simulators on the Mac',
  inputSchema: {
    type: 'object',
    properties: {
      mac_host: {
        type: 'string',
        description: 'SSH host for Mac. Omit if running on Mac.',
      },
    },
  },
  handler: async (params: any, context: ProjectContext) => {
    const manager = new IOSBuildManager(params.mac_host);
    return await manager.listSimulators();
  },
};
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit 2>&1 | tail -5
```

### Step 4: Update MobileProjectManager for fastlane Setup

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/MobileProjectManager.ts`
**Action:** Modify - Add fastlane setup to project creation

Add after GitHub workflows setup in `createProject()`:

```typescript
    // Copy fastlane template
    await this.setupFastlane(projectDir);
```

Add new method:

```typescript
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
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit 2>&1 | tail -5
```

---

## Validation Checklist

- [ ] `IOSBuildManager.ts` compiles without errors
- [ ] `IOSBuildManager` supports both local and SSH execution
- [ ] fastlane `Fastfile` template covers build_ios, beta, test_ios, and Android lanes
- [ ] `mobile_build_ios` MCP tool registered (simulator and device targets)
- [ ] `mobile_list_simulators` MCP tool registered
- [ ] Project creation includes fastlane Fastfile
- [ ] Full project `tsc --noEmit` passes

---

## Rollback

```bash
rm -f /home/samuel/sv/supervisor-service-s/src/mobile/IOSBuildManager.ts
rm -rf /home/samuel/sv/supervisor-service-s/src/mobile/templates/fastlane/

# Revert mobile-tools.ts to M-004 version
git checkout -- /home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts
git checkout -- /home/samuel/sv/supervisor-service-s/src/mobile/MobileProjectManager.ts
```

---

## Dependencies

**Blocked By:** Epic M-002 (Android build verified, proving the pipeline works)
**Blocks:** Epic M-006 (iOS CI/CD)
**External:** macOS machine with Xcode, Apple Developer account ($99/year)
**Can Run In Parallel With:** M-003 and M-004 (independent platform)
