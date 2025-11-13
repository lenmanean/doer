# SMTP Email Configuration for Production

Your app is configured to use the production Supabase database. To enable real email sending, you need to configure SMTP settings in your Supabase Dashboard.

## Steps to Configure SMTP in Supabase Dashboard

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/xbzcyyukykxnrfgnhike/settings/auth

2. **Enable Email Confirmations**
   - Scroll to the "Email Auth" section
   - Ensure "Enable email confirmations" is **enabled** ✅

3. **Configure SMTP Settings**
   - Scroll to the "SMTP Settings" section
   - Click "Enable Custom SMTP"
   - Configure your SMTP provider:

### Recommended SMTP Providers:

#### Option 1: SendGrid (Recommended for most users)
- **SMTP Host:** `smtp.sendgrid.net`
- **SMTP Port:** `587`
- **SMTP User:** `apikey`
- **SMTP Password:** Your SendGrid API Key
- **Sender Email:** Your verified sender email in SendGrid
- **Sender Name:** Your app name (e.g., "DOER")

#### Option 2: AWS SES (Amazon Simple Email Service)
- **SMTP Host:** `email-smtp.us-east-1.amazonaws.com` (or your region)
- **SMTP Port:** `587`
- **SMTP User:** Your AWS SES SMTP username
- **SMTP Password:** Your AWS SES SMTP password
- **Sender Email:** Your verified email in AWS SES
- **Sender Name:** Your app name

#### Option 3: Mailgun
- **SMTP Host:** `smtp.mailgun.org`
- **SMTP Port:** `587`
- **SMTP User:** Your Mailgun SMTP username
- **SMTP Password:** Your Mailgun SMTP password
- **Sender Email:** Your verified domain email
- **Sender Name:** Your app name

4. **Test the Configuration**
   - After saving, try signing up a new user
   - The confirmation email should be sent to the user's email address
   - Check your SMTP provider's logs/dashboard to verify emails are being sent

## Email Template Customization (Optional)

You can customize the email templates in the Supabase Dashboard:
- Go to Authentication → Email Templates
- Customize the "Confirm signup" template
- Use variables like `{{ .Code }}` for the OTP code

## Important Notes

- The `config.toml` file is only for local development
- Production email settings are configured in the Supabase Dashboard
- Make sure your SMTP provider allows sending from your domain/email
- Verify your sender email address in your SMTP provider's dashboard
- Check spam folders if emails aren't received

## Troubleshooting

If emails aren't being sent:
1. Verify SMTP credentials are correct
2. Check SMTP provider logs for errors
3. Ensure sender email is verified in your SMTP provider
4. Check Supabase logs in the Dashboard for email sending errors
5. Verify "Enable email confirmations" is enabled in Supabase Dashboard















