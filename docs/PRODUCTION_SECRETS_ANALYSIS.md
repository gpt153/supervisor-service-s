# Production Secrets Analysis

**Generated**: 2026-01-20

Analysis of which placeholder secrets need real values for production deployment.

---

## 🚨 CRITICAL - Required for Production

These secrets **MUST** be replaced before production deployment:

### Consilio (5 critical)

#### 1. `DB_PASSWORD`
- **Current**: `CHANGE_ME_STRONG_PASSWORD_MIN_32_CHARS`
- **Severity**: 🔴 CRITICAL
- **Impact**: Database authentication will fail
- **Usage**: Production PostgreSQL password
- **Action Required**: Generate strong 32+ char password
- **Command**: `openssl rand -base64 32`

#### 2. `JWT_SECRET`
- **Current**: `CHANGE_ME_32_CHARS_MINIMUM_SECRET_USE_OPENSSL_RAND`
- **Severity**: 🔴 CRITICAL
- **Impact**: JWT tokens can be forged, authentication bypass
- **Usage**: Signing JWT access tokens
- **Action Required**: Generate cryptographically secure secret
- **Command**: `openssl rand -base64 48`

#### 3. `JWT_REFRESH_SECRET`
- **Current**: `CHANGE_ME_32_CHARS_MINIMUM_REFRESH_USE_OPENSSL_RAND`
- **Severity**: 🔴 CRITICAL
- **Impact**: Refresh tokens can be forged
- **Usage**: Signing JWT refresh tokens
- **Action Required**: Generate cryptographically secure secret (MUST be different from JWT_SECRET)
- **Command**: `openssl rand -base64 48`

#### 4. `SESSION_SECRET`
- **Current**: `CHANGE_ME_SESSION_SECRET_MIN_32_CHARS`
- **Severity**: 🔴 CRITICAL
- **Impact**: Session hijacking, cookie forgery
- **Usage**: Express session cookie signing
- **Action Required**: Generate cryptographically secure secret
- **Command**: `openssl rand -base64 48`

#### 5. `SMTP_PASSWORD`
- **Current**: `CHANGE_ME_SENDGRID_API_KEY`
- **Severity**: 🔴 CRITICAL (if email is needed)
- **Impact**: Email functionality (password reset, notifications) will not work
- **Usage**: SendGrid SMTP authentication
- **Action Required**: Create SendGrid API key
- **How to Get**:
  1. Create SendGrid account
  2. Settings → API Keys → Create API Key
  3. Select "Mail Send" permission
  4. Copy API key (starts with `SG.`)

---

## ⚠️ OPTIONAL - Feature-Specific

These are optional unless you need the specific feature:

### Consilio (3 optional)

#### 6. `ARCHON_MCP_URL`
- **Current**: Empty
- **Severity**: ⚠️ OPTIONAL
- **Impact**: Archon MCP integration disabled (feature flag `ENABLE_ARCHON_MCP=false` in .env)
- **Usage**: Integration with old Archon system
- **Action Required**: Only if you need Archon integration
- **Default Behavior**: Feature disabled, no impact

#### 7. `ARCHON_TOKEN`
- **Current**: Empty
- **Severity**: ⚠️ OPTIONAL
- **Impact**: Same as above
- **Usage**: Authentication token for Archon MCP
- **Action Required**: Only if you need Archon integration

#### 8. `GITHUB_TOKEN`
- **Current**: Empty
- **Severity**: ⚠️ OPTIONAL
- **Impact**: GitHub MCP integration disabled (feature flag `ENABLE_GITHUB_MCP=false` in .env)
- **Usage**: GitHub API integration for issue/PR management
- **Action Required**: Only if you need GitHub integration
- **How to Get**:
  1. GitHub → Settings → Developer settings → Personal access tokens
  2. Generate new token (classic)
  3. Select scopes: `repo`, `read:org`
  4. Copy token

---

### Health-Agent (1 optional)

