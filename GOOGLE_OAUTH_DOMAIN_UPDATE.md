# Google OAuth Consent Screen Domain Update Guide

This guide will help you update your Google OAuth consent screen to display "usedoer.com" instead of the default Supabase domain (e.g., "xbzcyyukykxnrfgnhike.supabase.co").

## ⚠️ Important: Understanding the Difference

**The Supabase callback URL will ALWAYS show the Supabase domain** - this is expected and cannot be changed. The callback URL in Supabase's Google OAuth provider settings (`https://xbzcyyukykxnrfgnhike.supabase.co/auth/v1/callback`) is Supabase's internal OAuth endpoint.

**What controls the consent screen domain:**
- ✅ **"Authorized domains"** in Google Cloud Console OAuth consent screen (Step 2.3) - **THIS IS THE KEY SETTING**
- ✅ "Application home page" in Google Cloud Console OAuth consent screen
- ❌ The redirect URI does NOT control the consent screen domain
- ❌ Users DO NOT see redirect URIs in the consent screen - they're backend-only

**Key Point:** The redirect URI (`https://xbzcyyukykxnrfgnhike.supabase.co/auth/v1/callback`) must be in "Authorized redirect URIs" for the OAuth flow to work, but **users will never see this URL**. They only see the domain from "Authorized domains" (usedoer.com).

## Quick Fix (Most Important Step)

