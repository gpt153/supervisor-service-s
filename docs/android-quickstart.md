# Android App Building - Quick Start Guide

Complete setup for building and testing Android apps on odin3.

---

## ✅ Setup Complete

### Android SDK
- **Java:** 17.0.18 (OpenJDK)
- **Build Tools:** 34.0.0, 35.0.0
- **Platforms:** Android 34, 35
- **Location:** `/home/samuel/Android/Sdk`

### Firebase Test Lab
- **Project:** odin-mobile-lab
- **Service Account:** mobile-testlab@odin-mobile-lab.iam.gserviceaccount.com
- **Credentials:** `~/.config/firebase/testlab-key.json`
- **Available Devices:** 15+ physical & virtual Android devices

---

## Quick Commands

### Build an APK Locally

```bash
# 1. Create project directory
mkdir -p ~/test-app
cd ~/test-app

# 2. Initialize React Native project
npx create-expo-app@latest . --template blank

# 3. Install dependencies
npm install

# 4. Generate Android native code
npx expo prebuild --platform android --no-install

# 5. Build debug APK
cd android
./gradlew assembleDebug

# 6. APK location
ls -lh app/build/outputs/apk/debug/app-debug.apk
```

### Test on Firebase Test Lab

```bash
# Submit APK for testing
gcloud firebase test android run \
  --type robo \
  --app app/build/outputs/apk/debug/app-debug.apk \
  --device model=Pixel2,version=28 \
  --timeout 5m \
  --project=odin-mobile-lab

# View test results
# URL will be provided in command output
```

### List Available Devices

```bash
gcloud firebase test android models list \
  --project=odin-mobile-lab \
  --format="table(name,form,brand,codename,supportedVersionIds)"
```

### Check Daily Test Quota

Free tier: 60 minutes/day

```bash
# Via MCP tool (when MCP server running):
mobile_check_quota()

# Or check manually in Firebase Console
```

---

## Using MCP Tools

The mobile platform provides 14 MCP tools for automation. Start the MCP server:

```bash
cd /home/samuel/sv/supervisor-service-s
npm run dev:mcp
```

### Available Tools

**Project Management:**
- `mobile_create_project` - Create new React Native project
- `mobile_list_projects` - List all mobile projects
- `mobile_get_project` - Get project details

**Android Building:**
- `mobile_check_sdk` - Verify Android SDK installation
- `mobile_build_android` - Build Android APK
- `mobile_emulator_status` - Check emulator status

**Testing:**
- `mobile_list_devices` - List Firebase Test Lab devices
- `mobile_check_quota` - Check daily test quota usage
- `mobile_run_tests` - Submit APK to Firebase Test Lab
- `mobile_get_test_results` - Retrieve test results

**CI/CD:**
- `mobile_github_status` - Check GitHub Actions status
- `mobile_setup_ci` - Install CI/CD workflows

**iOS (requires Mac):**
- `mobile_build_ios` - Build iOS app
- `mobile_deploy_beta` - Deploy to TestFlight/Play Store

---

## Environment Variables

Configured in `/home/samuel/sv/supervisor-service-s/.env`:

```bash
# Firebase Test Lab
FIREBASE_PROJECT_ID=odin-mobile-lab
GOOGLE_APPLICATION_CREDENTIALS=/home/samuel/.config/firebase/testlab-key.json

# Android SDK
ANDROID_HOME=/home/samuel/Android/Sdk
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
```

---

## Troubleshooting

### "Permission denied" when building

```bash
chmod +x android/gradlew
```

### "SDK not found"

```bash
export ANDROID_HOME=/home/samuel/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
```

### "Firebase quota exceeded"

Wait until midnight UTC or upgrade to paid plan. Check usage:

```bash
gcloud firebase test android models list --project=odin-mobile-lab
```

### "APK invalid"

Ensure you're using `assembleDebug` not `bundle`:

```bash
cd android
./gradlew clean assembleDebug
```

---

## Complete Documentation

- **Firebase Setup:** `docs/firebase-test-lab-setup.md`
- **Mobile Platform PRD:** `.bmad/features/mobile-platform/prd.md`
- **Implementation Plan:** `.bmad/features/mobile-platform/implementation-plan.md`

---

## GitHub Actions CI/CD

Workflows are automatically created when using `mobile_create_project` tool.

**Android CI:** `.github/workflows/android-ci.yml`
- Runs on push to main/develop
- Builds APK
- Runs tests
- Uploads artifacts
- Submits to Firebase Test Lab

**iOS CI:** `.github/workflows/ios-ci.yml` (requires Mac runner)
- Builds IPA
- Deploys to TestFlight
- Runs Firebase iOS tests

---

## Next Steps

1. **Create your first app:**
   ```bash
   # Via MCP tool
   mobile_create_project({
     project_name: "my-app",
     framework: "react-native"
   })
   ```

2. **Build and test locally**

3. **Push to GitHub** - CI/CD automatically runs

4. **Deploy to Play Store Internal** (requires Google Play Console setup)

---

**Questions?** Check the full documentation or ask for help!
