import { linkifyText } from "../../lib/linkifyText";

/**
 * Board text may mark words for emphasis with **double asterisks**.
 * The text is split into plain strings and <strong> elements, so nothing in it is ever
 * read as HTML. An unmatched ** is left as typed.
 */
export function BoldText({ text }) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*\n]+?\*\*)/g);
  return parts.map((part, i) => (/^\*\*[^*\n]+?\*\*$/.test(part)
    ? <strong key={i} className="font-[640]">{linkifyText(part.slice(2, -2), `bold-${i}`)}</strong>
    : linkifyText(part, `text-${i}`)));
}

/** The same text with the markers removed, for lists, alt text and aria labels. */
export const plainText = (text) => String(text || "").replace(/\*\*([^*\n]+?)\*\*/g, "$1");
