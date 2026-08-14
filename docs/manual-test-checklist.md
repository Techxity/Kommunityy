# Kommunity — Manual test checklist (needs real data / live services)

Everything below was written and type-checked, and the pure logic is unit-tested, but these paths depend on live Paystack / Termii / Resend / a real database / a real browser, so they couldn't be exercised in development. Run them once on staging or right after deploy. Grouped by area, each with **what to do** and **what you should see**.

Legend: ☐ = to test.

---

## 0. Prerequisites (do these first — nothing works without them)

- ☐ **Run all pending DB migrations**, especially the newest: `016`, `018`–`025`. (022 dues reminders, 023 SMS wallet, 024 expenses, 025 expense receipts + funds-position flag.)
- ☐ **Set all Vercel env vars** (see the env list): `DATABASE_URL`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `APP_URL`, `CRON_SECRET`; plus Termii vars when enabling SMS.
- ☐ **Set the Paystack webhook** to `https://<domain>/api/public/paystack-webhook`.
- ☐ **Verify a Resend sending domain** and set `RESEND_FROM_ADDRESS` to an address on it (otherwise email falls back to the limited test sender).

---

## 1. Payments — dues (Paystack)

- ☐ **Pay dues end-to-end** (test mode): as a member, Pay now → Paystack → complete. Expect: redirect back shows success, payment appears in admin **Dues → Payment history**, and the member's "next due" advances.
- ☐ **Receipt email** lands in the payer's inbox with amount, reference, date, and period covered.
- ☐ **Multi-month payment**: pay for several periods; the coverage/"next due" reflects the full span.
- ☐ **Webhook + browser both fire**: confirm the payment is recorded **once** (no duplicate) whether the webhook or the redirect lands first.
- ☐ **Subaccount split**: for a community with saved bank details, confirm the NGN payment settles to their account (Paystack dashboard) and `settlement_mode = subaccount_split`.

## 2. Payments — donations, subscription, yearly billing

- ☐ **Donation** via a campaign link → donor gets a receipt; shows in donations.
- ☐ **Subscription/tier purchase** upgrades the community and clears the trial.
- ☐ **Yearly billing** charges exactly **10× the monthly price** (2 months free) and the "renews on" estimate advances 12 months.

## 3. Payouts + bank details

