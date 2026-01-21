# SendGrid Setup Guide

**Last Remaining Secret for Production:** `SMTP_PASSWORD` (SendGrid API Key)

---

## Quick Setup (5 minutes)

### Step 1: Create SendGrid Account

1. Go to **https://sendgrid.com/free/**
2. Click "Start for Free"
3. Fill in your details:
   - Email: (your email)
   - Password: (create strong password)
   - Company: "Personal" or your company name
4. Verify your email address (check inbox for verification link)

**Free Plan Includes:**
- ✅ 100 emails/day forever
- ✅ No credit card required
- ✅ Full API access

---

### Step 2: Create API Key

1. Log in to SendGrid dashboard
2. Navigate to: **Settings → API Keys**
   - Direct link: https://app.sendgrid.com/settings/api_keys
3. Click **"Create API Key"**
4. Configure API key:
   - **Name**: `Consilio Production` (or any descriptive name)
   - **Permissions**: Select **"Restricted Access"**
   - Expand **"Mail Send"** section
   - Check **"Mail Send"** permission (this is all you need)
5. Click **"Create & View"**
6. **COPY THE API KEY NOW** - it starts with `SG.`
   - ⚠️ You can only see it once!
   - Format: `SG.xxxxxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy`

---

### Step 3: Verify Sender Email (Required!)

SendGrid requires you to verify the email address you'll send from.

**Option A: Single Sender Verification (Recommended for personal projects)**

1. Go to: **Settings → Sender Authentication**
   - Direct link: https://app.sendgrid.com/settings/sender_auth
2. Click **"Verify a Single Sender"**
3. Fill in form:
   - **From Name**: `Consilio`
   - **From Email**: `noreply@consilio.app` (or your domain)
   - **Reply To**: (your email for replies)
   - **Company Address**: (your address)
4. Click **"Create"**
5. Check your email inbox for verification link
6. Click verification link

**Option B: Domain Authentication (For production domains)**

1. Go to: **Settings → Sender Authentication**
2. Click **"Authenticate Your Domain"**
3. Enter your domain: `consilio.app` (or `153.se`)
4. Follow DNS setup instructions (add CNAME records to Cloudflare)

---

### Step 4: Update Consilio .env

```bash
cd /home/samuel/sv/consilio-s

# Edit .env file
nano .env
```

Find this line:
```bash
SMTP_PASSWORD=CHANGE_ME_SENDGRID_API_KEY
```

Replace with your API key:
```bash
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

Save and exit (Ctrl+X, Y, Enter)

---

### Step 5: Store in Secrets Manager

```bash
cd /home/samuel/sv/supervisor-service-s

# Create quick script to store SendGrid API key
npx tsx -e "
import { SecretsManager } from './src/secrets/SecretsManager.js';
const mgr = new SecretsManager();
await mgr.set({
  keyPath: 'project/consilio/smtp_password',
  value: 'SG.YOUR_API_KEY_HERE',  // Replace with real API key!
  description: 'SendGrid API key for Consilio email (Mail Send permission)'
});
console.log('✅ SendGrid API key stored in secrets manager');
"
```

---

### Step 6: Test Email Sending

**Test configuration:**

```bash
cd /home/samuel/sv/consilio-s/backend

# Test email send (if you have a test script)
npm run test:email

# Or manually test with curl:
curl -X POST http://localhost:5000/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test Email",
    "text": "This is a test email from Consilio"
  }'
```

**Check SendGrid dashboard:**
- Go to **Activity Feed** to see sent emails
- Direct link: https://app.sendgrid.com/email_activity

---

## Configuration Summary

After setup, your Consilio `.env` should have:

```bash
# Email Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey                                           # Always "apikey"
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxx.yyyyyyyy...           # Your API key
EMAIL_FROM=noreply@consilio.app                            # Your verified sender
EMAIL_FROM_NAME=Consilio
```

---

## Troubleshooting

### Error: "The from address does not match a verified Sender Identity"

**Problem**: You haven't verified your sender email address

**Solution**:
1. Go to Settings → Sender Authentication
2. Verify your sender email or domain
3. Use the exact email you verified in `EMAIL_FROM`

---

### Error: "Invalid API key"

**Problem**: API key copied incorrectly or expired

**Solution**:
1. API key should start with `SG.`
2. No spaces or line breaks
3. Create a new API key if needed

---

### Error: "Permission denied"

**Problem**: API key doesn't have "Mail Send" permission

**Solution**:
1. Go to Settings → API Keys
2. Delete old key
3. Create new key with "Mail Send" permission enabled

---

### Emails not arriving

**Check in order:**

1. **SendGrid Activity Feed**
   - https://app.sendgrid.com/email_activity
   - Check if email was sent successfully
   - Look for bounce/block/spam reports

2. **Recipient's spam folder**
   - SendGrid free tier emails often go to spam initially
   - Mark as "Not Spam" to improve deliverability

3. **SendGrid Suppressions**
   - https://app.sendgrid.com/suppressions
   - Check if recipient is on bounce/block/spam list
   - Remove if needed

---

## Rate Limits

### Free Plan
- **100 emails/day**
- Good for: Development, small apps, password resets

### Paid Plans (if you need more)
- **Essentials**: $19.95/month - 50,000 emails/month
- **Pro**: $89.95/month - 100,000 emails/month

For Consilio's use case (password resets, notifications), free plan should be sufficient.

---

## Security Best Practices

1. **Never commit API key to git**
   - Already in `.gitignore` ✓
   - Stored in secrets manager ✓

2. **Use restricted API key**
   - Only "Mail Send" permission
   - Don't use "Full Access" keys

3. **Rotate API keys periodically**
   - Create new key every 6-12 months
   - Delete old keys after rotation

4. **Monitor usage**
   - Check SendGrid dashboard for unusual activity
   - Set up alerts for high volume

---

## Alternative: Use Gmail SMTP (Not Recommended for Production)

If you want to test quickly without SendGrid:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # NOT your Gmail password!
```

**Get Gmail App Password:**
1. Google Account → Security
2. 2-Step Verification (must be enabled)
3. App passwords → Generate
4. Use generated 16-character password

**⚠️ Not recommended for production:**
- Gmail has strict rate limits (500 emails/day)
- Requires 2FA on personal Gmail account
- Can get blocked if sending too many emails

---

## Next Steps

After SendGrid setup:

- [ ] Create SendGrid account
- [ ] Create API key with "Mail Send" permission
- [ ] Verify sender email address
- [ ] Update Consilio `.env` with `SMTP_PASSWORD`
- [ ] Store API key in secrets manager
- [ ] Test email sending
- [ ] Update production secrets analysis: ✅ All secrets configured!

---

**Last Updated**: 2026-01-21
**Estimated Time**: 5-10 minutes
