# Trial Abuse Prevention

## Overview

This document describes the mechanisms in place to prevent users from exploiting account deletion to obtain unlimited free trials by repeatedly deleting and recreating accounts.

## Problem Statement

Without protection, a user could:
1. Sign up for a new account
2. Start a 14-day Pro Monthly trial
3. Delete their account after the trial
4. Sign up again with a new email
5. Get another 14-day trial
6. Repeat indefinitely

## Solution Architecture

### Multi-Layer Protection

The trial eligibility check uses multiple layers to detect and prevent abuse:

#### Layer 1: Current User Subscription History
- Checks `user_plan_subscriptions` table for the current user
- If user has ever had a Pro subscription, trial is blocked
- **Status**: ✅ Implemented (existing logic)

#### Layer 2: Account Deletion Audit
- Stores email address in `account_deletion_audit` table when account is deleted
- Checks for previous account deletions with the same email
- If a previous deletion is found:
  - Attempts to verify if that account had Pro via Stripe
  - If Pro subscription confirmed → Block trial
  - If Pro subscription cannot be verified:
    - Recent deletion (≤30 days) → Block trial (prevent abuse)
    - Old deletion (>30 days) → Allow trial (legitimate re-signup)
- **Status**: ✅ Implemented

#### Layer 3: Stripe Customer History
- Searches Stripe for customers with the same email
- Checks if any deleted Stripe customers had Pro subscriptions
- Catches cases where email might have changed or audit record is missing
- **Status**: ✅ Implemented

## Implementation Details

### Database Changes

**Migration**: `20260105000000_add_email_to_deletion_audit.sql`
- Adds `email` column to `account_deletion_audit` table
- Creates index on `email` for efficient lookups
- Email is stored in lowercase and trimmed for consistency

### Code Changes

**New File**: `doer/src/lib/billing/trial-eligibility.ts`
- `checkTrialEligibility()` function performs comprehensive eligibility check
- Returns `{ eligible: boolean, reason?: string }`
- Handles errors gracefully (fails open to avoid blocking legitimate users)

**Updated Files**:
- `doer/src/app/api/settings/delete-account/route.ts`: Stores email in audit table
- `doer/src/app/api/checkout/create-subscription/route.ts`: Uses new eligibility check

### Trial Eligibility Logic Flow

```
1. Check current user's subscription history
   └─> If Pro found → Block trial
   
2. Check account_deletion_audit for same email
   └─> If deletion found:
       ├─> Check Stripe for Pro subscription
       │   └─> If Pro found → Block trial
       └─> If Pro not found:
           ├─> Deletion ≤30 days ago → Block trial (prevent abuse)
           └─> Deletion >30 days ago → Allow trial (legitimate)
   
3. Check Stripe for deleted customers with same email
   └─> If deleted customer with Pro found → Block trial
   
4. All checks passed → Allow trial
```

## Edge Cases Handled

### Email Changes
- **Issue**: User changes email between account deletions
- **Mitigation**: Stripe customer lookup catches deleted customers even if email changed
- **Limitation**: If user changes email AND uses different payment method, may bypass

### Stripe API Failures
- **Behavior**: Fails open (allows trial) to avoid blocking legitimate users
- **Logging**: All errors are logged for monitoring

### Missing Audit Records
- **Issue**: Audit record might be missing due to error
- **Mitigation**: Stripe customer lookup provides backup check

### Legitimate Re-signups
- **Scenario**: User deleted account months/years ago, wants to try again
- **Handling**: 30-day grace period - if deletion was >30 days ago, allow trial
- **Rationale**: Prevents abuse while allowing legitimate long-term re-signups

## Security Considerations

### Privacy
- Email addresses are stored in audit table for abuse prevention
- This is necessary for preventing trial abuse
- Considered acceptable trade-off for fraud prevention

### Performance
- Stripe API calls add latency to subscription creation
- Mitigated by:
  - Caching (future enhancement)
  - Parallel checks where possible
  - Failing fast on first blocking condition

### False Positives
- Legitimate users who deleted account recently might be blocked
- **Mitigation**: 30-day grace period
- **Remedy**: Users can contact support for manual override

## Monitoring and Alerts

### Key Metrics to Monitor
1. Trial eligibility check failures (should be rare)
2. Stripe API errors during eligibility checks
3. Accounts blocked from trial due to previous deletion
4. Time between account deletion and re-signup attempts

### Logging
All eligibility checks are logged with:
- User ID
- Email (hashed in production for privacy)
- Eligibility result and reason
- Timestamps

## Future Enhancements

### Payment Method Fingerprinting
- Track payment method fingerprints across customers
- Block trial if same payment method used on deleted account
- **Status**: Not implemented (privacy/complexity concerns)

### IP Address Tracking
- Track IP addresses of deleted accounts
- Block trial if same IP used for multiple deletions
- **Status**: Not implemented (IPs are unreliable, shared networks)

### Device Fingerprinting
- Track device/browser fingerprints
- Block trial if same device used for multiple deletions
- **Status**: Not implemented (privacy concerns, complexity)

### Rate Limiting
- Limit number of account deletions per email/IP
- **Status**: Not implemented (current checks should be sufficient)

## Testing

### Test Scenarios
1. ✅ New user → Should get trial
2. ✅ User with existing Pro subscription → Should NOT get trial
3. ✅ User deletes account, re-signs with same email → Should NOT get trial (if recent)
4. ✅ User deletes account >30 days ago, re-signs → Should get trial
5. ✅ User deletes account with Pro, re-signs with different email → Should NOT get trial (Stripe check)
6. ✅ Stripe API failure → Should allow trial (fail open)

### Manual Testing
1. Create test account with Pro trial
2. Delete account
3. Sign up again with same email
4. Attempt to start Pro trial → Should be blocked
5. Wait 31 days (or manually adjust deletion date in DB)
6. Attempt to start Pro trial → Should be allowed

## Configuration

### Environment Variables
- `STRIPE_SECRET_KEY`: Required for Stripe customer lookups
- `STRIPE_PRICE_PRO_MONTHLY`: Used to identify Pro subscriptions
- `STRIPE_PRICE_PRO_ANNUAL`: Used to identify Pro subscriptions

### Grace Period
- Currently set to 30 days
- Can be adjusted in `checkTrialEligibility()` function
- Consider business requirements when changing

## Support and Remediation

### Manual Override
If a legitimate user is incorrectly blocked:
1. Admin can check `account_deletion_audit` table
2. Verify user's situation
3. Manually create subscription with trial if appropriate
4. Or adjust deletion date in audit table to bypass check

### User Communication
If trial is blocked, user sees standard checkout flow without trial.
- No explicit message about why trial wasn't applied
- User can still subscribe at full price
- Support can explain if user contacts them

