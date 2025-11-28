# Apple Calendar Integration - Manual Tasks Guide

This document outlines all manual tasks required to finalize the Apple Calendar integration implementation.

## Prerequisites

- Apple Developer account (paid membership required: $99/year)
- Access to Apple Developer Portal
- Environment variable access for production/staging environments
- Test Apple IDs with iCloud calendars
- Understanding of Sign in with Apple OAuth 2.0 flow

---

## Step 1: Apple Developer Account Setup

### 1.1 Create Apple Developer Account

1. Navigate to [Apple Developer Portal](https://developer.apple.com)
2. Sign in with your Apple ID or create a new account
3. Enroll in the Apple Developer Program ($99/year)
4. Complete the enrollment process (may take 24-48 hours for approval)

### 1.2 Access Developer Portal

1. Once enrolled, navigate to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)
2. Ensure you have access to create App IDs and Services

---

## Step 2: App ID Registration

### 2.1 Create App ID

1. In the Apple Developer Portal, go to **Certificates, Identifiers & Profiles**
2. Click **Identifiers** in the left sidebar
3. Click the **+** button to create a new identifier
4. Select **App IDs** and click **Continue**
5. Select **App** and click **Continue**
6. Fill in the form:
   - **Description**: Enter a description (e.g., "DOER Calendar Integration")
   - **Bundle ID**: Use reverse domain notation (e.g., `com.usedoer.app`)
   - **Capabilities**: Enable **Sign in with Apple**
7. Click **Continue** and then **Register**

### 2.2 Record App ID

After registration, record:
- **Bundle ID** - This is your `APPLE_CLIENT_ID` (also called Services ID)
- **Team ID** - Found in the top right of the Developer Portal

---

## Step 3: Sign in with Apple Service Configuration

### 3.1 Create Services ID

1. In **Identifiers**, click **+** again
2. Select **Services IDs** and click **Continue**
3. Fill in:
   - **Description**: "DOER Apple Calendar OAuth"
   - **Identifier**: Use reverse domain (e.g., `com.usedoer.calendar`)
4. Click **Continue** and **Register**
5. Click on the newly created Services ID
6. Check **Sign in with Apple** and click **Configure**

### 3.2 Configure Sign in with Apple

1. **Primary App ID**: Select the App ID created in Step 2.1
2. **Website URLs**:
   - **Domains**: `usedoer.com` (or your production domain)
   - **Return URLs**: 
     - `https://usedoer.com/api/integrations/apple/connect`
     - For local development: `http://localhost:3000/api/integrations/apple/connect`
3. Click **Save** and then **Continue**
4. Click **Register**

### 3.3 Record Services ID

Record the **Services ID** - this is your `APPLE_CLIENT_ID` for OAuth

---

## Step 4: Create Client Secret (JWT)

Apple requires a JWT-based client secret, not a simple string. This is different from Google/Microsoft OAuth.

### 4.1 Create Private Key

1. In the Apple Developer Portal, go to **Certificates, Identifiers & Profiles**
2. Click **Keys** in the left sidebar
3. Click the **+** button to create a new key
4. Fill in:
   - **Key Name**: "DOER Calendar OAuth Key"
   - **Enable**: **Sign in with Apple**
5. Click **Configure** next to Sign in with Apple
6. Select the **Primary App ID** from Step 2.1
7. Click **Save** and then **Continue**
8. Click **Register**
9. **IMPORTANT**: Download the key file (`.p8` file) - you can only download it once
10. Record the **Key ID** shown on the page

### 4.2 Generate Client Secret (JWT)

Apple's client secret is a JWT that must be generated. You'll need:

- **Team ID**: From Step 2.2
- **Client ID**: Services ID from Step 3.3
- **Key ID**: From Step 4.1
- **Private Key**: The `.p8` file downloaded in Step 4.1

**Option A: Use a library to generate JWT**

Create a script or use a service to generate the JWT. The JWT should have:
- **Header**:
  ```json
  {
    "alg": "ES256",
    "kid": "<KEY_ID>"
  }
  ```
