# Branch-Based Deployment Setup Guide

This guide walks you through setting up separate pre-launch and post-launch deployments using Git branches and Vercel.

## Overview

We use two branches to maintain separate code states:
- **`main`** branch: Pre-launch mode (waitlist only, pricing hidden)
- **`post-launch`** branch: Post-launch mode (open signup, pricing visible)

Both branches share the same codebase with a feature flag that controls behavior based on the `NEXT_PUBLIC_APP_LAUNCH_STATUS` environment variable.

---

## Step 1: Update Feature Flags System

The feature flag system has been updated to support launch status:

```typescript
// src/lib/feature-flags.ts
export const IS_PRE_LAUNCH = process.env.NEXT_PUBLIC_APP_LAUNCH_STATUS === 'pre-launch'
export const IS_POST_LAUNCH = !IS_PRE_LAUNCH
```

**Status:** ✅ Already implemented

---

## Step 2: Update Environment Variables

### Local Development (.env.local)

Add to `doer/.env.local`:
```env
# ==========================================
# 🚀 Launch Status
# ==========================================
# Options: "pre-launch" | "post-launch"
# pre-launch: Waitlist only, pricing hidden, signup disabled
# post-launch: Open signup, pricing visible
NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch
```

### Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**

2. Add environment variable for **each branch**:

   **For `main` branch (Pre-Launch):**
   - Name: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
   - Value: `pre-launch`
   - Environment: Select "Production", "Preview", "Development"
   - Branch: Select "main" or "Apply to specific branches" → `main`

   **For `post-launch` branch (Post-Launch):**
   - Name: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
   - Value: `post-launch`
   - Environment: Select "Production", "Preview", "Development"
   - Branch: Select "Apply to specific branches" → `post-launch`

**Note:** Vercel allows you to set different environment variables for different branches. This is the key feature that makes branch-based deployment work.

---

## Step 3: Create Post-Launch Branch

### Option A: Create from Current Main (Recommended)

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Create post-launch branch from current main
git checkout -b post-launch

# Push the new branch to remote
git push -u origin post-launch
```

### Option B: Create as Empty Branch (If you want different starting point)

```bash
# Create orphan branch (no history)
git checkout --orphan post-launch

# Remove all files (optional, if starting fresh)
git rm -rf .

# Add your files
# ... then commit and push
```

**Status:** ⏳ Ready to execute (Step 4 below)

---

## Step 4: Configure Vercel Branch Settings

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Git**

2. **Production Branch:**
   - Currently: `main`
   - Change to: `post-launch`
   - This means deployments from `post-launch` branch will be your production deployments

3. **Branch Protection (Optional but Recommended):**
   - Enable branch protection for `post-launch`
   - Require PR reviews before merging
   - Prevent direct pushes to `post-launch`

4. **Build Settings:**
   - Verify build command: `npm run build`
   - Verify output directory: `.next` (default)
   - Framework preset: Next.js (should auto-detect)

---

## Step 5: Configure Domain Assignments

### Pre-Launch Domain (main branch)

1. In Vercel Dashboard → **Settings** → **Domains**
2. Add domain for `main` branch deployments:
   - Example: `preview.usedoer.com` or `beta.usedoer.com`
   - Or use Vercel preview domain: `your-project-git-main.vercel.app`

### Post-Launch Domain (post-launch branch)

1. In Vercel Dashboard → **Settings** → **Domains**
2. Assign your production domain:
   - Example: `usedoer.com`
   - Configure DNS settings as needed

**Note:** Vercel can automatically assign different domains to different branches, or you can use the same domain and only promote the post-launch branch to production.

---

## Step 6: Update Code to Use Feature Flags

All pricing and signup logic has been updated to use the `IS_PRE_LAUNCH` flag:

### Files Updated:
- ✅ `src/lib/feature-flags.ts` - Added launch status flags
- ✅ `src/app/page.tsx` - Pricing section conditional rendering
- ✅ `src/components/ui/PublicHeader.tsx` - Pricing links conditional
- ✅ `src/app/landing.tsx` - Pricing links conditional
- ✅ `src/app/pricing/page.tsx` - Redirect logic
- ✅ `src/app/auth/signup/page.tsx` - Signup redirect logic (if implemented)

**Status:** ⏳ Ready to implement (Steps below)

---

## Step 7: Testing the Setup

### Test Pre-Launch Mode (main branch)

1. Ensure `NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch` in `.env.local`
2. Run locally:
   ```bash
   cd doer
   npm run dev
   ```
3. Verify:
   - ✅ Pricing section is hidden
   - ✅ Pricing links are hidden
   - ✅ Signup redirects to waitlist
   - ✅ Waitlist form works

### Test Post-Launch Mode (post-launch branch)

1. Switch to post-launch branch:
   ```bash
   git checkout post-launch
   ```

2. Update `.env.local`:
   ```env
   NEXT_PUBLIC_APP_LAUNCH_STATUS=post-launch
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

