# GCloud Integration - Quick Start Guide

**Quick reference for using GCloud integration in supervisor-service**

---

## Setup (One-Time)

### 1. Create Service Account in GCloud Console

```bash
# 1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
# 2. Select your project
# 3. Click "Create Service Account"
#    - Name: supervisor-meta
#    - Role: Owner
# 4. Create and download JSON key
# 5. Save as: supervisor-meta-key.json
```

### 2. Store Key in Secrets System

```bash
# Via curl (copy JSON content)
cat supervisor-meta-key.json | pbcopy  # macOS
cat supervisor-meta-key.json | xclip   # Linux

curl -X POST http://localhost:8080/meta/tools/secret-set \
  -H "Content-Type: application/json" \
  -d '{
    "keyPath": "meta/gcloud/vm_host_key",
    "value": "<paste JSON here>",
    "description": "GCloud service account for VM host project"
  }'

# Delete local key file
rm supervisor-meta-key.json
```

### 3. Verify Setup

```bash
# List configured projects
curl http://localhost:8080/meta/tools/gcloud-list-projects

# Expected output:
# {"success":true,"count":1,"projects":["vm-host"]}
```

---

## Common Operations

### Get VM Details

```bash
curl -X POST http://localhost:8080/meta/tools/gcloud-get-vm \
  -H "Content-Type: application/json" \
  -d '{
    "project": "vm-host",
    "zone": "us-central1-a",
    "instanceName": "supervisor-vm"
  }'
```

### Start VM

```bash
curl -X POST http://localhost:8080/meta/tools/gcloud-start-vm \
  -H "Content-Type: application/json" \
  -d '{
    "project": "vm-host",
    "zone": "us-central1-a",
    "instanceName": "supervisor-vm"
  }'
```

### Stop VM

```bash
curl -X POST http://localhost:8080/meta/tools/gcloud-stop-vm \
  -H "Content-Type: application/json" \
  -d '{
    "project": "vm-host",
    "zone": "us-central1-a",
    "instanceName": "supervisor-vm"
  }'
```

### Check VM Health

```bash
curl -X POST http://localhost:8080/meta/tools/gcloud-vm-health \
  -H "Content-Type: application/json" \
  -d '{
    "project": "vm-host",
    "zone": "us-central1-a",
    "instanceName": "supervisor-vm",
    "minutes": 60
  }'
```

### Resize VM

```bash
# Upgrade from n1-standard-2 to n1-standard-4
curl -X POST http://localhost:8080/meta/tools/gcloud-resize-vm \
  -H "Content-Type: application/json" \
  -d '{
    "project": "vm-host",
    "zone": "us-central1-a",
    "instanceName": "supervisor-vm",
    "newMachineType": "n1-standard-4"
  }'
```

### List All VMs

```bash
# All zones
curl -X POST http://localhost:8080/meta/tools/gcloud-list-vms \
  -H "Content-Type: application/json" \
  -d '{"project": "vm-host"}'

# Specific zone
curl -X POST http://localhost:8080/meta/tools/gcloud-list-vms \
  -H "Content-Type: application/json" \
  -d '{
    "project": "vm-host",
    "zone": "us-central1-a"
  }'
```

### Auto-Scale VM

```bash
# Check if VM should be scaled
curl -X POST http://localhost:8080/meta/tools/gcloud-evaluate-scaling \
  -H "Content-Type: application/json" \
  -d '{
    "project": "vm-host",
    "zone": "us-central1-a",
    "instanceName": "supervisor-vm",
    "cpuThreshold": 80,
    "durationMinutes": 120
  }'

# Auto-scale if needed
curl -X POST http://localhost:8080/meta/tools/gcloud-auto-scale \
  -H "Content-Type: application/json" \
  -d '{
    "project": "vm-host",
    "zone": "us-central1-a",
    "instanceName": "supervisor-vm",
    "cpuThreshold": 80,
    "durationMinutes": 120
  }'
```

---

## Machine Types

**Available machine types (in order of size):**

| Type | vCPUs | Memory | Use Case |
|------|-------|--------|----------|
| `e2-micro` | 2 | 1 GB | Development, testing |
| `e2-small` | 2 | 2 GB | Small apps |
| `e2-medium` | 2 | 4 GB | Medium apps |
| `n1-standard-1` | 1 | 3.75 GB | Light workloads |
| `n1-standard-2` | 2 | 7.5 GB | Standard workloads |
| `n1-standard-4` | 4 | 15 GB | Heavy workloads |
| `n1-standard-8` | 8 | 30 GB | Very heavy workloads |
| `n1-standard-16` | 16 | 60 GB | Extreme workloads |

