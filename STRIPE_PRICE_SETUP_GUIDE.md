# Stripe Price Setup Guide

## Overview
You need to create **3 products** in Stripe (test mode) with the following configuration:

## 1. Basic Plan - Monthly

### Product Details:
- **Name**: `Basic Plan` (or `Basic - Monthly`)
- **Description**: `Basic plan with essential features for goal achievement`
- **Image**: (Optional - can be added later)
- **Product tax code**: `Use preset: General - Electronically Supplied Services` (or your default)
- **Pricing Model**: `Recurring` ✅
- **Amount**: `$0.00` (or your Basic plan price in USD)
- **Include tax in price**: `No` (typically)
- **Billing period**: `Monthly`

### Notes:
- This is the basic/free tier plan
- Price can be $0.00 if it's a free plan, or set to your Basic plan price
- After creating, copy the **Price ID** (starts with `price_...`)

---

## 2. Pro Plan - Monthly

### Product Details:
- **Name**: `Pro Plan` (or `Pro - Monthly`)
- **Description**: `Pro plan with advanced features, API credits, and integration actions`
- **Image**: (Optional - can be added later)
- **Product tax code**: `Use preset: General - Electronically Supplied Services` (or your default)
- **Pricing Model**: `Recurring` ✅
- **Amount**: `$20.00` (based on UI showing $20.00/mo in checkout)
- **Include tax in price**: `No` (typically)
- **Billing period**: `Monthly`

### Notes:
- Based on checkout page showing `$20.00/mo`
- After creating, copy the **Price ID** (starts with `price_...`)

---

## 3. Pro Plan - Annual

### Product Details:
- **Name**: `Pro Plan` (or `Pro - Annual`)
- **Description**: `Pro plan with advanced features, API credits, and integration actions (Annual billing)`
- **Image**: (Optional - can be added later)
- **Product tax code**: `Use preset: General - Electronically Supplied Services` (or your default)
- **Pricing Model**: `Recurring` ✅
- **Amount**: `$160.00` (33% discount from $240/yr)
- **Include tax in price**: `No` (typically)
- **Billing period**: `Yearly` (or `Annual`)

### Notes:
- Annual pricing: $160/yr (saves 33% compared to $20/mo × 12 = $240/yr)
- After creating, copy the **Price ID** (starts with `price_...`)

---

## Environment Variables

After creating the products in Stripe, update your environment variables:

```env
STRIPE_PRICE_BASIC=price_1STBusF79pCKydDWgAD1gj8H          # Basic plan monthly (Free forever)
STRIPE_PRICE_PRO_MONTHLY=price_1STBwGF79pCKydDWSajqwP7B    # Pro plan monthly ($20/mo)
STRIPE_PRICE_PRO_ANNUAL=price_1STBxxF79pCKydDWgxVSoFnv     # Pro plan annual ($160/yr, 33% off)
```

## Important Notes:

1. **Test Mode**: Make sure you're creating these in Stripe **Test Mode** (sandbox) since you're testing
2. **Price IDs**: Each product/price combination gets a unique Price ID starting with `price_`
3. **Currency**: All prices should be in USD (or your primary currency)
4. **Recurring**: All plans should use "Recurring" pricing model (not "One-off")
5. **Billing Period**: 
   - Monthly: Billing period = "Monthly"
   - Annual: Billing period = "Yearly" or "Annual"

## Current Error:

The error shows `price_1SST2rF79pCKydDW2X7NER9V` doesn't exist, which means:
- Either the environment variable has an old/deleted price ID
- Or the price was deleted when test data was cleared

## Next Steps:

1. Create the 3 products in Stripe Dashboard (test mode)
2. Copy the Price IDs from each product
3. Update environment variables in Vercel
4. Redeploy the application
5. Test checkout flow

## Database Configuration:

The database stores plan details in `billing_plans` and `billing_plan_cycles` tables:
- **Plan slugs**: `basic`, `pro`
- **Billing cycles**: `monthly`, `annual`
- **Limits**: API credits and integration actions are stored per plan cycle

Make sure your database has the corresponding plan records with:
- `billing_plans.slug` = `basic` or `pro`
- `billing_plan_cycles.cycle` = `monthly` or `annual`
- `billing_plan_cycles.price_cents` = price in cents (e.g., $20.00 = 2000 cents)

