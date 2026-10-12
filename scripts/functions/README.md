# Paystack webhook (auto Pro)

## 1. Install & configure secret

```bash
cd functions
npm install
firebase functions:config:set paystack.secret="sk_live_YOUR_SECRET_KEY"
```

Use `sk_test_...` while testing.

## 2. Deploy

```bash
firebase deploy --only functions,firestore:rules
```

## 3. Webhook URL in Paystack

Dashboard → Settings → API & Webhooks → Webhook URL:

```
https://us-central1-<YOUR_PROJECT_ID>.cloudfunctions.net/paystackWebhook
```

(Region may differ — check Firebase console after deploy.)

Subscribe to at least: **charge.success**

## 4. How matching works

1. Student pays with the **same email** as their UofA Readers account.
2. Webhook verifies `x-paystack-signature`.
3. On `charge.success`, user with that email gets `plan: "pro"`.
4. Open payment claims are marked activated.

If email does not match any user, a row is stored in `paymentOrphans` for admin follow-up.

## 5. Manual verify (optional)

```
https://us-central1-<PROJECT>.cloudfunctions.net/verifyPaystackReference?reference=REF_FROM_PAYSTACK
```
