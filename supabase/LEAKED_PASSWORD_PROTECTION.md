# Leaked Password Protection Configuration

## Overview

Supabase Auth can prevent users from using compromised passwords by checking against the HaveIBeenPwned.org database. This feature enhances security by blocking passwords that have been exposed in data breaches.

## Current Status

⚠️ **WARNING**: Leaked password protection is currently **DISABLED** in your Supabase project.

## How to Enable

Leaked password protection must be enabled through the Supabase Dashboard. This setting is not available in `config.toml` for local development.

### Steps to Enable:

1. Navigate to your Supabase Dashboard:
   - Go to: https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]/settings/auth

2. Find the "Password Security" section

3. Enable "Leaked Password Protection"

4. Save the changes

### Documentation

For more information, see:
- [Supabase Password Security Documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Security Impact

**Why this matters:**
- Prevents users from using passwords that have been compromised in data breaches
- Reduces the risk of account takeover attacks
- Enhances overall application security posture

**Recommendation:**
Enable this feature in production as soon as possible to protect user accounts.

## Local Development

Note: This feature is typically only available in production/hosted Supabase instances. For local development, you may need to test password validation logic separately.

