# Setting Up OTP Code Emails (Instead of Links)

## Problem
Currently, Supabase is sending confirmation **links** instead of **OTP codes** for email confirmation. This guide will help you configure Supabase to send 6-digit OTP codes.

## Solution: Update Supabase Dashboard Email Template

### Step 1: Access Supabase Dashboard
1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/xbzcyyukykxnrfgnhike
2. Navigate to **Authentication** → **Email Templates**

### Step 2: Edit the "Confirm signup" Template
1. Find the **"Confirm signup"** template in the list
2. Click **Edit** or **Customize**

### Step 3: Update the Email Template Content

Replace the existing template with the following HTML that includes both the code and a link (for compatibility):

```html
<h2>Confirm your signup</h2>

<p>We've sent you a 6-digit confirmation code. Enter it on the confirmation page to verify your email address.</p>

<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #ff7f00; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 8px; margin: 20px 0; font-family: monospace;">{{ .Token }}</p>

<p><strong>Your confirmation code is: <span style="font-size: 20px; font-weight: bold; color: #ff7f00;">{{ .Token }}</span></strong></p>

<p>Enter this code on the confirmation page to complete your signup.</p>

<p>This code will expire in 1 hour.</p>

<p>Alternatively, you can click this link to confirm:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

### Step 4: Update the Subject Line
Change the subject line to:
```
Confirm your signup - Your code is {{ .Token }}
```

Or simply:
```
Confirm your signup
```

### Step 5: Save the Template
1. Click **Save** or **Update Template**
2. The changes will take effect immediately

## Important Variables

Supabase provides these variables in email templates:
- `{{ .Token }}` - The 6-digit OTP code
- `{{ .ConfirmationURL }}` - The confirmation link (if you want to keep it as a backup)
- `{{ .Email }}` - The user's email address
- `{{ .SiteURL }}` - Your site URL

## Verification

After updating the template:
1. Test by creating a new account
2. Check your email - you should now receive an email with a 6-digit code
3. The code should be prominently displayed in the email
4. Enter the code on the `/auth/confirm-email` page to verify it works

## Alternative: Using Only Code (No Link)

If you want to remove the link entirely and only show the code, use this template:

```html
<h2>Confirm your signup</h2>

<p>Welcome to DOER! Please confirm your email address by entering the code below:</p>

<div style="text-align: center; margin: 30px 0;">
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ff7f00; font-family: 'Courier New', monospace; padding: 20px; background-color: #f5f5f5; border-radius: 8px; display: inline-block;">{{ .Token }}</p>
</div>

<p style="text-align: center; font-size: 14px; color: #666;">This code will expire in 1 hour.</p>

<p>If you didn't create an account, you can safely ignore this email.</p>
```

## Notes

- The `{{ .Token }}` variable contains the 6-digit OTP code
- The code length is configured in `supabase/config.toml` as `otp_length = 6`
- The code expires after 1 hour (configured as `otp_expiry = 3600` in config.toml)
- The confirmation page at `/auth/confirm-email` is already set up to handle OTP codes

## Troubleshooting

If you're still receiving links instead of codes:
1. Verify the template was saved correctly in the Supabase Dashboard
2. Check that `enable_confirmations = true` in your Supabase project settings
3. Ensure SMTP is properly configured
4. Try creating a new test account to verify the changes


## Email Change OTP Flow

The in-app email change experience also uses 6-digit OTP codes, but they are sent directly from the Next.js API using Nodemailer. When a user requests a new email:

1. `/api/settings/change-email` validates the password, records a pending request, and emails the OTP.
2. `/api/settings/confirm-email-change` verifies the OTP before updating Supabase auth and the audit log.

### Required Environment Variables

Configure the following variables so Nodemailer can send those emails:

```
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_SENDER_ADDRESS=no-reply@yourdomain.com
EMAIL_SENDER_NAME=DOER
```

If these values are missing, the API responds with `EMAIL_SEND_FAILED` and instructs you to configure SMTP credentials.










