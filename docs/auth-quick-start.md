# Authentication Quick Start

**3-minute setup for all AI CLIs**

---

## 1. Codex (OpenAI) - Interactive Login

```bash
codex login
```

Follow the browser flow. That's it!

**Verify:**
```bash
codex login status
# Should show: "Logged in as your-email@example.com"
```

---

## 2. Gemini (Google) - Choose One Method

### Option A: Google Auth (Recommended) ⭐

**Best for**: Teams, GCP users, better security

```bash
# 1. Authenticate with Google
gcloud auth application-default login

# 2. Set your GCP project (if you have one)
export GOOGLE_CLOUD_PROJECT="your-project-id"

# 3. Test it works
gemini -p "Say hello" --output-format json
```

**Verify:**
```bash
gcloud auth application-default print-access-token
# Should print a long access token
```

### Option B: API Key (Simpler)

**Best for**: Personal use, quick setup, free tier

```bash
# 1. Get API key from: https://aistudio.google.com/apikey

# 2. Set environment variable
export GOOGLE_API_KEY="your-key-here"

# 3. Make it permanent
echo 'export GOOGLE_API_KEY="your-key-here"' >> ~/.bashrc
source ~/.bashrc

# 4. Test it works
gemini -p "Say hello" --output-format json
```

---

## 3. Claude Code - Already Done ✅

Claude Code is already authenticated and working!

```bash
claude --version
# 2.1.12 (Claude Code)
```

---

## How Gemini Auth Priority Works

The Gemini wrapper tries credentials in this order:

1. **Application Default Credentials** (from `gcloud auth`)
   - More secure
   - Better for teams
   - Uses GCP quotas

2. **API Key** (from `GOOGLE_API_KEY`)
   - Simpler
   - Good for personal use
   - 1000 requests/day free

**You can use either method - the wrapper automatically detects which you have!**

---

## Quick Test All Three

```bash
# Test Claude
claude -p "Say 'Claude works'" --output-format json

# Test Codex (after login)
codex exec "Say 'Codex works'" --json

# Test Gemini (after auth)
gemini -p "Say 'Gemini works'" --output-format json
```

---

## Troubleshooting

### Codex: "Not logged in"
```bash
codex login
```

### Gemini: "No credentials found"

**If using Google Auth:**
```bash
gcloud auth application-default login
```

**If using API key:**
```bash
export GOOGLE_API_KEY="your-key-from-aistudio.google.com"
```

### Gemini: "GCP project required"

Only needed if using Google Auth (not API key):
```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
```

---

## Which Method Should I Use for Gemini?

| Use Case | Recommended Method |
|----------|-------------------|
| Personal projects | **API Key** (simpler) |
| Team/company | **Google Auth** (more secure) |
| Already use GCP | **Google Auth** (integrates better) |
| Just want it to work | **API Key** (faster setup) |

**Both methods work equally well with the multi-agent system!**

---

## Next Steps

After authentication:

1. ✅ All three CLIs are authenticated
2. ✅ Multi-agent routing works automatically
3. ✅ Just start using Claude normally - routing happens behind the scenes!

**No configuration needed** - the system automatically routes tasks to the best agent based on complexity and quota.

---

## Summary

```bash
# Codex
codex login

# Gemini (choose one)
gcloud auth application-default login  # Google Auth
# OR
export GOOGLE_API_KEY="..."            # API Key

# Claude
# Already authenticated! ✅
```

That's it! You're ready to use the multi-agent system.
