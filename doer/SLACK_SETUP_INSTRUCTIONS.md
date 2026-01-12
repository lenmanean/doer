# Slack Integration Setup Instructions

Complete guide for setting up the Slack integration for DOER.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: Create Slack OAuth App](#part-1-create-slack-oauth-app)
3. [Part 2: Configure OAuth & Permissions](#part-2-configure-oauth--permissions)
4. [Part 3: Configure Webhooks & Event Subscriptions](#part-3-configure-webhooks--event-subscriptions)
5. [Part 4: Configure Slash Commands](#part-4-configure-slash-commands)
6. [Part 5: Configure Interactive Components](#part-5-configure-interactive-components)
7. [Part 6: Environment Variables Setup](#part-6-environment-variables-setup)
8. [Part 7: Testing](#part-7-testing)
9. [Part 8: Production Deployment](#part-8-production-deployment)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Access to [Slack API Dashboard](https://api.slack.com/apps)
- Admin access to a Slack workspace for testing
- DOER application deployed (or local development environment)
- Access to Vercel dashboard (for production environment variables)

---

## Part 1: Create Slack OAuth App

### Step 1.1: Create New App

1. Navigate to [Slack API: Your Apps](https://api.slack.com/apps)
2. Click **"Create New App"** button
3. Select **"From scratch"** option
4. Enter app details:
   - **App Name**: `DOER`
   - **Pick a workspace**: Select your development workspace
5. Click **"Create App"**

### Step 1.2: Configure Basic Information

1. In the left sidebar, click **"Basic Information"**
2. Configure the following:
   - **App Name**: `DOER` (or keep default)
   - **Short Description**: `AI-powered task planning and scheduling with Slack notifications`
   - **App Icon**: Upload DOER logo (optional, recommended size: 512x512px)
   - **Background Color**: `#000000` (or your brand color)
   - **App Home**: Leave default settings (can customize later)

3. Scroll down to **"App Credentials"** section
4. **IMPORTANT**: Note these values (you'll need them later):
   - **Client ID**: `1234567890.1234567890123` (format: `number.number`)
   - **Client Secret**: `abc123def456...` (long alphanumeric string)
   - **Signing Secret**: `abc123def456...` (found here)

5. **Store these securely** - you'll add them to environment variables in Part 6

---

## Part 2: Configure OAuth & Permissions

### Step 2.1: Add Redirect URLs

1. In the left sidebar, click **"OAuth & Permissions"**
2. Scroll to **"Redirect URLs"** section
3. Click **"Add New Redirect URL"**
4. Add the following redirect URIs (one at a time):

   **Production:**
   ```
   https://usedoer.com/api/integrations/slack/callback
   ```

   **Development:**
   ```
   http://localhost:3000/api/integrations/slack/callback
   ```

   **Preview (if using Vercel):**
   ```
   https://your-preview-url.vercel.app/api/integrations/slack/callback
   ```

5. Click **"Add"** after each URL
6. Click **"Save URLs"** at the bottom

**Important Notes:**
- URLs must match exactly (including protocol http/https)
- No trailing slashes
- For local development, you may need to use ngrok or similar tool for HTTPS

### Step 2.2: Configure Bot Token Scopes

1. Still in **"OAuth & Permissions"**, scroll to **"Scopes"** section
2. Under **"Bot Token Scopes"**, click **"Add an OAuth Scope"**
3. Add the following scopes (one at a time):

   **Required Scopes:**
   - `chat:write` - Send messages as the bot
   - `chat:write.public` - Send messages to channels the bot isn't in
   - `commands` - Add slash commands
   - `channels:read` - View basic information about public channels
   - `groups:read` - View basic information about private channels
   - `im:read` - View basic information about direct messages
   - `users:read` - View people in the workspace

   **Optional Scopes:**
   - `users:read.email` - View email addresses of people in the workspace

4. After adding all scopes, click **"Save Changes"**

### Step 2.3: Configure User Token Scopes (Optional)

1. Under **"User Token Scopes"** section
2. Leave empty for now (can add later if needed for user-specific actions)
3. Click **"Save Changes"** if you made any changes

### Step 2.4: Install App to Workspace

1. Still in **"OAuth & Permissions"** section
2. Scroll to the top and click **"Install to Workspace"** button
3. Review the permissions requested
4. Click **"Allow"** to authorize
5. **After installation, you'll see:**
   - **Bot User OAuth Token**: `xoxb-...` (starts with `xoxb-`)
   - **User OAuth Token**: `xoxp-...` (if user scopes were added)
   
   **Note**: These tokens are shown once. You don't need to save them - the OAuth flow will handle token exchange automatically.

---

## Part 3: Configure Webhooks & Event Subscriptions

### Step 3.1: Enable Event Subscriptions

1. In the left sidebar, click **"Event Subscriptions"**
2. Toggle **"Enable Events"** to **ON**

### Step 3.2: Set Request URL

1. Under **"Request URL"** field, enter:

   **Production:**
   ```
   https://usedoer.com/api/integrations/slack/webhook
   ```

   **Development:**
   - Use ngrok or similar tool for HTTPS:
   ```
   https://your-ngrok-url.ngrok.io/api/integrations/slack/webhook
   ```
   - Or deploy to a preview environment

2. Click **"Save Changes"**

3. **Slack will immediately send a verification challenge** to your URL
4. The webhook handler should respond with the challenge
5. If verification succeeds, you'll see a green checkmark ✅
6. If verification fails:
   - Check that the URL is accessible
   - Verify the signing secret is correct (see Troubleshooting)
   - Check server logs for errors
   - Ensure the endpoint responds within 3 seconds

### Step 3.3: Subscribe to Bot Events

1. Still in **"Event Subscriptions"**, scroll to **"Subscribe to bot events"**
2. Click **"Add Bot User Event"**
3. Add the following events:

   **Required Events:**
   - `app_mention` - When users mention the app (e.g., `@DOER help`)
   - `tokens_revoked` - When tokens are revoked (for cleanup)

   **Optional Events:**
   - `message.im` - Direct messages to the bot (if you want DM support)

4. After adding events, click **"Save Changes"**

### Step 3.4: Subscribe to User Events (Optional)

1. Under **"Subscribe to events on behalf of users"** section
2. Leave empty for now (can add later if needed)
3. Click **"Save Changes"** if you made any changes

---

## Part 4: Configure Slash Commands

### Step 4.1: Create Slash Command

1. In the left sidebar, click **"Slash Commands"**
2. Click **"Create New Command"** button

### Step 4.2: Configure Command

1. Fill in the command details:

   **Command:**
   ```
   /doer
   ```

   **Request URL:**
   ```
   https://usedoer.com/api/integrations/slack/commands
   ```

   **Short Description:**
   ```
   Interact with DOER task planning
   ```

   **Usage Hint (optional):**
   ```
   [status|plan|today|reschedule|help]
   ```

2. Click **"Save"**

### Step 4.3: Test Slash Command

1. In your Slack workspace, type: `/doer help`
2. You should receive a response with available commands
3. If it doesn't work:
   - Check that the app is installed to the workspace
   - Verify the request URL is correct
   - Check server logs for errors

**Note**: For development, you can create a separate command with a development URL, or use the same command pointing to your development server.

---

## Part 5: Configure Interactive Components

### Step 5.1: Enable Interactivity

1. In the left sidebar, click **"Interactivity & Shortcuts"**
2. Toggle **"Interactivity"** to **ON**

### Step 5.2: Set Request URL

1. Under **"Request URL"** field, enter:

   **Production:**
   ```
   https://usedoer.com/api/integrations/slack/interactive
   ```

   **Development:**
   - Use ngrok or preview URL:
   ```
   https://your-ngrok-url.ngrok.io/api/integrations/slack/interactive
   ```

2. Click **"Save Changes"**

### Step 5.3: Verify Interactive Components

The interactive handler supports:
- `block_actions` - Button clicks, dropdown selections
- `view_submission` - Modal form submissions
- `view_closed` - Modal dismissals

These are automatically handled by the code - no additional configuration needed.

---

## Part 6: Environment Variables Setup

### Step 6.1: Local Development (.env.local)

1. Navigate to the `doer` directory in your project:
   ```bash
   cd doer
   ```

2. Open or create the `.env.local` file:
   ```bash
   # On Windows (PowerShell)
   notepad .env.local
   
   # On Windows (Git Bash) or Mac/Linux
   nano .env.local
   ```

3. Add the following environment variables:
   ```env
   # Slack OAuth Configuration
   SLACK_CLIENT_ID=your_client_id_here
   SLACK_CLIENT_SECRET=your_client_secret_here
   SLACK_SIGNING_SECRET=your_signing_secret_here

   # Optional: Explicit redirect URI (if different from default)
   # SLACK_REDIRECT_URI=http://localhost:3000/api/integrations/slack/callback
   ```

4. Replace the placeholders:
   - `your_client_id_here` → Your **Client ID** from Step 1.2
   - `your_client_secret_here` → Your **Client Secret** from Step 1.2
   - `your_signing_secret_here` → Your **Signing Secret** from Step 1.2

5. Save the file

6. **Verify the file was created correctly:**
   ```bash
   # Check that the variables are set (don't show values for security)
   grep -E "^SLACK_" .env.local
   ```

### Step 6.2: Production Environment (Vercel)

1. **Navigate to Vercel Dashboard:**
   - Go to: **https://vercel.com/dashboard**
   - Sign in to your account
   - Select your DOER project

2. **Go to Project Settings:**
   - Click on your project
   - Click on **"Settings"** in the top navigation
   - Click on **"Environment Variables"** in the left sidebar

3. **Add Environment Variables:**
   
   **Variable 1: SLACK_CLIENT_ID**
   - Click **"Add New"** button
   - **Name**: `SLACK_CLIENT_ID`
   - **Value**: (paste your Client ID from Slack)
   - **Environments**: Select all three:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
   - Click **"Save"**
   
   **Variable 2: SLACK_CLIENT_SECRET**
   - Click **"Add New"** button again
   - **Name**: `SLACK_CLIENT_SECRET`
   - **Value**: (paste your Client Secret from Slack)
   - **Environments**: Select all three:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
   - Click **"Save"**
   
   **Variable 3: SLACK_SIGNING_SECRET**
   - Click **"Add New"** button again
   - **Name**: `SLACK_SIGNING_SECRET`
   - **Value**: (paste your Signing Secret from Slack)
   - **Environments**: Select all three:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
   - Click **"Save"**

4. **Important**: After adding environment variables, you **must redeploy** the application:
   - Go to the **"Deployments"** tab
   - Click the **"..."** menu on the latest deployment
   - Click **"Redeploy"**
   - Or push a new commit to trigger a new deployment

### Step 6.3: Verify Environment Variables

1. **Local Verification:**
   - Start your development server:
     ```bash
     npm run dev
     ```
   - The `SlackProvider.validateConfig()` method will throw an error if variables are missing
   - Check the console for any validation errors

2. **Production Verification:**
   - After redeploying, test the OAuth flow
   - If environment variables are missing, you'll see errors in the Vercel logs

---

## Part 7: Testing

### Test 7.1: OAuth Flow Testing

1. **Local Testing:**
   ```bash
   npm run dev
   ```

2. Navigate to:
   ```
   http://localhost:3000/integrations/slack
   ```

3. Click **"Connect Slack"** button

4. You should be redirected to Slack's OAuth authorization page

5. Review the permissions and click **"Allow"**

6. You should be redirected back to:
   ```
   http://localhost:3000/integrations/slack?connected=slack&team_id=...
   ```

7. **Verify in Database:**
   - Check the `slack_connections` table
   - Should have a new entry with your user_id and team_id
   - Tokens should be encrypted

### Test 7.2: Webhook Testing

1. **URL Verification:**
   - When you saved the webhook URL in Part 3, Slack sent a verification challenge
   - Check server logs to verify the challenge was received and responded to
   - Webhook should return `{ "challenge": "..." }`
   - You should see a green checkmark ✅ in Slack app settings

2. **Event Testing:**
   - In your Slack workspace, mention the app: `@DOER help`
   - Check server logs for `app_mention` event
   - Verify the event is processed asynchronously (doesn't block the response)

### Test 7.3: Slash Command Testing

1. In your Slack workspace, type: `/doer help`
2. You should receive a response with available commands:
   - `/doer status` - Show current plan status
   - `/doer plan` - Show active plan summary
   - `/doer today` - Show today's scheduled tasks
   - `/doer reschedule [task]` - Request reschedule for a task
   - `/doer reschedule-all` - Request reschedule for all overdue tasks
   - `/doer complete [task]` - Mark a task as complete
   - `/doer help` - Show help message

3. Test other commands:
   - `/doer status` - Should show connection status
   - `/doer plan` - Should show active plan (if you have one)
   - `/doer today` - Should show today's tasks

### Test 7.4: Notification Testing

1. **Test Notification Sending:**
   - Use the test notification endpoint:
     ```bash
     POST /api/integrations/slack/test-notification
     ```
   - Or trigger a plan generation to test automatic notifications
   - Verify the message appears in the selected channel

2. **Test Different Notification Types:**
   - Plan generation notification
   - Schedule generation notification
   - Task completion notification
   - Reschedule notification

### Test 7.5: Error Handling Testing

1. **Test Invalid Token:**
   - Manually corrupt a token in the database
   - Try to send a notification
   - Should handle gracefully with an error message

2. **Test Missing Connection:**
   - Delete the connection from the database
   - Try to use a slash command
   - Should return a helpful error message

3. **Test Invalid Signature:**
   - Send a webhook request with a wrong signature
   - Should reject with 401 error

---

## Part 8: Production Deployment

### Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] OAuth app is configured with production redirect URI
- [ ] Environment variables are set in Vercel production environment
- [ ] Webhook URL is set to production URL in Slack app
- [ ] Slash command URL is set to production URL in Slack app
- [ ] Interactive components URL is set to production URL in Slack app
- [ ] SSL certificate is valid (required for webhooks)
- [ ] Database migrations are applied
- [ ] All redirect URIs are added to Slack app

### Deployment Steps

1. **Update Slack App URLs:**
   - Go to Slack app settings
   - Update all URLs to production:
     - OAuth redirect URI: `https://usedoer.com/api/integrations/slack/callback`
     - Webhook URL: `https://usedoer.com/api/integrations/slack/webhook`
     - Slash command URL: `https://usedoer.com/api/integrations/slack/commands`
     - Interactive components URL: `https://usedoer.com/api/integrations/slack/interactive`

2. **Set Production Environment Variables:**
   - Follow Step 6.2 to add variables in Vercel
   - Ensure they're set for Production environment

3. **Redeploy Application:**
   - Go to Vercel Deployments
   - Redeploy the latest deployment
   - Or push a new commit

4. **Test in Production:**
   - Test OAuth flow: `https://usedoer.com/integrations/slack`
   - Test webhook (Slack will verify automatically)
   - Test slash commands in your workspace
   - Test notifications

5. **Monitor:**
   - Check Vercel logs for errors
   - Monitor Slack app usage
   - Check database for connection issues

---

## Troubleshooting

### Common Issues

#### 1. "Redirect URI mismatch" Error

**Symptoms:**
- OAuth flow fails with "redirect_uri_mismatch" error
- User is redirected back with an error

**Solutions:**
- Verify redirect URI in Slack app matches exactly (including protocol)
- Check for trailing slashes
- Ensure protocol (http/https) matches
- For local development, ensure `http://localhost:3000` is added
- For production, ensure `https://usedoer.com` is added

#### 2. "Invalid signature" Error

**Symptoms:**
- Webhook verification fails
- Slash commands return 401 error
- Interactive components fail

**Solutions:**
- Verify `SLACK_SIGNING_SECRET` environment variable is correct
- Check that the raw body is used for signature verification (code already handles this)
- Ensure timestamp is within 5 minutes (code already validates this)
- Check server logs for signature verification errors

#### 3. "Token expired" or "Invalid token" Error

**Symptoms:**
- Notifications fail to send
- API calls return authentication errors

**Solutions:**
- Slack bot tokens don't expire, but check if token was revoked
- Reconnect the app: Go to `/integrations/slack` and click "Connect Slack" again
- Check database for corrupted tokens
- Verify token encryption/decryption is working

#### 4. "Channel not found" Error

**Symptoms:**
- Notifications fail to send to a channel
- Error message mentions channel not found

**Solutions:**
- Verify bot is in the channel (or use `chat:write.public` scope)
- Check channel ID is correct
- Ensure channel is not archived
- For private channels, bot must be invited

#### 5. Webhook URL Verification Fails

**Symptoms:**
- Red X in Slack app settings
- Webhook URL shows as invalid

**Solutions:**
- Check that the URL is accessible (try in browser)
- Verify SSL certificate is valid (required for HTTPS)
- Check server logs for verification challenge response
- Ensure endpoint responds within 3 seconds
- Verify signing secret is correct

#### 6. Slash Commands Don't Work

**Symptoms:**
- Typing `/doer` shows no response
- Command times out

**Solutions:**
- Verify app is installed to the workspace
- Check request URL is correct in Slack app settings
- Verify signature verification is working
- Check server logs for command handler errors
- Ensure connection exists in database for the team_id

#### 7. Environment Variables Not Working

**Symptoms:**
- `validateConfig()` throws errors
- OAuth flow fails

**Solutions:**
- Verify variables are set in `.env.local` (local) or Vercel (production)
- Check variable names are correct (case-sensitive)
- For Vercel, ensure variables are set for the correct environment
- Redeploy after adding variables
- Check Vercel logs for missing variable errors

### Getting Help

If you encounter issues not covered here:

1. Check server logs for detailed error messages
2. Check Vercel logs (for production)
3. Review Slack API documentation: https://api.slack.com/docs
4. Test with Slack's API tester: https://api.slack.com/methods
5. Verify all URLs are accessible and responding correctly

---

## Quick Reference

### Slack App Settings URLs

- **OAuth Redirect URIs:**
  - Production: `https://usedoer.com/api/integrations/slack/callback`
  - Development: `http://localhost:3000/api/integrations/slack/callback`

- **Webhook URL:**
  - Production: `https://usedoer.com/api/integrations/slack/webhook`

- **Slash Command URL:**
  - Production: `https://usedoer.com/api/integrations/slack/commands`

- **Interactive Components URL:**
  - Production: `https://usedoer.com/api/integrations/slack/interactive`

### Environment Variables

- `SLACK_CLIENT_ID` - From Slack app Basic Information
- `SLACK_CLIENT_SECRET` - From Slack app Basic Information
- `SLACK_SIGNING_SECRET` - From Slack app Basic Information

### Test URLs

- Local integrations: `http://localhost:3000/integrations/slack`
- Production integrations: `https://usedoer.com/integrations/slack`

---

## Next Steps

After completing this setup:

1. ✅ Test OAuth flow end-to-end
2. ✅ Test webhook event processing
3. ✅ Test slash commands
4. ✅ Test notification sending
5. ✅ Verify error handling
6. ✅ Deploy to production
7. ✅ Monitor for issues

See the implementation plan for detailed testing procedures.

