# OAuth Cross-Project Setup Guide

**Scenario:** OAuth credentials in one project (odin), VM running in another project (odin3)

**Last Updated:** 2026-01-26

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Odin Project (odin-455918)                             │
│  - OAuth Brand (Consent Screen)                         │
│  - OAuth 2.0 Clients (Client ID + Secret)               │
│  - IAP API enabled ✅                                    │
└─────────────────────────────────────────────────────────┘
                         │
                         │ OAuth Tokens
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Odin3 Project (619064793081)                           │
│  - VM Instance(s)                                        │
│  - Application validates OAuth tokens                   │
│  - Needs specific APIs enabled                          │
└─────────────────────────────────────────────────────────┘
```

---

## What to Enable on Odin3 (VM Project)

### Required APIs

**1. Compute Engine API** (for VM management)
```bash
gcloud services enable compute.googleapis.com --project=619064793081
```

**2. Cloud Resource Manager API** (for project operations)
```bash
gcloud services enable cloudresourcemanager.googleapis.com --project=619064793081
```

**3. Service Usage API** (for enabling other APIs)
```bash
gcloud services enable serviceusage.googleapis.com --project=619064793081
```

### Optional (Depending on Your Use Case)

**4. IAP API** (if using IAP to protect the VM)
```bash
gcloud services enable iap.googleapis.com --project=619064793081
```
- Only needed if you want IAP to protect access to the VM itself
- Not needed if you're just validating OAuth tokens from odin project

**5. Cloud Logging API** (for application logs)
```bash
gcloud services enable logging.googleapis.com --project=619064793081
```

**6. Cloud Monitoring API** (for metrics)
```bash
gcloud services enable monitoring.googleapis.com --project=619064793081
```

---

## Quick Enable All Command

**Enable all recommended APIs at once:**

```bash
gcloud services enable \
  compute.googleapis.com \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  iap.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  --project=619064793081
```

---

## Use Case Scenarios

### Scenario 1: Simple OAuth Authentication

**What you want:** VM in odin3 validates OAuth tokens issued by odin project

**On odin (OAuth project):**
- ✅ IAP API enabled
- ✅ OAuth brand created
- ✅ OAuth client created

**On odin3 (VM project):**
- ✅ Compute Engine API (to run VMs)
- ✅ Cloud Resource Manager API (basic operations)
- ❌ IAP API NOT needed (VM validates tokens directly)

**Application code on VM:**
```javascript
// Validate OAuth token from odin project
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID  // From odin project
);

async function verifyToken(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return payload; // User info
}
```

---

### Scenario 2: IAP-Protected VM

**What you want:** IAP sits in front of VM, handles OAuth automatically

**On odin (OAuth project):**
- ✅ IAP API enabled
- ✅ OAuth brand created
- ✅ OAuth client created (for IAP)

**On odin3 (VM project):**
- ✅ Compute Engine API
- ✅ Cloud Resource Manager API
- ✅ IAP API (required for IAP protection)

**Setup:**
```bash
# Enable IAP for the VM
gcloud iap web enable \
  --resource-type=app-engine \
  --oauth2-client-id=CLIENT_ID_FROM_ODIN \
  --oauth2-client-secret=CLIENT_SECRET_FROM_ODIN \
  --project=619064793081
```

---

### Scenario 3: Cross-Project Service Account

**What you want:** VM in odin3 uses service account from odin project

**On odin (OAuth project):**
- Create service account
- Grant necessary roles
- Create key

**On odin3 (VM project):**
- ✅ Compute Engine API
- Grant service account access to VM

**Setup:**
```bash
# In odin project: Create service account
gcloud iam service-accounts create oauth-validator \
  --display-name="OAuth Token Validator" \
  --project=odin-455918

# Grant permissions
gcloud projects add-iam-policy-binding odin-455918 \
  --member="serviceAccount:oauth-validator@odin-455918.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"

# In odin3 project: Allow VM to use this service account
gcloud compute instances set-service-account VM_NAME \
  --service-account=oauth-validator@odin-455918.iam.gserviceaccount.com \
  --scopes=cloud-platform \
  --zone=ZONE \
  --project=619064793081
