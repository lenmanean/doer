# Supabase Security Settings

## Leaked Password Protection

**⚠️ Warning**: Leaked password protection is currently disabled in Supabase Auth.

### Current Status: Paid Feature Limitation

**Leaked Password Protection is a paid Supabase feature** and requires upgrading from the free tier. This warning is expected and acceptable until the project is upgraded to a paid plan.

### Temporary Solution (Implemented)

We've implemented a **client-side password check** against HaveIBeenPwned.org as a temporary measure:

- **Location**: `src/lib/password-security.ts`
- **Usage**: Validates passwords during signup and password changes
- **Limitation**: Client-side only (can be bypassed by malicious users)
- **Note**: This is a temporary solution until Supabase's native feature can be enabled

### Future Implementation (When Upgraded)

Once upgraded to a paid Supabase plan, you can enable the native feature:

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication Settings**
   - Click on **Authentication** in the left sidebar
   - Click on **Settings**

3. **Enable Leaked Password Protection**
   - Scroll to **"Password Security"** section
   - Toggle **"Leaked Password Protection"** to **ON**
   - Save the changes

4. **Remove Client-Side Check**
   - Once native protection is enabled, the client-side check can be removed
   - The native server-side check is more secure and cannot be bypassed

### What It Does

- Checks passwords against HaveIBeenPwned.org database
- Prevents users from using passwords that have been compromised in data breaches
- Blocks weak/compromised passwords during signup and password changes
- Enhances overall security posture

### Why It's Important

- **Security Best Practice**: Prevents users from using compromised passwords
- **Data Protection**: Reduces risk of account compromise
- **Compliance**: Helps meet security compliance requirements
- **User Safety**: Protects users from using passwords that are known to be compromised

### Documentation

- Official Guide: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- HaveIBeenPwned API: https://haveibeenpwned.com/API/v3#PwnedPasswords
- Supabase Pricing: https://supabase.com/pricing

---

**Note**: This warning is expected on the free tier and can be safely ignored until the project is upgraded to a paid plan.

