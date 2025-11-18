# Fix Email Confirmation Rate Limiting (429 Error)

## Problem
Users are getting "Too many signup attempts" errors when trying to create accounts. This is due to Supabase's email rate limiting.

## Solution: Update Rate Limits in Supabase Dashboard

### Step 1: Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/xbzcyyukykxnrfgnhike/settings/auth
2. Navigate to **Authentication** → **Rate Limits**

### Step 2: Increase Email Rate Limits
Look for these settings and increase them:

- **Email sent per hour**: Currently may be set to 2-5. Increase to:
  - **Development/Testing**: 50-100 per hour
  - **Production**: Based on expected signup volume (100-500+ per hour)

### Step 3: Check Sign-up Rate Limits
- **Sign up and sign-in requests** (5 minute interval): Should be at least 30-50
- Increase if you expect higher traffic

### Step 4: Verify SMTP Configuration
1. Go to **Settings** → **Auth** → **SMTP Settings**
2. Ensure SMTP is properly configured
3. If using Supabase's default email service, consider:
   - Configuring a custom SMTP provider (SendGrid, Mailgun, AWS SES)
   - This gives you higher rate limits and better deliverability

### Step 5: Test
After updating:
1. Wait 5-10 minutes for changes to propagate
2. Try signing up again
3. The error should be resolved

## Alternative: Disable Email Confirmation (Development Only)
⚠️ **Only for development/testing - NOT recommended for production**

1. Go to **Authentication** → **Email Templates**
2. Set **Enable email confirmations** to `false`
3. Users can sign up without email confirmation

## Current Rate Limit Settings
Based on `supabase/config.toml`:
- `email_sent = 2` per hour (VERY LOW - this is for local dev)
- Production settings are configured in Supabase Dashboard

## Why This Happens
Supabase rate limits email sending to prevent abuse and manage costs. The default limits are conservative and need to be adjusted based on your application's needs.

