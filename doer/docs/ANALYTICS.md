# Analytics & Tracking

This document describes the analytics and marketing tracking implementations in DOER.

## Meta Pixel Integration

### Pixel ID
- **ID**: `871104482045579`
- **Environment Variable**: `NEXT_PUBLIC_FACEBOOK_PIXEL_ID`
- **Location**: `.env.local`

### Implementation Details

#### Global PageView Tracking
- **Location**: `doer/src/app/layout.tsx`
- **Method**: Meta Pixel script loaded in root layout `<head>` tag
- **Strategy**: Uses Next.js `Script` component with `strategy="afterInteractive"`
- **Behavior**: Automatically fires `PageView` event on every page load
- **Fallback**: Includes `<noscript>` image tag for users without JavaScript

#### Custom Event: WaitlistSignup
- **Event Name**: `WaitlistSignup`
- **Trigger**: Fired after successful waitlist email signup
- **Payload**: 
  ```typescript
  {
    source: string  // Describes where the signup originated
  }
  ```

### Event Trigger Locations

The `WaitlistSignup` event is fired from the following locations:

1. **Homepage Hero Section**
   - Location: `doer/src/app/page.tsx`
   - Source: `"landing_page_hero"`
   - Component: `WaitlistForm` with `source="landing_page_hero"`

2. **Pricing Card Section**
   - Location: `doer/src/app/page.tsx`
   - Source: Button click that scrolls to waitlist form
   - Component: `PricingCard` button

3. **Final CTA Section**
   - Location: `doer/src/app/page.tsx`
   - Source: `"final_cta"`
   - Component: `WaitlistForm` with `source="final_cta"` (compact variant)

4. **Landing Page Hero**
   - Location: `doer/src/app/landing.tsx`
   - Source: `"landing_page_hero"`
   - Component: `WaitlistForm` with `source="landing_page_hero"`

5. **Landing Page CTA**
   - Location: `doer/src/app/landing.tsx`
   - Source: `"landing_page_cta"`
   - Component: `WaitlistForm` with `source="landing_page_cta"`

6. **Landing Page Waitlist Section**
   - Location: `doer/src/app/landing.tsx`
   - Source: `"landing_page_waitlist_section"`
   - Component: `WaitlistForm` with `source="landing_page_waitlist_section"`

### Tracking Helper Function

The tracking is handled by a helper function:
- **File**: `doer/src/lib/analytics/marketing-service.ts`
- **Function**: `trackWaitlistSignup(source: string)`
- **Implementation**: 
  ```typescript
  if (typeof window !== 'undefined' && window.fbq && FACEBOOK_PIXEL_ID) {
    window.fbq('trackCustom', 'WaitlistSignup', {
      source: source,
    })
  }
  ```

### Waitlist Form Component

The waitlist form component integrates both API submission and Meta Pixel tracking:
- **File**: `doer/src/components/ui/WaitlistForm.tsx`
- **API Endpoint**: `POST /api/waitlist`
- **Tracking**: Fires `WaitlistSignup` event after successful API response

### TypeScript Declarations

Global `fbq` function is declared in:
- **File**: `doer/src/lib/analytics/marketing-service.ts`
- **Declaration**:
  ```typescript
  declare global {
    interface Window {
      fbq?: (
        command: 'init' | 'track' | 'trackCustom',
        eventName: string,
        params?: Record<string, any>
      ) => void
    }
  }
  ```

## Viewing Pixel Data

### Events Manager
Access your Meta Pixel data through Facebook Events Manager:
- **URL**: https://business.facebook.com/events_manager2
- **Pixel ID**: `871104482045579`

### What You Can View
1. **Overview Dashboard**
   - Real-time event activity
   - Event counts and trends
   - Pixel status and health

2. **Events Tab**
   - `PageView` events (automatic on every page load)
   - `WaitlistSignup` custom events (after successful signup)
   - Event source breakdown (e.g., `landing_page_hero`, `final_cta`)

