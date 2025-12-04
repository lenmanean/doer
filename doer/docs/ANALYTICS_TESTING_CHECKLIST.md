# Analytics Testing Checklist

This document provides a comprehensive testing checklist for GA4 and Facebook Pixel implementations.

## Prerequisites

1. **Environment Variables Set**:
   - `NEXT_PUBLIC_GA4_MEASUREMENT_ID` - Should be set to your GA4 measurement ID (e.g., `G-E9V12G2B1C`)
   - `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` - Should be set to your Facebook Pixel ID (e.g., `871104482045579`)

2. **Browser Tools**:
   - Chrome DevTools (Network tab, Console)
   - Facebook Pixel Helper browser extension
   - Google Tag Assistant (optional)
   - GA4 DebugView (in GA4 dashboard)

## Consent Testing

### Test 1: No Consent Given
- [ ] Load page without accepting cookies
- [ ] Verify GA4 script does NOT load (check Network tab for `googletagmanager.com`)
- [ ] Verify Facebook Pixel script does NOT load (check Network tab for `facebook.net` or `fbevents.js`)
- [ ] Verify no tracking events fire in console
- [ ] Verify cookie consent banner is displayed

### Test 2: Analytics Consent Only
- [ ] Accept only analytics cookies
- [ ] Verify GA4 script loads
- [ ] Verify Facebook Pixel script does NOT load
- [ ] Verify GA4 page_view events fire
- [ ] Verify Facebook Pixel events do NOT fire

### Test 3: Marketing Consent Only
- [ ] Accept only marketing cookies
- [ ] Verify GA4 script does NOT load
- [ ] Verify Facebook Pixel script loads
- [ ] Verify Facebook Pixel PageView events fire
- [ ] Verify GA4 events do NOT fire

### Test 4: Both Consents Given
- [ ] Accept both analytics and marketing cookies
- [ ] Verify both scripts load
- [ ] Verify both platforms track events

### Test 5: Consent Withdrawal
- [ ] Accept all cookies
- [ ] Verify scripts load and events fire
- [ ] Withdraw consent (clear cookies/localStorage)
- [ ] Reload page
- [ ] Verify scripts do NOT load after consent withdrawal

## Page View Tracking

### Test 6: Initial Page Load
- [ ] Accept all cookies
- [ ] Load homepage
- [ ] Verify GA4 page_view event fires (check Network tab or GA4 DebugView)
- [ ] Verify Facebook Pixel PageView event fires (check Network tab or Pixel Helper)
- [ ] Verify events appear in respective dashboards within 24-48 hours

### Test 7: Route Changes (SPA Navigation)
- [ ] Accept all cookies
- [ ] Navigate from homepage to `/dashboard`
- [ ] Verify GA4 page_view fires with correct pathname
- [ ] Verify Facebook Pixel PageView fires
- [ ] Navigate to `/schedule`
- [ ] Verify both platforms track the new route
- [ ] Check that page_path in GA4 matches the actual route

### Test 8: Query Parameters
- [ ] Navigate to a page with query parameters (e.g., `/dashboard?plan=123`)
- [ ] Verify GA4 page_view includes query parameters in page_path
- [ ] Verify Facebook Pixel PageView fires

## Event Tracking

### Test 9: WaitlistSignup Event - Facebook Pixel
- [ ] Accept marketing cookies
- [ ] Fill out waitlist form on homepage
- [ ] Submit form successfully
- [ ] Verify Facebook Pixel `WaitlistSignup` custom event fires
- [ ] Verify event includes `source` parameter
- [ ] Check Facebook Events Manager → Test Events tab
- [ ] Verify event appears within seconds
- [ ] Verify event parameters are correct

### Test 10: sign_up Event - GA4
- [ ] Accept analytics cookies
- [ ] Fill out waitlist form on homepage
- [ ] Submit form successfully
- [ ] Verify GA4 `sign_up` event fires
- [ ] Verify event includes `method: 'waitlist'` parameter
- [ ] Verify event includes `source` parameter
- [ ] Check GA4 DebugView or Realtime reports
- [ ] Verify event appears within 30 seconds

### Test 11: WaitlistSignup from Multiple Sources
- [ ] Test waitlist signup from homepage hero section
  - [ ] Verify `source: 'landing_page_hero'` in both platforms
- [ ] Test waitlist signup from final CTA section
  - [ ] Verify `source: 'final_cta'` in both platforms
- [ ] Test waitlist signup from GoalInput component
  - [ ] Verify correct source parameter