- **Payload**:
  ```json
  {
    "iss": "<TEAM_ID>",
    "iat": <current_timestamp>,
    "exp": <expiration_timestamp>,
    "aud": "https://appleid.apple.com",
    "sub": "<CLIENT_ID>"
  }
  ```
- **Signature**: Signed with the private key using ES256 algorithm

**Option B: Use environment variable for JWT**

Store the JWT generation logic in your application or use a service that generates it on-demand.

**Note**: The JWT expires (typically after 6 months). You'll need to regenerate it periodically or implement automatic generation.

---

## Step 5: Configure Environment Variables

### 5.1 Local Development (.env.local)

Add the following to your `.env.local` file:

```env
APPLE_CLIENT_ID=com.usedoer.calendar
APPLE_CLIENT_SECRET=<JWT_CLIENT_SECRET>
APPLE_REDIRECT_URI=http://localhost:3000/api/integrations/apple/connect

# Optional: For JWT generation (if generating client secret dynamically)
APPLE_TEAM_ID=<YOUR_TEAM_ID>
APPLE_KEY_ID=<YOUR_KEY_ID>
APPLE_PRIVATE_KEY_PATH=./path/to/AuthKey_XXXXXXXXXX.p8
```

### 5.2 Production Environment (Vercel/Deployment Platform)

**⚠️ Production credentials are stored in `.secure-notes.md` (gitignored) for reference.**

1. Navigate to your deployment platform (e.g., Vercel dashboard)
2. Go to **Settings** → **Environment Variables**
3. Add the following variables:

   - **APPLE_CLIENT_ID**
     - Value: See `doer/.secure-notes.md` for production Services ID
     - Environment: Production, Preview, Development (all)
   
   - **APPLE_CLIENT_SECRET**
     - Value: JWT client secret (see Step 4.2)
     - Environment: Production, Preview, Development (all)
     - ⚠️ **Keep this secret secure - never commit to git**
     - **Note**: This is a JWT, not a simple string
   
   - **APPLE_REDIRECT_URI** (Optional)
     - Value: `https://usedoer.com/api/integrations/apple/connect`
     - Environment: Production only
     - Note: If not set, it will be auto-generated from `NEXT_PUBLIC_APP_URL`

   - **APPLE_TEAM_ID** (Optional, if generating JWT dynamically)
     - Value: Your Apple Team ID
     - Environment: Production, Preview, Development (all)

   - **APPLE_KEY_ID** (Optional, if generating JWT dynamically)
     - Value: Key ID from Step 4.1
     - Environment: Production, Preview, Development (all)

4. **Redeploy** your application after adding environment variables

**Note:** Production credentials are documented in `doer/.secure-notes.md` for reference only. This file is gitignored and should never be committed.

---

## Step 6: Verify Redirect URI Configuration

### 6.1 Production Redirect URI

Ensure the redirect URI in Apple Developer Portal matches your production domain:
- Apple Developer Portal: `https://usedoer.com/api/integrations/apple/connect`
- Must match exactly (including protocol, domain, and path)

### 6.2 Development Redirect URI

For local development:
- Apple Developer Portal: `http://localhost:3000/api/integrations/apple/connect`
- Only needed if testing locally

---

## Step 7: CalDAV Server Configuration

### 7.1 iCloud CalDAV URL

The integration uses iCloud's CalDAV server:
- **Server URL**: `https://caldav.icloud.com`
- This is hardcoded in the `AppleCalendarProvider` implementation

### 7.2 Authentication

iCloud CalDAV uses:
- **Username**: User's Apple ID email
- **Password**: OAuth access token (Bearer token)
- The access token from Sign in with Apple OAuth is used for CalDAV authentication

**Note**: The current implementation extracts the username from the token or connection metadata. You may need to store the user's Apple ID separately in the connection metadata.

---

## Step 8: Testing the Integration

### 8.1 Test OAuth Flow

1. Start your development server: `npm run dev`
2. Navigate to `/integrations` in your browser
3. Click on **Apple Calendar** card
4. Click **Connect Apple Calendar**
5. You should be redirected to Apple's Sign in with Apple page
6. Sign in with an Apple ID
7. Grant permissions when prompted
8. You should be redirected back to `/integrations/apple?connected=apple`
9. Verify connection status shows "Connected"

