# API Tokens

DOER exposes a personal API token system that lets customers integrate external tools while respecting their subscription limits. This document explains the lifecycle of tokens, enforcement model, and operational guidelines.

## Token Overview

- Tokens are scoped to a specific user account and inherit that account's active subscription limits.
- Tokens are bearer secrets with the format `doer.<token_id>.<token_secret>`.
- Each token declares an explicit set of scopes. Requests that present the token must satisfy the scope checks implemented by the REST endpoints.
- All token metadata lives in the `api_tokens` table (hash + salt only; the raw secret is never persisted).

## Scopes

| Scope             | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `plans.generate`  | Access to `/api/plans/generate` (roadmap generation).    |
| `plans.read`      | Access to read-only plan APIs (future expansion).        |
| `plans.schedule`  | Access to scheduling endpoints.                          |
| `clarify`         | Access to `/api/clarify` for feasibility checks.         |
| `reschedules`     | Access to reschedule APIs.                                |
| `integrations`    | Access to external integration webhooks/actions.         |
| `admin`           | Reserved for future internal/privileged automation.      |

## Credit Enforcement

Tokens participate in the same credit pool as the owning user. We provision plan cycles in `plan_usage_balances` and track reservations/commits in `usage_ledger` with the `token_id` attached for auditing.

The flow:

1. Authenticate request with `authenticateApiRequest` helper.
2. Reserve required credits via `CreditService.reserve` before calling OpenAI or other expensive operations.
3. Commit the credits after success, or release them on error/validation failure.

## Management UI (Beta)

A standalone UI is available at `/settings/api-tokens` that lets users:

- List existing tokens (+ see last used / expiry metadata).
- Generate new tokens with optional expiry and configurable scopes.
- Revoke tokens (soft delete via `revoked_at`).

> **Important:** The UI will display the raw token exactly once after creation. The user is responsible for storing it securely.

## Operational Notes

- `API_TOKEN_HASH_PEPPER` **must** be configured in the runtime environment. Rotate this value the same way as other sensitive service secrets.
- Service role access (`SUPABASE_SERVICE_ROLE_KEY`) is required for the API token RPCs and Supabase writes. Protect this key.
- Monthly resets should call the `reset_usage_cycle` function for each user/metric pair (see `plan_usage_balances`).
- Alerts: monitor for `usage_ledger` entries failing to commit/release and for timestamps on `last_used_at` to detect inactive tokens.

## Future Enhancements

- UI integration inside the main settings dashboard.
- Additional scopes for plan exports and analytics.
- Token analytics (recent usage, per-scope breakdown).

For implementation details see:

- `supabase/migrations/20251111010000_add_billing_usage_and_api_tokens.sql`
- `src/lib/auth/api-token-auth.ts`
- `src/lib/usage/credit-service.ts`
- `src/app/api/settings/api-tokens/*`
- `src/app/api/plans/generate/route.ts`
- `src/app/api/clarify/route.ts`

## Configuration Flags

Add these environment variables alongside the existing Supabase and OpenAI keys:

- `API_TOKEN_HASH_PEPPER`: High-entropy string used when hashing token secrets.
- `PLAN_ENFORCEMENT_ENABLED`: When `true`, credit reservations are enforced. Leave `false` while billing flows are under construction.
- `PLAN_ASSIGNMENT_ENABLED`: Controls whether payment/webhook stubs call `assignSubscription`. Keep `false` until the billing flow is live.
- `user_settings.unmetered_access`: Admin-only flag that bypasses credit checks for trusted accounts (set via service role tooling).

## Plan Assignment Stub

- `POST /api/stripe/mock-webhook`
  - Body: `{ "userId": "uuid", "planSlug": "pro", "cycle": "monthly" }`
  - Respects `PLAN_ASSIGNMENT_ENABLED`. When disabled, responds with 202 and no changes. When enabled, invokes `assignSubscription` and seeds usage balances.
  - Intended for dev/test usage until real Stripe webhooks are wired up.

## Test Mode Scripts

Use the helper script to create a test Checkout session (requires `ts-node` or `tsx`):

```bash
STRIPE_SECRET_KEY=sk_test_... \
STRIPE_PRICE_BASIC=price_... \
STRIPE_PRICE_PRO_MONTHLY=price_... \
STRIPE_PRICE_PRO_ANNUAL=price_... \
  tsx scripts/stripe/create-test-checkout.ts <userId> <planSlug> [billingCycle] [successUrl] [cancelUrl]
```

The script stores metadata on both the Checkout session and the resulting subscription so the webhook can resolve the correct plan.

## Production Rollout Checklist

1. **Secrets**
   - Store `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `API_TOKEN_HASH_PEPPER`, and `SUPABASE_SERVICE_ROLE_KEY` in your production secret manager.

2. **Feature Flags**
   - When you are ready for plan assignment: set `PLAN_ASSIGNMENT_ENABLED=true`.
   - After verifying assignments and ledger activity, enable `PLAN_ENFORCEMENT_ENABLED=true` to enforce credit usage.

3. **Monitoring & Rollback**
   - Watch the Stripe Dashboard → Webhooks for delivery failures.
   - Tail Supabase logs for the `/api/stripe/webhook` route and `usage_ledger` inserts.
   - If issues arise, immediately set `PLAN_ASSIGNMENT_ENABLED=false` and/or `PLAN_ENFORCEMENT_ENABLED=false` to pause enforcement while investigating.
