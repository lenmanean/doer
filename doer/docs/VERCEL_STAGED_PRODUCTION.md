# Understanding "production:staged" in Vercel

## What is "production:staged"?

**`production:staged`** means your deployment has been built as a **production build** but hasn't been assigned to your production domain yet. It's essentially a production-ready deployment that's "waiting in the wings" before going live.

## Key Differences

### Regular Preview Deployment
- Built from any branch
- Uses preview URL (e.g., `pre-launch-abc123.vercel.app`)
- For testing any changes

### production:staged
- Built from your production branch (configured in Settings → Git)
- Uses production build settings
- Has a preview URL (for testing)
- **Not assigned to production domain yet**
- Waiting for you to promote it

### Production (Promoted)
- Built from production branch
- Assigned to your production domain (e.g., `usedoer.com`)
- Live to all users

## How You Get "production:staged"

This happens when:
1. **Auto-assign is disabled** in Settings → Environments → Production
2. **You push to your production branch**
3. Vercel builds it as production but doesn't assign domains

This gives you a chance to test the production build before making it live.

## Why Use Staged Production?

### ✅ Benefits:
- **Test production builds** before they go live
- **Verify everything works** with production settings
- **Manual control** over when changes go live
- **Safer deployments** - catch issues before users see them

### Perfect For:
- Pre-launch testing
- Major feature releases
- Critical bug fixes
- Launch day deployments

## How to Promote Staged to Production

### Step 1: Test Your Staged Deployment
1. Go to **Deployments** tab
2. Find deployment labeled `production:staged`
3. Click on it to get the preview URL
4. Test thoroughly

### Step 2: Promote to Production
1. In the deployment details, click **three dots (⋯)** menu
2. Select **"Promote to Production"**
3. Confirm the promotion

### Step 3: Verify
- Your production domain will now point to this deployment
- Changes go live immediately (CDN cache may take 1-2 minutes)

## Workflow Example

```
1. Push to production branch (e.g., post-launch)
   ↓
2. Vercel creates "production:staged" deployment
   ↓
3. Test on preview URL
   ↓
4. If looks good → Promote to Production
   ↓
5. Production domain updates, site goes live!
```

## Current Status Check

### If you see "production:staged":
- ✅ Deployment is ready to go live
- ✅ Built with production settings
- ✅ Just needs promotion
- ⏸️ Not live to users yet

### If you see "Production" badge:
- ✅ Already assigned to production domain
- ✅ Live to all users
- ✅ No action needed

## Settings That Affect This

### Enable Staged Production:
1. **Settings** → **Environments** → **Production**
2. Find **"Auto-assign Custom Production Domains"**
3. **Disable** it
4. Now all production branch deployments will be "staged"

### Disable Staged Production:
1. **Settings** → **Environments** → **Production**
2. **Enable** "Auto-assign Custom Production Domains"
3. Deployments automatically become production (no staging)

## For Your Situation

If you see a `production:staged` deployment with your fix:

1. **Test it first:**
   - Click the deployment
   - Use the preview URL to verify the fix

2. **Promote when ready:**
   - Click three dots (⋯) → "Promote to Production"
   - Production domain updates immediately

3. **Result:**
   - Fix goes live to all users
   - No need to rebuild or redeploy

## Summary

**`production:staged` = Production build ready to go live, just waiting for your approval!**

It's like having a production deployment in "test mode" - you can verify everything works before making it live. Once you're confident, just promote it and it becomes your live production site.