### 8.2 Test Calendar Discovery

1. After connecting, navigate to `/integrations/apple`
2. Verify that calendars are listed
3. Check that calendar names are displayed correctly
4. Verify primary calendar is identified

### 8.3 Test Calendar Fetching

1. Select one or more calendars
2. Click **Pull from Apple Calendar**
3. Verify events are synced successfully
4. Check sync logs for any errors
5. Verify events appear in the calendar view

### 8.4 Test Task Pushing

1. Ensure you have an active plan with scheduled tasks
2. On `/integrations/apple`, click **Push to Apple Calendar**
3. Verify tasks appear in your iCloud calendar
4. Check that events have DOER metadata (can be verified in Calendar app)
5. Verify events are marked as busy (not free)

### 8.5 Test Incremental Sync

1. After initial sync, make a change in your iCloud calendar (add/edit/delete an event)
2. Wait a few minutes
3. Click **Pull from Apple Calendar** again
4. Verify only changed events are synced (check sync logs)
5. Verify sync token is updated

### 8.6 Test Token Refresh

1. Wait for access token to expire (or manually expire it in database for testing)
2. Attempt to sync or push
3. Verify token is automatically refreshed
4. Check logs for refresh activity

---

## Step 9: Error Scenarios Testing

### 9.1 Test Expired Token Handling

1. Manually set `token_expires_at` in database to past date
2. Attempt to sync
3. Verify automatic token refresh occurs

### 9.2 Test Revoked Permissions

