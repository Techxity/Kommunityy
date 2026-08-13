# SMS channel — architecture & implementation plan

**Status:** proposal for review (no code written yet)
**Date:** 2026-08-13
**Scope:** Optional SMS for birthdays, dues reminders, and broadcasts, funded by a per‑community prepaid wallet that the community admin owns and tops up directly — fully separated from platform subscription fees and dues/donation payouts.

---

## 1. Goals & principles

1. **Optional, admin‑owned.** Off by default. The community admin turns it on/off in their own settings, funds their own wallet, and controls what it's spent on. No super‑admin involvement needed for day‑to‑day use.
2. **Pass‑through pricing.** Communities pay exactly what the provider (Termii) charges per page — no Kommunity markup. SMS is cost‑neutral to the platform.
3. **Detached from platform fees.** The SMS wallet is a self‑contained ledger. It never nets against dues, donations, payout balances, or the subscription invoice. (See §7 — this is the core of the transparency ask.)
4. **Fail‑safe.** If SMS is off, the wallet is empty, or a number is invalid, the system silently falls back to the existing email path — a member never gets *nothing*, and a send never fails a payment or a cron.
5. **Auditable.** Every credit and debit is a ledger row; the wallet balance is provably the sum of the ledger. The admin can see exactly what each channel cost.

---

## 2. Provider: Termii

Chosen for the **DND (transactional) route**, which is what reaches Nigerian members reliably (most are on the DND registry; the DND route also bypasses the MTN 8pm–8am promotional block). Provider logic is placed behind a small interface (`SmsProvider`) so Africa's Talking or a bulk reseller can be added later without touching the wallet/ledger.

**API facts (from Termii docs, verified 2026‑08):**

- Send single/array: `POST {TERMII_BASE_URL}/api/sms/send` — `to` accepts up to 100 numbers.
- Send bulk: `POST {TERMII_BASE_URL}/api/sms/send/bulk` — array up to 100 numbers.
- Body: `api_key`, `to`, `from` (sender ID, 3–11 alphanumeric chars), `sms`, `type` (`plain` | `unicode`), `channel` (`dnd` | `generic` | `whatsapp` | `voice`).
- Response: `{ code:"ok", balance, message_id, message, ... }` — `balance` is the **platform Termii account** balance (useful for reconciliation, not per‑message costing).
- Segmenting: **1 page = 160 chars** GSM‑7; special/unicode chars drop it to **70 chars/page**.
- Base URL: `https://api.ng.termii.com` (confirm the exact host on your dashboard at setup).

**Operational prerequisites (manual, one‑time — see §11):** register an alphanumeric **sender ID**, and request **DND route activation** from Termii support (email support@termii.com). Get your **rate card** and set the per‑page rate in config.

---

## 3. Money model — pass‑through, wallet in kobo

- Wallet balance is stored in **integer kobo** (₦ × 100) to avoid floating‑point drift. Termii's own balance is a float; we never store money as a float.
- Cost of a send = `recipients × pages(message) × ratePerPageKobo`, where the rate is a **config value set to equal your Termii rate** (pass‑through). Two rates supported because Termii prices routes differently: `SMS_RATE_DND_KOBO` and `SMS_RATE_GENERIC_KOBO`.
- `pages(message)` uses standard GSM‑7 vs UCS‑2 segmentation (160 / 153‑concat for GSM‑7; 70 / 67‑concat for unicode). A pure helper, unit‑tested.
- **One platform Termii account** funds all sends; each community's top‑ups reimburse the platform pool at the pass‑through rate. This keeps admin onboarding light (no per‑community Termii signup). *(Alternative "bring‑your‑own Termii key per community" is noted in §12 as a decision — maximum independence, heavier onboarding.)*
- **Top‑up crediting:** when an admin tops up ₦X, the wallet is credited the **full ₦X** of SMS value. The Paystack processing fee is added *on top* at checkout (admin pays ₦X + Paystack fee) so the wallet gets the whole amount and the platform stays cost‑neutral. *(Decision flagged in §12 — the alternative is to credit net‑of‑fee.)*

---

## 4. Data model

New tables (migration `023_sms_wallet.sql`). All money columns are `bigint`/`int` kobo.

