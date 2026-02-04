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
