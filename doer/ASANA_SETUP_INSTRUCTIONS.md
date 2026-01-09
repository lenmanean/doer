# Asana Integration Setup Instructions

This guide provides step-by-step instructions for setting up the Asana OAuth integration.

## Part 1: Asana OAuth App Setup

### Step 1: Navigate to Asana Developer Console

1. Open your web browser and go to: **https://app.asana.com/0/developer-console**
2. Sign in with your Asana account (the account you want to use for the integration)

### Step 2: Create New App

1. Click **"Create new app"** or **"Register new app"** button
2. Fill in the app details:
   - **App name**: `DOER Integration` (or your preferred name)
   - **App URL**: `https://usedoer.com` (or your production URL)
   - **Description**: `DOER task management integration`
   - **App icon**: (Optional) Upload DOER logo if available

3. Click **"Create"** or **"Register"** to create the app

### Step 3: Configure OAuth Redirect URIs

1. After creating the app, you'll be taken to the app settings page
2. Find the **"Redirect URIs"** or **"Redirect URL"** section
3. Add the following redirect URIs (one per line or as separate entries):

   ```
   https://usedoer.com/api/integrations/asana/callback
   http://localhost:3000/api/integrations/asana/callback
   ```

   **Important Notes:**
   - Asana requires **exact match** of redirect URIs, including protocol (http vs https)
   - For localhost, use `http://` (not `https://`)
   - For production, use `https://`
   - If you have Vercel preview deployments, you'll need to add those URLs dynamically (see note below)

4. Click **"Save"** or **"Update"** to save the redirect URIs

### Step 4: Configure OAuth Scopes

1. In the app settings, find the **"OAuth"** or **"Permissions"** section
2. Select the following scopes/permissions:
   - `default` (provides basic read/write access)
   - Or explicitly select:
     - ✅ Read tasks
     - ✅ Write tasks
     - ✅ Read projects
     - ✅ Write projects (if needed)

3. Save the settings

### Step 5: Save Client Credentials