```
community_sms_settings
  community_id        uuid PK  REFERENCES communities(id) ON DELETE CASCADE
  enabled             boolean  NOT NULL DEFAULT false      -- master on/off (admin owns)
  sender_id           text                                 -- approved Termii sender ID
  route               text     NOT NULL DEFAULT 'dnd'       -- 'dnd' | 'generic'
  ch_birthdays        boolean  NOT NULL DEFAULT false       -- per-channel toggles
  ch_reminders        boolean  NOT NULL DEFAULT false
  ch_broadcasts       boolean  NOT NULL DEFAULT false
  low_balance_kobo    bigint   NOT NULL DEFAULT 50000       -- alert threshold (₦500)
  low_balance_alerted_at timestamptz
  updated_at          timestamptz NOT NULL DEFAULT now()

sms_wallets
  community_id        uuid PK  REFERENCES communities(id) ON DELETE CASCADE
  balance_kobo        bigint   NOT NULL DEFAULT 0           -- cached; == SUM(sms_ledger.delta_kobo)
  updated_at          timestamptz NOT NULL DEFAULT now()

sms_ledger                                                 -- the source of truth
  id            uuid PK DEFAULT gen_random_uuid()
  community_id  uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE
  delta_kobo    bigint NOT NULL                            -- + credit, − debit
  kind          text NOT NULL CHECK (kind IN ('topup','debit','refund','adjustment'))
  reference     text                                       -- paystack ref / send batch id
  meta          jsonb NOT NULL DEFAULT '{}'
  created_at    timestamptz NOT NULL DEFAULT now()

sms_topups                                                 -- payment audit (mirrors dues_payments)
  id            uuid PK DEFAULT gen_random_uuid()
  community_id  uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE
  amount_kobo   bigint NOT NULL
  currency      text NOT NULL DEFAULT 'NGN'
  provider      text NOT NULL DEFAULT 'paystack'
  provider_ref  text NOT NULL
  status        text NOT NULL DEFAULT 'paid'
  created_at    timestamptz NOT NULL DEFAULT now()
  UNIQUE (provider, provider_ref)                          -- idempotent, like existing payment tables

sms_messages                                               -- per-recipient send log
  id            uuid PK DEFAULT gen_random_uuid()
  community_id  uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE
  member_id     uuid REFERENCES members(id) ON DELETE SET NULL
  msisdn        text NOT NULL                              -- normalized 234XXXXXXXXXX
  channel       text NOT NULL CHECK (channel IN ('birthday','reminder','broadcast','test'))
  segments      int  NOT NULL
  cost_kobo     bigint NOT NULL
  status        text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','delivered'))
  provider      text NOT NULL DEFAULT 'termii'
  provider_message_id text
  error         text
  created_at    timestamptz NOT NULL DEFAULT now()
```

Balance integrity: `balance_kobo` is a cached read; a debit/credit updates it **and** inserts a ledger row in the same transaction (`withTransaction`). A periodic (or on‑read) assertion that `balance_kobo == SUM(ledger)` guards against drift.

Also add to `members`: `sms_opt_out boolean NOT NULL DEFAULT false` (member‑level opt‑out, §10).

---

## 5. Top‑up flow (admin funds the wallet)

Mirrors the existing Paystack dues/tier pattern, with a new payment **kind = `sms_topup`**.

```
Admin → SMS wallet page → "Top up" → enter ₦ amount
  → startSmsTopup(amountKobo)                         [server fn]
      builds Paystack init: amount = amountKobo + paystackFee,
      metadata = { kind:'sms_topup', community_id }, settlement = platform_held
  → Paystack checkout → redirect back
  → verifySmsTopup(reference)  AND/OR  webhook
      → applyVerifiedCharge(tx):  new branch  kind==='sms_topup'
          INSERT sms_topups (... provider_ref ...) ON CONFLICT DO NOTHING RETURNING id
          if newly inserted:
            ledger += topup(amountKobo)      -- exactly what they chose
            wallet.balance_kobo += amountKobo
            (idempotent — webhook + browser can't double-credit, same guard as receipts)
```

Key point: the top‑up charge is `settlement_mode = platform_held` and lands in `sms_topups`, **not** `dues_payments`/`donation_payments`. It therefore never appears in payout aggregation or platform‑fee math (§7).

Super‑admin can also post `adjustment` ledger rows (goodwill credit, correction) with no payment.

---

## 6. Sending pipeline

A single reusable path so all three channels behave identically.

