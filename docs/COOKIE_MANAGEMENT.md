# Cookie Management Documentation

## Overview

DOER implements a comprehensive cookie management system that respects user privacy and complies with GDPR/CCPA regulations. Cookie preferences are stored in two locations:

1. **localStorage** - For immediate access and anonymous users
2. **Supabase Database** - For logged-in users (synced to their account)

## Database Schema

### Table: `user_settings`

The `cookie_consent` column stores user consent preferences as JSONB:

```sql
ALTER TABLE "public"."user_settings"
ADD COLUMN IF NOT EXISTS "cookie_consent" jsonb;
```

### Data Structure

The `cookie_consent` column stores data in the following format:

```json
{
  "accepted": true,
  "categories": ["essential", "analytics", "marketing", "functional"],
  "timestamp": 1703520000000
}
```

**Fields:**
- `accepted` (boolean): Whether the user has given consent
- `categories` (array): List of consented cookie categories
- `timestamp` (number): Unix timestamp when consent was given

**Cookie Categories:**
- `essential` - Required for website functionality (always enabled)
- `analytics` - Google Analytics 4 tracking
- `marketing` - Facebook Pixel and Google Ads conversion tracking
- `functional` - User preferences (theme, language, etc.)

## Accessing Cookie Data

### 1. Via Settings Page (User Interface)

Users can view and manage their cookie preferences at:
**Settings → Privacy & Security → Cookie Preferences**

This interface shows:
- Current consent status
- Enabled/disabled categories
- Consent timestamp
- Database sync status
- Quick actions (Accept All, Revoke All, Customize)

### 2. Via Supabase SQL Queries

#### Get all users with cookie consent

```sql
SELECT 
  user_id,
  cookie_consent,
  updated_at
FROM user_settings
WHERE cookie_consent IS NOT NULL;
```

#### Get users who consented to analytics

```sql
SELECT 
  user_id,
  cookie_consent->>'categories' as categories,
  cookie_consent->>'timestamp' as consent_timestamp
FROM user_settings
WHERE cookie_consent->'categories' @> '["analytics"]'::jsonb;
```

#### Get users who consented to marketing

```sql
SELECT 
  user_id,
  cookie_consent->>'categories' as categories
FROM user_settings
WHERE cookie_consent->'categories' @> '["marketing"]'::jsonb;
```

#### Get consent statistics

```sql
SELECT 
  COUNT(*) FILTER (WHERE cookie_consent IS NOT NULL) as total_consents,
  COUNT(*) FILTER (WHERE cookie_consent->'categories' @> '["analytics"]'::jsonb) as analytics_consents,
  COUNT(*) FILTER (WHERE cookie_consent->'categories' @> '["marketing"]'::jsonb) as marketing_consents,
  COUNT(*) FILTER (WHERE cookie_consent->'categories' @> '["functional"]'::jsonb) as functional_consents
FROM user_settings;
```

#### Get consent by date range

```sql
SELECT 
  DATE(to_timestamp((cookie_consent->>'timestamp')::bigint / 1000)) as consent_date,
  COUNT(*) as consent_count
FROM user_settings
WHERE cookie_consent IS NOT NULL
GROUP BY consent_date
ORDER BY consent_date DESC;
```

### 3. Via Supabase Client (JavaScript/TypeScript)

#### Get current user's consent

```typescript
import { supabase } from '@/lib/supabase/client'

const { data, error } = await supabase
  .from('user_settings')
  .select('cookie_consent')
  .eq('user_id', userId)
  .single()

if (data?.cookie_consent) {
  const consent = data.cookie_consent
  console.log('Categories:', consent.categories)
  console.log('Timestamp:', new Date(consent.timestamp))
}
```

#### Update user consent

```typescript
import { saveConsentPreferences } from '@/lib/cookies/cookie-utils'

await saveConsentPreferences(['essential', 'analytics', 'functional'])
```

#### Check if user has specific consent

```typescript
import { hasConsent } from '@/lib/cookies/cookie-utils'

const hasAnalytics = hasConsent('analytics')
const hasMarketing = hasConsent('marketing')
```

