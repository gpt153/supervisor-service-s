# Secrets Management Workflow

**CRITICAL: All project supervisors MUST follow this workflow for secrets.**

---

## 🔒 Mandatory Rule

**When you receive or create ANY secret (API key, password, token, etc.):**

1. ✅ **FIRST**: Store in vault using `mcp_meta_set_secret`
2. ✅ **THEN**: Add to .env file

**NO EXCEPTIONS.** Vault is backup/source of truth, .env is disposable working copy.

---

## Workflow

### Store Secret (Step 1 - FIRST)

```
mcp_meta_set_secret({
  keyPath: 'project/{project}/{secret-name-lowercase}',
  value: 'actual-secret-value',
  description: 'Clear explanation (>10 chars)'
})
```

### Add to .env (Step 2 - SECOND)

```
Edit .env file:
SECRET_KEY=actual-secret-value
```

### Verify (Step 3)

```
mcp_meta_get_secret({ keyPath: 'project/{project}/{secret-name}' })
```

---

## Key Path Format

**Project secrets**: `project/{project-name}/{secret-name-lowercase}`

**Meta secrets**: `meta/{category}/{secret-name-lowercase}`

---

## Why This Matters

- ✅ Recovery if .env corrupted/deleted
- ✅ Encrypted backup always available
- ✅ Never lose production credentials

**Without vault backup**:
- ❌ Lost .env = lost production credentials = service down

---

**Complete guide**: `/home/samuel/sv/docs/guides/secrets-management-guide.md`

**Last Updated**: 2026-01-21
