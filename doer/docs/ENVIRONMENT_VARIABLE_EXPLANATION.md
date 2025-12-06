# Environment Variable Setup - One-Time Configuration

## Key Point: Set Once, Works Automatically

You configure the environment variable **ONCE** in Vercel with different values for different branches. After that, **Vercel automatically uses the correct value** based on which branch is deploying.

## How It Works

### Initial Setup (One-Time)

In Vercel Dashboard, you add the same environment variable twice with different branch-specific values:

1. **Variable 1:** 
   - Name: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
   - Value: `pre-launch`
   - Branch: `pre-launch`

2. **Variable 2:**
   - Name: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
   - Value: `post-launch`
   - Branch: `post-launch`

### Automatic Behavior (No Manual Changes Needed)

Once configured:
- **Push to `pre-launch` branch** → Vercel automatically uses `pre-launch` value
- **Push to `post-launch` branch** → Vercel automatically uses `post-launch` value
- **No manual updates needed** when switching branches

## Visual Flow

```
You push to pre-launch branch
    ↓
Vercel detects pre-launch branch deployment
    ↓
Vercel automatically applies: NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch
    ↓
Deployment runs with pre-launch mode

---

You push to post-launch branch
    ↓
Vercel detects post-launch branch deployment
    ↓
Vercel automatically applies: NEXT_PUBLIC_APP_LAUNCH_STATUS=post-launch
    ↓
Deployment runs with post-launch mode
```

## Local Development (Only)

When **testing locally**, you may want to update `.env.local` to match the branch:

```bash
# On pre-launch branch
git checkout pre-launch
# .env.local: NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch

# On post-launch branch
git checkout post-launch
# .env.local: NEXT_PUBLIC_APP_LAUNCH_STATUS=post-launch
```

**This is ONLY for local testing.** Vercel deployments are automatic.

## Summary

- ✅ **Vercel:** Configure once, works automatically forever
- ✅ **No manual updates** needed when switching branches
- ✅ **Automatic:** Vercel picks the right value based on branch
- ⚠️ **Local only:** Update `.env.local` manually for local testing

## When Do You Need to Change It?

**You only change it if:**
- You want to modify the behavior (e.g., change from pre-launch to post-launch permanently)
- You're adding the variable for the first time
- You need to fix a misconfiguration

**You DON'T change it when:**
- Switching between branches (Vercel handles it)
- Making code changes
- Deploying updates