3. **Test Events Tab**
   - Real-time event testing
   - Use browser extension or test ID for immediate verification
   - Perfect for debugging during development

4. **Diagnostics Tab**
   - Pixel installation status
   - Error tracking
   - Performance metrics

### Quick Access Links
- **Events Manager**: https://business.facebook.com/events_manager2
- **Test Events**: https://business.facebook.com/events_manager2/test_events
- **Pixel Settings**: Navigate to your Pixel in Events Manager

### Expected Events
- **PageView**: Fires automatically on every page load
- **WaitlistSignup**: Custom event with `source` parameter indicating signup origin

### Testing in Real-Time
1. Open Events Manager → Test Events tab
2. Enable Test Mode (install Meta Pixel Helper browser extension)
3. Visit your website and complete a waitlist signup
4. Events should appear in the Test Events feed within seconds

## Google Analytics 4 (GA4) Integration

### Measurement ID
- **ID**: `G-E9V12G2B1C`
- **Environment Variable**: `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- **Location**: `.env.local` (local) / Vercel Environment Variables (production)

### Implementation Details

#### Global Script Loading
- **Location**: `doer/src/components/analytics/AnalyticsScripts.tsx`
- **Method**: Google Tag Manager script loaded conditionally based on analytics consent
- **Strategy**: Uses Next.js `Script` component with `strategy="afterInteractive"`
- **Consent**: Only loads when user has consented to analytics cookies

#### GA4 Configuration
The GA4 configuration includes:
- **Enhanced Measurement**: Automatic tracking of page scrolls (90% threshold), outbound clicks, site search, video engagement, and file downloads
- **Privacy Settings**: 
  - IP anonymization enabled (`anonymize_ip: true`)
  - Google signals disabled (`allow_google_signals: false`)
  - Ad personalization signals disabled (`allow_ad_personalization_signals: false`)
- **Debug Mode**: Enabled automatically in development (`NODE_ENV !== 'production'`)

#### Custom Event: Waitlist Signup
- **Event Name**: `sign_up` (standard GA4 event)
- **Trigger**: Fired after successful waitlist email signup
- **Parameters**: 
  ```typescript
  {
    method: 'waitlist',
    source: string  // Describes where the signup originated
  }
  ```

### Event Trigger Locations

The `sign_up` event with `method: 'waitlist'` is fired from the same locations as Facebook Pixel `WaitlistSignup`:

1. **Homepage Hero Section**
   - Location: `doer/src/app/page.tsx`
   - Source: `"landing_page_hero"`
   - Component: `WaitlistForm` with `source="landing_page_hero"`

2. **Final CTA Section**
   - Location: `doer/src/app/page.tsx`
   - Source: `"final_cta"`
   - Component: `WaitlistForm` with `source="final_cta"` (compact variant)

3. **Landing Page Hero**
   - Location: `doer/src/app/landing.tsx`
   - Source: `"landing_page_hero"`
   - Component: `WaitlistForm` with `source="landing_page_hero"`

4. **Landing Page CTA**
   - Location: `doer/src/app/landing.tsx`
   - Source: `"landing_page_cta"`
   - Component: `WaitlistForm` with `source="landing_page_cta"`

5. **Landing Page Waitlist Section**
   - Location: `doer/src/app/landing.tsx`
   - Source: `"landing_page_waitlist_section"`
   - Component: `WaitlistForm` with `source="landing_page_waitlist_section"`

### Tracking Helper Function

The tracking is handled by a helper function:
- **File**: `doer/src/lib/analytics/analytics-service.ts`
- **Function**: `trackWaitlistSignup(source: string)`
- **Implementation**: 
  ```typescript
  window.gtag('event', 'sign_up', {
    method: 'waitlist',
    source: source,
  })
  ```
- **Consent**: Automatically respects analytics consent via `hasConsent('analytics')` check

### Waitlist Form Component

The waitlist form component integrates both API submission and dual tracking:
- **File**: `doer/src/components/ui/WaitlistForm.tsx`
- **API Endpoint**: `POST /api/waitlist`
- **Tracking**: 
  - Fires Facebook Pixel `WaitlistSignup` event after successful API response
  - Fires GA4 `sign_up` event with `method: 'waitlist'` after successful API response

### Viewing GA4 Data

#### Google Analytics Dashboard
Access your GA4 data through Google Analytics:
- **URL**: https://analytics.google.com
- **Property**: Select your GA4 property with measurement ID `G-E9V12G2B1C`

#### What You Can View
1. **Realtime Reports**
   - Real-time event activity
   - Active users on site
   - Events fired in last 30 minutes
   - Perfect for testing waitlist signups

2. **Events Report**
   - `page_view` events (automatic on every page load)
   - `sign_up` events with `method: 'waitlist'` (after successful waitlist signup)
   - Event parameters breakdown (source, method)

3. **Engagement Reports**
   - User engagement metrics
   - Session duration
   - Pages per session
   - Bounce rate

4. **Acquisition Reports**
   - Traffic sources
   - User acquisition channels
   - Campaign performance

### Testing GA4 Events

#### Local Testing
1. Set `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-E9V12G2B1C` in `.env.local`
2. Run `npm run dev`
3. Open browser DevTools → Network tab
4. Filter for `google-analytics.com` or `googletagmanager.com`
5. Complete a waitlist signup
6. Verify:
   - GA4 script loads
   - `sign_up` event fires with correct parameters (`method: 'waitlist'`, `source`)
   - Facebook Pixel `WaitlistSignup` event still fires

#### GA4 Real-Time Testing
1. Go to GA4 → Reports → Realtime
2. Complete a waitlist signup
3. Verify events appear in real-time report within 30 seconds
4. Check event parameters to confirm `method: 'waitlist'` and `source` are present

#### Debug Mode
- Debug mode is automatically enabled in development (`NODE_ENV !== 'production'`)
- In debug mode, GA4 will log detailed information to the browser console
- Use Google Analytics DebugView for detailed event inspection

### Environment Variables Setup

#### Vercel Configuration
1. Navigate to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update:
   - **Variable Name**: `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
   - **Value**: `G-E9V12G2B1C`
   - **Environment**: Select all (Production, Preview, Development)