1. Go to [Apple ID Account Settings](https://appleid.apple.com)
2. Sign in and go to **Sign-In and Security** → **Apps Using Apple ID**
3. Revoke DOER app permissions
4. Attempt to sync
5. Verify appropriate error message is shown
6. Re-connect to restore access

### 9.3 Test Invalid Sync Token

1. Manually corrupt the sync token in the database
2. Attempt to sync
3. Verify fallback to full sync occurs
4. Check logs for sync token errors

### 9.4 Test Network Errors

1. Simulate network failure (disable network temporarily)
2. Attempt to sync
3. Verify graceful error handling

### 9.5 Test CalDAV Errors

1. Test with invalid calendar URL
2. Test with expired access token
3. Verify appropriate error messages

---

## Step 10: Production Deployment Checklist

- [ ] Apple Developer account created and enrolled
- [ ] App ID registered
- [ ] Services ID created and configured
- [ ] Sign in with Apple enabled and configured
- [ ] Private key created and downloaded
- [ ] Client secret (JWT) generated
- [ ] Redirect URIs configured in Apple Developer Portal
- [ ] Environment variables set in production
- [ ] Application redeployed with new environment variables
- [ ] OAuth flow tested with test Apple ID
- [ ] Calendar discovery tested
- [ ] Calendar fetching tested
- [ ] Task pushing tested
- [ ] Incremental sync tested
- [ ] Token refresh tested
- [ ] Error scenarios tested
- [ ] Monitoring/logging verified

---

## Step 11: Monitoring and Maintenance

### 11.1 Monitor Connection Events

Check the `calendar_connection_events` table for:
- Failed OAuth attempts
- Token refresh failures
- Connection issues

### 11.2 Monitor Sync Logs

Check the `calendar_sync_logs` table for:
- Failed syncs
- High error rates
- Performance issues

### 11.3 Client Secret (JWT) Rotation

Apple JWT client secrets expire (typically after 6 months). Before expiration:
1. Generate a new JWT using the same private key
2. Update `APPLE_CLIENT_SECRET` environment variable
3. Redeploy application
4. Old JWT can be deleted after verification

**Note**: The private key (`.p8` file) should be stored securely and backed up. You'll need it to generate new JWTs.

### 11.4 Review Apple API Quotas

Monitor usage against Apple's API quotas:
- Sign in with Apple: No specific documented limits, but monitor for rate limiting
- CalDAV: Monitor for HTTP 429 (Too Many Requests) responses
- Adjust sync frequency if approaching limits

---

## Step 12: Documentation Updates

### 12.1 User-Facing Documentation

Update user documentation to include:
- How to connect Apple Calendar
- Supported account types (iCloud only)
- Feature descriptions
- Troubleshooting guide

### 12.2 Developer Documentation

Update developer documentation with:
- Architecture overview
- Provider implementation pattern
- CalDAV protocol integration details
- iCalendar format handling
- Error handling patterns
- JWT client secret generation

---

## Step 13: Troubleshooting Common Issues

### Issue: "Invalid redirect URI" Error

**Solution**:
- Verify redirect URI in Apple Developer Portal matches exactly
- Check environment variables are set correctly
- Ensure protocol (http/https) matches
- Verify domain is registered in Apple Developer Portal

### Issue: "Invalid client secret" Error

**Solution**:
- Verify JWT is correctly formatted
- Check JWT hasn't expired (regenerate if needed)
- Verify JWT is signed with the correct private key
- Ensure Key ID matches the key used to sign
- Check Team ID and Client ID in JWT payload

### Issue: "Insufficient privileges" Error

**Solution**:
- Verify Sign in with Apple is enabled for the Services ID
- Ensure App ID is linked to Services ID
- Check user has granted permissions during OAuth flow
- Verify scopes requested match capabilities

### Issue: Token Refresh Fails

**Solution**:
- Verify refresh token is stored correctly in database
- Check JWT client secret is valid
- Verify refresh token hasn't been revoked by user
- Check Apple Developer Portal for service status

### Issue: CalDAV Discovery Fails

**Solution**:
- Verify access token is valid
- Check iCloud CalDAV server URL is correct
- Verify user's Apple ID is correct
- Check network connectivity to caldav.icloud.com
- Verify access token has calendar permissions

### Issue: Events Not Syncing

**Solution**:
- Verify calendars are selected in settings
- Check sync logs for errors
- Verify CalDAV permissions
- Check network connectivity
- Verify iCalendar parsing is working correctly

### Issue: "Cannot find module 'ical.js'" Error

**Solution**:
- Run `npm install ical.js`
- Verify package is in `package.json`
- Check node_modules directory
- Restart development server

---

## Additional Notes

- **Security**: 
  - Private keys (`.p8` files) should never be committed to version control
  - JWT client secrets should be stored securely
  - Access tokens are encrypted in the database

- **Testing**: 
  - Always test in staging before production deployment
  - Use test Apple IDs for development
  - Test with both personal and work Apple IDs if applicable

- **Backup**: 
  - Keep a secure backup of private key files
  - Store JWT generation logic securely
  - Document all Apple Developer Portal configurations

- **Compliance**: 
  - Ensure integration complies with Apple's terms of service
  - Follow Apple's Human Interface Guidelines for Sign in with Apple
  - Respect user privacy and data handling requirements

- **Support**: 
  - Monitor Apple Developer status page for outages
  - Check Apple Developer Forums for known issues
  - Review Apple's documentation for API changes

---

## Support Resources

- [Apple Developer Documentation](https://developer.apple.com/documentation)
- [Sign in with Apple Documentation](https://developer.apple.com/sign-in-with-apple/)
- [CalDAV Protocol Specification (RFC 4791)](https://tools.ietf.org/html/rfc4791)
- [iCalendar Format Specification (RFC 5545)](https://tools.ietf.org/html/rfc5545)
- [Apple Developer Forums](https://developer.apple.com/forums/)

---

## Important Differences from Google/Outlook

1. **Client Secret**: Apple uses JWT-based client secrets, not simple strings
2. **OAuth Flow**: Apple uses `response_mode: form_post` instead of query parameters
3. **Protocol**: Uses CalDAV (not REST API) - more complex implementation
4. **Format**: Uses iCalendar (ICS) format instead of JSON
5. **Sync Tokens**: Uses CTag/ETag instead of syncToken/deltaLink
6. **Authentication**: CalDAV uses Bearer token authentication

---

**Last Updated**: [Current Date]
**Implementation Version**: 1.0.0


