# User Preferences Best Practices & Security Guide

## Overview

This document outlines best practices for handling user preferences in DOER, including security considerations, validation, and future extensibility.

## Current Architecture

### ✅ Good Practices (Already Implemented)
- **JSONB Storage**: Flexible, efficient storage for preferences
- **Separate Columns**: Profile data (display_name, avatar_url) in dedicated columns
- **RLS Policies**: Row-level security ensures users can only access their own settings
- **API Validation**: Basic input validation on API routes

### ⚠️ Areas for Improvement
- **Lack of Schema Validation**: No centralized schema/type definition
- **Inconsistent Validation**: Some preferences validated, others not
- **No Type Safety**: Preferences not strongly typed across codebase
- **Missing Sensitive Preference Handling**: Privacy settings need special care
- **No Audit Logging**: Changes to sensitive preferences aren't logged

## Best Practices

### 1. Type Safety & Schema Definition

**Create centralized TypeScript interfaces** for all preferences:

```typescript
// src/lib/types/preferences.ts
export interface UserPreferences {
  // UI Preferences
  theme: 'dark' | 'light'
  accent_color: 'orange' | 'blue' | 'green' | 'purple' | 'pink' | 'yellow'
  
  // Time & Date Preferences
  time_format: '12h' | '24h'
  week_start_day: 0 | 1 // 0=Sunday, 1=Monday
  
  // Workday Preferences
  workday_start_hour: number // 0-23
  workday_end_hour: number // 0-23
  lunch_start_hour: number // 0-23
  lunch_end_hour: number // 0-23
  
  // Smart Scheduling
  smart_scheduling: {
    enabled: boolean
    auto_reschedule: boolean
    penalty_reduction: boolean
    notification_threshold: number // hours
  }
  
  // Privacy & Data Collection
  privacy: {
    improve_model_enabled: boolean
    analytics_enabled: boolean
    // Future: marketing_emails, data_sharing, etc.
  }
  
  // Auto-Reschedule
  auto_reschedule: {
    enabled: boolean
    reschedule_window_days: number
    priority_spacing: 'tight' | 'moderate' | 'loose'
    buffer_minutes: number
  }
}
```

### 2. Input Validation

**Always validate on the server side** before saving:

```typescript
// Validation functions
function validateTheme(theme: any): theme is 'dark' | 'light' {
  return theme === 'dark' || theme === 'light'
}

function validateAccentColor(color: any): boolean {
  return ['orange', 'blue', 'green', 'purple', 'pink', 'yellow'].includes(color)
}

function validateWorkdayHour(hour: any): boolean {
  return typeof hour === 'number' && hour >= 0 && hour <= 23
}

// Validate privacy settings especially carefully
function validatePrivacySettings(privacy: any): boolean {
  if (typeof privacy !== 'object' || privacy === null) return false
  if ('improve_model_enabled' in privacy) {
    if (typeof privacy.improve_model_enabled !== 'boolean') return false
  }
  return true
}
```

### 3. Security Considerations

#### A. Authentication & Authorization
- ✅ **Already Implemented**: RLS policies ensure users can only access their own settings
- ✅ **Already Implemented**: API routes check authentication

#### B. Input Sanitization
- **Sanitize all string inputs** (display_name, avatar_url)
- **Validate all enum values** (theme, accent_color)
- **Range check numeric values** (hours, thresholds)
- **Type check all boolean values**

#### C. Sensitive Preferences
Privacy-related preferences (like `improve_model_enabled`) need special handling:
- **Always default to false** (opt-in, not opt-out)
- **Require explicit consent** (show clear explanation)
- **Log changes** (audit trail for compliance)
- **Encrypt if stored** (if highly sensitive, though JSONB is fine for most cases)

#### D. SQL Injection Prevention
- ✅ **Already Safe**: Using Supabase client prevents SQL injection
- ✅ **Already Safe**: JSONB operations use parameterized queries

### 4. API Route Security

**Always follow this pattern:**

```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // 2. Validate input
  const body = await request.json()
  if (!validatePreferences(body.preferences)) {
    return NextResponse.json({ error: 'Invalid preferences' }, { status: 400 })
  }
  
  // 3. Sanitize input
  const sanitized = sanitizePreferences(body.preferences)
  
  // 4. Get existing preferences (merge strategy)
  const { data: existing } = await supabase
    .from('user_settings')
    .select('preferences')
    .eq('user_id', user.id)
    .single()
  
  // 5. Merge (don't overwrite entire object)
  const merged = { ...existing?.preferences, ...sanitized }
  
  // 6. Save
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      preferences: merged,
      updated_at: new Date().toISOString()
    })
  
  // 7. Handle errors
  if (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
  
  return NextResponse.json({ success: true })
}
```

### 5. Organization Strategy

**Group related preferences in nested objects:**

```json
{
  "ui": {
    "theme": "dark",
    "accent_color": "orange"
  },
  "time": {
    "time_format": "12h",
    "week_start_day": 0
  },
  "workday": {
    "start_hour": 9,
    "end_hour": 17,
    "lunch_start": 12,
    "lunch_end": 13
  },
  "privacy": {
    "improve_model_enabled": false,
    "analytics_enabled": false
  },
  "smart_scheduling": {
    "enabled": true,
    "auto_reschedule": true,
    "penalty_reduction": true,
    "notification_threshold": 24
  }
}
```

**Benefits:**
- Logical grouping
- Easier to find/update related settings
- Can set permissions per group
- Cleaner API responses

### 6. Default Values

**Always provide sensible defaults:**