```

---

## Recommended Minimal Setup

**For most cases (VM validates OAuth tokens from odin):**

```bash
# On odin3 project (VM project)
gcloud services enable compute.googleapis.com --project=619064793081
gcloud services enable cloudresourcemanager.googleapis.com --project=619064793081
gcloud services enable logging.googleapis.com --project=619064793081
```

**On VM (application code):**
```bash
# Install Google Auth Library
npm install google-auth-library

# Set environment variables (from odin project OAuth client)
export GOOGLE_CLIENT_ID="123456789-abc.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-..."
```

---

## Adding Odin3 to GCloud Manager

**To allow PSes to manage VMs in odin3 project:**

1. **Get service account key for odin3:**

You have a compute service account: `619064793081-compute@developer.gserviceaccount.com`

But you need an Owner-level service account. Create one:

```bash
# Create service account in odin3
gcloud iam service-accounts create odin3-supervisor \
  --display-name="Odin3 Supervisor Service Account" \
  --project=619064793081

# Grant Owner role
gcloud projects add-iam-policy-binding 619064793081 \
  --member="serviceAccount:odin3-supervisor@619064793081.iam.gserviceaccount.com" \
  --role="roles/owner"

# Create JSON key
gcloud iam service-accounts keys create odin3-key.json \
  --iam-account=odin3-supervisor@619064793081.iam.gserviceaccount.com \
  --project=619064793081

# Display key (to store in vault)
cat odin3-key.json
```

2. **Store in vault:**

```javascript
await mcp__meta__set_secret({
  keyPath: "meta/gcloud/odin3_key",
  value: JSON.stringify(keyJsonContent),
  description: "GCloud service account for Odin3 project (Owner role) - VM management"
});
```

3. **Restart MCP server:**

The GCloud manager will automatically load the new project.

4. **Verify:**

```javascript
const projects = await gcloud_list_projects();
// Should now show: ["odin", "openhorizon", "odin3"]
```

---

## Common Pitfalls

### ❌ Wrong: Enabling IAP on odin3 for simple OAuth

**You DON'T need IAP on odin3** if you're just validating tokens.

IAP is only needed if you want IAP to sit in front of your VM as a proxy.

### ❌ Wrong: Using OAuth client from odin3

**OAuth credentials should come from odin project** (where you created them).

The VM in odin3 uses these credentials to validate tokens, but doesn't need its own OAuth setup.

### ✅ Right: Enable only what you need

**Minimal setup:**
- Compute Engine API (to run VMs)
- Cloud Resource Manager API (basic operations)
- Your application validates tokens using credentials from odin project

---

## Testing

**1. Create VM in odin3:**

```javascript
const vm = await gcloud_create_vm({
  project: "odin3",  // Once added to GCloud manager
  zone: "us-central1-a",
  name: "oauth-test-vm",
  machineType: "e2-micro",
  diskSizeGB: 10
});
```

**2. SSH to VM and install app:**

```bash
gcloud compute ssh oauth-test-vm --project=619064793081 --zone=us-central1-a

# On VM:
npm install express google-auth-library

# Create test server
cat > server.js <<'EOF'
const express = require('express');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    res.json({ valid: true, user: payload.email });
  } catch (error) {
    res.status(401).json({ valid: false, error: error.message });
  }
});

app.listen(8080, () => console.log('Server running on port 8080'));
EOF

# Set credentials from odin project
export GOOGLE_CLIENT_ID="your-client-id-from-odin"
export GOOGLE_CLIENT_SECRET="your-secret-from-odin"

# Run
node server.js
```

**3. Test OAuth:**

```bash
# Get OAuth token from odin project
# Test VM validates it correctly
curl -H "Authorization: Bearer $TOKEN" http://VM_IP:8080/verify
```

---

## Summary

**On odin project (OAuth credentials):**
- ✅ IAP API enabled (you already did this)
- ✅ OAuth brand created
- ✅ OAuth clients created

**On odin3 project (VM runs here):**
- ✅ Compute Engine API (required)
- ✅ Cloud Resource Manager API (required)
- ❌ IAP API (optional, only if using IAP proxy)

**Application on VM:**
- Uses OAuth client ID/secret from odin project
- Validates tokens issued by odin project
- No additional OAuth setup needed on odin3

---

**Quick command to enable required APIs on odin3:**

```bash
gcloud services enable \
  compute.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project=619064793081
```

**That's it! Your VM in odin3 can now validate OAuth tokens from odin.**

---

**Maintained by:** Meta-Supervisor (MS)
**For:** Cross-project OAuth architecture