### 4. Via API Endpoint

Create a custom API endpoint to manage cookie preferences:

```typescript
// app/api/settings/cookie-consent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('cookie_consent')
    .eq('user_id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ consent: data?.cookie_consent || null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { categories } = body

  const consentData = {
    accepted: true,
    categories,
    timestamp: Date.now(),
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      cookie_consent: consentData,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, consent: consentData })
}
```

## Managing Cookie Data

### Update Consent Programmatically

```typescript
import { saveConsentPreferences } from '@/lib/cookies/cookie-utils'

// Accept all cookies
await saveConsentPreferences(['essential', 'analytics', 'marketing', 'functional'])

// Accept only essential and analytics
await saveConsentPreferences(['essential', 'analytics'])

// Revoke all (essential only)
await saveConsentPreferences(['essential'])
```

### Delete Consent Data

#### Delete from database

```sql
UPDATE user_settings
SET cookie_consent = NULL
WHERE user_id = 'user-uuid-here';
```

#### Delete from localStorage (client-side)

```typescript
localStorage.removeItem('cookieConsent')
```

### Export Consent Data

```sql
SELECT 
  u.email,
  us.cookie_consent,
  us.updated_at
FROM user_settings us
JOIN auth.users u ON u.id = us.user_id
WHERE us.cookie_consent IS NOT NULL
ORDER BY us.updated_at DESC;
```

## Analytics Integration

### Google Analytics 4

- **Environment Variable**: `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- **Initialization**: Only if `analytics` category is consented
- **Tracking**: All events respect consent status

### Facebook Pixel

- **Environment Variable**: `NEXT_PUBLIC_FACEBOOK_PIXEL_ID`
- **Initialization**: Only if `marketing` category is consented
- **Tracking**: Conversion events and custom events

### Google Ads

- **Environment Variable**: `NEXT_PUBLIC_GOOGLE_ADS_ID`
- **Initialization**: Only if `marketing` category is consented
- **Tracking**: Conversion tracking and remarketing

## Best Practices

1. **Always check consent before tracking**
   ```typescript
   import { hasConsent } from '@/lib/cookies/cookie-utils'
   
   if (hasConsent('analytics')) {
     trackEvent('user_action', { action: 'click' })
   }
   ```

2. **Respect user choices**
   - Never track without explicit consent
   - Allow users to revoke consent at any time
   - Re-initialize services when consent changes

3. **Data retention**
   - Cookie consent data is stored indefinitely
   - Users can delete their consent data via settings
   - Consider implementing data retention policies

4. **Privacy compliance**
   - Provide clear descriptions of each cookie category
   - Allow granular control (not just accept/reject all)
   - Store consent timestamp for audit purposes

## Troubleshooting

### Consent not saving to database

1. Check if user is authenticated
2. Verify `user_settings` table has `cookie_consent` column
3. Check RLS policies allow updates
4. Verify user owns the `user_settings` record

### Analytics not tracking

1. Check if `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is set
2. Verify user has consented to `analytics` category
3. Check browser console for errors
4. Verify scripts are loading (check Network tab)

### Marketing pixels not firing

1. Check if `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` or `NEXT_PUBLIC_GOOGLE_ADS_ID` is set
2. Verify user has consented to `marketing` category
3. Check Facebook Pixel Helper or Google Tag Assistant
4. Verify scripts are loading conditionally

## Related Files

- `src/lib/cookies/cookie-utils.ts` - Cookie utility functions
- `src/lib/analytics/analytics-service.ts` - GA4 integration
- `src/lib/analytics/marketing-service.ts` - Facebook Pixel & Google Ads
- `src/components/ui/CookieConsent.tsx` - Consent banner component
- `src/components/settings/CookieManagement.tsx` - Settings page component
- `src/components/analytics/AnalyticsScripts.tsx` - Conditional script loading
- `supabase/migrations/20251226000000_add_cookie_consent_to_user_settings.sql` - Database migration

