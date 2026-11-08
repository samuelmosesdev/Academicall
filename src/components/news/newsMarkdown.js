/**
 * Story bodies are stored as Markdown in the existing `body` field, so old plain-text stories keep working.
 * Supported: paragraphs, ## / ### headings, > quotes, - and 1. lists, --- dividers, **bold**, *italic*, `code`,
 * [links](https://…), ![caption](image-url "caption") photos and [Label](https://…){button} link buttons.
 * Nothing here produces HTML: the renderer builds React elements from these tokens, so a story can't inject markup.
 */

/** Only web links, mail/phone links and on-site paths are ever rendered as links or images. */
export function safeUrl(value, { image = false } = {}) {
  const url = String(value || "").trim();
  if (!url || /[\u0000-\u001f\u007f\\]/.test(url)) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (!image && /^(mailto:|tel):[^\s]+$/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch {
    return null;
  }
  return null;
}

/** "unilag.edu.ng" -> "https://unilag.edu.ng"; keeps anything that already has a scheme. */
export function normalizeLink(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) return url;
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(url)) return `mailto:${url}`;
  return `https://${url.replace(/^\/+/, "")}`;
}

const INLINE_SOURCE =
  [
    "!?\\[([^\\]]+)\\]\\(([^)\\s]+)(?:\\s+\"[^\"]*\")?\\)", // 1,2: [text](url)
    "\\*\\*(.+?)\\*\\*", // 3: bold
    "(?<![\\w*])\\*(?!\\s)(.+?)(?<!\\s)\\*(?![\\w*])", // 4: *italic*
    "(?<![\\w])_(?!\\s)(.+?)(?<!\\s)_(?![\\w])", // 5: _italic_
    "`([^`]+)`", // 6: code
    "(https?:\\/\\/[^\\s<>()]+[^\\s<>().,;:!?\"'])", // 7: bare link (legacy stories)
  ].join("|");

/** Inline Markdown -> small token tree. */
export function parseInline(text) {
  const out = [];
  const source = String(text || "");
  let last = 0;
  let m;
  // A fresh regex per call: parseInline calls itself for nested formatting, and a shared global regex
  // would have its position reset by the inner call (an endless loop).
  const INLINE = new RegExp(INLINE_SOURCE, "g");
  while ((m = INLINE.exec(source))) {
    if (m.index > last) pushText(out, source.slice(last, m.index));
    if (m[2] !== undefined) {
      if (m[0].startsWith("!")) out.push({ t: "text", v: m[1] });
      else out.push({ t: "link", href: m[2], c: parseInline(m[1]) });
    } else if (m[3] !== undefined) out.push({ t: "strong", c: parseInline(m[3]) });
    else if (m[4] !== undefined) out.push({ t: "em", c: parseInline(m[4]) });
    else if (m[5] !== undefined) out.push({ t: "em", c: parseInline(m[5]) });
    else if (m[6] !== undefined) out.push({ t: "code", v: m[6] });
    else out.push({ t: "link", href: m[7], c: [{ t: "text", v: m[7] }] });
    last = m.index + m[0].length;
  }
  if (last < source.length) pushText(out, source.slice(last));
  return out;
}

/** Line breaks inside a paragraph: a bare newline, a trailing backslash or two trailing spaces. */
function pushText(out, text) {
  text.split(/\\\n|\s{2,}\n|\n/).forEach((part, i) => {
    if (i > 0) out.push({ t: "br" });
    if (part) out.push({ t: "text", v: part.replace(/\\([*_`[\]()#>-])/g, "$1") });
  });
}

const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;
const BUTTON = /^\[([^\]]+)\]\(([^)\s]+)\)\{button\}$/;

/** Body text -> block list. */
export function parseBlocks(body) {
  return String(body || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.replace(/^\n+|\s+$/g, ""))
    .filter((b) => b.trim() && !/^#{1,6}\s*$/.test(b.trim()))
    .map((block) => {
      const lines = block.split("\n");
      const heading = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
      if (heading && lines.length === 1) return { type: heading[1].length >= 3 ? "h3" : "h2", c: parseInline(heading[2]) };
      if (heading) return { type: heading[1].length >= 3 ? "h3" : "h2", c: parseInline(heading[2]), rest: lines.slice(1).join("\n") };
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(block.trim())) return { type: "hr" };
      const image = IMAGE.exec(block.trim());
      if (image) return { type: "image", alt: image[1], src: image[2], caption: image[3] || "" };
      const button = BUTTON.exec(block.trim());
      if (button) return { type: "button", label: button[1], href: button[2] };
      if (lines.every((l) => /^>\s?/.test(l))) return { type: "quote", c: parseInline(lines.map((l) => l.replace(/^>\s?/, "")).join("\n")) };
      if (lines.every((l) => /^[-*+]\s+/.test(l))) return { type: "ul", items: lines.map((l) => parseInline(l.replace(/^[-*+]\s+/, ""))) };
      if (lines.every((l) => /^\d+[.)]\s+/.test(l))) return { type: "ol", items: lines.map((l) => parseInline(l.replace(/^\d+[.)]\s+/, ""))) };
      return { type: "p", c: parseInline(block) };
    });
}

/** Plain text of a story: used for word counts and excerpts (no markup, no image or button blocks). */
export function plainText(body) {
  return String(body || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)\{button\}/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,3}\s*/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+|^\d+[.)]\s+/gm, "")
    .replace(/^-{3,}$/gm, " ")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const wordCount = (body) => (plainText(body).match(/\S+/g) || []).length;
