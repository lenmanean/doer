# Single-Branch Deployment Guide

## Overview

DOER uses a **single-branch deployment approach** with feature flags controlled by environment variables. This eliminates the complexity of managing multiple Git branches while maintaining the flexibility to switch between pre-launch and post-launch modes instantly.

Instead of using separate branches (`pre-launch` and `post-launch`), we now use a single `main` branch with the `NEXT_PUBLIC_APP_LAUNCH_STATUS` environment variable controlling all behavior.

## How It Works

### Environment Variable Control

The entire application behavior is controlled by a single environment variable:

- **Variable Name**: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
- **Values**:
  - `pre-launch`: Waitlist mode, pricing hidden, signup disabled
  - `post-launch`: Open signup, pricing visible, full functionality

### Feature Flags

The application uses feature flags that automatically respond to the environment variable:

```typescript
// src/lib/feature-flags.ts
export const IS_LAUNCHED = process.env.NEXT_PUBLIC_APP_LAUNCH_STATUS === 'post-launch'
export const IS_PRE_LAUNCH = !IS_LAUNCHED
export const IS_POST_LAUNCH = IS_LAUNCHED
```

These flags control:
- Waitlist form vs. signup button display
- Pricing page visibility
- Header navigation buttons
- Signup page redirects

## Current Setup

### Git Branch
- **Production Branch**: `main`
- All deployments come from this single branch

### Environment Variable Configuration

#### Local Development
- **File**: `.env.local`
- **Current Value**: `NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch`

#### Vercel Production
- Set via Vercel Dashboard → Settings → Environment Variables
- **Current Value**: `pre-launch` (for Production environment)
- No branch restrictions needed (single branch)

## Switching Between Modes

### To Switch to Pre-Launch Mode

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Find `NEXT_PUBLIC_APP_LAUNCH_STATUS`
3. Edit the value to `pre-launch`
4. Save changes
5. Vercel will automatically redeploy with the new value

### To Switch to Post-Launch Mode

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Find `NEXT_PUBLIC_APP_LAUNCH_STATUS`
3. Edit the value to `post-launch`
4. Save changes
5. Vercel will automatically redeploy with the new value

### Verification After Switching

After changing the environment variable, verify:

- **Pre-launch mode**:
  - ✅ Homepage shows "Join Waitlist" button
  - ✅ Pricing links are hidden
  - ✅ Signup page redirects to waitlist
  - ✅ Header shows "Join Waitlist" button

- **Post-launch mode**:
  - ✅ Homepage shows "Get Started" button
  - ✅ Pricing links are visible
  - ✅ Signup page works normally
  - ✅ Header shows "Get Started" button

## Vercel Configuration

### Production Branch Setup

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Git**
2. Ensure **Production Branch** is set to `main`
3. Click **Save**

### Environment Variable Setup

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add or edit the variable:
   - **Key**: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
   - **Value**: `pre-launch` or `post-launch`
   - **Environment**: Select "Production", "Preview", and "Development"
   - **Note**: No branch restriction needed (single branch)

3. Click **Save**

### Deployment Settings

- **Auto-deploy**: Enabled for pushes to `main` branch
- **Production deployments**: Automatically deploy when code is pushed to `main`
- **Preview deployments**: Automatically created for pull requests

## Launch Day Checklist

When you're ready to launch:

- [ ] Set `NEXT_PUBLIC_APP_LAUNCH_STATUS=post-launch` in Vercel
- [ ] Verify production deployment completes successfully
- [ ] Test signup flow end-to-end
- [ ] Verify pricing page is accessible
- [ ] Check all "Get Started" buttons work correctly
- [ ] Monitor analytics for signups
- [ ] Verify Meta Pixel tracking works

## Rollback Plan

If you need to quickly revert to pre-launch mode:

1. Go to Vercel Dashboard → Environment Variables
2. Change `NEXT_PUBLIC_APP_LAUNCH_STATUS` back to `pre-launch`
3. Save (automatic redeploy will occur)

**Note**: This does not affect existing user accounts or database data. It only changes the public-facing UI and signup flow.

## Benefits of Single-Branch Approach

✅ **Simpler Workflow**: No branch switching or merging required  
✅ **Instant Switching**: Change mode in seconds via environment variable  
✅ **No Code Duplication**: Single codebase for both modes  
✅ **Easier Testing**: Test both modes locally by changing `.env.local`  
✅ **Lower Risk**: No merge conflicts or branch synchronization issues  
✅ **Consistent History**: All changes in one branch timeline

## Local Development

### Testing Pre-Launch Mode

1. Ensure `.env.local` contains:
   ```env
   NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch
   ```

2. Restart your development server:
   ```bash
   npm run dev
   ```

3. Verify:
   - Homepage shows waitlist form
   - Pricing links are hidden
   - Signup redirects to waitlist

### Testing Post-Launch Mode

1. Update `.env.local`:
   ```env
   NEXT_PUBLIC_APP_LAUNCH_STATUS=post-launch
   ```

2. Restart your development server:
   ```bash
   npm run dev
   ```

3. Verify:
   - Homepage shows "Get Started" button
   - Pricing links are visible
   - Signup page works normally

## Troubleshooting

### Environment Variable Not Taking Effect

1. **Check Vercel**: Ensure the variable is set correctly in Vercel Dashboard
2. **Check Scope**: Ensure the variable is set for the correct environment (Production/Preview/Development)
3. **Redeploy**: Trigger a new deployment after changing the variable
4. **Cache**: Clear browser cache or use incognito mode to test

### Changes Not Reflecting

1. **Build Time**: Environment variables are read at build time, not runtime
2. **Redeploy Required**: After changing env vars, Vercel must rebuild
3. **Check Build Logs**: Verify the variable is present in build logs

### Preview Deployments

Preview deployments use the same environment variable. To test different modes:

1. Create a new environment variable with branch restriction (for testing only)
2. Or manually test locally by changing `.env.local`

## Related Files

- Feature Flags: `src/lib/feature-flags.ts`
- Homepage: `src/app/page.tsx`
- Header: `src/components/ui/PublicHeader.tsx`
- Landing Page: `src/app/landing.tsx`
- Signup Page: `src/app/auth/signup/page.tsx`
- Pricing Page: `src/app/pricing/page.tsx`

## Support

For questions or issues with deployment configuration, refer to:
- `docs/MANUAL_STEPS_SINGLE_BRANCH.md` - Detailed manual setup steps
- `docs/IMPLEMENTATION_SUMMARY.md` - Implementation overview

