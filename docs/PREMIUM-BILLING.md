# Premium billing (Paystack)

## What it does
- **Admin → Billing & premium** (`/admin/billing`, needs `settings.manage`):
  - Tick which features are **paid**; everything unticked stays free. Staff always have full access.
  - Add/edit plans: id, name, price (₦), length (days), perks, On sale, Highlight.
  - Edit the upgrade page: headline, subheadline, note, support email, FAQ.
  - See revenue, paid count, active premium and the last 40 payments.
- **Students/aspirants**: `/dashboard/upgrade` shows the admin's plans and wording. "Pay" opens Paystack checkout
  started by the API (amount always comes from the plan, never the browser). On return the page verifies the payment.
- **My materials** (`/dashboard/materials`) lets students organize saved materials and personal uploads into nested folders.
  Upload permission is controlled separately by the **Material uploads** feature in Admin → Billing; it is free by default.
- A free account opening a paid page sees a lock panel with "See plans"; the API answers `402 premium_required`.
- Plans run for their number of days, then lapse to free automatically. Paying again adds time to the end.
- Manual grant/revoke: `PUT /api/v1/admin/billing/users/:id` `{ planId }` or `{ revoke: true }` (needs `payments.review`).

## Setup (you supply the keys)
API environment:
- `PAYSTACK_SECRET_KEY=sk_live_...` (or `sk_test_...` to test first)
- `PUBLIC_APP_URL=https://academicall.pages.dev` (the frontend origin; defaults to this production URL)

Checkout sends Paystack back to `/dashboard/upgrade` on the same supported site origin that started checkout (`https://academicall.site` or `https://academicall.pages.dev`) with the payment reference in the query string. This preserves the browser's origin-scoped login session. If checkout has no supported Origin header, it falls back to `PUBLIC_APP_URL` (or `https://academicall.site`). The upgrade route verifies the transaction before showing the account as premium.

Paystack dashboard → Settings → API Keys & Webhooks:
- Live callback URL: `https://academicall.site/dashboard/upgrade` (the app also uses the `pages.dev` origin when checkout starts there)
- Live webhook URL: `https://academicall-api-1.onrender.com/api/v1/payments/webhook/paystack`

No frontend key is needed. Billing itself reuses the existing Payment, Subscription and Setting tables.

## My materials folders

The materials feature adds `material_folders` and nullable folder references to saved materials and uploaded documents. Deploy the API migration with `npx prisma migrate deploy` before enabling the updated app. Personal uploads are limited to 500 files per account, 25 MB per file, and 200 folders (up to three levels deep). The existing Cloudinary upload flow is used.

## API
- `GET /billing` — public plans, paid features, page words, my status
- `POST /billing/checkout { planId }` → `{ url, reference }`
- `GET /billing/verify/:reference`
- `GET|PUT /admin/billing`
- Webhook `charge.success` now goes through the same `activatePlan` (idempotent on reference).

## Test with Paystack test mode
1. Set `sk_test_` key, turn on a plan, tick a feature as paid.
2. Sign in as a student, open the feature → lock panel → See plans → Pay → use Paystack's test card.
3. Back on `/dashboard/upgrade` you should see "Payment confirmed. Premium is on." and the feature opens.

## Notes
- The old Admin → Payments page (payment links + claims) still works; Billing is the new source of truth for prices.
- Not built yet (out of this release): screenshots, automatic recurring card charges, admin/agent team management.
