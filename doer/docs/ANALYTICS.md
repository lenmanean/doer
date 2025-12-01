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

## Notes

- Meta Pixel script is loaded only once in the root layout to avoid duplication
- The Pixel ID is read from environment variables, never hardcoded
- All tracking is client-side only (browser Pixel tracking)
- No server-side Conversions API or datasets are used
- The Pixel script respects SSR and only runs in the browser
- Events may take a few minutes to appear in Events Manager (use Test Events for immediate verification)

## Related Files

- `doer/src/app/layout.tsx` - Root layout with Pixel script
- `doer/src/components/ui/WaitlistForm.tsx` - Waitlist form component
- `doer/src/lib/analytics/marketing-service.ts` - Tracking helper functions
- `doer/src/app/api/waitlist/route.ts` - Waitlist API endpoint
- `doer/src/components/analytics/AnalyticsScripts.tsx` - Other analytics (GA4, Google Ads)

