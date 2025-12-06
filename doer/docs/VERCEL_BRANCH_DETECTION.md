# When Does Vercel Recognize New Branches?

## Quick Answer

**Vercel automatically detects new branches within 1-5 minutes** after you push them to your Git repository. No manual action needed!

## How Branch Detection Works

### Automatic Detection

1. **You push branch to Git:**
   ```bash
   git push origin post-launch
   ```

2. **Vercel detects it automatically:**
   - Vercel watches your Git repository
   - When a new branch appears, it's automatically indexed
   - This happens in the background (1-5 minutes)

3. **First deployment triggers automatically:**
   - When you make your first push to the branch
   - OR when you manually trigger a deployment
   - Vercel creates a Preview deployment for that branch

### Timeline

```
Push to Git → Vercel Detects (1-5 min) → Branch Available in Dashboard
```

## Verify Branch Detection

### Method 1: Check Vercel Dashboard

1. Go to **Vercel Dashboard** → Your Project
2. Click **"Deployments"** tab
3. Look for deployments from `post-launch` branch
4. OR click **"Settings"** → **"Git"**
   - You should see all connected branches listed

### Method 2: Trigger a Deployment

The fastest way to make Vercel recognize the branch is to trigger a deployment:

1. **Make a small change:**
   ```bash
   git checkout post-launch
   echo "# Test deployment" >> README.md
   git add README.md
   git commit -m "test: Trigger post-launch deployment"
   git push origin post-launch
   ```

2. **Vercel will:**
   - Detect the push immediately
   - Start building within seconds
   - Create a preview deployment
   - Branch will now be fully recognized

### Method 3: Manual Deployment

1. Go to **Vercel Dashboard** → Your Project
2. Click **"Deployments"** → **"Create Deployment"**
3. Select branch: `post-launch`
4. Click **"Deploy"**

## Current Status Check

Let's verify your `post-launch` branch is ready:

✅ **Branch exists on remote:** Confirmed via `git ls-remote`
✅ **Branch pushed to origin:** Already done

**Next Steps:**

### Option 1: Wait for Auto-Detection (1-5 minutes)
- Just wait - Vercel will detect it automatically
- Check Vercel Dashboard in a few minutes

### Option 2: Trigger Deployment Now (Recommended)

Make a small commit to trigger immediate detection:

```bash
# Make sure you're on post-launch branch
git checkout post-launch

# Create a small commit (if you haven't already pushed changes)
git commit --allow-empty -m "chore: Initialize post-launch branch for Vercel detection"

# Push to trigger deployment
git push origin post-launch
```

This will:
- ✅ Immediately trigger Vercel to recognize the branch
- ✅ Create your first preview deployment
- ✅ Make the branch available in all Vercel settings

## Setting Environment Variables

Once Vercel recognizes the branch, you can set branch-specific environment variables:

1. **Go to:** Settings → Environment Variables
2. **Add variable:** `NEXT_PUBLIC_APP_LAUNCH_STATUS`
3. **Value:** `post-launch`
4. **Scope to branch:** Select `post-launch` branch

### When to Set Variables

- ✅ **Best time:** After branch appears in Vercel Dashboard
- ✅ **Can set before:** Variables will be applied on next deployment
- ⚠️ **Won't work:** If branch isn't detected yet

## Troubleshooting

### Branch Not Showing in Vercel?

1. **Check Git connection:**
   - Vercel Dashboard → Settings → Git
   - Verify repository is connected
   - Check if branch exists on remote: `git ls-remote --heads origin post-launch`

2. **Trigger deployment:**
   ```bash
   git checkout post-launch
   git push origin post-launch
   ```

3. **Manual deployment:**
   - Vercel Dashboard → Deployments → Create Deployment
   - Select `post-launch` branch

4. **Check branch name:**
   - Ensure exact spelling: `post-launch` (with hyphen)
   - Case-sensitive

### Environment Variables Not Working?

1. **Wait for branch detection first**
2. **Trigger a new deployment after setting variables**
3. **Check variable scope matches branch name exactly**

## Quick Checklist

- [ ] Branch pushed to Git remote ✅
- [ ] Wait 1-5 minutes OR trigger deployment now
- [ ] Verify branch appears in Vercel Dashboard
- [ ] Set environment variable for `post-launch` branch
- [ ] Trigger deployment to apply variables

## Summary

**Vercel updates with new branch names automatically** within 1-5 minutes of pushing to Git. To trigger immediate recognition, make a small commit and push, or create a manual deployment in the Vercel Dashboard.

Your `post-launch` branch is already pushed, so Vercel should detect it soon. You can also trigger it immediately with an empty commit:

```bash
git checkout post-launch
git commit --allow-empty -m "chore: Trigger Vercel branch detection"
git push origin post-launch
```













