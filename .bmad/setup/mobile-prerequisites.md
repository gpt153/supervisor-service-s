# Mobile Prerequisites Setup Guide

**Last Updated:** 2026-01-22
**Related:** Mobile App Development Platform (Epics 031-039)

---

## Overview

This guide covers all prerequisites for mobile app development in the SV system.

---

## 1. Apple Developer Setup ($99/year)

### Enroll in Apple Developer Program

1. Go to https://developer.apple.com/programs/
2. Click "Enroll"
3. Pay $99 annual fee
4. Wait for approval (~24 hours)

### Install Xcode (MacBook)

```bash
# From App Store: Search "Xcode" and install (~15GB)
# Or via CLI:
xcode-select --install
```

### Install fastlane

```bash
gem install fastlane
```

### Configure Certificates

```bash
# Use fastlane match for team certificate management
fastlane match init
fastlane match development
fastlane match appstore
```

**Store credentials:**
```bash
# Via supervisor MCP tool:
mcp_meta_set_secret({
  keyPath: "meta/apple/developer_account_email",
  value: "your@email.com"
})

mcp_meta_set_secret({
  keyPath: "meta/apple/app_specific_password",
  value: "xxxx-xxxx-xxxx-xxxx"
})
```

---

## 2. Google Play Setup ($25 one-time)

### Create Google Play Console Account

1. Go to https://play.google.com/console
2. Pay $25 one-time registration fee
3. Complete account setup

### Generate Signing Key

```bash
keytool -genkey -v -keystore release.keystore \
  -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

**Store keystore:**
- Location: `/home/samuel/sv/mobile-signing/release.keystore`
- Never commit to git!

**Store credentials:**
```bash
mcp_meta_set_secret({
  keyPath: "meta/google/play_keystore_password",
  value: "your-password"
})
```

---

## 3. Firebase Setup (Free Tier)

### Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add Project"
3. Enter project name (e.g., "SV Mobile Testing")
4. Enable Google Analytics (optional)

### Enable Test Lab

1. In Firebase console → Test Lab
2. Enable API
3. Note: Free tier = 60 minutes/day

### Create Service Account

```bash
# In Firebase console → Settings → Service Accounts
# Click "Generate New Private Key"
# Download JSON file
```

**Store service account:**
```bash
mcp_meta_set_secret({
  keyPath: "meta/firebase/test_lab_credentials",
  value: "<paste entire JSON content>"
})
```

### Seed Device Catalog

```bash
# List available devices:
gcloud firebase test android models list
gcloud firebase test ios models list

# Seed database (automated via Epic 034)
```

---

## 4. GitHub Actions Setup

### Add Repository Secrets

Go to GitHub repo → Settings → Secrets → Actions:

**iOS:**
- `APPLE_ID` - Apple Developer email
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password
- `MATCH_PASSWORD` - fastlane match password

**Android:**
- `RELEASE_KEYSTORE` - Base64 encoded keystore
- `KEYSTORE_PASSWORD` - Keystore password
- `KEY_ALIAS` - Key alias
- `KEY_PASSWORD` - Key password

**Firebase:**
- `FIREBASE_SERVICE_ACCOUNT` - Service account JSON

### Configure Self-Hosted Runner (MacBook)

```bash
# On MacBook:
cd /Users/samuel/actions-runner
./config.sh --url https://github.com/YOUR-ORG/YOUR-REPO --token YOUR-TOKEN
./run.sh

# Or as service:
./svc.sh install
./svc.sh start
```

---

## 5. Local Development Environment

### Node.js & npm

```bash
# Check versions:
node --version  # Should be v20+
npm --version

# If not installed:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### React Native CLI

```bash
npm install -g react-native-cli
```

### Expo CLI (Optional)

```bash
npm install -g expo-cli
```

### Android Studio (VM - for Android development)

```bash
# Install Android Studio:
sudo snap install android-studio --classic

# Install Android SDK:
# Open Android Studio → SDK Manager → Install SDK 33
```

### Xcode (MacBook - for iOS development)

Already installed in step 1.

---

## 6. Environment Variables

Create `.env` in mobile project root:

```bash
# iOS
APPLE_ID=your@email.com
FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Android
ANDROID_KEYSTORE_PATH=../mobile-signing/release.keystore
ANDROID_KEYSTORE_PASSWORD=your-password
ANDROID_KEY_ALIAS=my-key-alias
ANDROID_KEY_PASSWORD=your-key-password

# Firebase
FIREBASE_PROJECT_ID=sv-mobile-testing
GOOGLE_APPLICATION_CREDENTIALS=../firebase-service-account.json
```

**NEVER commit .env to git!**

---

## 7. Verification Checklist

Before starting mobile development, verify:

- [ ] Apple Developer account active ($99 paid)
- [ ] Google Play Console account active ($25 paid)
- [ ] Firebase project created, Test Lab enabled
- [ ] Xcode installed on MacBook
- [ ] fastlane installed on MacBook
- [ ] Signing keys generated (iOS + Android)
- [ ] Service accounts created and stored in vault
- [ ] GitHub Actions configured with secrets
- [ ] Self-hosted runner active (MacBook)
- [ ] All environment variables set

---

## 8. Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer | $99 | Annual |
| Google Play | $25 | One-time |
| Firebase Test Lab | Free | 60 min/day |
| GitHub Actions | Free | 2000 min/month Linux, ~200 macOS |
| **Total First Year** | **$124** | - |
| **Ongoing (Year 2+)** | **$99** | Annual |

---

## 9. Troubleshooting

**iOS Build Fails:**
- Check certificates: `fastlane match development`
- Verify Xcode version: `xcodebuild -version`
- Check provisioning profiles in Xcode

**Android Build Fails:**
- Verify keystore path and password
- Check Gradle version: `./gradlew --version`
- Clean build: `./gradlew clean`

**Firebase Test Lab Fails:**
- Check service account permissions
- Verify gcloud CLI: `gcloud auth list`
- Check quota: `mobile_check_quota()`

**GitHub Actions Fails:**
- Check secrets are set correctly
- Verify runner is active: Settings → Actions → Runners
- Check workflow logs

---

## 10. Next Steps

Once prerequisites complete:

1. Create first mobile project: `mobile_create_project({ project_name: "test-app", framework: "react-native" })`
2. Build iOS: `fastlane build_ios`
3. Build Android: `./gradlew assembleRelease`
4. Run tests: `mobile_run_tests({ platform: "android" })`
5. Deploy beta: `mobile_deploy_beta({ platform: "ios" })`

---

**Support:** See `.bmad/epics/031-039` for detailed implementation guides.
