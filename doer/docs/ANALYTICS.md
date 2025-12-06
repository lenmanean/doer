# Analytics & Tracking

This document describes the analytics and marketing tracking implementations in DOER, including Google Analytics 4 (GA4), Facebook Pixel, and Vercel Web Analytics.

## Meta Pixel Integration

### Pixel ID
- **ID**: `871104482045579`
- **Environment Variable**: `NEXT_PUBLIC_FACEBOOK_PIXEL_ID`
- **Location**: `.env.local`

### Implementation Details

#### Global PageView Tracking
- **Location**: `doer/src/components/analytics/AnalyticsScripts.tsx`
- **Method**: Meta Pixel script loaded conditionally based on marketing consent
- **Strategy**: Uses Next.js `Script` component with `strategy="afterInteractive"`
- **Behavior**: PageView events are tracked via unified service (not automatic on init) for consistency
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

The waitlist form component integrates both API submission and multi-platform tracking:
- **File**: `doer/src/components/ui/WaitlistForm.tsx`
- **API Endpoint**: `POST /api/waitlist`
- **Tracking**: Fires `WaitlistSignup` event to Facebook Pixel after successful API response

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
- **Page View Tracking**: Manual tracking via unified service (`send_page_view: false` to avoid duplicates)
- **Enhanced Measurement**: Automatic tracking of page scrolls (90% threshold), outbound clicks, site search, video engagement, and file downloads
- **Privacy Settings**: 
  - IP anonymization enabled (`anonymize_ip: true`)
  - Google signals disabled (`allow_google_signals: false`)
  - Ad personalization signals disabled (`allow_ad_personalization_signals: false`)
- **Debug Mode**: Enabled automatically in development (`NODE_ENV !== 'production'`)

#### Page View Tracking
- **Automatic**: Disabled in GA4 config (`send_page_view: false`)
- **Manual**: All page views tracked via `AnalyticsInitializer` → `unified-tracking-service` → `analytics-service`
- **Rationale**: Ensures consistent tracking across all platforms and avoids duplicate events

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

The waitlist form component integrates both API submission and multi-platform tracking:
- **File**: `doer/src/components/ui/WaitlistForm.tsx`
- **API Endpoint**: `POST /api/waitlist`
- **Tracking**: 
  - Fires Facebook Pixel `WaitlistSignup` event after successful API response
  - Fires GA4 `sign_up` event with `method: 'waitlist'` after successful API response
  - Fires Vercel Analytics `waitlist_signup` event after successful API response

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

## Vercel Web Analytics Integration

### Overview
Vercel Web Analytics provides privacy-focused web analytics that integrates seamlessly with Vercel deployments. It tracks page views, custom events, and user interactions while respecting user consent preferences.

### Implementation Details

#### Global Script Loading
- **Location**: `doer/src/components/analytics/AnalyticsScripts.tsx`
- **Method**: `<Analytics />` component from `@vercel/analytics/react`
- **Strategy**: Conditionally rendered based on analytics consent
- **Consent**: Only loads when user has consented to analytics cookies (same category as GA4)
- **Automatic Tracking**: The `<Analytics />` component automatically tracks page views on route changes

#### Vercel Analytics Configuration
- **Package**: `@vercel/analytics`
- **Component**: `<Analytics />` - Automatically tracks page views
- **Custom Events**: Use `track()` function from `@vercel/analytics/react`
- **Privacy**: Privacy-focused, no cookies required, GDPR compliant

#### Unified Tracking Service
All analytics platforms (GA4, Pixel, Vercel) are coordinated through a unified tracking service:
- **File**: `doer/src/lib/analytics/unified-tracking-service.ts`
- **Purpose**: Ensures consistent event tracking across all platforms
- **Functions**:
  - `trackPageView(url, title)` - Tracks page views to all platforms
  - `trackEvent(eventName, params)` - Tracks custom events to GA4 and Vercel
  - `trackButtonClick(buttonId, buttonText, location)` - Standardized button click tracking
  - `trackNavigation(from, to, method)` - Navigation tracking
  - `trackWaitlistSignup(source)` - Waitlist signup tracking to all platforms

