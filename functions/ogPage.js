/**
 * ogPage — link previews for a single-page app.
 *
 * WhatsApp, X, Facebook, LinkedIn, Telegram and Slack never run JavaScript, so a
 * shared link to /news/<slug> would only ever show the homepage tags. Firebase
 * Hosting sends shareable paths here (see firebase.json rewrites). This function:
 *   1. asks the API what the path is (GET /og/meta?path=…)
 *   2. writes the title, description, image, canonical URL, Open Graph and Twitter
 *      tags into the built index.html, and returns it. People get the normal app.
 *   3. proxies the card images (/og/**) from the API with long CDN caching, so the
 *      image URL lives on academicall.site and survives the API's cold start.
 * If the API is slow (> 3.5 s) or down, the page still loads with the default tags.
 *
 * Config (optional): OG_API_URL in functions/.env (e.g. OG_API_URL=https://…/api/v1);
 * OG_SHELL_ORIGIN only for local testing (defaults to the requesting host over https).
 * Defaults to the production API. Uses the v2 API (firebase-functions 6 default).
 */
const { onRequest } = require("firebase-functions/v2/https");

const SITE = "https://academicall.site";
const apiBase = () => (process.env.OG_API_URL || "https://academicall-api-1.onrender.com/api/v1").replace(/\/$/, "");

let shell = { html: null, at: 0 };
async function indexHtml(req) {
  if (shell.html && Date.now() - shell.at < 5 * 60_000) return shell.html;
  const host = req.get("x-forwarded-host") || req.get("host") || "academicall.site";
  // Hosting serves /index.html as a static file (rewrites only apply when no file matches), so this can't loop.
  const origin = process.env.OG_SHELL_ORIGIN || `https://${host}`;
  const r = await fetch(`${origin}/index.html`, { headers: { "x-og-shell": "1" } });
  if (!r.ok) throw new Error(`index.html ${r.status}`);
  shell = { html: await r.text(), at: Date.now() };
  return shell.html;
}

async function withTimeout(url, ms, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function defaults(path) {
  return {
    title: "Academicall — your semester, in one place",
    description: "Materials, timetables, study groups, CBT practice and campus news for Nigerian university students.",
    image: `${SITE}/og/default.jpg`, imageAlt: "Academicall", url: SITE + path, type: "website", siteName: "Academicall",
  };
}

function tags(m) {
  const t = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(m.url)}" />`,
    `<meta property="og:site_name" content="${esc(m.siteName)}" />`,
    `<meta property="og:type" content="${esc(m.type)}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(m.url)}" />`,
    `<meta property="og:image" content="${esc(m.image)}" />`,
    `<meta property="og:image:secure_url" content="${esc(m.image)}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(m.imageAlt)}" />`,
    `<meta property="og:locale" content="en_NG" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${esc(m.image)}" />`,
    `<meta name="twitter:image:alt" content="${esc(m.imageAlt)}" />`,
  ];
  if (m.type === "article") {
    if (m.publishedTime) t.push(`<meta property="article:published_time" content="${esc(m.publishedTime)}" />`);
    if (m.author) t.push(`<meta property="article:author" content="${esc(m.author)}" />`);
    if (m.section) t.push(`<meta property="article:section" content="${esc(m.section)}" />`);
  }
  return t.join("\n    ");
}

/** Replace the default head tags (between the og:start / og:end markers in index.html). */
function inject(html, m) {
  const block = `<!-- og:start -->\n    ${tags(m)}\n    <!-- og:end -->`;
  if (html.includes("<!-- og:start -->")) return html.replace(/<!-- og:start -->[\s\S]*?<!-- og:end -->/, block);
  return html.replace(/<title>[\s\S]*?<\/title>/, "").replace("</head>", `    ${block}\n  </head>`);
}

exports.ogPage = onRequest({ region: "us-central1", memory: "256MiB", timeoutSeconds: 20, concurrency: 40, maxInstances: 10 }, async (req, res) => {
  const path = req.path || "/";
  try {
    // Card images: /og/news/<slug>.jpg, /og/study/<code>.jpg, /og/default.jpg, /og/default-news.jpg
    if (path.startsWith("/og/")) {
      const r = await withTimeout(`${apiBase()}/og/image/${path.slice(4)}`, 15_000);
      if (!r.ok) { res.status(r.status === 404 ? 404 : 502).end(); return; }
      res.set("Content-Type", r.headers.get("content-type") || "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
      res.send(Buffer.from(await r.arrayBuffer()));
      return;
    }
    const htmlP = indexHtml(req);
    let meta = defaults(path);
    try {
      const r = await withTimeout(`${apiBase()}/og/meta?path=${encodeURIComponent(path)}`, 3500);
      if (r.ok) meta = { ...meta, ...(await r.json()) };
    } catch (_) { /* API asleep or down: defaults */ }
    const html = inject(await htmlP, meta);
    res.set("Content-Type", "text/html; charset=utf-8");
    // Short edge cache: edits show up within minutes, crawlers get a fast answer.
    res.set("Cache-Control", "public, max-age=60, s-maxage=300");
    res.set("Vary", "Accept-Encoding");
    res.send(html);
  } catch (err) {
    console.error("[ogPage]", path, err);
    // Last resort: let the browser load the app shell directly.
    res.redirect(302, `/index.html#${path}`);
  }
});

// exported for tests
exports._internals = { inject, tags, esc };
