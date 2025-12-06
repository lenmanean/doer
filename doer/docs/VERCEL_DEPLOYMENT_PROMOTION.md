# Vercel Deployment Promotion Guide

## Understanding Preview vs Production Deployments

### Preview Deployments
- **Automatic:** Every push to any branch creates a preview deployment
- **URL:** Unique preview URL (e.g., `pre-launch-abc123.vercel.app`)
- **Purpose:** Test changes before they go live
- **Status:** ✅ Your fix is working here!

### Production Deployments
- **Manual or Automatic:** Depends on your settings
- **URL:** Your production domain (e.g., `usedoer.com`)
- **Purpose:** Live site that users see
- **Current Status:** May need manual promotion

## Why Preview Shows Fix But Production Doesn't

This happens because:
1. **Preview deployments** automatically update with every push
2. **Production deployments** only update when:
   - Auto-promotion is enabled (and branch matches production branch), OR
   - You manually promote a deployment

## Check Your Current Setup

### Step 1: Identify Production Branch

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Git**
2. Look for **"Production Branch"** setting
3. Note which branch is set:
   - `pre-launch` (current pre-launch state)
   - `post-launch` (post-launch state)
   - `main` (if it still exists)

### Step 2: Check Which Deployment is Production

1. Go to **Vercel Dashboard** → Your Project → **Deployments**
2. Look for the deployment with:
   - ✅ Green "Production" badge
   - ✅ Your production domain assigned
   - ✅ Most recent commit (or older if not auto-promoting)

## How to Promote a Deployment

### Option 1: Promote Latest Preview to Production

**If the preview deployment looks good and you want to make it production:**

1. Go to **Vercel Dashboard** → Your Project → **Deployments**
2. Find the preview deployment that has your fix
   - It should show the correct branch name (`pre-launch` or `post-launch`)
   - It should have the latest commit hash
   - The preview image should show the fix working
3. Click the **three dots (⋯)** menu on that deployment
4. Click **"Promote to Production"**
5. Confirm the promotion

**Result:**
- ✅ Production domain switches to that deployment
- ✅ Users immediately see the fix
- ✅ No new build needed

### Option 2: Check Auto-Promotion Settings

**If you want automatic production updates:**

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Git**
2. Look for **"Auto-deploy from Production Branch"**
3. If **disabled:**
   - Deployments are created but not automatically promoted
   - You need to manually promote (use Option 1)
4. If **enabled:**
   - Any push to production branch automatically becomes production
   - No manual promotion needed

### Option 3: Change Production Branch

**If you want a different branch to be production:**

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Git**
2. Find **"Production Branch"** setting
3. Change it to your desired branch:
   - `pre-launch` for pre-launch site
   - `post-launch` for post-launch site
4. Vercel will automatically deploy that branch to production

## Quick Decision Tree

```
Is preview deployment working? 
├─ Yes → Is production showing old version?
│   ├─ Yes → Manually promote preview to production (Option 1)
│   └─ No → Already fixed!
└─ No → Fix code and push again

Want automatic production updates?
├─ Yes → Enable "Auto-deploy from Production Branch" (Option 2)
└─ No → Continue with manual promotions (Option 1)
```

## For Your Current Situation

Since **preview deployments show the fix working**, here's what to do:

### If Production Branch is `pre-launch`:

1. **Check which deployment is production:**
   - Go to Deployments tab
   - Find deployment with "Production" badge

2. **If production is old:**
   - Find the latest `pre-launch` preview deployment (with fix)
   - Click three dots → "Promote to Production"
   - Production will immediately show the fix

3. **If production is already latest:**
   - Clear browser cache
   - Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
   - Check if CDN needs to update (can take 1-2 minutes)

### If Production Branch is Different:

1. **Check Settings → Git → Production Branch**
2. **Either:**
   - Promote the preview deployment manually (Option 1), OR
   - Change production branch to match the branch with your fix

## Troubleshooting

### Production Still Shows Old Version After Promotion

1. **Clear browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Or use Incognito/Private window

2. **Check CDN cache:**
   - Vercel CDN may take 1-2 minutes to update
   - Wait a few minutes and refresh

3. **Verify promotion:**
   - Go to Deployments tab
   - Confirm the deployment with "Production" badge has latest commit

4. **Check branch:**
   - Ensure you promoted from the correct branch
   - Verify commit hash matches your latest push

### Preview and Production Look Different

- **Different branches:** Preview is from one branch, production from another
- **Solution:** Promote the correct preview deployment, or change production branch

### Can't Find "Promote to Production" Option

- **Not a team member:** Only team members with deployment permissions can promote
- **Already production:** The deployment might already be production
- **Check permissions:** Contact project owner to grant deployment permissions

## Best Practices

1. **Always test on preview first** ✅ (You did this!)
2. **Use manual promotion for launches** ✅ (Better control)
3. **Keep auto-promotion off during pre-launch** ✅ (Prevents accidents)
4. **Enable auto-promotion after launch** (Optional, for convenience)

## Summary

**Your preview deployments show the fix working!** 🎉

To make it live on production:
1. Go to **Vercel Dashboard** → **Deployments**
2. Find the preview deployment with your fix
3. Click **three dots (⋯)** → **"Promote to Production"**
4. Production will immediately update!

No new build needed - you're just switching which deployment is "production."












