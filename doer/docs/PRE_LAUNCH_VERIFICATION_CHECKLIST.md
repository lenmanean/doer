# Pre-Launch Branch Verification Checklist

Use this checklist to verify that the pre-launch branch is working correctly before proceeding with post-launch testing.

## ✅ Implementation Status

### Feature Flags
- [x] Feature flags system implemented (`src/lib/feature-flags.ts`)
- [x] `IS_PRE_LAUNCH` and `IS_POST_LAUNCH` flags available
- [x] Controlled by `NEXT_PUBLIC_APP_LAUNCH_STATUS` environment variable

### Code Updates
- [x] Homepage pricing section uses `!IS_PRE_LAUNCH` conditional
- [x] Header pricing links use `!IS_PRE_LAUNCH` conditional (desktop & mobile)
- [x] Landing page pricing links use `!IS_PRE_LAUNCH` conditional
- [x] Pricing page redirects using `IS_PRE_LAUNCH` check
- [x] Signup page redirects to waitlist using `IS_PRE_LAUNCH` check

### Environment Variable
- [x] `.env.local` has `NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch`
- [ ] Vercel environment variable set for `pre-launch` branch (to be configured)

### Documentation
- [x] All documentation updated from `main` to `pre-launch` branch references
- [x] `docs/LAUNCH_BRANCH_SETUP.md` updated
- [x] `docs/BRANCH_QUICK_REFERENCE.md` created
- [x] `docs/IMPLEMENTATION_SUMMARY.md` created
- [x] `docs/VERCEL_DOMAIN_SETUP.md` updated

### Git Branches
- [x] `pre-launch` branch exists and tracks `origin/pre-launch`
- [x] All changes committed to `pre-launch` branch
- [x] Changes pushed to `origin/pre-launch`

## 🧪 Testing Checklist

### Local Testing

**Test Pre-Launch Mode:**
1. [ ] Checkout pre-launch branch: `git checkout pre-launch`
2. [ ] Verify `.env.local` has `NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch`
3. [ ] Run dev server: `npm run dev`
4. [ ] Visit homepage - verify pricing section is **HIDDEN**
5. [ ] Check header navigation - verify pricing link is **HIDDEN**
6. [ ] Visit `/pricing` - verify redirects to homepage
7. [ ] Visit `/auth/signup` - verify redirects to `/#waitlist`
8. [ ] Test waitlist form - verify it works correctly
9. [ ] Verify goal input is single-row (not multi-row textarea)

### Deployment Testing (After Vercel Config)

1. [ ] Verify pre-launch branch has environment variable in Vercel
2. [ ] Check deployment URL for pre-launch branch
3. [ ] Verify pricing is hidden on deployed site
4. [ ] Verify signup redirects work on deployed site
5. [ ] Verify waitlist form works on deployed site

## 📋 Pre-Launch Behavior (What Should Work)

### ✅ Should Work (Pre-Launch Mode)
- [ ] Waitlist signup form
- [ ] Goal capture (two-step: Goal → Email)
- [ ] Meta Pixel tracking (PageView, WaitlistSignup events)
- [ ] Navigation links (except pricing)
- [ ] Login page
- [ ] All public pages accessible

### ❌ Should Be Hidden/Disabled (Pre-Launch Mode)
- [ ] Pricing section on homepage
- [ ] Pricing links in header (desktop)
- [ ] Pricing links in header (mobile)
- [ ] Pricing links on landing page
- [ ] Pricing page (`/pricing` should redirect)
- [ ] Signup page (`/auth/signup` should redirect to waitlist)

## 🚀 Next Steps After Verification

Once pre-launch is confirmed working:

1. **Configure Vercel:**
   - Set environment variable for `pre-launch` branch: `NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch`
   - Set production branch to `post-launch` (if not already)
   - Set environment variable for `post-launch` branch: `NEXT_PUBLIC_APP_LAUNCH_STATUS=post-launch`

2. **Test Post-Launch Branch:**
   - Switch to `post-launch` branch
   - Update `.env.local` to `post-launch`
   - Test locally
   - Verify pricing is visible
   - Verify signup works

3. **Verify Branch Switching:**
   - Test that you can switch between branches
   - Verify each branch behaves differently
   - Confirm environment variables work correctly

## 🔍 Quick Verification Commands

```bash
# Verify you're on pre-launch branch
git branch --show-current

# Verify environment variable is set
grep NEXT_PUBLIC_APP_LAUNCH_STATUS .env.local

# Test locally
npm run dev

# Check for any "main" references in docs (should be none)
grep -r "\bmain\b" docs/ --include="*.md" | grep -v "pre-launch\|post-launch\|maintenance\|domain"
```

## ✅ Verification Complete

Once all items above are checked, the pre-launch branch is ready for:
- Production deployment testing
- Post-launch branch testing
- Final launch preparation











