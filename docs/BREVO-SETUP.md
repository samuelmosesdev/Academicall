# Academical — Brevo email verification (no Firebase Blaze)

You will send **branded 6-digit codes** with Brevo through a **free Cloudflare Worker**.
Firebase Spark stays as-is; the worker updates Firestore `emailVerified` securely.

---

## Overview

```
Signup → App gets Firebase idToken
      → Worker stores code + emails via Brevo (“Academical”)
      → Student enters code
      → Worker checks code → sets users/{uid}.emailVerified = true
      → App unlocks (same gate as before)
```

---

## Step 1 — Brevo account

1. Sign up at [https://www.brevo.com](https://www.brevo.com) (free).
2. **Settings → SMTP & API → API Keys → Generate** a key. Copy it.
3. **Senders → Add a sender**
   - Easiest to start: use a sender Brevo allows without a domain (their onboarding email).
   - Better: verify your own domain (SPF/DKIM) so inbox delivery is strong.
4. Note:
   - **API key**
   - **Sender email**: `noreply@academicall.site` (must be verified in Brevo)
   - Sender name: `Academical`

---

## Step 2 — Firebase service account (for the worker only)

1. Firebase Console → Project settings → **Service accounts**
2. **Generate new private key** → download JSON
3. From the JSON you need:
   - `project_id`
   - `client_email`
   - `private_key`

Keep this file private. Never commit it to GitHub.

---

## Step 3 — Cloudflare Worker

1. Sign up at [https://dash.cloudflare.com](https://dash.cloudflare.com) (free).
2. **Workers & Pages → Create → Create Worker**
3. Name it e.g. `academical-verify`
4. Paste the contents of `workers/brevo-verify/worker.js` into the editor
5. **Deploy**
6. Copy the worker URL, e.g.  
   `https://academical-verify.<subdomain>.workers.dev`

### Add secrets

In the worker → **Settings → Variables → Secrets** (or Wrangler):

| Secret name | Value |
|-------------|--------|
| `BREVO_API_KEY` | your Brevo API key |
| `BREVO_SENDER_EMAIL` | verified sender email |
| `BREVO_SENDER_NAME` | `Academical` |
| `FIREBASE_PROJECT_ID` | from service account JSON `project_id` |
| `FIREBASE_CLIENT_EMAIL` | from JSON `client_email` |
| `FIREBASE_PRIVATE_KEY` | from JSON `private_key` (paste full key including `-----BEGIN...`; Cloudflare accepts `\n` for newlines) |

Redeploy after secrets.

---

## Step 4 — App `.env.local`

```env
VITE_VERIFY_API_URL=https://academical-verify.YOUR_SUBDOMAIN.workers.dev
```

No trailing slash. Restart:

```bash
npm run dev
```

---

## Step 5 — Test

1. Sign up with a real email you can open  
2. You should get **“Your Academical verification code”** from your Brevo sender  
3. Enter the 6 digits on the Verify page  
4. You should continue to Complete profile  

If send fails, open Worker → **Logs** and check Brevo sender verification.

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Brevo 401 | Wrong API key |
| Brevo 400 sender | Sender email not verified in Brevo |
| Firestore write failed | Service account lacks permission — use the Firebase Admin SDK key from that project |
| Invalid token | User must be signed in; try resend after refresh |
| CORS | Worker already sends `Access-Control-Allow-Origin: *` |
| Still Firebase link email | `VITE_VERIFY_API_URL` missing or wrong — app falls back to Firebase mailer |

---

## Security notes

- Codes live only 15 minutes and are cleared after success  
- Client never gets to set `emailVerified` by itself (worker uses service account)  
- Do not put Brevo API key or service account JSON in the frontend  

---

## Optional: custom domain on Worker

Workers & Pages → your worker → **Custom domains** → add `verify.yourdomain.com`  
Then set `VITE_VERIFY_API_URL=https://verify.yourdomain.com`