4. Verify:
   - ✅ Pricing section is visible
   - ✅ Pricing links are visible
   - ✅ Signup page works
   - ✅ Can create accounts

---

## Step 8: Daily Workflow

### Making Pre-Launch Changes

1. Ensure you're on `main` branch:
   ```bash
   git checkout main
   git pull origin main
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat: Your pre-launch change"
   git push origin main
   ```

3. Vercel automatically deploys `main` branch (pre-launch mode)

### Making Post-Launch Changes

1. Switch to `post-launch` branch:
   ```bash
   git checkout post-launch
   git pull origin post-launch
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat: Your post-launch change"
   git push origin post-launch
   ```

3. Vercel automatically deploys `post-launch` branch (post-launch mode)

### Merging Changes Between Branches

**Pre-Launch → Post-Launch (one-way merge):**
```bash
git checkout post-launch
git merge main
# Resolve any conflicts
git push origin post-launch
```

**Shared Changes (merge to both):**
```bash
# Make changes on main
git checkout main
# ... make changes ...
git commit -m "fix: Shared bug fix"
git push origin main

# Merge to post-launch
git checkout post-launch
git merge main
git push origin post-launch
```

---

## Step 9: Launch Day Checklist

When ready to launch:

1. **Merge pre-launch work into post-launch:**
   ```bash
   git checkout post-launch
   git pull origin post-launch
   git merge main
   # Resolve conflicts if any
   git push origin post-launch
   ```

2. **Verify Vercel Environment Variables:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Confirm `post-launch` branch has `NEXT_PUBLIC_APP_LAUNCH_STATUS=post-launch`

3. **Verify Domain Assignment:**
   - Confirm production domain (`usedoer.com`) is assigned to `post-launch` branch

4. **Test Post-Launch Deployment:**
   - Visit preview URL for `post-launch` branch
   - Verify pricing is visible
   - Verify signup works
   - Test all critical flows

5. **Promote to Production:**
   - In Vercel, the `post-launch` branch should already be your production branch
   - Or manually promote the latest deployment if needed

6. **Monitor:**
   - Watch for errors in Vercel logs
   - Monitor analytics
   - Check user signups

---

## Step 10: Rollback Plan

If you need to rollback:

### Rollback Post-Launch Branch

```bash
git checkout post-launch
git log --oneline  # Find commit hash before problematic change
git revert <commit-hash>
# OR
git reset --hard <commit-hash>
git push origin post-launch --force  # ⚠️ Use with caution
```

### Switch Back to Pre-Launch Mode Temporarily

1. In Vercel Dashboard → Settings → Git
2. Change Production Branch back to `main`
3. Or manually redeploy from `main` branch

---

## Troubleshooting

### Issue: Environment Variable Not Working

- **Check:** Vercel Dashboard → Settings → Environment Variables
- **Verify:** Variable is set for the correct branch
- **Solution:** Rebuild the deployment after setting env var

### Issue: Wrong Branch Deploying

- **Check:** Vercel Dashboard → Settings → Git → Production Branch
- **Verify:** Correct branch is set as production
- **Solution:** Update production branch setting

### Issue: Changes Not Reflecting

- **Check:** Git branch you're on locally vs. Vercel deployment
- **Verify:** Code is pushed to correct branch
- **Solution:** Pull latest changes, rebuild

---

## Quick Reference

### Branch Purposes

| Branch | Purpose | Domain | Launch Status |
|--------|---------|--------|---------------|
| `main` | Pre-launch development | `preview.usedoer.com` | `pre-launch` |
| `post-launch` | Production/Post-launch | `usedoer.com` | `post-launch` |

### Environment Variable Values

- `pre-launch`: Waitlist mode, pricing hidden, signup disabled
- `post-launch`: Open signup, pricing visible, full access

### Key Commands

```bash
# Switch branches
git checkout main
git checkout post-launch

# Merge pre-launch → post-launch
git checkout post-launch
git merge main

# View current branch
git branch

# View all branches
git branch -a
```

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify environment variables are set correctly
3. Ensure you're pushing to the correct branch
4. Check feature flag implementation in code

