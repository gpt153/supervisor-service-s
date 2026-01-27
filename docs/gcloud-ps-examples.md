# GCloud Manager - PS Usage Examples

**Last Updated:** 2026-01-26

---

## Overview

**ANY Project Supervisor (PS) can manage VMs across ALL GCloud projects.**

- Consilio PS can create VMs in OpenHorizon project
- Odin PS can manage VMs in Odin project
- Health-Agent PS can monitor VMs across all projects

**No permission barriers. Full autonomy.**

---

## Example Workflows

### Example 1: Consilio PS needs a database server

**User:** "I need a PostgreSQL server for Consilio"

**Consilio PS workflow:**

```javascript
// 1. Check if VM already exists
const existing = await mcp__supervisor__gcloud_list_vms({
  project: "openhorizon"  // Using OpenHorizon GCloud project
});

// 2. Create new VM
const result = await mcp__supervisor__gcloud_create_vm({
  project: "openhorizon",
  zone: "us-central1-a",
  name: "consilio-db",
  machineType: "n1-standard-2",  // 2 vCPUs, 7.5GB RAM
  diskSizeGB: 50,
  imageFamily: "ubuntu-2204-lts",
  imageProject: "ubuntu-os-cloud"
});

// 3. Once created, install PostgreSQL (via SSH or startup script)
// 4. Allocate port and create tunnel
const port = await mcp__supervisor__allocate_port({
  projectName: "consilio",
  serviceName: "database",
  serviceType: "database"
});

const tunnel = await mcp__supervisor__tunnel_request_cname({
  subdomain: "consilio-db",
  targetPort: port.port
});

// Result: consilio-db.153.se points to PostgreSQL on VM
```

**No asking permission. PS does this autonomously.**

---

### Example 2: Odin PS monitors and scales VMs

**User:** "Make sure the Odin services have enough resources"

**Odin PS workflow:**

```javascript
// 1. List all VMs in Odin project
const vms = await mcp__supervisor__gcloud_list_vms({
  project: "odin"
});

// 2. Check health for each VM
for (const vm of vms.vms) {
  const health = await mcp__supervisor__gcloud_vm_health({
    project: "odin",
    zone: vm.zone,
    instanceName: vm.name
  });

  // 3. Auto-scale if needed
  if (health.warnings.length > 0) {
    const decision = await mcp__supervisor__gcloud_auto_scale({
      project: "odin",
      zone: vm.zone,
      instanceName: vm.name
    });

    if (decision.action === "scale_up") {
      console.log(`Scaled ${vm.name} to ${decision.newMachineType}`);
    }
  }
}

// Result: All VMs monitored and scaled automatically
```

**Runs on schedule (cron). Fully autonomous.**

---

### Example 3: Health-Agent PS creates monitoring infrastructure

**User:** "Set up health monitoring infrastructure"

**Health-Agent PS workflow:**

```javascript
// 1. Create VM for monitoring service
const vm = await mcp__supervisor__gcloud_create_vm({
  project: "openhorizon",
  zone: "us-central1-a",
  name: "health-monitor",
  machineType: "e2-medium",  // 2 vCPUs, 4GB RAM
  diskSizeGB: 30
});

// 2. Deploy Prometheus/Grafana via Cloud Run or startup script
// 3. Create public endpoint
const tunnel = await mcp__supervisor__tunnel_request_cname({
  subdomain: "health",
  targetPort: 3000  // Grafana port
});

// Result: health.153.se shows Grafana dashboard
```

---

## Key Points

### 1. Cross-Project Access

**Any PS can manage VMs in ANY project:**

```javascript
// Consilio PS using OpenHorizon project
gcloud_create_vm({ project: "openhorizon", ... })

// Odin PS using Odin project
gcloud_create_vm({ project: "odin", ... })

// Health-Agent PS using either
gcloud_list_vms({ project: "openhorizon" })
gcloud_list_vms({ project: "odin" })
```

### 2. No Permission Needed

PSs **NEVER ask permission** for:
- Creating VMs
- Scaling VMs
- Monitoring VMs
- Deleting VMs (if requested by user)

**Autonomous = Do it immediately**

### 3. Available Projects

Currently configured:
- `odin` - odin-455918 (Compute API needs enabling)
- `openhorizon` - openhorizon-cc (✅ Working)

Add more via:
```javascript
mcp__meta__set_secret({
  keyPath: "meta/gcloud/PROJECT_NAME_key",
  value: JSON.stringify(serviceAccountKeyJson),
  description: "GCloud service account for PROJECT (Owner role)"
})
```

Then restart MCP server to load.

---

## Cost Awareness

**Machine Type Costs (approximate monthly, us-central1):**

| Type | vCPU | RAM | Monthly Cost |
|------|------|-----|--------------|
| e2-micro | 2 | 1GB | $6 |
| e2-small | 2 | 2GB | $12 |
| e2-medium | 2 | 4GB | $24 |
| n1-standard-1 | 1 | 3.75GB | $25 |
| n1-standard-2 | 2 | 7.5GB | $50 |
| n1-standard-4 | 4 | 15GB | $100 |

**PSs should:**
- Start with smallest viable size
- Use auto-scaler to increase if needed
- Monitor costs via `get-usage-summary` tool

---

## Troubleshooting

### "Compute Engine API not enabled"

**Solution:** Enable API in GCloud console:
```
https://console.developers.google.com/apis/api/compute.googleapis.com/overview?project=PROJECT_ID
```

Or have Meta-Supervisor enable it via API.

### "Insufficient permissions"

**Check:** Service account has Owner role
```bash
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*"
```

### "Project not configured"

**Add project:**
1. Get service account JSON key
2. Store in vault: `meta/gcloud/PROJECT_NAME_key`
3. Restart MCP server
4. Verify: `gcloud-list-projects`

---

**Maintained by:** Meta-Supervisor (MS)
**PS Access:** All PSes have full access