#### Custom Events Tracked

##### Page Views
- **Event Name**: `page_view`
- **Automatic**: Yes, via `<Analytics />` component (handles all page views automatically)
- **Manual**: Not needed - rely on `<Analytics />` component to avoid duplicates
- **Note**: Unified service does NOT manually track page views to Vercel to avoid duplicates

##### Button Clicks
- **Event Name**: `button_click`
- **Trigger**: When buttons with `trackClick` prop are clicked
- **Parameters**:
  ```typescript
  {
    button_id: string,
    button_text: string,
    location: string,  // e.g., 'header', 'hero', 'pricing'
    variant?: string,
    size?: string,
    href?: string,
    target?: string
  }
  ```

##### Waitlist Signup
- **Event Name**: `waitlist_signup`
- **Trigger**: After successful waitlist email signup
- **Parameters**:
  ```typescript
  {
    source: string  // e.g., 'landing_page_hero', 'final_cta'
  }
  ```

##### Navigation
- **Event Name**: `navigation`
- **Trigger**: Programmatic navigation or link clicks
- **Parameters**:
  ```typescript
  {
    from: string,
    to: string,
    method: string  // e.g., 'link', 'button', 'programmatic'
  }
  ```

### Button Click Tracking

#### Button Component Integration
The `Button` component supports automatic click tracking via props:
- **File**: `doer/src/components/ui/Button.tsx`
- **Props**:
  - `trackClick?: boolean` - Enable tracking for this button
  - `trackId?: string` - Custom button ID (auto-generated if not provided)
  - `trackLocation?: string` - Location context (e.g., 'header', 'hero', 'pricing')

#### Usage Example
```tsx
<Button
  variant="primary"
  trackClick
  trackId="header-join-waitlist"
  trackLocation="header"
  onClick={handleClick}
>
  Join Waitlist
</Button>
```

#### Button Tracking Utilities
- **File**: `doer/src/lib/analytics/button-tracking.ts`
- **Functions**:
  - `trackButtonClick(buttonId, buttonText, location, additionalParams?)` - Direct tracking function
  - `useTrackButtonClick(buttonId, buttonText, location, additionalParams?)` - React hook for onClick handlers
  - `generateButtonId(buttonText, location)` - Generate consistent button IDs

### Tracked Button Locations

#### Header Buttons
- `header-join-waitlist` - Join Waitlist button in header
- `header-get-started` - Get Started button in header
- `header-login` - Log In button in header
- `header-start-planning` - Start Planning button (authenticated users)

#### Pricing Section
- `pricing-{card-title}-waitlist` - Waitlist buttons on pricing cards
- `pricing-{card-title}-cta` - CTA buttons on pricing cards

#### Final CTA Section
- `final-cta-join-waitlist` - Join Waitlist button in final CTA
- `final-cta-get-started` - Get Started button in final CTA

### Viewing Vercel Analytics Data

#### Vercel Dashboard
Access your analytics data through the Vercel Dashboard:
- **URL**: https://vercel.com/dashboard
- **Location**: Project → Analytics tab
- **Real-time**: Data appears within seconds of events

#### What You Can View
1. **Web Analytics Dashboard**
   - Page views over time
   - Unique visitors
   - Top pages
   - Referrers
   - Device breakdown
   - Geographic data

2. **Custom Events**
   - Button clicks with location breakdown
   - Navigation patterns
   - Waitlist signups by source
   - Custom event parameters

3. **Performance Metrics**
   - Page load times
   - Core Web Vitals
   - Performance trends

### Testing Vercel Analytics

#### Local Testing
1. Ensure `@vercel/analytics` package is installed
2. Run `npm run dev`
3. Accept analytics consent (if using cookie consent)
4. Navigate between pages and click tracked buttons
5. Check Vercel Dashboard → Analytics tab for real-time data

