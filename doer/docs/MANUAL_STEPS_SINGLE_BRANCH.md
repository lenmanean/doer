# Manual Steps for Single-Branch Deployment Setup

This document provides detailed, step-by-step instructions for setting up and managing the single-branch deployment system in Vercel.

## Prerequisites

- Access to Vercel Dashboard
- Access to your project repository
- Admin access to Vercel project settings

---

## Step 1: Verify Production Branch in Vercel

### 1.1 Navigate to Git Settings

1. Go to **Vercel Dashboard** (https://vercel.com/dashboard)
2. Select your **DOER project**
3. Click **Settings** (gear icon in top navigation)
4. Click **Git** in the left sidebar

### 1.2 Check Production Branch

1. Look for **Production Branch** section
2. Verify it shows: `main`
3. If it shows a different branch:
   - Click the dropdown
   - Select `main`
   - Click **Save**

**Expected Result**: Production branch is set to `main`

---

## Step 2: Configure Environment Variable in Vercel

### 2.1 Navigate to Environment Variables

1. In Vercel Dashboard, stay in **Settings**
2. Click **Environment Variables** in the left sidebar
3. You should see a list of existing environment variables

### 2.2 Add or Update Launch Status Variable

#### Option A: Variable Doesn't Exist Yet

1. Click **Add New** button (or "Create new" tab)
2. Fill in the form:
   - **Key**: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
   - **Value**: `pre-launch` (for current pre-launch state)
3. Under **Environments**, select:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. **Important**: Do NOT select any branch restriction (leave blank)
   - This is a single-branch setup, so branch restrictions are not needed
5. Click **Save**

#### Option B: Variable Already Exists

1. Find `NEXT_PUBLIC_APP_LAUNCH_STATUS` in the list
2. Click the **three dots (⋯)** menu on the right
3. Select **Edit**
4. Update the **Value** field:
   - For pre-launch: `pre-launch`
   - For post-launch: `post-launch`
5. Verify **Environments** are selected (Production, Preview, Development)
6. Verify no branch restrictions are set
7. Click **Save**

### 2.3 Verify Variable Configuration

After saving, you should see:
- **Key**: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
- **Value**: `pre-launch` (or `post-launch`)
- **Environments**: Production, Preview, Development
- **Branches**: (none or "All branches")

**Expected Result**: Environment variable is configured for all environments without branch restrictions

---

## Step 3: Trigger New Deployment

After changing the environment variable, Vercel needs to rebuild to pick up the change.

### 3.1 Automatic Redeploy

- If you enabled "Auto-redeploy on environment variable changes", Vercel will automatically start a new deployment
- Wait 2-3 minutes for the deployment to complete

### 3.2 Manual Redeploy (if needed)

1. Go to **Deployments** tab in Vercel Dashboard
2. Find the most recent deployment
3. Click the **three dots (⋯)** menu
4. Select **Redeploy**
5. Wait for deployment to complete

---

## Step 4: Verify Deployment

### 4.1 Check Deployment Status

1. Go to **Deployments** tab
2. Find the latest deployment (should be "Ready" or "Building")
3. Once status is "Ready", click on the deployment
4. Open the **Build Logs** tab
5. Search for `NEXT_PUBLIC_APP_LAUNCH_STATUS`
6. Verify the value appears correctly in the logs

### 4.2 Test Pre-Launch Mode (if value is `pre-launch`)

1. Visit your production URL (e.g., `https://usedoer.com`)
2. Verify:
   - ✅ Homepage shows "Join Waitlist" button/form
   - ✅ Header shows "Join Waitlist" button
   - ✅ Pricing links are NOT visible in navigation
   - ✅ Visiting `/pricing` redirects to homepage
   - ✅ Visiting `/auth/signup` redirects to waitlist

### 4.3 Test Post-Launch Mode (if value is `post-launch`)

1. Visit your production URL
2. Verify:
   - ✅ Homepage shows "Get Started" button
   - ✅ Header shows "Get Started" button
   - ✅ Pricing links ARE visible in navigation
   - ✅ Visiting `/pricing` shows the pricing page
   - ✅ Visiting `/auth/signup` shows the signup form

---

## Step 5: Switch Between Modes (Launch Day)

When you're ready to launch, switch from pre-launch to post-launch:

### 5.1 Update Environment Variable

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Find `NEXT_PUBLIC_APP_LAUNCH_STATUS`
3. Click **Edit** (three dots menu)
4. Change **Value** from `pre-launch` to `post-launch`
5. Click **Save**

### 5.2 Wait for Redeployment

1. Go to **Deployments** tab
2. Wait for new deployment to start automatically
3. Monitor build progress
4. Wait for deployment to complete (status: "Ready")

### 5.3 Final Verification

1. Visit production URL
2. Perform full end-to-end test:
   - ✅ Click "Get Started" button
   - ✅ Complete signup flow
   - ✅ Verify pricing page loads
   - ✅ Check all navigation links work
   - ✅ Verify Meta Pixel tracking (if applicable)

---

## Troubleshooting

### Issue: Environment Variable Not Taking Effect

**Symptoms**: Changes don't reflect after updating the variable

**Solutions**:
1. Verify variable is saved in Vercel Dashboard
2. Check that "Production" environment is selected
3. Trigger a manual redeploy
4. Clear browser cache or use incognito mode
5. Check build logs to confirm variable is present

### Issue: Deployment Fails

**Symptoms**: Build fails or deployment shows error

**Solutions**:
1. Check **Build Logs** for specific error messages
2. Verify environment variable format (no extra spaces, exact spelling)
3. Check that all required variables are present
4. Verify Node.js version compatibility
5. Check for syntax errors in code (run `npm run build` locally)

### Issue: Wrong Mode Displayed

**Symptoms**: Shows waitlist when should show signup (or vice versa)

**Solutions**:
1. Double-check environment variable value in Vercel
2. Verify you're looking at the correct deployment (Production vs Preview)
3. Clear browser cache completely
4. Check build logs to see what value was used during build
5. Verify feature flags are imported correctly in code

### Issue: Preview Deployments Show Wrong Mode

**Symptoms**: Pull request previews show different mode than production

**Solutions**:
1. Preview deployments use the same environment variable
2. Verify variable is set for "Preview" environment
3. Or create a separate variable with branch restriction (for testing only)

---

## Quick Reference: Command-Line Verification

While you can't directly check Vercel env vars from command line, you can verify locally:

### Local Testing

1. Update `.env.local`:
   ```env
   NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch
   ```

2. Build locally:
   ```bash
   npm run build
   ```

3. Start production server:
   ```bash
   npm start
   ```

4. Visit `http://localhost:3000` and verify behavior

---

## Checklist Summary

### Initial Setup
- [ ] Production branch set to `main`
- [ ] Environment variable created: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
- [ ] Variable value set to `pre-launch`
- [ ] Variable scoped to: Production, Preview, Development
- [ ] No branch restrictions set
- [ ] Initial deployment successful
- [ ] Pre-launch mode verified on production URL

### Launch Day
- [ ] Environment variable updated to `post-launch`
- [ ] New deployment triggered and completed
- [ ] Post-launch mode verified on production URL
- [ ] Signup flow tested end-to-end
- [ ] Pricing page accessible
- [ ] All navigation links work
- [ ] Analytics tracking verified

### Rollback (if needed)
- [ ] Environment variable changed back to `pre-launch`
- [ ] Redeployment completed
- [ ] Pre-launch mode verified again

---

## Important Notes

1. **Build Time vs Runtime**: Environment variables are read at build time, not runtime. Changes require a new build/deployment.

2. **No Branch Restrictions**: With single-branch setup, you don't need branch-specific variables. All deployments use the same variable value.

3. **Cache Clearing**: After deployment, users may see cached pages. Clear browser cache or wait for CDN cache to expire.

4. **Testing**: Always test mode changes on a preview deployment before applying to production.

5. **Backup Plan**: Keep a note of the previous environment variable value in case you need to rollback quickly.

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs/environment-variables
- **Deployment Guide**: `docs/SINGLE_BRANCH_DEPLOYMENT.md`
- **Implementation Summary**: `docs/IMPLEMENTATION_SUMMARY.md`