```
sendCommunitySms(communityId, channel, recipients[], bodyBuilder) →
  1. gate: settings.enabled AND settings['ch_'+channel] ?  else → email-only, return
  2. build list: members with a valid phone, not sms_opt_out; normalize to 234XXXXXXXXXX
  3. cost = Σ pages(body) × rate(route);  read wallet.balance_kobo
  4. if balance < cost:
        send what the balance covers (optional) OR skip SMS entirely,
        fall back to EMAIL for the rest, and fire low-balance alert to admin
  5. Termii /api/sms/send/bulk in chunks of 100 (route = settings.route, sender = settings.sender_id)
  6. in one transaction: ledger += debit(actualCost); wallet -= actualCost;
        insert sms_messages rows (status 'sent', provider_message_id)
  7. failures from Termii → status 'failed'; (optional) refund those via DLR webhook later
```

**Channel wiring** (SMS is *additive* — email still sends unless you later make them exclusive):

| Channel | Trigger today | SMS hook | Message |
|---|---|---|---|
| Birthday | `send-birthday-emails.mjs` / `api/cron/birthdays` (`birthdays.server.ts`) | after the email send, if `ch_birthdays` | short plain‑text birthday line (new SMS template, ~1 page) |
| Dues reminder | `dues-reminders.server.ts` + manual `sendDuesReminders` | if `ch_reminders` | "You're N months behind (₦X). Pay: <short link>" |
| Broadcast | `broadcasts.functions.ts` | admin picks Email / SMS / both; if SMS + `ch_broadcasts` | the broadcast body, with a **cost estimate shown before send** |

