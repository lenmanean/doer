# Step-by-Step: Setting Branch-Specific Environment Variables in Vercel

## Overview

You need to add `NEXT_PUBLIC_APP_LAUNCH_STATUS` **twice** - once for each branch with different values. Vercel will automatically use the correct one based on which branch is deploying.

## Step 1: Add Variable for Pre-Launch Branch

### 1.1 Create First Variable

1. In Vercel Dashboard → **Settings** → **Environment Variables**
2. Click **"Create new"** tab (should already be selected)
3. Fill in the form:

   **Key field:**
   - Enter: `NEXT_PUBLIC_APP_LAUNCH_STATUS`

   **Value field:**
   - Enter: `pre-launch`

4. **Environments dropdown:**
   - Click the dropdown that says "All Environments"
   - Select: **"All Environments"** (Production, Preview, Development)
   - ✅ **Yes, select all environments** - this ensures it works for all deployment types

5. **Branch Selection:**
   - Look for: **"Select a custom Preview branch"** button (below Environments dropdown)
   - Click it
   - Enter: `pre-launch`
   - This restricts this variable to only the `pre-launch` branch

6. **Sensitive toggle:**
   - Leave as **"Disabled"** (this is not a secret value)

7. Click **"Save"**

### 1.2 Verify First Variable

After saving, you should see in the list:
- Key: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
- Value: `pre-launch` (may show masked)
- Scope: Should show `pre-launch` branch or specific branch info

---

## Step 2: Add Variable for Post-Launch Branch

### 2.1 Create Second Variable

1. Still in **Settings** → **Environment Variables**
2. Click **"Add Another"** button (with the + icon)
   - OR click **"Create new"** tab again
3. Fill in the form:

   **Key field:**
   - Enter: `NEXT_PUBLIC_APP_LAUNCH_STATUS`
   - ⚠️ **Same key name** as before!

   **Value field:**
   - Enter: `post-launch`

4. **Environments dropdown:**
   - Click the dropdown
   - Select: **"All Environments"** (Production, Preview, Development)

5. **Branch Selection:**
   - Click **"Select a custom Preview branch"** button
   - Enter: `post-launch`
   - This restricts this variable to only the `post-launch` branch

6. **Sensitive toggle:**
   - Leave as **"Disabled"**

7. Click **"Save"**

### 2.2 Verify Second Variable

After saving, you should see TWO variables in the list:
1. `NEXT_PUBLIC_APP_LAUNCH_STATUS` = `pre-launch` (for `pre-launch` branch)
2. `NEXT_PUBLIC_APP_LAUNCH_STATUS` = `post-launch` (for `post-launch` branch)

---

## Visual Guide

```
Environment Variables Page:

┌─────────────────────────────────────────┐
│ Create new                              │
├─────────────────────────────────────────┤
│ Key: NEXT_PUBLIC_APP_LAUNCH_STATUS     │
│ Value: pre-launch                       │
│                                         │
│ Environments: [All Environments ▼]     │
│ [Select a custom Preview branch]       │
│   → Enter: pre-launch                  │
│                                         │
│ [Save]                                  │
└─────────────────────────────────────────┘

Then click "Add Another" or create again:

┌─────────────────────────────────────────┐
│ Create new                              │
├─────────────────────────────────────────┤
│ Key: NEXT_PUBLIC_APP_LAUNCH_STATUS     │
│ Value: post-launch                      │
│                                         │
│ Environments: [All Environments ▼]     │
│ [Select a custom Preview branch]       │
│   → Enter: post-launch                 │
│                                         │
│ [Save]                                  │
└─────────────────────────────────────────┘
```

---

## Important Points

### ✅ Set for "All Environments"

**Yes, select "All Environments"** because:
- Production deployments from `post-launch` need it
- Preview deployments from both branches need it
- Development builds need it

### 🔑 Same Key Name, Different Branches

- **Same variable name:** `NEXT_PUBLIC_APP_LAUNCH_STATUS`
- **Different values:** `pre-launch` vs `post-launch`
- **Different branches:** One scoped to `pre-launch`, one to `post-launch`

### 🎯 How Vercel Uses Them

- When you push to `pre-launch` branch → Vercel sees branch-specific variable → Uses `pre-launch` value
- When you push to `post-launch` branch → Vercel sees branch-specific variable → Uses `post-launch` value
- **Automatic:** No manual changes needed!

---

## Verification After Setup

1. **Check Variable List:**
   - You should see TWO entries for `NEXT_PUBLIC_APP_LAUNCH_STATUS`
   - One with value for `pre-launch` branch
   - One with value for `post-launch` branch

2. **Test Deployment:**
   - Push a small change to `pre-launch` branch
   - Check deployment logs - should show variable is set
   - Deploy should show pre-launch behavior

3. **Filter View:**
   - In the variable list, use the "Environments" dropdown
   - You can filter to see variables by branch/environment

---

## Troubleshooting

### Issue: Can't find "Select a custom Preview branch" button

- Make sure you're creating a NEW variable (not editing existing)
- The button appears below the "Environments" dropdown
- Try clicking "Add Another" if creating a second variable

### Issue: Both branches using same value

- Verify branch names are spelled exactly: `pre-launch` and `post-launch`
- Check that each variable is scoped to its specific branch
- Rebuild deployments after setting variables

### Issue: Variable not appearing in deployment

- New deployments are required after adding variables
- Trigger a new deployment (push to branch or redeploy)
- Check deployment logs to see which variables were applied

---

## Summary

1. ✅ Create variable with value `pre-launch` for `pre-launch` branch
2. ✅ Create variable with value `post-launch` for `post-launch` branch
3. ✅ Set both to "All Environments"
4. ✅ Scope each to its specific branch
5. ✅ No manual updates needed when switching branches!