```typescript
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  accent_color: 'orange',
  time_format: '12h',
  week_start_day: 0,
  workday_start_hour: 9,
  workday_end_hour: 17,
  lunch_start_hour: 12,
  lunch_end_hour: 13,
  smart_scheduling: {
    enabled: true,
    auto_reschedule: true,
    penalty_reduction: true,
    notification_threshold: 24
  },
  privacy: {
    improve_model_enabled: false, // Always default to false for privacy
    analytics_enabled: false
  },
  auto_reschedule: {
    enabled: true,
    reschedule_window_days: 3,
    priority_spacing: 'moderate',
    buffer_minutes: 15
  }
}
```

### 7. Migration Strategy

**When adding new preferences:**

1. **Update TypeScript interface** first
2. **Update default values** in migration
3. **Backfill existing users** in migration
4. **Update validation** in API routes
5. **Update UI** to handle new preference
6. **Document** in this file

**Example Migration:**

```sql
-- Add new preference to defaults
ALTER TABLE "public"."user_settings" 
ALTER COLUMN "preferences" 
SET DEFAULT '{
  ...existing defaults...,
  "privacy": {
    "improve_model_enabled": false,
    "analytics_enabled": false
  }
}'::jsonb;

-- Backfill existing users
UPDATE "public"."user_settings" 
SET "preferences" = jsonb_set(
    COALESCE("preferences", '{}'::jsonb),
    '{privacy}',
    '{"improve_model_enabled": false, "analytics_enabled": false}'::jsonb,
    true
  )
WHERE "preferences"->'privacy' IS NULL;
```

### 8. Audit Logging (For Sensitive Preferences)

**For privacy/compliance-critical preferences**, consider logging changes:

```sql
CREATE TABLE IF NOT EXISTS "public"."preference_audit_log" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id"),
  "preference_key" text NOT NULL,
  "old_value" jsonb,
  "new_value" jsonb,
  "changed_at" timestamp with time zone DEFAULT now(),
  "ip_address" inet,
  "user_agent" text
);

-- Trigger to log privacy preference changes
CREATE OR REPLACE FUNCTION log_privacy_preference_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.preferences->'privacy' IS DISTINCT FROM NEW.preferences->'privacy' THEN
    INSERT INTO preference_audit_log (user_id, preference_key, old_value, new_value)
    VALUES (
      NEW.user_id,
      'privacy',
      OLD.preferences->'privacy',
      NEW.preferences->'privacy'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER privacy_preference_audit
  AFTER UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION log_privacy_preference_changes();
```

### 9. Testing

**Test all preference operations:**

```typescript
// Test validation
describe('Preference Validation', () => {
  it('should reject invalid theme', () => {
    expect(validateTheme('invalid')).toBe(false)
  })
  
  it('should accept valid theme', () => {
    expect(validateTheme('dark')).toBe(true)
  })
  
  it('should reject invalid hour range', () => {
    expect(validateWorkdayHour(25)).toBe(false)
    expect(validateWorkdayHour(-1)).toBe(false)
  })
})

// Test API security
describe('API Security', () => {
  it('should reject unauthenticated requests', async () => {
    const response = await fetch('/api/profile', {
      method: 'POST',
      body: JSON.stringify({ preferences: {} })
    })
    expect(response.status).toBe(401)
  })
  
  it('should only allow users to update their own preferences', async () => {
    // Test RLS policy
  })
})
```

## Current Issues & Recommendations

### Issue 1: `improve_model_enabled` Not Properly Validated
**Status**: ⚠️ Missing validation in `/api/profile` route

**Fix**: Add validation when saving preferences:

```typescript
if (settings?.preferences?.improve_model_enabled !== undefined) {
  if (typeof settings.preferences.improve_model_enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'improve_model_enabled must be boolean' },
      { status: 400 }
    )
  }
  incomingPrefs.privacy = {
    ...(currentPrefs.privacy || {}),
    improve_model_enabled: settings.preferences.improve_model_enabled
  }
}
```

### Issue 2: No Centralized Preference Schema
**Status**: ⚠️ Preferences scattered across codebase

**Fix**: Create `src/lib/types/preferences.ts` with all preference types

### Issue 3: Inconsistent Default Values
**Status**: ⚠️ Some preferences have defaults, others don't

**Fix**: Update database defaults to include all preferences

### Issue 4: No Privacy Preference Grouping
**Status**: ⚠️ Privacy settings stored at root level

**Fix**: Move to nested `privacy.*` structure

## Implementation Checklist

When adding a new preference:

- [ ] Add to TypeScript interface
- [ ] Add to default preferences (migration)
- [ ] Add validation function
- [ ] Update API route validation
- [ ] Update UI components
- [ ] Add to documentation
- [ ] Write tests
- [ ] Consider audit logging (if sensitive)
- [ ] Update this guide

## Security Checklist

Before deploying preference changes:

- [ ] All inputs validated server-side
- [ ] Authentication required
- [ ] RLS policies tested
- [ ] Sensitive preferences default to false/opt-in
- [ ] No SQL injection vectors
- [ ] Type checking on all values
- [ ] Range checking on numeric values
- [ ] Enum validation on string values
- [ ] Audit logging for sensitive changes (if needed)

## Future Considerations

1. **Preference Versioning**: Version preferences schema for migrations
2. **Preference Templates**: Allow users to save/load preference sets
3. **Preference Export/Import**: Allow users to export/import settings
4. **Preference Sync**: Sync preferences across devices
5. **Admin Preferences**: Different permission levels for admin vs user preferences