3. Click **Save**
4. Redeploy your application for changes to take effect

#### Local Development
1. Create or update `.env.local` file in `doer/` directory
2. Add: `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-E9V12G2B1C`
3. Restart development server

### Best Practices

- **Privacy First**: IP anonymization enabled, no PII in event parameters
- **Consent Management**: All tracking respects user cookie consent preferences
- **Standard Events**: Uses GA4 standard `sign_up` event for better compatibility
- **Enhanced Measurement**: Automatic tracking of common user interactions
- **Debug Mode**: Automatically enabled in development for easier testing

## Notes

- Meta Pixel script is loaded only once in the root layout to avoid duplication
- The Pixel ID is read from environment variables, never hardcoded
- All tracking is client-side only (browser Pixel tracking)
- No server-side Conversions API or datasets are used
- The Pixel script respects SSR and only runs in the browser
- Events may take a few minutes to appear in Events Manager (use Test Events for immediate verification)

## Related Files

### Meta Pixel
- `doer/src/app/layout.tsx` - Root layout with Pixel script
- `doer/src/lib/analytics/marketing-service.ts` - Facebook Pixel tracking helper functions

### Google Analytics 4
- `doer/src/components/analytics/AnalyticsScripts.tsx` - GA4 script loading and configuration
- `doer/src/lib/analytics/analytics-service.ts` - GA4 tracking helper functions

### Shared Components
- `doer/src/components/ui/WaitlistForm.tsx` - Waitlist form component (tracks to both GA4 and Facebook Pixel)
- `doer/src/app/api/waitlist/route.ts` - Waitlist API endpoint
- `doer/src/components/analytics/AnalyticsInitializer.tsx` - Analytics initialization based on consent

