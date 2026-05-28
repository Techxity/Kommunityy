## Multi-currency Payments — Member Picks Currency at Checkout

Community admin enables one or both currencies. Each member picks ₦ or $ when they pay. Stripe handles every $ charge; Paystack handles every ₦ charge. Two processors, one unified app.

---

### What changes vs the previous plan

Currency is no longer locked to the community. It's chosen **per payment** by the payer (member or donor). The community admin only decides *which currencies are accepted*.

---

### Roles

**Super admin (platform owner, one-time)**
1. Enable Lovable Cloud (already done).
2. Run `enable_stripe_payments` for the USD rail.
3. Create a Paystack business account, add `PAYSTACK_SECRET_KEY` + `PAYSTACK_WEBHOOK_SECRET` to Lovable secrets (we'll request these when needed — no values to enter yet).
4. Point Stripe webhook → `/api/public/stripe-webhook`, Paystack webhook → `/api/public/paystack-webhook`.

**Community admin (per community)**
1. **Settings → Accepted currencies**: toggle ₦ NGN, $ USD, or both (default: both on).
2. **Dues plan**: enter the amount in ₦ AND/OR the amount in $ (only for currencies that are enabled). Each is a separate plan under the hood (one Paystack plan + one Stripe price), but the admin sees a single "dues" entry.
3. **Donations**: enter target in ₦ AND/OR $ (admin picks which currencies this campaign accepts). Target shows in both if both are enabled. Optional: a single "primary" currency for the progress bar — or convert at a fixed admin-set FX rate so both fund a unified total.
4. **View payers**: list shows each payer with the currency they paid in (`₦25,000` / `$30`). Totals are shown per currency (no auto-FX in the dashboard).

**Members / donors**
- On the "Pay dues" or "Donate" screen, see a currency selector: ₦ NGN or $ USD (only the currencies the admin enabled).
- Pick one → land on Paystack or Stripe checkout → return to the app, payment recorded against the chosen currency.

---

### Data model adjustments

```
communities
  accept_ngn         boolean   default true
  accept_usd         boolean   default true
  -- (drop the single `currency`/`provider` columns from the old plan)

dues_plans
  community_id
  amount_ngn         numeric?  -- nullable; null means "not offered in NGN"
  amount_usd         numeric?  -- nullable; null means "not offered in USD"
  interval           'monthly' | 'quarterly' | 'yearly'
  paystack_plan_code text?     -- created lazily when amount_ngn is set
  stripe_price_id    text?     -- created lazily when amount_usd is set

dues_payments
  plan_id, member_name, member_email
  amount, currency ('NGN'|'USD'), provider ('paystack'|'stripe')
  provider_ref, status, paid_at

donations
  community_id, purpose
  target_ngn         numeric?
  target_usd         numeric?
  deadline, status, shareable_slug
  paystack_page_slug text?
  stripe_product_id  text?

donation_payments
  donation_id, payer_name, payer_email
  amount, currency, provider, provider_ref, status, paid_at
```

I'll **migrate the existing tables** (added in the previous turn) to this shape — drop `communities.currency` / `communities.provider`, add the accept flags, swap `dues_plans.amount/currency` for `amount_ngn`/`amount_usd`, swap `donations.target/currency` for `target_ngn`/`target_usd`. Payment-record tables stay as-is (each row already has its own `currency` + `provider`).

---

### Code layout

```
src/lib/payments/
  provider.ts          getProvider(currency) → paystack | stripe
  stripe.server.ts     createPrice, createCheckoutSession, createSubscription
  paystack.server.ts   createPlan, initializeTransaction, createSubscription
  dues.functions.ts    createOrUpdateDuesPlan, startDuesCheckout(planId, currency)
  donations.functions.ts createDonation, endDonation, startDonationCheckout(donationId, currency, amount)

src/routes/api/public/
  stripe-webhook.ts    verifies sig, inserts dues_payments / donation_payments
  paystack-webhook.ts  verifies sig, inserts the same

src/routes/
  donate.$slug.tsx     public donation page with currency selector
  pay-dues.$planId.tsx public "pay your dues" page with currency selector
```

### Provider router (unchanged seam)

```ts
export function getProvider(currency: 'NGN' | 'USD') {
  return currency === 'NGN' ? paystack : stripe;
}
```

The seam is now invoked at **checkout time** with the payer's choice, not at community-setup time.

---

### UI changes

- **Community settings**: two checkboxes — "Accept ₦ NGN", "Accept $ USD".
- **Dues setup modal**: two amount fields side-by-side, one per currency. Leave one blank to not offer it.
- **Donation modal**: two target fields side-by-side (₦ target / $ target). Admin picks deadline + purpose as today.
- **Donation tile**: shows `Collected: ₦120,000 + $300 / Target: ₦500,000 + $1,000`. Progress bar tracks the currency with the higher % completion, or shows two bars.
- **Public donation page (`/donate/<slug>`)**: amount input + currency toggle. Submitting routes to Paystack (₦) or Stripe ($).
- **Member dues page**: currency toggle if both are offered for the plan; single-currency view if only one.

---

### What this turn ships

1. Run the migration to reshape the tables (drop old columns, add new ones).
2. Wait for super admin to enable Stripe (`enable_stripe_payments`) and add Paystack secrets — I'll prompt for those when needed.
3. Build the provider abstraction + Stripe and Paystack adapters.
4. Build the two webhook endpoints.
5. Wire Dues and Donations server functions and update the admin modals.
6. Build the public `/donate/<slug>` page with the currency selector.
7. Test end-to-end in both providers' test modes.

Ready to build when you approve.
