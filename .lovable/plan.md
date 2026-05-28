## Multi-currency Payments: Stripe (USD) + Paystack (NGN)

Each community picks its currency at setup. The app routes dues and donations to the right processor automatically — Stripe for USD, Paystack for NGN. Members never see the plumbing.

---

### Provider split

| Currency | Processor | Why |
|---|---|---|
| NGN (₦) | **Paystack** | Native Nigerian payouts, supports card, bank transfer, USSD. Stripe cannot pay out to Nigerian businesses. |
| USD ($) | **Stripe (built-in)** | Lovable's `enable_stripe_payments` — no API keys to paste, test mode out of the box. |

Both providers support **subscriptions** (for dues) and **one-off charges** (for donations), so the flows mirror each other.

---

### What each role sets up

**Super admin (platform owner, one-time)**
1. Enable Lovable Cloud.
2. Run `enable_stripe_payments` for the USD rail. Claim + verify the Stripe account for live mode.
3. Create a Paystack business account at paystack.com, generate a secret key, and add it as a Lovable secret (`PAYSTACK_SECRET_KEY`). Add `PAYSTACK_WEBHOOK_SECRET` too.
4. In Paystack dashboard, point the webhook to `https://<project>.lovable.app/api/public/paystack-webhook`. In Stripe dashboard, point its webhook to `/api/public/stripe-webhook`.
5. Manage which communities are live vs test.

**Community admin (per community, ongoing)**
1. **Choose currency at community setup**: NGN or USD. This locks the processor for that community.
2. **Dues** — create a dues plan (amount + interval). The app creates a Stripe Price *or* a Paystack Plan under the hood depending on currency.
3. **Invite members to subscribe** — each member opens a "Set up dues" link → Stripe Checkout or Paystack subscription page → returns to the app, status flips to Active.
4. **Donations** — create a campaign with a target. The app creates a shareable link `/donate/<slug>` that opens the right hosted checkout for the campaign's currency.
5. **End donation** / **View payers** / **Edit** — all work the same regardless of provider; the DB is the source of truth.

**Members (payers)**
- Pay dues from their dashboard (one click → hosted checkout → done; recurring afterward).
- Donate via the public link (any amount, no login needed; if logged in, payment is linked to their member record).

---

### Data model (Lovable Cloud)

```
communities
  +currency               'NGN' | 'USD'
  +payment_provider       'paystack' | 'stripe'   (derived from currency)

members
  +stripe_customer_id?    nullable
  +paystack_customer_code? nullable
  +dues_subscription_id?  (Stripe sub id OR Paystack subscription code)
  +dues_status            'active' | 'past_due' | 'cancelled' | 'none'

dues_plans
  community_id, amount, currency, interval
  stripe_price_id?        nullable
  paystack_plan_code?     nullable
  active

dues_payments
  member_id, plan_id, amount, currency, paid_at
  provider                'stripe' | 'paystack'
  provider_ref            invoice id / transaction reference
  status                  'paid' | 'failed' | 'refunded'

donations
  community_id, purpose, target, currency, deadline, status
  stripe_product_id?      nullable
  paystack_page_slug?     nullable
  shareable_slug

donation_payments
  donation_id, member_id?, payer_name, payer_email, amount, currency, paid_at
  provider, provider_ref
```

### Code layout

```
src/lib/payments/
  provider.ts              picks 'stripe' | 'paystack' from community.currency
  stripe.server.ts         Stripe SDK calls (createPrice, createCheckout, etc.)
  paystack.server.ts       Paystack REST calls (plans, subscriptions, transactions)
  dues.functions.ts        createDuesPlan, startSubscription, cancelSubscription
  donations.functions.ts   createDonation, endDonation, createDonationCheckout

src/routes/api/public/
  stripe-webhook.ts        verifies Stripe signature, updates dues/donation tables
  paystack-webhook.ts      verifies Paystack x-paystack-signature, same job

src/routes/
  donate.$slug.tsx         public donation landing page (any currency)
```

### Provider router (single seam)

A tiny abstraction so the UI never branches:

```ts
// payments/provider.ts
interface PaymentProvider {
  createDuesPlan(input): Promise<{ planRef: string }>
  startDuesSubscription(input): Promise<{ checkoutUrl: string }>
  cancelDuesSubscription(ref: string): Promise<void>
  createDonationCheckout(input): Promise<{ checkoutUrl: string }>
}

export function getProvider(currency: 'NGN' | 'USD'): PaymentProvider {
  return currency === 'NGN' ? paystack : stripe;
}
```

The Dues and Donations server functions just call `getProvider(community.currency).method(...)` — no `if`s in the UI.

### UI changes
- **Community setup**: add a "Currency" radio (₦ NGN / $ USD). Locked after first dues/donation is created.
- **Dues page**: existing "Dues setup" modal stays; the amount field shows the right symbol based on community currency.
- **Donations page**: tiles show `₦` or `$` based on each donation's currency; "Copy link" button on active tiles for the shareable donation URL.
- **Member dashboard**: "Pay dues" button → opens hosted checkout in a new tab.

### Secrets to add (super admin)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — auto-provisioned by `enable_stripe_payments`.
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET` — added manually via Lovable's secrets UI after creating the Paystack account.

### Build sequence
1. Enable Lovable Cloud.
2. Add DB tables + RLS.
3. Run `enable_stripe_payments`.
4. Add Paystack secrets.
5. Build the provider abstraction + Stripe and Paystack adapters.
6. Build the two webhook endpoints.
7. Wire Dues and Donations server functions to the provider router.
8. Update community setup with the currency field; update Dues/Donations UI to show the right symbol and open hosted checkouts.
9. Test end-to-end in Stripe test mode and Paystack test mode.
10. Super admin claims Stripe live mode and switches Paystack to live keys.

Ready to build when you approve.