#### Event Verification
1. Open browser DevTools → Network tab
2. Filter for `vercel-insights.com` or `vercel.com`
3. Perform actions (page navigation, button clicks, waitlist signup)
4. Verify events are sent with correct parameters

### Environment Variables Setup

#### Vercel Configuration
Vercel Analytics is automatically configured when deployed to Vercel. No environment variables are required.

#### Local Development
- Analytics will work in local development
- Data may not appear in Vercel Dashboard until deployed
- Use browser DevTools to verify events are being sent

### Best Practices

- **Unified Service**: Use `unified-tracking-service.ts` for multi-platform tracking
- **Consistent Naming**: Use standardized event names and parameters
- **Button Tracking**: Enable tracking on high-value buttons (CTAs, signups, etc.)
- **Location Context**: Always provide location context for button clicks
- **Privacy First**: All tracking respects user consent preferences
- **No PII**: Never include personally identifiable information in event parameters

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

### Vercel Web Analytics
- `doer/src/components/analytics/AnalyticsScripts.tsx` - Vercel Analytics component loading
- `doer/src/lib/analytics/unified-tracking-service.ts` - Unified tracking service for all platforms
- `doer/src/lib/analytics/button-tracking.ts` - Button click tracking utilities

### Shared Components
- `doer/src/components/ui/WaitlistForm.tsx` - Waitlist form component (tracks to GA4, Pixel, and Vercel Analytics via unified service)
- `doer/src/components/ui/GoalInput.tsx` - Goal input component (tracks to GA4, Pixel, and Vercel Analytics via unified service)
- `doer/src/components/ui/Button.tsx` - Button component with optional click tracking
- `doer/src/app/api/waitlist/route.ts` - Waitlist API endpoint
- `doer/src/components/analytics/AnalyticsInitializer.tsx` - Analytics initialization and page view tracking via unified service

### Hooks
- `doer/src/hooks/useAnalytics.ts` - GA4-only hook for advanced features (user actions, feature usage, performance metrics)
  - Note: Does NOT track page views (handled by AnalyticsInitializer to avoid duplicates)
  - Use unified service for multi-platform tracking

## Architecture Overview

### Unified Tracking Service
The **unified tracking service** (`unified-tracking-service.ts`) is the primary interface for multi-platform tracking:
- **Purpose**: Ensures consistent event tracking across GA4, Facebook Pixel, and Vercel Analytics
- **Usage**: Use for all multi-platform events (page views, button clicks, waitlist signups, etc.)
- **Consent**: Automatically respects consent categories (analytics vs marketing)

### Individual Services
Individual services are platform-specific and should only be used directly for platform-specific features:

- **analytics-service.ts**: GA4-only functions
  - Use for: GA4-specific features (user properties, advanced events)
  - Do NOT use for: Multi-platform tracking (use unified service instead)
  
- **marketing-service.ts**: Facebook Pixel and Google Ads functions
  - Use for: Marketing-specific events
  - Do NOT use for: Multi-platform tracking (use unified service instead)

### Page View Tracking Flow
1. User navigates to a page
2. `AnalyticsInitializer` detects route change
3. Calls `unified-tracking-service.trackPageView()`
4. Unified service dispatches to:
   - GA4: via `analytics-service.trackPageView()` (manual)
   - Pixel: via `marketing-service.trackPageView()` (manual)
   - Vercel: Automatic via `<Analytics />` component (no manual tracking needed)

### Avoiding Duplicates
- **GA4**: `send_page_view: false` in config, all page views tracked manually via unified service
- **Vercel**: Rely on `<Analytics />` component automatic tracking, no manual `page_view` events
- **Pixel**: All page views tracked manually via unified service (removed automatic PageView from init for consistency)
- **useAnalytics hook**: Removed page view tracking to avoid duplicates with AnalyticsInitializer
- **Initial Load**: AnalyticsInitializer fires on mount, tracking initial page view via unified service
- **Route Changes**: AnalyticsInitializer fires on pathname/searchParams changes, tracking via unified service

