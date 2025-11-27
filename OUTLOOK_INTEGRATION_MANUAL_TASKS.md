# Microsoft Outlook Integration - Manual Tasks Guide

This document outlines all manual tasks required to finalize the Microsoft Outlook calendar integration implementation.

## Prerequisites

- Access to Azure Portal (Azure AD / Microsoft Entra ID)
- Admin access to configure Azure AD application
- Environment variable access for production/staging environments
- Test Microsoft accounts (personal and work/school)

---

## Step 1: Azure AD App Registration

### 1.1 Create Azure AD Application

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** (or **Microsoft Entra ID**)
3. Click on **App registrations** in the left sidebar
4. Click **+ New registration**

### 1.2 Configure Application Details

1. **Name**: Enter a descriptive name (e.g., "DOER Outlook Integration")
2. **Supported account types**: 
   - Select **"Accounts in any organizational directory and personal Microsoft accounts"**
   - This enables both work/school and personal accounts
3. **Redirect URI**:
   - Platform: **Web**
   - URI: `https://usedoer.com/api/integrations/outlook/connect`
   - Click **Add**
   - For local development, also add: `http://localhost:3000/api/integrations/outlook/connect`
4. Click **Register**

### 1.3 Record Application Credentials

After registration, you'll be on the **Overview** page. Record:
- **Application (client) ID** - This is your `OUTLOOK_CLIENT_ID`
- **Directory (tenant) ID** - Not needed for common endpoint, but good to have

### 1.4 Create Client Secret

1. Navigate to **Certificates & secrets** in the left sidebar
2. Click **+ New client secret**
3. **Description**: Enter a description (e.g., "DOER Production Secret")
4. **Expires**: Choose expiration (recommend 24 months for production)
5. Click **Add**
6. **IMPORTANT**: Copy the **Value** immediately - this is your `OUTLOOK_CLIENT_SECRET`
   - This value is only shown once and cannot be retrieved later
   - Store it securely

---

## Step 2: Configure API Permissions

### 2.1 Request API Permissions

1. Navigate to **API permissions** in the left sidebar
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Search for and add the following permissions:
   - `Calendars.ReadWrite` - Read and write access to user calendars
   - `offline_access` - Maintain access to data (required for refresh tokens)
6. Click **Add permissions**

### 2.2 Grant Admin Consent (for Work/School Accounts)

1. Still on the **API permissions** page
2. Click **Grant admin consent for [Your Organization]**
3. Click **Yes** to confirm
4. Verify that all permissions show **"Granted for [Your Organization]"** with a green checkmark

**Note**: For personal Microsoft accounts, users will grant consent during the OAuth flow.

---

## Step 3: Configure Environment Variables

### 3.1 Local Development (.env.local)

Add the following to your `.env.local` file:

```env
OUTLOOK_CLIENT_ID=your-application-client-id-here
OUTLOOK_CLIENT_SECRET=your-client-secret-value-here
OUTLOOK_REDIRECT_URI=http://localhost:3000/api/integrations/outlook/connect
```

### 3.2 Production Environment (Vercel/Deployment Platform)

**⚠️ Production credentials are stored in `.secure-notes.md` (gitignored) for reference.**

1. Navigate to your deployment platform (e.g., Vercel dashboard)
2. Go to **Settings** → **Environment Variables**
3. Add the following variables:

   - **OUTLOOK_CLIENT_ID**
     - Value: See `doer/.secure-notes.md` for production Client ID
     - Environment: Production, Preview, Development (all)
   
   - **OUTLOOK_CLIENT_SECRET**
     - Value: See `doer/.secure-notes.md` for production Client Secret
     - Environment: Production, Preview, Development (all)
     - ⚠️ **Keep this secret secure - never commit to git**
   
   - **OUTLOOK_REDIRECT_URI** (Optional)
     - Value: `https://usedoer.com/api/integrations/outlook/connect`
     - Environment: Production only
     - Note: If not set, it will be auto-generated from `NEXT_PUBLIC_APP_URL`

4. **Redeploy** your application after adding environment variables

**Note:** Production credentials are documented in `doer/.secure-notes.md` for reference only. This file is gitignored and should never be committed.

---

## Step 4: Verify Redirect URI Configuration

### 4.1 Production Redirect URI

Ensure the redirect URI in Azure AD matches your production domain:
- Azure AD: `https://usedoer.com/api/integrations/outlook/connect`
- Must match exactly (including protocol, domain, and path)

### 4.2 Development Redirect URI

For local development:
- Azure AD: `http://localhost:3000/api/integrations/outlook/connect`
- Only needed if testing locally

---

## Step 5: Testing the Integration

### 5.1 Test OAuth Flow with Personal Account

1. Start your development server: `npm run dev`
2. Navigate to `/integrations` in your browser
3. Click on **Microsoft Outlook** card
4. Click **Connect Microsoft Outlook**
5. You should be redirected to Microsoft login
6. Sign in with a personal Microsoft account (outlook.com, hotmail.com)
7. Grant permissions when prompted
8. You should be redirected back to `/integrations/outlook?connected=outlook`
9. Verify connection status shows "Connected"

### 5.2 Test OAuth Flow with Work/School Account

