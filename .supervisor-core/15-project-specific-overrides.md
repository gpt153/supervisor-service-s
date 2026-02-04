# Project-Specific Deployment Overrides

**Some projects have non-standard deployment requirements**

---

## Consilio Deployment

**CRITICAL**: Consilio MUST deploy from backend directory

```bash
cd /home/samuel/sv/consilio-s/backend
docker compose up -d postgres
```

**When spawning deployment subagent for Consilio**:

```json
{
  "project_path": "/home/samuel/sv/consilio-s/backend",
  "docker_compose_file": "docker-compose.yml"
}
```

**Reason**: Root directory has old docker-compose that creates empty volume. Backend has correct volume with production data.

---

## Other Projects

Standard deployment from project root is fine for:
- odin-s
- health-agent-s
- openhorizon-s
- supervisor-service-s

---

**Check each project's `.supervisor-specific/03-deployment-workflow.md` for details**
