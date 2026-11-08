# Cloudflare Pages deployment

The frontend is deployed from this workspace to the `academicall` Pages project.
Firebase remains available as a rollback target until the custom domain migration
has been verified.

## Deploy from VS Code

Install dependencies once, then authenticate Wrangler with a Cloudflare API token
that has **Cloudflare Pages: Edit** permission for this account. Keep the token out
of source control and do not put it in a `VITE_` variable.

In PowerShell:

```powershell
$env:CLOUDFLARE_API_TOKEN = Read-Host "Cloudflare API token"
$env:CLOUDFLARE_ACCOUNT_ID = "846fcf28d6114e4cd85ef238db9fe993"
npm run deploy:pages
```

`deploy:pages` builds the Vite app and uploads `dist/` to the production branch.
The account ID and token are supplied to the current PowerShell process only.

## Pages Functions

The Pages Functions in `functions/news/`, `functions/study/`, and `functions/og/`
preserve server-rendered Open Graph metadata and image proxying for share links.
They use `VITE_API_URL` at runtime and fall back to the production API URL if it is
not configured. Firebase Functions in this folder remain for the Firebase
deployment/rollback path; they are not invoked by Cloudflare Pages.

## Custom domain cutover

Add the custom hostname under the `academicall` Pages project after the Pages
deployment is healthy. Follow Cloudflare's displayed DNS instructions. Do not
remove Firebase Hosting DNS records until the custom domain resolves to Pages,
HTTPS is active, and the important routes and share previews have been verified.
Keep any unrelated mail or verification DNS records unchanged.