1. Repeat steps 1-4 from above
2. Sign in with a work/school Microsoft account
3. If admin consent was granted, you should proceed directly
4. If admin consent was not granted, you may see an error - ensure Step 2.2 is completed
5. Verify connection status

### 5.3 Test Calendar Fetching

1. After connecting, navigate to `/integrations/outlook`
2. Verify that calendars are listed
3. Select one or more calendars
4. Click **Pull from Microsoft Outlook**
5. Verify events are synced successfully
6. Check sync logs for any errors

### 5.4 Test Task Pushing

1. Ensure you have an active plan with scheduled tasks
2. On `/integrations/outlook`, click **Push to Microsoft Outlook**
3. Verify tasks appear in your Outlook calendar
4. Check that events have DOER metadata (can be verified in Outlook web)

### 5.5 Test Incremental Sync

1. After initial sync, make a change in your Outlook calendar (add/edit/delete an event)
2. Wait a few minutes
3. Click **Pull from Microsoft Outlook** again
4. Verify only changed events are synced (check sync logs)

### 5.6 Test Token Refresh

1. Wait for access token to expire (or manually expire it in database for testing)
2. Attempt to sync or push
3. Verify token is automatically refreshed
4. Check logs for refresh activity

---

## Step 6: Error Scenarios Testing

### 6.1 Test Expired Token Handling

1. Manually set `token_expires_at` in database to past date
2. Attempt to sync
3. Verify automatic token refresh occurs

### 6.2 Test Revoked Permissions

1. Go to [Microsoft Account Permissions](https://account.microsoft.com/privacy/app-permissions)
2. Revoke DOER app permissions
3. Attempt to sync
4. Verify appropriate error message is shown
5. Re-connect to restore access

### 6.3 Test Rate Limiting

1. Perform multiple rapid API calls
2. Verify exponential backoff is implemented
3. Check logs for rate limit handling

### 6.4 Test Network Errors

1. Simulate network failure (disable network temporarily)
2. Attempt to sync
3. Verify graceful error handling

---

## Step 7: Production Deployment Checklist

- [ ] Azure AD application registered
- [ ] Client ID and Secret obtained
- [ ] API permissions configured and admin consent granted
- [ ] Redirect URIs configured in Azure AD
- [ ] Environment variables set in production
- [ ] Application redeployed with new environment variables
- [ ] OAuth flow tested with personal account
- [ ] OAuth flow tested with work/school account
- [ ] Calendar fetching tested
- [ ] Task pushing tested
- [ ] Incremental sync tested
- [ ] Token refresh tested
- [ ] Error scenarios tested
- [ ] Monitoring/logging verified

---

## Step 8: Monitoring and Maintenance

### 8.1 Monitor Connection Events

Check the `calendar_connection_events` table for:
- Failed OAuth attempts
- Token refresh failures
- Connection issues

### 8.2 Monitor Sync Logs

Check the `calendar_sync_logs` table for:
- Failed syncs
- High error rates
- Performance issues

### 8.3 Client Secret Rotation

Azure AD client secrets expire. Before expiration:
1. Create a new client secret in Azure AD
2. Update `OUTLOOK_CLIENT_SECRET` environment variable
3. Redeploy application
4. Old secret can be deleted after verification

### 8.4 Review Microsoft Graph API Quotas

Monitor usage against Microsoft Graph API quotas:
- Default: 10,000 requests per 10 minutes per app per tenant
- Adjust sync frequency if approaching limits

---

## Step 9: Documentation Updates

### 9.1 User-Facing Documentation

Update user documentation to include:
- How to connect Outlook calendar
- Supported account types
- Feature descriptions
- Troubleshooting guide

### 9.2 Developer Documentation

Update developer documentation with:
- Architecture overview
- Provider implementation pattern
- Microsoft Graph API integration details
- Error handling patterns

---

## Step 10: Troubleshooting Common Issues

### Issue: "Invalid redirect URI" Error

**Solution**:
- Verify redirect URI in Azure AD matches exactly
- Check environment variables are set correctly
- Ensure protocol (http/https) matches

### Issue: "Insufficient privileges" Error

**Solution**:
- Verify API permissions are configured
- Ensure admin consent is granted for work/school accounts
- Check user has granted consent for personal accounts

### Issue: Token Refresh Fails

**Solution**:
- Verify `offline_access` permission is granted
- Check client secret is correct
- Verify refresh token is stored correctly in database

### Issue: Delta Query Fails

**Solution**:
- Delta links expire after 7 days
- Fall back to full sync if delta link is invalid
- Check sync token format in database

### Issue: Events Not Syncing

**Solution**:
- Verify calendars are selected in settings
- Check sync logs for errors
- Verify Microsoft Graph API permissions
- Check network connectivity

---

## Additional Notes

- **Security**: Client secrets should never be committed to version control
- **Testing**: Always test in staging before production deployment
- **Backup**: Keep a backup of client secret values (stored securely)
- **Compliance**: Ensure integration complies with Microsoft's terms of service
- **Support**: Monitor Microsoft Graph API status for outages

---

## Support Resources

- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/overview)
- [Azure AD App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Microsoft Graph Calendar API Reference](https://docs.microsoft.com/en-us/graph/api/resources/calendar)
- [OAuth 2.0 Authorization Code Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

---

**Last Updated**: [Current Date]
**Implementation Version**: 1.0.0

