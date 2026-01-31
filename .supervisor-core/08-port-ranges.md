# Port Management

## 🚨 CRITICAL: Use ONLY Your Assigned Range

**MANDATORY before ANY service:**

1. ✅ Read range from `.supervisor-specific/02-deployment-status.md`
2. ✅ Verify port within range
3. ✅ Request allocation if needed
4. ❌ NEVER use defaults (3000, 4000, 8080) without verification

**Common mistake**: Using "default ports" → STOP, check YOUR range first

---

## Port Ranges

**Your project**: Check `.supervisor-specific/02-deployment-status.md` (typically 100 ports, e.g., 5000-5099)

**Reserved infrastructure**: 8000-8099 (MCP server, etc.)

---

## Request Workflow

1. Identify service
2. Read your range
3. Pick next available
4. Request from meta-supervisor (validates range)
5. Update `.env`, `docker-compose.yml`, deployment docs

---

## References

**Guide**: `/home/samuel/sv/docs/guides/port-management-guide.md`