If you've already updated Site URL and redirect URLs in Supabase, the critical step you're likely missing is:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Scroll to **"Authorized domains"** section
4. Click **"Add Domain"** and add: `usedoer.com` (without https://)
5. Remove `xbzcyyukykxnrfgnhike.supabase.co` if it's listed
6. **Save** the changes
7. Wait 5-10 minutes and test in an incognito window

## Overview

The OAuth consent screen domain is controlled by:
1. **Google Cloud Console** - OAuth consent screen "Authorized domains" (PRIMARY)
2. **Supabase Auth Settings** - Site URL (affects post-auth redirect, not consent screen)

---

## Step 1: Configure Custom Domain in Supabase

### 1.1 Access Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/xbzcyyukykxnrfgnhike
2. Navigate to **Settings** → **Auth**

### 1.2 Configure Site URL

1. In the **Auth Settings** page, find the **"Site URL"** field
2. Update it to: `https://usedoer.com`
3. This tells Supabase to use your custom domain for auth redirects

### 1.3 Add Redirect URLs

1. Scroll to the **"Redirect URLs"** section (or **"Additional Redirect URLs"**)
2. Ensure the following URLs are added:
   - `https://usedoer.com/auth/callback`
   - `https://usedoer.com/**` (if wildcard is supported)
   - Or add specific paths:
     - `https://usedoer.com/auth/callback`
     - `https://usedoer.com/api/auth/callback`
     - `https://usedoer.com/dashboard/integrations`

3. **Save** the changes

### 1.4 Verify Google OAuth Provider Settings

1. In the same **Auth Settings** page, scroll to **"Auth Providers"** or **"External OAuth Providers"**
2. Click on **Google** provider
3. Verify that:
   - **Enabled** is checked ✅
   - **Client ID** is set (your Google OAuth Client ID)
   - **Client Secret** is set (your Google OAuth Client Secret)
4. **Important:** The callback URL shown will be `https://xbzcyyukykxnrfgnhike.supabase.co/auth/v1/callback` - **this is expected and correct!** 
   - Supabase's Google OAuth provider always uses its own internal callback URL
   - This URL must be registered in Google Cloud Console (see Step 3)
   - The consent screen domain is controlled by Google Cloud Console's "Authorized domains" (see Step 2.3)

---

## Step 2: Update Google Cloud Console OAuth Settings

### 2.1 Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the one associated with your Google OAuth credentials)
3. Navigate to **APIs & Services** → **OAuth consent screen**

### 2.2 Update Application Domain

1. In the **OAuth consent screen** settings, find the **"Application home page"** field
2. Update it to: `https://usedoer.com`
3. Find the **"Application domain"** field (if available)
4. Update it to: `usedoer.com`

### 2.3 Update Authorized Domains ⚠️ **THIS IS THE KEY SETTING**

**This is the most important step!** The "Authorized domains" setting directly controls what domain appears in the OAuth consent screen.

1. Scroll to the **"Authorized domains"** section
2. Click **"Add Domain"** (or **"ADD DOMAIN"** button)
3. Add: `usedoer.com`
   - **Do NOT include** `https://` or `http://` - just the domain: `usedoer.com`
4. Remove the Supabase domain (`xbzcyyukykxnrfgnhike.supabase.co`) if it's listed
   - You can remove it by clicking the X next to it
5. **Save** the changes (click the "SAVE AND CONTINUE" or "SAVE" button at the bottom)

**Important:** 
- This setting can take 5-10 minutes to propagate
- Google caches consent screen settings, so changes may not appear immediately
- Test in an incognito window after making changes

### 2.4 Update Privacy Policy and Terms of Service URLs

1. In the **OAuth consent screen** settings, find:
   - **Privacy policy URL**: Update to `https://usedoer.com/privacy` (or your actual privacy policy URL)
   - **Terms of service URL**: Update to `https://usedoer.com/terms` (or your actual terms URL)
2. These URLs should point to pages on your `usedoer.com` domain

### 2.5 Update Application Name and Logo

1. **Application name**: Ensure it shows "DOER" or "usedoer" (not Supabase-related)
2. **Application logo**: Upload your app logo if you haven't already
3. **Support email**: Use an email from your domain (e.g., `help@usedoer.com`)

---

## Step 3: Update OAuth Redirect URIs in Google Cloud Console

### 3.1 Access OAuth 2.0 Client Settings

1. In Google Cloud Console, go to **APIs & Services** → **Credentials**
2. Find your **OAuth 2.0 Client ID** (the one used by Supabase)
3. Click on it to edit

### 3.2 Update Authorized Redirect URIs

1. In the **"Authorized redirect URIs"** section, ensure you have:
   - `https://xbzcyyukykxnrfgnhike.supabase.co/auth/v1/callback` (REQUIRED - this is Supabase's internal callback)
   - `https://usedoer.com/auth/callback` (optional - for direct redirects if needed)
   
   **Critical:** The Supabase callback URL (`https://xbzcyyukykxnrfgnhike.supabase.co/auth/v1/callback`) **MUST** be in this list. This is the URL that Supabase uses internally for OAuth callbacks.

2. Click **Save**

**⚠️ IMPORTANT CLARIFICATION:**
- **Users DO NOT see the redirect URI in the consent screen** - it's a backend technical requirement only
- The redirect URI being in this list does NOT make it appear in the consent screen
- **What users see** ("to continue to usedoer.com") is controlled by **"Authorized domains"** in the OAuth consent screen settings (Step 2.3)
- The redirect URI is invisible to users - it's just where Google sends the OAuth code after authentication
- You can safely have the Supabase domain in redirect URIs without it showing in the consent screen

---

## Step 4: Verify Custom Domain Setup (Optional but Recommended)

### 4.1 Check if Supabase Supports Custom Auth Domains

Supabase may require additional configuration for custom auth domains. Check:

1. In Supabase Dashboard → **Settings** → **General**
2. Look for **"Custom Domain"** or **"Custom Auth Domain"** settings
3. If available, configure:
   - **Custom Auth Domain**: `auth.usedoer.com` (or similar subdomain)
   - Follow Supabase's DNS configuration instructions
   - This may require adding CNAME records to your DNS

### 4.2 Alternative: Use Supabase's Custom Domain Feature

If Supabase offers a custom domain feature for auth:

1. In Supabase Dashboard → **Settings** → **General** → **Custom Domain**
2. Add your custom domain: `usedoer.com` or `auth.usedoer.com`
3. Follow the DNS configuration steps provided by Supabase
4. Wait for DNS propagation (can take up to 48 hours)
5. Once verified, update your redirect URIs to use the custom domain

---

## Step 5: Update Environment Variables (If Needed)

### 5.1 Check Your Environment Variables

Verify your production environment variables are set correctly:

- `NEXT_PUBLIC_APP_URL`: Should be `https://usedoer.com`
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key

### 5.2 Update Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Verify `NEXT_PUBLIC_APP_URL` is set to `https://usedoer.com`
5. If not, update it and redeploy

---

## Step 6: Test the OAuth Flow

### 6.1 Test Google Sign-In

1. Go to `https://usedoer.com/login`
2. Click **"Sign in with Google"**
3. You should see the Google account selection page
4. **Verify the domain shown**: It should say "to continue to **usedoer.com**" instead of the Supabase domain
5. Complete the sign-in flow
6. You should be redirected back to `https://usedoer.com`

### 6.2 Test Google Calendar Integration

1. Go to `https://usedoer.com/dashboard/integrations`
2. Click on **Google Calendar** integration
3. Click **Connect**
4. Verify the OAuth consent screen shows "usedoer.com"
5. Complete the connection flow

---

## Step 7: Troubleshooting

### Issue: Will the Supabase redirect URI show in the consent screen?

**NO - Users will NEVER see the redirect URI!**
- The redirect URI (`https://xbzcyyukykxnrfgnhike.supabase.co/auth/v1/callback`) is a backend technical requirement
- Users only see the domain from "Authorized domains" in the consent screen (e.g., "to continue to usedoer.com")
- The redirect URI is invisible to users - it's just where Google sends the OAuth code after they authenticate
- You can safely have the Supabase domain in "Authorized redirect URIs" without it appearing in the consent screen
- The consent screen domain is controlled by "Authorized domains" in Google Cloud Console OAuth consent screen (Step 2.3), NOT by redirect URIs

### Issue: Still seeing Supabase domain in consent screen

**Solution:**
1. **Most Important:** Verify `usedoer.com` is in the **"Authorized domains"** list in Google Cloud Console → OAuth consent screen
   - This is the PRIMARY setting that controls the consent screen domain
   - Go to: APIs & Services → OAuth consent screen → Authorized domains
   - Add `usedoer.com` if it's not there
   - Remove `xbzcyyukykxnrfgnhike.supabase.co` from authorized domains (if present)
2. Verify "Application home page" is set to `https://usedoer.com`
3. Clear browser cache and cookies
4. Wait 5-10 minutes for Google's cache to update (Google caches consent screen settings)
5. Try in an incognito/private browser window
6. Verify all settings in Google Cloud Console are saved (click Save if needed)

### Issue: OAuth redirect fails

**Solution:**
1. Verify redirect URIs match exactly in both:
   - Supabase Dashboard → Auth Settings → Redirect URLs
   - Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs
2. Ensure `https://usedoer.com/auth/callback` is in both places
3. Check that your Site URL in Supabase is `https://usedoer.com`

### Issue: "Redirect URI mismatch" error

**Solution:**
1. The redirect URI in your code must match exactly what's registered in Google Cloud Console
2. Check your code uses `https://usedoer.com/auth/callback` (not localhost or Supabase domain)
3. Verify environment variables are set correctly in production

### Issue: Custom domain not working in Supabase

**Solution:**
1. If Supabase doesn't support custom auth domains directly, you may need to:
   - Use a reverse proxy (advanced)
   - Contact Supabase support for custom domain options
   - Accept that the internal redirect may use Supabase domain, but the consent screen can still show your domain

---

## Important Notes

1. **Supabase Callback URL is Fixed**: The callback URL in Supabase's Google OAuth provider settings will ALWAYS show the Supabase domain (`https://xbzcyyukykxnrfgnhike.supabase.co/auth/v1/callback`). This is expected and cannot be changed. This does NOT affect the consent screen domain.

2. **Authorized Domains Controls Consent Screen**: The domain shown in the Google OAuth consent screen is controlled by the "Authorized domains" setting in Google Cloud Console, NOT by the redirect URI.

3. **Google Cache**: Google caches OAuth consent screen settings. Changes to "Authorized domains" may take 5-10 minutes to appear. Always test in an incognito window.

4. **DNS Propagation**: If you're setting up a custom auth domain, DNS changes can take 24-48 hours to propagate

5. **Multiple Environments**: If you have staging/preview environments, you may need separate OAuth clients or add multiple redirect URIs

6. **Supabase Limitations**: Supabase's internal OAuth callback will always use their domain, but the user-facing consent screen will show your domain once "Authorized domains" is configured correctly

---

## Verification Checklist

After completing all steps, verify:

- [ ] Site URL in Supabase is set to `https://usedoer.com`
- [ ] Redirect URLs in Supabase include `https://usedoer.com/auth/callback`
- [ ] Google OAuth consent screen shows "usedoer.com" in the domain
- [ ] Application home page in Google Cloud Console is `https://usedoer.com`
- [ ] `usedoer.com` is in Authorized domains in Google Cloud Console
- [ ] OAuth redirect URIs in Google Cloud Console include `https://usedoer.com/auth/callback`
- [ ] Test sign-in flow works and shows "usedoer.com" in consent screen
- [ ] Test Google Calendar integration shows "usedoer.com" in consent screen

---

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)

---

## Need Help?

If you encounter issues:
1. Check Supabase logs in the Dashboard
2. Check Google Cloud Console logs
3. Verify DNS settings if using custom domain
4. Test in incognito mode to rule out caching issues

