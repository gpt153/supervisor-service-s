# Deployment Documentation

## Critical: Keep Deployment Info Current

**Your CLAUDE.md must always have up-to-date deployment information.**

This prevents wasting time researching deployment details.

---

## Deployment Status File

**Location**: `.supervisor-specific/02-deployment-status.md`

**Must include:**

1. ✅ **Live Deployments**
   - Development: URLs, ports, status
   - Production: URLs, platform, last deploy

2. ✅ **Service Ports**
   - Port table with all services
   - Your port range (e.g., 5200-5299)

3. ✅ **Architecture Diagram**
   - ASCII diagram of service connections

4. ✅ **How to Run Locally**
   - Complete startup commands
   - Access URLs

5. ✅ **Environment Variables**
   - All required env vars

6. ✅ **Database Info**
   - Connection strings (dev/prod)
   - Migration tools

7. ✅ **Deployment Workflow**
   - How to deploy
   - Verification steps

8. ✅ **Known Issues**
   - Current blockers
   - Technical debt

---

## When to Update

**Update `.supervisor-specific/02-deployment-status.md` whenever:**

- ✅ Ports change (new service added)
- ✅ Deployment happens (new URL, platform)
- ✅ Architecture changes (new database, service)
- ✅ Access changes (new tunnel, domain)
- ✅ Known issues discovered

After updating, regenerate CLAUDE.md:
```bash
# Request: mcp__meta__refresh_project_context
```

---

## Templates & Examples

**Need a template?**
- New projects: See `/home/samuel/sv/docs/templates/deployment-status-template.md`
- Examples: Check other projects' `.supervisor-specific/02-deployment-status.md`

**Detailed guide:**
- Complete walkthrough: `/home/samuel/sv/docs/guides/deployment-documentation-guide.md`

---

**Maintained by**: Each project-supervisor (PS)
**Update frequency**: After every deployment change