- ☐ **Bank search + name resolution**: type a bank, enter a 10-digit account → the account name auto-resolves; Save is blocked until it does.
- ☐ **Save bank details** creates the Paystack recipient/subaccount (or falls back gracefully if Transfers aren't enabled).
- ☐ **Request payout** for a USD/held balance → moves Requested → Approved → Paid; money reaches the bank.

## 4. Dues arrears + reminders

- ☐ **Defaulters list** matches reality for a community you know — periods behind and amount owed.
- ☐ **Per-member currency**: a member who pays in USD shows arrears in $ (not ₦).
- ☐ **Manual reminders** (Remind / Remind all): defaulters with email get the email; result message counts are right; "last reminded" updates.
- ☐ **Automated reminder cron**: trigger `/api/cron/trials` (which also runs dues reminders) with the `CRON_SECRET` bearer; confirm only overdue members not reminded in ~25 days are contacted.
- ☐ **Collection rate** figure looks sane against known data.

## 5. SMS (Termii) — needs a funded Termii wallet + approved Sender ID + DND route

- ☐ **Wallet top-up**: SMS → Top up → Paystack. Confirm the wallet is credited the **full amount you chose** (fee added on top at checkout), and a `topup` ledger row appears.
- ☐ **Test send** to your own number on the **DND route**; confirm it arrives, a `debit` ledger row is written, and the balance drops by the expected amount.
- ☐ **Cost = pages × rate**: the composer's live estimate matches the actual debit (watch the GSM-7 vs Unicode page count — try an emoji/curly quote).
- ☐ **Dues reminder by SMS**: with the reminders channel on, a defaulter with a phone gets a text.
- ☐ **Birthday SMS**: set a test member's DOB to today, run `/api/cron/birthdays`; confirm the text sends and they're marked so it doesn't resend.
- ☐ **Broadcast SMS**: send a broadcast via SMS/both; the cost estimate and the recipients match.
- ☐ **Opt-out respected**: a member who unticks "Receive SMS" gets no texts.
- ☐ **Phone normalization**: members entered as `080…`, `+234…`, `234…` all send; rubbish numbers are skipped (not charged).
- ☐ **Low-balance alert**: drain the wallet below the threshold → admin gets the low-balance email once (and again after it recovers and drops again).
- ☐ **Insufficient balance**: with an empty wallet, SMS silently falls back to email; nothing is charged.
- ☐ **DLR webhook + refund**: configure Termii's delivery webhook (`/api/public/termii-dlr`, with `SMS_DLR_TOKEN` if set); force a failed delivery → the message shows failed and the wallet is **refunded**; a delivered one shows delivered; retries don't double-refund.
- ☐ **Super-admin reserve panel** (`/super-admin/sms`): total community liabilities vs live Termii balance; the shortfall alert triggers when the reserve dips below liabilities.

## 6. Financial report + expenses

- ☐ **Report totals** (gross, fees, net, dues/donations split) match known data for a period, per currency.
- ☐ **Monthly** and **by-member** breakdowns look right.
- ☐ **CSV export** opens cleanly in Excel/Google Sheets, with the ₦ sign intact; the **Net column sums** to the true position (income net minus expenses).
- ☐ **Print** produces a clean one-piece report (buttons/nav hidden).
- ☐ **Add / edit / delete expense** works; totals and surplus/deficit update.
- ☐ **Receipt evidence**: attach a PNG/JPG/PDF (~<3MB) to an expense → **View** opens it in a new tab → **Remove** clears it. Try an oversized/wrong-type file (should be rejected).
- ☐ **Funds-position toggle**: flip "Deduct expenses from funds position" on → "Currently held" drops by the all-time expenses total; off → it doesn't. Surplus/deficit reflects expenses either way.

## 7. Email (Resend) — after domain verification

- ☐ Receipts, dues reminders, low-balance alerts, and the **About contact form** (→ hello@akenrose.com, reply-to = sender) all deliver to real inboxes.
- ☐ **Trial lifecycle emails**: a community near trial end gets the 2-day / 1-day warnings and the ended notice (via `/api/cron/trials`).

## 8. Scheduled jobs (Vercel Cron)

- ☐ Confirm **`/api/cron/birthdays`** and **`/api/cron/trials`** actually fire daily on Vercel (check logs). Note: the dues-reminder job runs *inside* the trials cron; the standalone `/api/cron/dues-reminders` route exists if you'd rather schedule it separately (GitHub Actions/Railway).
- ☐ Each returns 401 without the `CRON_SECRET` bearer.

## 9. Elections, broadcasts, birthdays (functional)

- ☐ **Election**: create positions + candidates, vote as a member (one vote/position, locked), results/export are correct.
- ☐ **Broadcast (email)** reaches active members and shows on their dashboards.
- ☐ **Birthday email + admin digest** send on the day.

## 10. Auth / onboarding

- ☐ **Signup**: the Terms/Privacy checkbox blocks submit until ticked; account + community are created; trial starts (or payment flow runs).
- ☐ **Password eye toggle** reveals/hides on every auth page (login, community login, signup, reset, invite, change-password).
- ☐ **Login tab order**: Tab goes email → password → Sign in (skips "Forgot password").
- ☐ **Invite flow**: an email-invited member sets a password and lands active (skips approval).
- ☐ **Forgot/reset password** email + link works.

## 11. Mobile responsiveness & navigation (real device or DevTools)

- ☐ **Admin on a phone**: the hamburger opens the nav drawer; you can reach Members, Dues, Payouts, Reports, SMS, etc.; the drawer closes on selection.
- ☐ **Member on a phone**: the scrollable pill nav reaches every page.
- ☐ **Tables** (dues arrears, reports, expenses, chapters) scroll sideways instead of breaking the layout.
- ☐ **Workspace switcher**: an account that's admin of one community and member of another can switch, and each view scopes correctly.

---

### Suggested smoke-test order (30 minutes on staging)
1. Env + migrations + webhook set.
2. Signup → create community → set dues → add a member.
3. Member pays dues (test mode) → receipt arrives → arrears/report update.
4. Add bank details → confirm settlement path.
5. Turn on SMS → top up → test send → birthday/reminder text.
6. Record an expense + receipt → check surplus/deficit and the funds-position toggle.
7. Open everything once on a phone.
