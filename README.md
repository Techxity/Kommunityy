# Kommunity

Community management for associations, alumni groups and estates.

## SMS setup on Vercel

SMS (birthday wishes, dues reminders and broadcasts) is sent through
[BulkSMSNigeria](https://www.bulksmsnigeria.com) from one shared platform
account. Each community pays from its own prepaid SMS wallet. The architecture
is in [docs/sms-wallet-architecture.md](docs/sms-wallet-architecture.md).

### 1. Environment variables

Add these under **Vercel → Project → Settings → Environment Variables** for
the Production environment, then **redeploy**. Vercel only applies changed
variables to new deployments.

**Required for SMS to send**

| Variable | Value | Notes |
| --- | --- | --- |
| `BULKSMSNIGERIA_API_TOKEN` | API token from the BulkSMSNigeria dashboard | Without it every send fails and the super-admin reserve panel shows "not configured". |
| `SMS_RATE_DND_KOBO` | Per-page price on the DND route, in **kobo**, VAT included | `400` = ₦4.00. Set it to your BulkSMSNigeria rate. Communities pay exactly this, so a wrong value means over- or under-charging. Defaults to `400` if unset. |
| `SMS_RATE_GENERIC_KOBO` | Per-page price on the generic route, in kobo | Defaults to `300` if unset. |

**Required for delivery reports and refunds**

| Variable | Value | Notes |
| --- | --- | --- |
| `SMS_DLR_TOKEN` | A long random string, e.g. the output of `openssl rand -hex 32` | Without it texts still send, but nothing is ever marked delivered/failed and **failed texts are not refunded**. Never share it. It authenticates BulkSMSNigeria's callbacks. |
| `APP_URL` | Your production origin, e.g. `https://app.kommunity.ng` (no trailing slash) | Used to build the delivery-report callback URL and the Paystack top-up return URL. |

There's nothing to configure on the BulkSMSNigeria dashboard for delivery
reports. Every send passes its own callback URL
(`<APP_URL>/api/public/sms-dlr?token=…`).

**Required by the rest of the app (SMS depends on them too)**

| Variable | Why SMS needs it |
| --- | --- |
| `DATABASE_URL` | Wallets, ledger and the message log. |
| `PAYSTACK_SECRET_KEY` | Admins top up their SMS wallet through Paystack. |
| `CRON_SECRET` | Authenticates the daily crons that send birthday and dues-reminder texts. Without it the cron routes refuse to run. |

**Optional**

| Variable | Default | When to set it |
| --- | --- | --- |
| `SMS_GATEWAY_DND` | `direct-refund` | If BulkSMSNigeria gives you a different gateway name for reaching Do-Not-Disturb numbers. |
| `SMS_GATEWAY_GENERIC` | `direct-refund` | If you want the generic route on a different gateway. |
| `BULKSMSNIGERIA_BASE_URL` | `https://www.bulksmsnigeria.com/api/v2` | Only if BulkSMSNigeria tells you to use another host. |

### 2. Database migrations

Run these against the production database if they haven't been applied yet:

- `db/migrations/023_sms_wallet.sql`: wallets, ledger, top-ups and the message log
- `db/migrations/029_sms_provider_bulksmsnigeria.sql`: switches the provider and adds the delivery-report index

### 3. Other one-time setup

- **Paystack webhook**: set it to `https://<your-domain>/api/public/paystack-webhook` so wallet top-ups are credited even if the admin closes the tab before returning.
- **Fund the BulkSMSNigeria account.** It's the shared reserve behind every community's wallet. Keep it above the total of all community balances. The super-admin **SMS reserve** page (`/super-admin/sms`) shows both numbers.
- **Register each community's sender ID** on the BulkSMSNigeria account. Texts from an unapproved sender ID fail (and are refunded).
- **Crons**: `vercel.json` already schedules `/api/cron/birthdays` and `/api/cron/trials` daily. Dues reminders run inside the trials cron, so no extra entry is needed.

### 4. Check it works

1. As a community admin, open **Admin → SMS**, top up ₦100, enable SMS, enter an approved sender ID and save.
2. Send a broadcast to yourself with SMS ticked.
3. Under **Recent messages** the text should show `sent`, then change to `delivered` within a few minutes. If it stays `sent`, check `SMS_DLR_TOKEN` and `APP_URL`, then look for `[sms-dlr]` or `[sms]` lines in the Vercel function logs.

The full SMS test list is in section 5 of
[docs/manual-test-checklist.md](docs/manual-test-checklist.md).
