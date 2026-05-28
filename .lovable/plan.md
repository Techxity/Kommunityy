## Payments Architecture — Centralized Treasury + Payouts

Every payment lands in the platform's single Paystack account. We compute fees on each transaction, hold community balances in our DB, and the super admin pays communities out on request. Paystack Subaccounts/Splits are **not** used.

---

### Money flow

```text
Member/donor pays
      │
      ▼
Paystack checkout (NGN or USD)
      │  T+1 settlement
      ▼
Platform's Paystack bank account ── ALL funds
      │
      │  Per-payment we record:
      │    gross         = what payer paid
      │    paystack_fee  = from webhook payload
      │    platform_fee  = gross × tier_pct (community's plan)
      │    community_net = gross − platform_fee     ← owed to community
      │    platform_net  = platform_fee − paystack_fee  ← our cut
      ▼
Community balance grows
      │
      │  Community admin: "Request payout"
      ▼
Super admin "Payouts" inbox
      │
      ├─ Approve + Paystack Transfer → automated, recipient code, transfer API
      └─ Approve + Manual → super admin sends in their own bank, marks "paid"
      │
      ▼
Community balance decreases by payout amount
```

### Fee rules (locked from your answers)

- **Platform fee**: percentage of gross, **set per subscription tier** (Free, Pro, etc.) by super admin. Each community inherits its tier's %.
- **Paystack fee**: platform absorbs it (community gets `gross − platform_fee` regardless).
- **Currencies**: NGN + USD both flow through the same platform account. USD payouts default to manual (Paystack Transfers don't reliably support USD); NGN payouts default to Paystack Transfers API.

### Onboarding

Community admin enters bank details in **Settings → Payouts** at any time. Until they do, they can still accept payments — balance accrues — but cannot request a payout.

---

### Data model additions

**`communities`** — bank + Paystack recipient
```
bank_name              text
bank_code              text         -- Paystack's bank code list
account_number         text
account_name           text         -- returned by Paystack resolve
paystack_recipient_code text        -- created lazily on first save
```

**Subscription tiers** (existing `super-admin.plans` page — likely needs a new column or new table if it's still mock):
```
platform_fee_pct       numeric      -- e.g. 5.00 means 5%
```
Each community references its current tier (existing field or new `community_subscriptions.tier_id`).

**`dues_payments`** and **`donation_payments`** — add fee breakdown
```
gross_amount           numeric       -- rename existing `amount`
paystack_fee           numeric       -- from webhook
platform_fee           numeric       -- snapshot at payment time
community_net          numeric       -- gross − platform_fee
```

**`payouts`** — new table
```
id                     uuid
community_id           uuid
amount                 numeric
currency               'NGN' | 'USD'
status                 'requested' | 'approved' | 'paid' | 'failed' | 'rejected'
method                 'paystack_transfer' | 'manual' | null
paystack_transfer_code text
notes                  text
requested_by           uuid
requested_at           timestamptz
approved_by            uuid
approved_at            timestamptz
paid_at                timestamptz
```

**View `community_balances`** (derived, per currency)
```
community_id, currency,
  collected     = sum(community_net where status=paid)
  paid_out      = sum(payouts.amount where status=paid)
  pending_out   = sum(payouts.amount where status in (requested,approved))
  available     = collected − paid_out − pending_out
```

RLS: payouts readable by anon for now (consistent with existing tables); writes via service_role only.

---

### Code work

#### Paystack adapter additions (`src/lib/payments/paystack.server.ts`)
- `resolveAccount(account_number, bank_code)` → name on account
- `listBanks(currency)` → bank code dropdown source
- `createTransferRecipient({ account_number, bank_code, name, currency })` → `recipient_code`
- `initiateTransfer({ amount, recipient_code, reason, reference })` → transfer code
- Webhook: also handle `transfer.success` / `transfer.failed` / `transfer.reversed` to mark payouts paid/failed.

#### Server functions
- `saveCommunityBank` — resolves account, creates recipient, stores on `communities`.
- `requestPayout(currency)` — community admin; checks balance, inserts `payouts` row as `requested`.
- `approvePayout(id, method, amount?)` — super admin; sets `approved`. If `method='paystack_transfer'`, calls Paystack and stores transfer code; final paid/failed flips on the transfer webhook.
- `markPayoutPaid(id, note)` — super admin; for manual transfers, flips to `paid`.
- `rejectPayout(id, reason)`.

#### Webhook update (`/api/public/paystack-webhook`)
On `charge.success`:
1. Look up community via `donation_id`/`plan_id`.
2. Read community's current tier → `platform_fee_pct`.
3. Compute fees, insert payment row with the full breakdown.

On `transfer.*`:
1. Find payout by `paystack_transfer_code`.
2. Update status (paid / failed / rejected).

#### UI

**Community admin → Settings → Payouts** (new view or section in existing settings)
- Bank details form (bank dropdown + account number → auto-fills account name via resolve).
- Balance card per currency: Available, Pending payout, Lifetime paid out.
- "Request payout" button (disabled if no bank details or zero balance).
- Payout history table.

**Super admin → Payouts** (new route `/super-admin/payouts`)
- Tabs: Pending / All.
- Each row: community, amount, currency, requested date.
- Actions: **Approve via Paystack** (NGN only, default) | **Mark as manually paid** (for USD or fallback) | **Reject**.
- Optional notes field.

**Super admin → Plans** (existing `super-admin.plans.tsx`)
- Add a "Platform fee %" field per tier.

**Admin donations list / dues list**
- Show `community_net` next to gross so admins see what's actually theirs.

---

### Operational notes (super admin will need to know)

- **Paystack Transfers API requires "Transfers" enabled** on the Paystack dashboard (Settings → Preferences → Transfers). Without it, every payout falls back to manual.
- **USD transfers via Paystack** aren't generally available — plan defaults USD payouts to manual.
- **Paystack transfer fees** (₦10–₦50/txn) come out of the platform's account; folded into our cut.
- **Paystack balance must be sufficient** to fund a transfer. If we approve a payout before T+1 settlement of the funding charge, the transfer will fail — surface the Paystack balance on the super-admin payouts page.

---

### Out of scope for this plan

- Auto-reconciliation against Paystack settlement reports (manual spot-checking is fine for v1).
- Multi-currency conversion (NGN balances pay out in NGN, USD in USD; no FX).
- Stripe / non-Paystack rails.

---

### Order of work

1. Migration: bank fields, fee columns, `payouts` table, `community_balances` view, tier `platform_fee_pct`.
2. Paystack adapter additions (recipients + transfers + bank list).
3. Webhook update: fee breakdown + transfer events.
4. Server fns: bank save, request/approve/mark-paid/reject.
5. Community Settings → Payouts UI.
6. Super admin Payouts page + tier % field on Plans page.
7. Surface `community_net` on existing dues/donations admin views.