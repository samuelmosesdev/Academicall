const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+|(?<![\p{L}\p{N}_@])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}]{2,63}(?::\d{1,5})?(?:[/?#][^\s<>"']*)?/giu;
const TRAILING_PUNCTUATION = /[.,!?;:]+$/;

function cleanUrl(candidate) {
  let url = candidate.replace(TRAILING_PUNCTUATION, "");
  for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
    while (url.endsWith(close) && (url.match(new RegExp(`\\${close}`, "g")) || []).length > (url.match(new RegExp(`\\${open}`, "g")) || []).length) {
      url = url.slice(0, -1);
    }
  }
  return url;
}

export function linkifyText(value, keyPrefix = "link") {
  const text = String(value ?? "");
  const nodes = [];
  let cursor = 0;
  let index = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = cleanUrl(match[0]);
    const start = match.index;
    if (!url || start < cursor) continue;

    if (start > cursor) nodes.push(<span key={`${keyPrefix}-text-${index++}`}>{text.slice(cursor, start)}</span>);

    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    try {
      const parsed = new URL(href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Unsupported link protocol");
      nodes.push(
        <a
          key={`${keyPrefix}-url-${index++}`}
          href={parsed.href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-current/40 underline-offset-2 hover:decoration-current"
        >
          {url}
        </a>,
      );
      cursor = start + url.length;
    } catch {
      nodes.push(<span key={`${keyPrefix}-text-${index++}`}>{text.slice(start, start + url.length)}</span>);
      cursor = start + url.length;
    }
  }

  if (cursor < text.length) nodes.push(<span key={`${keyPrefix}-text-${index}`}>{text.slice(cursor)}</span>);
  return nodes;
}
