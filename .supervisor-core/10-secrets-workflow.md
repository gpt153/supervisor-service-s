# Secrets Management Workflow

**CRITICAL: MANDATORY workflow for all secrets**

---

## 🔒 The Rule

**When you receive or create ANY secret:**

1. ✅ **FIRST**: Store in vault via meta-supervisor
2. ✅ **THEN**: Add to .env file

**NO EXCEPTIONS.** Vault is source of truth, .env is disposable.

---

## Workflow

**Steps:**

1. **FIRST**: Store in vault
   - Key path: `project/{project}/{secret-name}`
   - Include clear description
   - Meta-supervisor handles encryption

2. **SECOND**: Add to .env file
   - Add `SECRET_KEY=actual-value`
   - Never commit .env to git

3. **Verify**: Confirm secret stored in vault

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
