# Vercel Domain Configuration Guide

## Auto-assign Custom Production Domains Setting

### Current Recommendation: **DISABLED** ✅

**Location:** Vercel Dashboard → Your Project → Settings → Domains → "Auto-assign Custom Production Domains"

### Why Keep It Disabled?

1. **Safety & Control**
   - Prevents accidental production deployments
   - You explicitly choose when to launch
   - Can test on preview URLs first

2. **Testing Workflow**
   - Test `post-launch` branch on preview URL
   - Verify everything works before promoting
   - Manual promotion ensures readiness

3. **Launch Day Flexibility**
   - Test thoroughly before switching domains
   - Can rollback easily if issues found
   - No risk of auto-deployment breaking production

### Workflow with Auto-assign DISABLED

#### Pre-Launch (Testing)
1. Push to `pre-launch` branch → Gets preview deployment URL
2. Push to `post-launch` branch → Gets preview deployment URL
3. Test `post-launch` preview URL thoroughly

#### Launch Day
1. Test `post-launch` deployment on preview URL
2. When ready, go to Vercel Dashboard → Deployments
3. Find the `post-launch` deployment you want to promote
4. Click "Promote to Production" (three dots menu)
5. Production domain (`usedoer.com`) switches to that deployment

### When to Enable Auto-assign

**Enable if:**
- You're confident in your deployment process
- You want automatic production updates on every `post-launch` merge
- You have robust testing before merging to `post-launch`
- You want less manual intervention

**Keep Disabled if:**
- You want explicit control over launches
- You want to test before promoting
- You're in pre-launch phase (recommended)
- Safety is a priority

## Domain Configuration

### Pre-Launch Domain (pre-launch branch)

**Setup:**
1. Go to Vercel Dashboard → Settings → Domains
2. Add domain: `preview.usedoer.com` (or your choice)
3. Configure DNS as shown in Vercel
4. This will automatically be assigned to `pre-launch` branch preview deployments

**Purpose:**
- Preview/staging environment
- Test pre-launch features
- Share with team/beta testers

### Production Domain (post-launch branch)

**Setup:**
1. Go to Vercel Dashboard → Settings → Domains
2. Add/verify domain: `usedoer.com`
3. Configure DNS as shown in Vercel
4. With auto-assign disabled, you'll manually promote deployments

**Purpose:**
- Live production environment
- Only promoted when ready
- Primary user-facing domain

## Launch Day Process

### With Auto-assign DISABLED (Recommended)

1. **Final Testing:**
   ```bash
   git checkout post-launch
   git merge pre-launch  # Merge any final pre-launch changes
   git push origin post-launch
   ```

2. **Wait for Deployment:**
   - Vercel automatically builds and deploys `post-launch` branch
   - Get preview URL from Vercel Dashboard → Deployments

3. **Test Preview Deployment:**
   - Visit preview URL for `post-launch` branch
   - Verify pricing is visible
   - Test signup flow
   - Check all critical functionality

4. **Promote to Production:**
   - Go to Vercel Dashboard → Deployments
   - Find the `post-launch` deployment you tested
   - Click the three dots (⋯) menu
   - Click "Promote to Production"
   - Confirm promotion
   - Production domain switches immediately

5. **Verify:**
   - Visit `usedoer.com` (should show post-launch version)
   - Test production site
   - Monitor Vercel logs for errors

### With Auto-assign ENABLED

1. **Merge to post-launch:**
   ```bash
   git checkout post-launch
   git merge pre-launch
   git push origin post-launch
   ```

2. **Automatic Assignment:**
   - Vercel builds and deploys
   - Production domain automatically assigned
   - No manual promotion needed

3. **Verify:**
   - Visit `usedoer.com` (should already be live)

## Rollback Process

### With Auto-assign DISABLED

1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click three dots (⋯) → "Promote to Production"
4. Production domain switches back

### With Auto-assign ENABLED

1. Revert the commit or merge
2. Or manually promote a previous deployment
3. Auto-assign will handle the domain switching

## Current Recommendation

**Keep Auto-assign DISABLED** because:
- ✅ More control over launch timing
- ✅ Can test before going live
- ✅ Easier to rollback if needed
- ✅ Better for pre-launch → post-launch transition
- ✅ Prevents accidental production deployments

You can always enable it later once you're confident in your deployment process!

