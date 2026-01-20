# Tunnel Manager Deployment Guide

**Quick deployment guide for the Tunnel Manager system**

---

## Pre-Deployment Checklist

- [ ] VM snapshot created (rollback plan)
- [ ] `/etc/cloudflared/config.yml` backed up
- [ ] Cloudflare secrets verified in SecretsManager
- [ ] Docker daemon accessible
- [ ] Dependencies installed

---

## Step 1: Install Dependencies

```bash
cd /home/samuel/sv/supervisor-service-s
npm install better-sqlite3 dockerode js-yaml
npm install --save-dev @types/better-sqlite3 @types/dockerode @types/js-yaml
```

**Verify:**
```bash
npm list better-sqlite3 dockerode js-yaml
```

---

## Step 2: Verify Secrets

Check that Cloudflare secrets are configured:

```bash
# Via SecretsManager MCP tool
secret_get { "path": "meta/cloudflare/dns_edit_token" }
secret_get { "path": "meta/cloudflare/account_id" }
secret_get { "path": "meta/cloudflare/tunnel_id" }
secret_get { "path": "meta/cloudflare/zone_id_153se" }
```

**Required secrets:**
- `meta/cloudflare/dns_edit_token` - Cloudflare API token with DNS edit permissions
- `meta/cloudflare/account_id` - Cloudflare account ID
- `meta/cloudflare/tunnel_id` - Cloudflare tunnel ID
- `meta/cloudflare/zone_id_153se` - Zone ID for 153.se domain

---

## Step 3: Create Data Directory

```bash
mkdir -p /home/samuel/sv/supervisor-service-s/data
```

The tunnel manager will create `tunnel-manager.db` here automatically.

---

## Step 4: Verify Cloudflared

Check that cloudflared is running:

**If systemd:**
```bash
systemctl status cloudflared
```

**If Docker:**
```bash
docker ps | grep cloudflared
```

**Verify config exists:**
```bash
ls -la /etc/cloudflared/config.yml
```

---

## Step 5: Build and Start

```bash
# Build TypeScript
npm run build

# Start service (or restart if already running)
npm run dev
```

**Expected output:**
```
Initializing TunnelManager...
✓ Database initialized
✓ Cloudflare Manager initialized
✓ Domain discovery completed
Discovered 1 domains: 153.se
✓ Docker network intelligence initialized
Cloudflared detected as host service
✓ Ingress manager initialized
✓ CNAME manager initialized
✓ Restart manager initialized
✓ Health monitor started
✅ TunnelManager initialized successfully
```

---

## Step 6: Verify Functionality

### Test 1: Get Tunnel Status

```bash
# Via MCP tool
tunnel_get_status
```

**Expected:**
```json
{
  "status": "up",
  "uptime_seconds": 300,
  "restart_count": 0,
  "cloudflared_location": "host"
}
```

### Test 2: List Domains

```bash
tunnel_list_domains
```

**Expected:**
```
Available domains (1):

- 153.se (f0cd4fffeebf70a32d4dde6c56806ce7)
```

### Test 3: List CNAMEs

```bash
tunnel_list_cnames { "isMetaSupervisor": true }
```

**Expected:** Lists any existing CNAMEs or "No CNAMEs found"

---

## Step 7: Test CNAME Creation (Optional)

**Create a test CNAME:**

```bash
# 1. Allocate a test port
port_allocate {
  "port": 9999,
  "projectName": "test",
  "purpose": "Tunnel manager test"
}

# 2. Start a simple HTTP server
python3 -m http.server 9999 &

# 3. Request CNAME
tunnel_request_cname {
  "subdomain": "test",
  "domain": "153.se",
  "targetPort": 9999,
  "projectName": "test"
}

# 4. Verify DNS + ingress
curl https://test.153.se
# Should return HTTP server response

# 5. Clean up
tunnel_delete_cname {
  "hostname": "test.153.se",
  "isMetaSupervisor": true
}

kill %1  # Kill HTTP server
```

---

## Step 8: Monitor Logs

Watch for errors:

```bash
# Supervisor service logs
tail -f logs/supervisor-service.log

# Cloudflared logs (systemd)
journalctl -u cloudflared -f

# Cloudflared logs (Docker)
docker logs -f cloudflared
```

---

## Post-Deployment

### Verify Auto-Recovery

Simulate tunnel failure to test auto-restart:

```bash
# Systemd
sudo systemctl stop cloudflared

# Wait 90 seconds (3 health checks)
# Tunnel should auto-restart

# Verify
tunnel_get_status
# Should show: restart_count: 1
```

### Check Database

```bash
ls -lh /home/samuel/sv/supervisor-service-s/data/tunnel-manager.db
# Should exist and be small (<1MB)

# Inspect with SQLite
sqlite3 data/tunnel-manager.db "SELECT * FROM tunnel_health ORDER BY timestamp DESC LIMIT 5;"
```

### Verify Ingress Config

```bash
cat /etc/cloudflared/config.yml
# Should have test CNAME if you created one above
```

---

## Rollback Procedure

If deployment fails:

### Option 1: Quick Rollback (Keep Running)

```bash
# 1. Stop supervisor service
systemctl stop supervisor-service

# 2. Restore config backup
cp /etc/cloudflared/config.yml.backup /etc/cloudflared/config.yml

# 3. Restart tunnel
systemctl restart cloudflared

# 4. Remove database
rm /home/samuel/sv/supervisor-service-s/data/tunnel-manager.db

# 5. Revert code (if needed)
cd /home/samuel/sv/supervisor-service-s
git checkout HEAD~1

# 6. Rebuild and restart
npm run build
systemctl start supervisor-service
```

### Option 2: Full Rollback (VM Snapshot)

```bash
# Restore VM to pre-deployment snapshot
# (Procedure depends on VM infrastructure)
```

---

## Troubleshooting Deployment

### Issue: TunnelManager fails to initialize

**Check:**
1. All secrets exist: `secret_list { "pattern": "meta/cloudflare/*" }`
2. Docker is running: `docker info`
3. Database directory is writable: `touch data/test && rm data/test`

### Issue: Health checks fail immediately

**Check:**
1. Cloudflared is running: `systemctl status cloudflared` or `docker ps`
2. Config is valid: `/usr/bin/cloudflared validate /etc/cloudflared/config.yml`

### Issue: Domain discovery finds no domains

**Check:**
1. Cloudflare API token has correct permissions
2. Account ID is correct
3. Network connectivity to Cloudflare API: `curl -H "Authorization: Bearer $TOKEN" https://api.cloudflare.com/client/v4/zones`

### Issue: Docker network detection fails

**Check:**
1. Docker socket is accessible: `ls -la /var/run/docker.sock`
2. User has Docker permissions: `groups` (should include `docker`)
3. Docker daemon is running: `systemctl status docker`

---

## Performance Baseline

After deployment, collect baseline metrics:

```bash
# CPU usage (should be <1%)
top -bn1 | grep supervisor-service

# Database size
ls -lh data/tunnel-manager.db

# Health check latency (check logs)
grep "Health check" logs/supervisor-service.log | tail -10

# Memory usage
ps aux | grep supervisor-service
```

---

## Success Criteria

✅ TunnelManager initialized without errors
✅ tunnel_get_status returns "up"
✅ tunnel_list_domains shows at least 1 domain
✅ Health checks running every 30 seconds
✅ Test CNAME creation/deletion works
✅ Auto-restart works on simulated failure
✅ Database file created and readable
✅ CPU usage <1%
✅ No errors in logs

---

## Next Steps

1. **Migrate existing CNAMEs** (if any) to tunnel manager database
2. **Update PS documentation** to reference new MCP tools
3. **Monitor for 24 hours** to ensure stability
4. **Set up alerts** for tunnel down events
5. **Schedule weekly database backups**

---

**Deployment Date:** _____________________
**Deployed By:** _____________________
**Rollback Tested:** ☐ Yes ☐ No
**Status:** ☐ Success ☐ Partial ☐ Rollback

---

**Questions or issues?** Check `.bmad/epics/005-tunnel-manager.md` for detailed implementation notes.
