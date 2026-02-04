# Firebase Test Lab Setup Guide

Complete instructions for setting up Firebase Test Lab for the Mobile Platform.

---

## Prerequisites

- ✅ Android SDK installed (done)
- ✅ gcloud CLI installed (done)
- Firebase project created

---

## Step-by-Step Setup

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Enter project name: `mobile-testlab-sv` (or your choice)
4. Disable Analytics (optional)
5. Click **"Create project"**
6. **Note your PROJECT_ID** (e.g., `mobile-testlab-sv-abc123`)

### 2. Enable Firebase Test Lab API

1. Go to https://console.cloud.google.com/apis/library/testing.googleapis.com
2. Select your Firebase project
3. Click **"ENABLE"**

### 3. Create Service Account

Replace `YOUR_PROJECT_ID` with your actual project ID:

```bash
export FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"

# Create service account
gcloud iam service-accounts create mobile-testlab \
  --display-name="Mobile Test Lab Service Account" \
  --project="$FIREBASE_PROJECT_ID"

# Grant Test Lab permissions
gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member="serviceAccount:mobile-testlab@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/firebase.testlab.admin"

gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member="serviceAccount:mobile-testlab@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# Create and download key
gcloud iam service-accounts keys create /tmp/firebase-testlab-key.json \
  --iam-account="mobile-testlab@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com"
```

### 4. Store Credentials Securely

The service account key is now at `/tmp/firebase-testlab-key.json`. Store it securely:

#### Option A: Local File (for development)

```bash
# Create config directory
mkdir -p /home/samuel/.config/firebase

# Move key to permanent location
mv /tmp/firebase-testlab-key.json /home/samuel/.config/firebase/testlab-key.json
chmod 600 /home/samuel/.config/firebase/testlab-key.json

# Add to .env
cat >> /home/samuel/sv/supervisor-service-s/.env << EOF

# Firebase Test Lab
FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
GOOGLE_APPLICATION_CREDENTIALS=/home/samuel/.config/firebase/testlab-key.json
EOF
```

#### Option B: Vault (recommended for production)

Use MCP tool to store in vault:

```typescript
// Via MCP tool call:
mcp_meta_set_secret({
  path: 'project/mobile/firebase-service-account',
  value: '<paste contents of firebase-testlab-key.json>',
  description: 'Firebase Test Lab service account credentials'
})

mcp_meta_set_secret({
  path: 'project/mobile/firebase-project-id',
  value: 'YOUR_PROJECT_ID',
  description: 'Firebase project ID for Test Lab'
})
```

### 5. Configure GitHub Secrets (for CI/CD)

For GitHub Actions to run Firebase tests:

```bash
# Base64 encode the key
base64 -w 0 /home/samuel/.config/firebase/testlab-key.json > /tmp/encoded-key.txt

# Add to GitHub repository secrets:
# Go to: https://github.com/YOUR_ORG/YOUR_REPO/settings/secrets/actions
# Add secrets:
#   - GOOGLE_CREDENTIALS = <contents of /tmp/encoded-key.txt>
#   - FIREBASE_PROJECT_ID = YOUR_PROJECT_ID

# Clean up
rm /tmp/encoded-key.txt
```

---

## Verification

Test that Firebase Test Lab is working:

```bash
# Authenticate with service account
gcloud auth activate-service-account \
  --key-file=/home/samuel/.config/firebase/testlab-key.json

# List available devices
gcloud firebase test android models list \
  --project="$FIREBASE_PROJECT_ID"
```

Expected output: List of Android devices (Pixel 5, Samsung Galaxy, etc.)

---

## Testing the Integration

Once credentials are stored, test with a sample APK:

```bash
# Create a test project
cd /home/samuel/sv/supervisor-service-s
node -e "
const { mcp_tools } = require('./dist/mcp/tools/mobile-tools.js');
mcp_tools.mobile_create_project({
  project_name: 'test-app',
  framework: 'react-native'
});
"

# Build APK
cd /home/samuel/sv/test-app-s
npm install
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleDebug

# Submit to Firebase Test Lab
gcloud firebase test android run \
  --type robo \
  --app android/app/build/outputs/apk/debug/app-debug.apk \
  --device model=Pixel5,version=30 \
  --project="$FIREBASE_PROJECT_ID"
```

---

## Quota Limits (Free Tier)

- **60 minutes per day** of device testing
- Resets at midnight UTC
- Monitor usage with `mobile_check_quota` MCP tool

---

## Troubleshooting

### "Permission denied"
Run: `gcloud auth activate-service-account --key-file=...`

### "Quota exceeded"
Check daily usage: `mobile_check_quota`
Wait until midnight UTC or upgrade to paid plan

### "APK invalid"
Ensure APK is built with `assembleDebug` (not `bundle`)
Check file size: should be 1-100MB

---

**Setup Complete!** You can now build and test Android apps with Firebase Test Lab.
