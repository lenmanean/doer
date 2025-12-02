# Branch-Based Deployment Quick Reference

## Current Setup

### Branches
- **`pre-launch`**: Pre-launch branch (waitlist mode, pricing hidden)
- **`post-launch`**: Post-launch branch (open signup, pricing visible)

### Environment Variable
- `NEXT_PUBLIC_APP_LAUNCH_STATUS`
  - Value for `pre-launch`: `pre-launch`
  - Value for `post-launch`: `post-launch`

## Quick Commands

### Switch Branches
```bash
git checkout pre-launch    # Switch to pre-launch
git checkout post-launch   # Switch to post-launch
```

### Make Changes

**Pre-Launch Changes (on pre-launch):**
```bash
git checkout pre-launch
# Make changes
git add .
git commit -m "feat: Pre-launch feature"
git push origin pre-launch
```

**Post-Launch Changes (on post-launch):**
```bash
git checkout post-launch
# Make changes
git add .
git commit -m "feat: Post-launch feature"
git push origin post-launch
```

### Merge Pre-Launch → Post-Launch
```bash
git checkout post-launch
git merge pre-launch
git push origin post-launch
```

## Vercel Configuration

1. **Production Branch**: Set to `post-launch` in Vercel Dashboard
2. **Environment Variables**: Configure separately for each branch
   - `pre-launch` branch: `NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch`
   - `post-launch` branch: `NEXT_PUBLIC_APP_LAUNCH_STATUS=post-launch`

## Launch Day

1. Merge all pre-launch work:
   ```bash
   git checkout post-launch
   git merge pre-launch
   git push origin post-launch
   ```

2. Verify Vercel env vars are set correctly for `post-launch` branch

3. Vercel automatically deploys → Done!

## Testing Locally

**Pre-Launch Mode:**
```bash
git checkout pre-launch
# .env.local: NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch
npm run dev
```

**Post-Launch Mode:**
```bash
git checkout post-launch
# .env.local: NEXT_PUBLIC_APP_LAUNCH_STATUS=post-launch
npm run dev
```

