const SITE = "https://academicall.site";
const DEFAULT_DESCRIPTION =
  "Materials, timetables, study groups, CBT practice and campus news for Nigerian university students.";
const DEFAULT_API_URL = "https://academicall-api-1.onrender.com/api/v1";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function defaultMetadata(path) {
  return {
    title: "Academicall — your semester, in one place",
    description: DEFAULT_DESCRIPTION,
    image: `${SITE}/og/default.jpg`,
    imageAlt: "Academicall",
    url: SITE + path,
    type: "website",
    siteName: "Academicall",
  };
}

export function metadataTags(metadata) {
  const tags = [
    `<title>${escapeHtml(metadata.title)}</title>`,
    `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(metadata.url)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(metadata.siteName)}" />`,
    `<meta property="og:type" content="${escapeHtml(metadata.type)}" />`,
    `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(metadata.url)}" />`,
    `<meta property="og:image" content="${escapeHtml(metadata.image)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtml(metadata.image)}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt)}" />`,
    '<meta property="og:locale" content="en_NG" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(metadata.image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(metadata.imageAlt)}" />`,
  ];

  if (metadata.type === "article") {
    if (metadata.publishedTime) {
      tags.push(
        `<meta property="article:published_time" content="${escapeHtml(metadata.publishedTime)}" />`,
      );
    }
    if (metadata.author) {
      tags.push(`<meta property="article:author" content="${escapeHtml(metadata.author)}" />`);
    }
    if (metadata.section) {
      tags.push(`<meta property="article:section" content="${escapeHtml(metadata.section)}" />`);
    }
  }

  return tags.join("\n    ");
}

export function injectMetadata(html, metadata) {
  const block = `<!-- og:start -->\n    ${metadataTags(metadata)}\n    <!-- og:end -->`;
  if (html.includes("<!-- og:start -->")) {
    return html.replace(/<!-- og:start -->[\s\S]*?<!-- og:end -->/, block);
  }
  return html.replace(/<title>[\s\S]*?<\/title>/, "").replace("</head>", `    ${block}\n  </head>`);
}

function apiBase(env) {
  return (env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
}

export async function renderSocialPage({ request, env, next }) {
  const path = new URL(request.url).pathname;
  const metadata = defaultMetadata(path);

  try {
    const response = await fetch(
      `${apiBase(env)}/og/meta?path=${encodeURIComponent(path)}`,
      { signal: AbortSignal.timeout(9000) },
    );
    if (response.ok) {
      Object.assign(metadata, await response.json());
    } else {
      console.warn(`[pages:og] Metadata API returned ${response.status} for ${path}`);
    }
  } catch (error) {
    console.warn(`[pages:og] Using default metadata for ${path}:`, error);
  }

  const shell = await next();
  if (!shell.ok) return shell;

  const headers = new Headers(shell.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=60, s-maxage=300");
  headers.set("Vary", "Accept-Encoding");

  return new Response(injectMetadata(await shell.text(), metadata), {
    status: shell.status,
    statusText: shell.statusText,
    headers,
  });
}

export async function proxyOgImage({ request, env }) {
  const path = new URL(request.url).pathname;
  const imagePath = path.slice("/og/".length);

  try {
    const response = await fetch(`${apiBase(env)}/og/image/${imagePath}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return new Response(null, { status: response.status === 404 ? 404 : 502 });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error(`[pages:og] Image proxy failed for ${path}:`, error);
    return new Response("Unable to retrieve Open Graph image.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