#### 9. `USDA_API_KEY`
- **Current**: `placeholder`
- **Severity**: ⚠️ OPTIONAL
- **Impact**: USDA nutrition database lookups disabled (feature flag `ENABLE_NUTRITION_VERIFICATION=true` suggests it's wanted)
- **Usage**: Nutrition data verification via USDA FoodData Central API
- **Action Required**: Only if you want nutrition verification
- **How to Get**:
  1. Visit https://fdc.nal.usda.gov/api-key-signup.html
  2. Sign up for free API key
  3. Copy API key from email
- **Note**: No code currently uses this (future feature?)

---

## 📊 Summary by Severity

| Severity | Count | Projects | Action |
|----------|-------|----------|--------|
| 🔴 CRITICAL | 5 | Consilio | **MUST** replace before production |
| ⚠️ OPTIONAL | 4 | Consilio, Health-Agent | Replace only if feature needed |

---

## 🎯 Recommended Actions

### For Production Deployment

**Minimum required steps:**

1. Generate all 4 Consilio secrets:
   ```bash
   # Database password
   export DB_PASSWORD=$(openssl rand -base64 32)

   # JWT secrets (must be different!)
   export JWT_SECRET=$(openssl rand -base64 48)
   export JWT_REFRESH_SECRET=$(openssl rand -base64 48)

   # Session secret
   export SESSION_SECRET=$(openssl rand -base64 48)
   ```

2. Get SendGrid API key (if email needed):
   - Sign up at https://sendgrid.com
   - Create API key with "Mail Send" permission

3. Update Consilio `.env` with real values

4. Store in secrets manager:
   ```bash
   cd /home/samuel/sv/supervisor-service-s
   npx tsx -e "
   import { SecretsManager } from './src/secrets/SecretsManager.js';
   const mgr = new SecretsManager();
   await mgr.set({
     keyPath: 'project/consilio/db_password',
     value: process.env.DB_PASSWORD
   });
   // Repeat for all secrets
   "
   ```

### For Feature Enablement

**Only if you want these features:**

- GitHub integration → Get GitHub PAT
- Archon integration → Configure Archon MCP URL and token
- USDA nutrition → Get USDA API key

---

## 🔐 Current State vs Production Ready

| Secret | Current State | Production Ready? |
|--------|---------------|-------------------|
| DB_PASSWORD | ❌ Placeholder | ❌ NO - Security risk |
| JWT_SECRET | ❌ Placeholder | ❌ NO - Authentication broken |
| JWT_REFRESH_SECRET | ❌ Placeholder | ❌ NO - Authentication broken |
| SESSION_SECRET | ❌ Placeholder | ❌ NO - Session security broken |
| SMTP_PASSWORD | ❌ Placeholder | ⚠️ DEPENDS - Email won't work |
| ARCHON_MCP_URL | ❌ Empty | ✅ YES - Feature disabled |
| ARCHON_TOKEN | ❌ Empty | ✅ YES - Feature disabled |
| GITHUB_TOKEN | ❌ Empty | ✅ YES - Feature disabled |
| USDA_API_KEY | ❌ Placeholder | ✅ YES - Feature not used yet |

---

## 💡 Development vs Production

**Current Setup (Development):**
- Docker Compose uses fallback values when secrets are placeholders
- See docker-compose.yml line 39: `JWT_SECRET: ${JWT_SECRET:-dev-jwt-secret-minimum-32-characters-long}`
- ✅ This is OK for development
- ❌ This is NOT OK for production

**Production Deployment:**
- No fallback values in production profile
- docker-compose.yml line 99: `JWT_SECRET: ${JWT_SECRET}` (no fallback!)
- 🚨 Will fail to start if placeholders remain

---

## 📋 Pre-Production Checklist

Before deploying to production:

- [ ] Generate DB_PASSWORD with `openssl rand -base64 32`
- [ ] Generate JWT_SECRET with `openssl rand -base64 48`
- [ ] Generate JWT_REFRESH_SECRET with `openssl rand -base64 48` (different from JWT_SECRET!)
- [ ] Generate SESSION_SECRET with `openssl rand -base64 48`
- [ ] Get SendGrid API key (if email needed)
- [ ] Update `.env` with real values
- [ ] Store all secrets in secrets manager for backup
- [ ] Test production deployment locally first
- [ ] Verify no placeholder values remain: `grep -r "CHANGE_ME" .env`

---

**Last Updated**: 2026-01-20
**Next Review**: Before production deployment