---

## Auto-Scaling Thresholds

**Default thresholds:**
- **CPU:** 80% average over 2 hours → scale up
- **Memory:** 85% average → scale up
- **Disk:** 85% used → alert (manual resize needed)

**Customize thresholds:**

```bash
curl -X POST http://localhost:8080/meta/tools/gcloud-auto-scale \
  -H "Content-Type: application/json" \
  -d '{
    "project": "vm-host",
    "zone": "us-central1-a",
    "instanceName": "supervisor-vm",
    "cpuThreshold": 70,
    "durationMinutes": 60
  }'
```

---

## Monitoring Agent (Optional)

**For memory and disk metrics, install Cloud Monitoring agent:**

```bash
# SSH into VM
gcloud compute ssh VM_NAME --zone=ZONE

# Install agent (Ubuntu)
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install

# Verify
sudo systemctl status google-cloud-ops-agent
```

**Without agent:**
- CPU metrics: ✅ Available
- Memory metrics: ⚠️ Returns 0
- Disk metrics: ⚠️ Returns disk size only

---

## Troubleshooting

### "Project not configured"
```
Error: Project "vm-host" not configured. Available projects: (none)
```

**Fix:** Add service account key to secrets system (see Setup above).

### "VM not found"
```
Error: Failed to get VM "instance-1": VM not found
```

**Fix:** Check instance name and zone:
```bash
# List all VMs
curl -X POST http://localhost:8080/meta/tools/gcloud-list-vms \
  -H "Content-Type: application/json" \
  -d '{"project": "vm-host"}'
```

### "Authentication failed"
```
Error: Failed to add GCloud project: Invalid JWT
```

**Fix:** Verify service account key JSON is valid and has Owner role.

### Memory/Disk metrics return 0
**Fix:** Install Cloud Monitoring agent (see above).

---

## Advanced Usage

### Programmatic Access (TypeScript)

```typescript
import { initializeGCloud } from './gcloud/index.js';
import { SecretsManager } from './secrets/SecretsManager.js';

// Initialize
const secretsManager = new SecretsManager();
const gcloud = await initializeGCloud(secretsManager);

// Get VM
const vm = await gcloud.manager.getVM('vm-host', 'us-central1-a', 'supervisor-vm');
console.log(`VM Status: ${vm.status}`);

// Check health
const health = await gcloud.health.getVMHealth('vm-host', 'us-central1-a', 'supervisor-vm', 60);
console.log(`CPU: ${health.cpu.current.toFixed(1)}%`);

// Auto-scale
const decision = await gcloud.scaler.autoScale('vm-host', 'us-central1-a', 'supervisor-vm');
if (decision.scaled) {
  console.log(`Scaled to ${decision.recommendedMachineType}`);
}
```

### Batch Monitoring (Cron)

```typescript
// Monitor multiple VMs hourly
const vms = [
  { project: 'vm-host', zone: 'us-central1-a', instanceName: 'supervisor-vm' },
  { project: 'openhorizon', zone: 'europe-west1-b', instanceName: 'prod-vm' },
];

const result = await gcloud.scaler.monitorAndScale(vms);
console.log(`Checked: ${result.checked}, Scaled: ${result.scaled}`);
result.alerts.forEach(alert => console.log(`⚠️ ${alert}`));
```

---

## Reference

**Documentation:**
- Full implementation: `/home/samuel/sv/supervisor-service/EPIC-006-GCLOUD.md`
- Infrastructure design: `/home/samuel/sv/.bmad/infrastructure/gcloud-integration.md`

**Source code:**
- GCloudManager: `src/gcloud/GCloudManager.ts`
- HealthMonitor: `src/gcloud/HealthMonitor.ts`
- AutoScaler: `src/gcloud/AutoScaler.ts`
- MCP Tools: `src/gcloud/gcloud-tools.ts`

**MCP Tools (11 total):**
1. `gcloud-get-vm`
2. `gcloud-start-vm`
3. `gcloud-stop-vm`
4. `gcloud-resize-vm`
5. `gcloud-create-vm`
6. `gcloud-delete-vm`
7. `gcloud-list-vms`
8. `gcloud-vm-health`
9. `gcloud-evaluate-scaling`
10. `gcloud-auto-scale`
11. `gcloud-list-projects`
