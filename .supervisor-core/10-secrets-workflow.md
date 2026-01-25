# Secrets Management Workflow

**CRITICAL: MANDATORY workflow for all secrets**

---

## 🔒 The Rule

**When you receive or create ANY secret:**

1. ✅ **FIRST**: Vault → `mcp_meta_set_secret`
2. ✅ **THEN**: .env file

**NO EXCEPTIONS.** Vault is source of truth, .env is disposable.

---

## Workflow

```javascript
// Step 1: FIRST - Store in vault
mcp_meta_set_secret({
  keyPath: 'project/{project}/{secret-name}',
  value: 'actual-value',
  description: 'Clear explanation (>10 chars)'
})

// Step 2: SECOND - Add to .env
Edit .env: SECRET_KEY=actual-value

// Step 3: Verify
mcp_meta_get_secret({ keyPath: 'project/{project}/{secret-name}' })
```

---

## Key Paths

**Project**: `project/{project-name}/{secret-name}`
**Meta**: `meta/{category}/{secret-name}`

---

## Why Vault First

✅ Recovery if .env lost/corrupted
✅ Encrypted backup always available
❌ Without vault: Lost .env = service down

---

**Complete guide**: `/home/samuel/sv/docs/guides/secrets-management-guide.md`