### Test 12: Error Handling
- [ ] Simulate network error (disable network in DevTools)
- [ ] Submit waitlist form
- [ ] Verify form still works (doesn't crash)
- [ ] Verify error is logged to console but doesn't break functionality
- [ ] Re-enable network and verify tracking works normally

## Advanced Matching (Facebook Pixel)

### Test 13: Advanced Matching Verification
- [ ] Accept marketing cookies
- [ ] Submit waitlist form with valid email
- [ ] Check Facebook Events Manager → Overview → Advanced Matching
- [ ] Verify that some events show Advanced Matching data (hashed email)
- [ ] Note: Not all events will have Advanced Matching (depends on Facebook's automatic detection)

## Script Loading

### Test 14: Script Load Order
- [ ] Accept all cookies
- [ ] Load page and check Network tab
- [ ] Verify scripts load in correct order:
  1. GA4 script loads first (if analytics consent)
  2. Facebook Pixel script loads (if marketing consent)
- [ ] Verify no duplicate script loads

### Test 15: Script Initialization
- [ ] Accept all cookies
- [ ] Check browser console for errors
- [ ] Verify `window.gtag` is defined (for GA4)
- [ ] Verify `window.fbq` is defined (for Facebook Pixel)
- [ ] Verify `window.dataLayer` is defined (for GA4)

## Production Verification

### Test 16: Production Environment
- [ ] Deploy to production/staging
- [ ] Verify environment variables are set correctly
- [ ] Test all consent scenarios in production
- [ ] Verify events appear in production dashboards:
  - [ ] GA4: https://analytics.google.com
  - [ ] Facebook: https://business.facebook.com/events_manager2

### Test 17: Dashboard Verification
- [ ] Wait 24-48 hours after testing
- [ ] Check GA4 Events report:
  - [ ] `page_view` events appear
  - [ ] `sign_up` events appear with correct parameters
- [ ] Check Facebook Events Manager:
  - [ ] `PageView` events appear
  - [ ] `WaitlistSignup` custom events appear
  - [ ] Event counts are reasonable (not 0, not suspiciously high)

## Performance Testing

### Test 18: Script Performance
- [ ] Use Lighthouse or PageSpeed Insights
- [ ] Verify analytics scripts don't significantly impact page load
- [ ] Verify scripts load asynchronously (non-blocking)
- [ ] Check that scripts use `strategy="afterInteractive"` in Next.js

## Privacy Compliance

### Test 19: Privacy Compliance
- [ ] Verify no PII (Personally Identifiable Information) is sent in events
- [ ] Verify email is NOT sent to Facebook Pixel (only hashed via Advanced Matching)
- [ ] Verify IP anonymization is enabled in GA4
- [ ] Verify consent is respected before any tracking occurs

## Edge Cases

### Test 20: Multiple Rapid Submissions
- [ ] Submit waitlist form multiple times quickly
- [ ] Verify each submission fires tracking event
- [ ] Verify no duplicate events or errors

### Test 21: Browser Compatibility
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test in Edge
- [ ] Verify all platforms work correctly

### Test 22: Mobile Testing
- [ ] Test on mobile device
- [ ] Verify scripts load correctly
- [ ] Verify events fire correctly
- [ ] Test consent banner on mobile

## Debugging Tips

### If GA4 Events Don't Appear:
1. Check browser console for errors
2. Verify `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is set
3. Check Network tab for `google-analytics.com` or `googletagmanager.com` requests
4. Verify consent was given for analytics
5. Check GA4 DebugView for real-time debugging
6. Verify `window.gtag` is defined

### If Facebook Pixel Events Don't Appear:
1. Check browser console for errors
2. Verify `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` is set
3. Check Network tab for `facebook.net` or `fbevents.js` requests
4. Verify consent was given for marketing
5. Use Facebook Pixel Helper extension
6. Check Facebook Events Manager → Test Events tab
7. Verify `window.fbq` is defined

### If Events Fire But Don't Appear in Dashboards:
1. Wait 24-48 hours (some delay is normal)
2. Check that you're looking at the correct property/dataset
3. Verify date range includes the test period
4. Check for filters that might exclude your events

## Quick Verification Commands

### Check Environment Variables (Client-Side)
```javascript
// In browser console:
console.log('GA4 ID:', process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID)
console.log('FB Pixel ID:', process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID)
```

### Check if Scripts Loaded
```javascript
// In browser console:
console.log('gtag available:', typeof window.gtag !== 'undefined')
console.log('fbq available:', typeof window.fbq !== 'undefined')
console.log('dataLayer:', window.dataLayer)
```

### Check Consent Status
```javascript
// In browser console:
const consent = localStorage.getItem('cookieConsent')
console.log('Consent:', consent ? JSON.parse(consent) : 'No consent')
```

## Sign-off

- [ ] All consent tests passed
- [ ] All page view tests passed
- [ ] All event tracking tests passed
- [ ] Script loading verified
- [ ] Production deployment verified
- [ ] Dashboard verification completed
- [ ] Privacy compliance verified
- [ ] Edge cases tested

**Tested by**: _______________  
**Date**: _______________  
**Environment**: _______________ (dev/staging/production)