1. After creating the app, you'll see your app credentials:
   - **Client ID**: Copy this value (you'll need it for `ASANA_CLIENT_ID`)
   - **Client Secret**: Copy this value (you'll need it for `ASANA_CLIENT_SECRET`)

2. **Security Note**: 
   - Keep the client secret secure and **never commit it to version control**
   - Store it in a secure password manager
   - You'll need it for the next step

---

## Part 2: Environment Variables Setup

### Step 1: Local Development (.env.local)

1. Navigate to the `doer` directory in your project:
   ```bash
   cd doer
   ```

2. Open or create the `.env.local` file:
   ```bash
   # On Windows (PowerShell)
   notepad .env.local
   
   # On Windows (Git Bash)
   nano .env.local
   
   # On Mac/Linux
   nano .env.local
   ```

3. Add the following environment variables to `.env.local`:
   ```bash
   ASANA_CLIENT_ID=your_asana_client_id_here
   ASANA_CLIENT_SECRET=your_asana_client_secret_here
   ```

4. Replace `your_asana_client_id_here` with the **Client ID** from Step 5 of Part 1
5. Replace `your_asana_client_secret_here` with the **Client Secret** from Step 5 of Part 1

6. Save the file

7. **Verify the file was created correctly:**
   ```bash
   # Check that the variables are set (don't show values for security)
   grep -E "^ASANA_" .env.local
   ```

### Step 2: Vercel Production Environment

1. **Navigate to Vercel Dashboard:**
   - Go to: **https://vercel.com/dashboard**
   - Sign in to your account
   - Select your DOER project

2. **Go to Project Settings:**
   - Click on your project
   - Click on **"Settings"** in the top navigation
   - Click on **"Environment Variables"** in the left sidebar

3. **Add Environment Variables:**
   - Click **"Add New"** button
   - Add the first variable:
     - **Name**: `ASANA_CLIENT_ID`
     - **Value**: (paste your Client ID from Asana Developer Console)
     - **Environments**: Select all three:
       - ✅ Production
       - ✅ Preview
       - ✅ Development
     - Click **"Save"**
   
   - Click **"Add New"** again
   - Add the second variable:
     - **Name**: `ASANA_CLIENT_SECRET`
     - **Value**: (paste your Client Secret from Asana Developer Console)
     - **Environments**: Select all three:
       - ✅ Production
       - ✅ Preview
       - ✅ Development
     - Click **"Save"**

4. **Important**: After adding environment variables, you **must redeploy** the application for changes to take effect:
   - Go to the **"Deployments"** tab
   - Click the **"..."** menu on the latest deployment
   - Click **"Redeploy"**
   - Or push a new commit to trigger a new deployment

### Step 3: Verify Environment Variables

1. **Local Verification:**
   - Start your development server:
     ```bash
     npm run dev
     ```
   - The provider's `validateConfig()` method will throw an error if variables are missing
   - Check the console for any validation errors

2. **Production Verification:**
   - After redeploying, test the OAuth flow
   - If environment variables are missing, you'll see errors in the Vercel logs

---

## Part 3: Testing the Setup

### Test OAuth Flow Locally

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the integrations page:
   ```
   http://localhost:3000/integrations
   ```

3. Click **"Connect Asana"** button

4. You should be redirected to Asana's authorization page

5. After authorizing, you should be redirected back to:
   ```
   http://localhost:3000/integrations/asana?connected=asana
   ```

### Troubleshooting

**Issue: "Redirect URI mismatch" error**
- **Solution**: Verify that the redirect URI in Asana Developer Console exactly matches:
  - For localhost: `http://localhost:3000/api/integrations/asana/callback`
  - For production: `https://usedoer.com/api/integrations/asana/callback`
- Check for trailing slashes, protocol (http vs https), and exact path

**Issue: "Invalid client credentials" error**
- **Solution**: 
  - Verify `ASANA_CLIENT_ID` and `ASANA_CLIENT_SECRET` are correct
  - Make sure there are no extra spaces or quotes in the environment variables
  - Restart your development server after adding environment variables

**Issue: Environment variables not found**
- **Solution**:
  - Verify `.env.local` file exists in the `doer` directory
  - Check that variable names are exactly `ASANA_CLIENT_ID` and `ASANA_CLIENT_SECRET`
  - Restart your development server
  - For production, ensure you've redeployed after adding variables

---

## Additional Notes

### Vercel Preview Deployments

If you want to test with Vercel preview deployments:

1. Each preview deployment gets a unique URL (e.g., `https://doer-abc123.vercel.app`)
2. You'll need to add these URLs to Asana's redirect URIs as they're created
3. Alternatively, you can use a wildcard pattern if Asana supports it (check Asana's documentation)

### Security Best Practices

1. **Never commit `.env.local` to version control**
   - It should already be in `.gitignore`
   - Double-check that sensitive values aren't in your repository

2. **Rotate credentials if compromised**
   - If you suspect your client secret was exposed, regenerate it in Asana Developer Console
   - Update all environment variables with the new secret

3. **Use different apps for development and production** (optional)
   - You can create separate Asana apps for different environments
   - This provides better isolation and security

---

## Quick Reference

### Asana Developer Console
- URL: https://app.asana.com/0/developer-console
- Redirect URIs needed:
  - `https://usedoer.com/api/integrations/asana/callback`
  - `http://localhost:3000/api/integrations/asana/callback`

### Environment Variables
- Local: `doer/.env.local`
- Production: Vercel Dashboard → Project Settings → Environment Variables

### Test URLs
- Local integrations: `http://localhost:3000/integrations`
- Production integrations: `https://usedoer.com/integrations`

---

## Next Steps

After completing this setup:

1. ✅ Test OAuth flow (test-oauth-flow)
2. ✅ Test task operations (test-task-operations)
3. ✅ Test auto-push (test-auto-push)
4. ✅ Verify error handling (verify-error-handling)

See the implementation plan for detailed testing procedures.



