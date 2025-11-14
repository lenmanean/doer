# Username Security Implementation

## Overview
This document outlines the comprehensive username security measures implemented in the DOER application to prevent duplicate usernames and ensure data integrity.

## Security Layers

### 1. **Database Level (Strongest Protection)**

#### Unique Constraint
- **Location**: `supabase/migrations/20251108000001_add_username.sql`
- **Implementation**: Unique index on `LOWER(username)` ensures case-insensitive uniqueness
```sql
CREATE UNIQUE INDEX idx_user_settings_username_lower 
ON public.user_settings (LOWER(username));
```
- **Protection**: Prevents ANY duplicate usernames at the database level, regardless of how the insert/update is attempted

#### Format Validation
- **Constraint**: `username_format_check`
- **Rules**: 
  - 3-20 characters
  - Alphanumeric, underscores, and hyphens only
  - Pattern: `^[a-zA-Z0-9_-]{3,20}$`

#### Username Cooldown + Audit Trail
- **Location**: `supabase/migrations/20251116000000_credential_update_infra.sql`
- **Implementation**: `enforce_username_change_policy()` trigger enforces a 24-hour cooldown between changes and records `username_last_changed_at`.
```sql
CREATE TRIGGER enforce_username_change_policy
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_change_policy();
```
- **Audit**: Every change is captured in `public.username_change_audit` with user_id, IP, and user-agent for forensic review.
- **Protection**: Users can update usernames, but only once every 24 hours, preventing rapid impersonation attempts while still allowing corrections.

### 2. **API Level (Server-Side Validation)**

#### Username Availability Check
- **Location**: `doer/src/app/api/auth/check-username/route.ts`
- **Method**: `POST /api/auth/check-username`
- **Features**:
  - Case-insensitive duplicate check
  - Format validation (3-20 chars, alphanumeric + _ -)
  - Returns `{ available: boolean }`

#### Auth Callback Protection
- **Location**: `doer/src/app/auth/callback/route.ts`
- **Implementation**: Catches unique constraint violations (error code `23505`)
- **Behavior**: If username is taken during signup, clears it from user metadata and redirects to profile setup for new selection

### 3. **Client Level (UX Enhancement)**

#### Real-time Validation
- **Location**: `doer/src/app/auth/signup/page.tsx`
- **Features**:
  - Validates username format before submission
  - Checks availability via API before signup
  - Shows immediate feedback to user
  - Prevents form submission if username is taken

#### Validation Rules
```typescript
- Length: 3-20 characters
- Characters: Letters, numbers, underscores, hyphens
- Case: Insensitive for uniqueness
- Feedback: Real-time error messages
```

## Username Flow

### Signup Process
1. **User enters username** → Client-side format validation
2. **Form submission** → API checks availability
3. **If available** → Username stored in user metadata
4. **Email confirmation** → User confirms email
5. **Auth callback** → Username inserted into `user_settings` table
6. **If duplicate** → Database rejects, callback clears metadata, user redirected to choose new username

### Username Change Process
1. **Settings UI** → User edits username in `Settings → Account Information`.
2. **Client validation** → `validateUsername` prevents malformed submissions.
3. **API protection** → `POST /api/settings/change-username` rate limits, enforces cooldown, and checks global availability via the service-role client.
4. **Database trigger** → `public.enforce_username_change_policy()` is the final authority, updating `username_last_changed_at` and throwing `USERNAME_CHANGE_COOLDOWN` when needed.
5. **Audit logging** → Every change is persisted in `public.username_change_audit` with IP + User-Agent metadata.
6. **Auth sync** → `updateAuthUsername` keeps `auth.users` metadata aligned so username-based login continues working.

### Race Condition Handling
Even if two users submit the same username simultaneously:
1. Both pass API check (race condition)
2. Both attempt database insert
3. **Database unique constraint** ensures only one succeeds
4. Second user's insert fails with error code `23505`
5. Callback route catches error and clears username
6. User redirected to profile setup to choose different username

## Error Codes

| Code | Meaning | Handling |
|------|---------|----------|
| `23505` | Unique constraint violation | Clear username from metadata, redirect to profile setup |
| `PGRST116` | No rows found (username available) | Proceed with signup |
| `400` | Invalid format | Show validation error to user |

## Testing Username Security

### Test Cases
1. ✅ **Same username, different case**: Should be rejected (e.g., "JohnDoe" vs "johndoe")
2. ✅ **Simultaneous signups**: Database prevents duplicates
3. ✅ **Invalid characters**: Rejected at client and server
4. ✅ **Length violations**: Rejected at client and server
5. ✅ **Username change attempt**: Trigger enforces cooldown and audit logging
6. ✅ **SQL injection**: Protected by parameterized queries

### Manual Testing
```bash
# Test 1: Check availability
curl -X POST http://localhost:3000/api/auth/check-username \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser"}'

# Expected: {"available": true} or {"available": false}

# Test 2: Try to create duplicate (should fail at DB level)
# Sign up with username "testuser"
# Try to sign up again with "TestUser" (different case)
# Expected: Second signup should fail or redirect to choose new username
```

## Security Best Practices Implemented

1. ✅ **Defense in Depth**: Multiple layers (DB, API, Client)
2. ✅ **Case-Insensitive Uniqueness**: Prevents confusion
3. ✅ **Controlled Changes**: 24-hour cooldown enforced by the database trigger + audit log
4. ✅ **Format Validation**: Prevents malicious input
5. ✅ **Race Condition Protection**: Database constraint is final authority
6. ✅ **Error Handling**: Graceful fallback for all failure scenarios
7. ✅ **Audit Trail**: All errors logged for monitoring

## Future Enhancements

### Potential Additions
- [ ] Username reservation system (hold username for X minutes during signup)
- [ ] Profanity filter for usernames
- [ ] Reserved username list (admin, support, etc.)
- [x] Username history tracking (audit table)
- [ ] Rate limiting on username checks (prevent enumeration)

## Maintenance

### Monitoring
- Monitor logs for error code `23505` (indicates race conditions)
- Track username check API usage
- Alert on unusual patterns (many failed checks from same IP)

### Database Maintenance
```sql
-- Check for any username conflicts (should return 0)
SELECT LOWER(username), COUNT(*) 
FROM user_settings 
WHERE username IS NOT NULL
GROUP BY LOWER(username) 
HAVING COUNT(*) > 1;

-- Verify trigger is active
SELECT * FROM pg_trigger 
WHERE tgname = 'enforce_username_change_policy';
```

## Conclusion

The username security implementation uses a **defense-in-depth** approach with the database unique constraint as the ultimate authority. Even if client or API checks fail due to race conditions or bugs, the database will always prevent duplicate usernames.

**Key Principle**: Trust the database, validate everywhere else.