> Note: birthdays currently run in a standalone `.mjs` (can't import `.ts`). SMS logic lives in TS (`src/lib/sms/…`). Recommendation: drive birthday SMS from the **TS route cron** (`api/cron/birthdays`) so it can share the Termii client; keep the `.mjs` email‑only, or add a tiny JS Termii client mirror. Flagged in §12.

SMS bodies are **new short plain‑text templates** (not the HTML email templates) in `src/lib/sms/templates.ts`, kept ≤ 1 page where possible to control cost.

---

## 7. How this stays detached from platform fees (the transparency core)

Money flows in two opposite directions, and they never mix:

| | Direction | Where it lives | Touches payouts? | Touches platform fee? |
|---|---|---|---|---|
| Dues / donations | **into** the community | `dues_payments`, `donation_payments` | yes | yes (% cut) |
| Subscription | community → Kommunity | `plan_payments` | no | n/a |
| **SMS wallet** | community → SMS spend | `sms_topups`, `sms_ledger`, `sms_messages` | **no** | **no** |

The single enforced boundary: **SMS top‑ups use `kind='sms_topup'` + `settlement_mode='platform_held'` and are stored in their own tables**, so the payout aggregation (which sums `dues_payments`/`donation_payments` by settlement mode) can never pick them up, and the platform‑fee percentage is never applied to them. The admin gets one clean, self‑reconciling SMS statement — top‑ups in, messages out, balance remaining — with zero interaction with their dues, donations, payout balance, or subscription invoice.

---

## 7a. Float management & reconciliation (shared‑account model only)

With one platform Termii account behind all communities, **Termii cannot tell you how much any single community has left** — it only knows one aggregate balance. Per‑community "funds remaining" is therefore answered *entirely by our own ledger*, never by Termii.

**Mental model — it's a bank.** Each community has a balance in *our* DB (`sms_wallets.balance_kobo`, provably `= SUM(sms_ledger.delta_kobo)`). Termii is the vault holding one shared reserve. We never ask the vault what a customer has; we ask our own books. Termii's `balance` field (returned on every send) is used *only* by the operator for reconciliation and reserve monitoring — never to gate a community's send.

**"Has this admin used up their funds?" — resolved at send time, purely internally:**

```
1. read community's balance_kobo (our DB)
2. cost = recipients × pages × rate
3. balance_kobo < cost  → out of funds → block / partial-send + email fallback
   balance_kobo ≥ cost  → send, then in ONE transaction: debit wallet + insert ledger 'debit'
```

**The one new operator responsibility this model creates:** the reserve must always cover the sum of all community wallets.

```
Community A wallet:  ₦ 1,200   ┐
Community B wallet:  ₦   400   ├─ our ledger = source of truth for "who has funds"
Community C wallet:  ₦ 8,050   ┘   Σ = ₦9,650  (outstanding liability)
                                    ↓ must always be covered by
Platform Termii reserve: ₦25,000    ← operator keeps this topped up
```

- **Invariant:** `SUM(sms_wallets.balance_kobo) ≤ platform Termii reserve` (in value). Total community credits are a liability the reserve must cover.
- **Failure mode to prevent:** if the shared Termii account runs dry while a community still shows wallet balance, their send fails at Termii even though "they have funds" — an *operator* failure, not an accounting one.
- **Operator monitoring:** a scheduled check (super‑admin) compares the live Termii balance (`GET {TERMII_BASE_URL}/api/get-balance`) against `SUM(sms_wallets.balance_kobo)`; alert when `reserve − liabilities < threshold` (e.g. one large broadcast's worth) so the reserve is topped up *before* it's exhausted. Surface both numbers on a super‑admin "SMS reserve" panel.
- **Reconciliation:** because debits use a fixed pass‑through rate equal to Termii's rate, our internal debits should track Termii's actual deductions. Periodically compare the Termii balance drop over a window against `SUM(ledger debits)` for the same window; investigate drift (usually failed‑send refunds or a stale rate config).
- **Concurrency:** each community debits its own wallet row independently, so communities never contend with each other; the shared reserve is simply drawn down by all of them.

> This burden is the price of the light‑onboarding shared model. The "bring‑your‑own Termii key" alternative (decision #1) removes it entirely — each community's Termii balance *is* its own wallet, no float to manage — at the cost of every admin doing their own Termii signup, sender‑ID approval, and DND activation.

---

## 8. Settings & UI (all in the community admin area)

**Admin → Settings → "SMS" section** (owned entirely by the admin):
- Master **Enable SMS** toggle.
- **Sender ID** field (must match the Termii‑approved ID).
- Per‑channel switches: Birthday wishes / Dues reminders / Broadcasts.
- Low‑balance alert threshold.

**Admin → SMS wallet** (new page, or a card on the Dues/Settings area):
- Current balance (₦), with low‑balance warning styling.
- **Top up** button → amount → Paystack.
- **Statement**: ledger table (top‑ups, debits per channel, refunds, adjustments) + per‑message log with cost, fully exportable — the transparency surface.
- A small cost cheat‑sheet ("≈ ₦X per SMS page on your current route").

**Broadcast composer:** add channel choice (Email / SMS / Both) and a live **cost estimate** ("142 members × 2 pages ≈ ₦994") before the send is confirmed.

---

## 8a. Composer feedback & segment counting

The person sending sees the length/cost **live as they type**, and the number they see is produced by the **same pure `segments()` helper the backend bills with** — one source of truth, so preview and charge can never disagree.

**Shared helper** (`src/lib/sms/segments.ts`, unit‑tested, imported by both the composer and the debit path):

```
segments(text) → { encoding: 'gsm7' | 'unicode',
                   chars: number,
                   perPage: number,      // 160/153 gsm7, 70/67 unicode
                   pages: number,
                   charsLeftOnPage: number }
```

Segmentation rules it encodes:
- **GSM‑7**: 160 chars on a single page; **153** per part once the message splits (7 chars reserved for the concatenation header).
- **Unicode (UCS‑2)**: 70 single; **67** per part.
- **Encoding detection**: if any character falls outside the GSM‑7 basic + extension set, the whole message becomes Unicode → the per‑page limit drops to 70. Termii flags a specific set (`^ { } [ ] ~ | € \ ' "` and similar) as the trigger characters; the helper's charset check mirrors that so its page count matches Termii's billing.

**Live counter in the broadcast composer** (updates every keystroke):
- Characters used / remaining on the current page — e.g. `148 / 160`.
- Page count, flipping the instant a boundary is crossed (`1 page` → `2 pages`).
- Encoding badge: **Plain** vs **Unicode**.
- Live cost: `pages × recipients × rate` — e.g. `2 pages × 142 members ≈ ₦994`.

**Explicit Unicode warning.** The common trap is a single non‑GSM character silently halving the page size and doubling cost — pasted smart quotes `' "`, an em‑dash, the `₦` sign, or an emoji. When detected, the composer shows: *"Your message contains a special character (') and is now billed as Unicode — 70 characters per page."* with a one‑click "replace smart quotes with plain" fix.

**Pre‑send confirmation** for anything over one page: *"This message is 2 pages and will send to 142 members for ≈ ₦994. Continue?"* — no surprise deductions.

**System messages** (birthdays, reminders) aren't typed by the admin, but name substitution changes length. The settings **preview** renders the resolved message at worst case (longest member name) with its page count; these templates are kept comfortably inside one page.

---

## 9. Config / environment

```
TERMII_API_KEY          platform Termii key
TERMII_BASE_URL         https://api.ng.termii.com
TERMII_DEFAULT_SENDER   fallback sender ID
SMS_RATE_DND_KOBO       per-page rate on DND route  (= your Termii rate)
SMS_RATE_GENERIC_KOBO   per-page rate on generic route
PAYSTACK_SECRET_KEY     (existing) — reused for top-ups
```

Rates in env (not code) so a Termii price change is a one‑line config update, and pass‑through stays exact.

---

## 10. Guardrails & compliance

- **Never overdraw:** balance checked before send; debit is capped to what's covered; wallet can't go negative (DB check + transaction).
- **Idempotency:** top‑ups keyed by `(provider, provider_ref)`; send debits keyed by a batch id so a retried cron can't double‑charge.
- **Opt‑out:** `members.sms_opt_out` respected everywhere; surfaced on the member profile. (Inbound "STOP" auto‑opt‑out via a Termii inbound webhook is a fast‑follow, not v1.)
- **Phone validation:** normalize to `234XXXXXXXXXX`; invalid/empty numbers are skipped (never debited) and fall back to email.
- **DND route** for member notifications so DND‑registered members actually receive them.
- **Rate limiting** on top‑up initiation (reuse existing rate‑limit helper).
- **Delivery status (fast‑follow):** Termii DLR webhook → mark `sms_messages.status` delivered/failed and auto‑refund failed sends to the ledger.

---

## 11. Manual setup checklist additions

1. Create/verify a Termii account; fund it (platform pool).
2. Register an **alphanumeric sender ID**; wait for approval.
3. Email Termii support to **activate the DND route**.
4. Get the **rate card**; set `SMS_RATE_DND_KOBO` / `SMS_RATE_GENERIC_KOBO`.
5. Add `TERMII_*` env vars in Vercel.
6. Run migration `023_sms_wallet.sql`.
7. Test‑send to your own number on the DND route; confirm the ledger debits and balance match.

---

## 12. Open decisions (need your call before/at build)

1. **Wallet model:** platform‑shared Termii account + per‑community wallet *(recommended, light onboarding)* **vs** bring‑your‑own Termii key per community *(max independence, heavy onboarding)*.
2. **Top‑up crediting:** add Paystack fee on top so the wallet gets the full amount *(recommended, platform cost‑neutral)* **vs** credit net‑of‑fee.
3. **Birthday cron:** move birthday SMS onto the TS route cron *(recommended)* **vs** add a JS Termii mirror to the `.mjs`.
4. **Broadcast/email relationship:** SMS *in addition to* email *(recommended default)* **vs** admin picks one to avoid double‑paying.
5. **Failed‑send refunds:** ship DLR webhook + auto‑refund in v1, or as fast‑follow.

---

## 13. Phased delivery

- **Phase 1 — Wallet foundation:** migration, `sms_wallets`/`sms_ledger`/`sms_topups`, Paystack top‑up flow, `applyVerifiedCharge` branch, wallet page + statement, settings toggle. *No sends yet.* Proves the money model in isolation.
- **Phase 2 — Provider + one channel:** Termii client (`SmsProvider` interface), segmentation helper (unit‑tested), phone normalizer, `sendCommunitySms`, wire **dues reminders** first (smallest, highest‑value). Test‑send + reconcile.
- **Phase 3 — Remaining channels:** birthdays and broadcasts (with cost estimate in the composer).
- **Phase 4 — Compliance & polish:** DLR webhook + failed‑send refunds, inbound STOP opt‑out, low‑balance email alert, admin cost analytics.

---

## 14. Testing plan

- **Pure/unit:** page/segment counting (GSM‑7 vs unicode, multipart), phone normalization, cost = recipients × pages × rate, balance‑sufficiency + overdraw guard.
- **Idempotency:** duplicate top‑up webhook + browser verify → single credit; retried send batch → single debit.
- **Integration (staging):** real Termii test‑send on DND; confirm ledger, `sms_messages`, and cached balance all agree; confirm `sms_topups` never appears in payout totals.
- **Fallback:** SMS off / empty wallet / invalid number → email path still fires.
```
