import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FigureView, CtaView } from "./NodeViews";
import { safeUrl } from "../newsMarkdown";

const clean = (s) => String(s || "").replace(/"/g, "'").replace(/[\r\n]+/g, " ");
const attr = (s) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A photo block. Saved as `![caption](url "caption")`. */
export const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: "" }, caption: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "figure[data-figure]",
        getAttrs: (el) => ({
          src: el.querySelector("img")?.getAttribute("src"),
          alt: el.querySelector("img")?.getAttribute("alt") || "",
          caption: el.querySelector("figcaption")?.textContent || "",
        }),
      },
      { tag: "img[src]", getAttrs: (el) => ({ src: el.getAttribute("src"), alt: el.getAttribute("alt") || "", caption: el.getAttribute("title") || "" }) },
    ];
  },
  renderHTML({ node }) {
    return ["figure", { "data-figure": "" }, ["img", { src: node.attrs.src, alt: node.attrs.alt }], ["figcaption", {}, node.attrs.caption || ""]];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const { src, caption, alt } = node.attrs;
          state.write(`![${clean(alt || caption).replace(/[[\]]/g, "")}](${src}${caption ? ` "${clean(caption)}"` : ""})`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

/** A link button. Saved as `[Label](https://…){button}`. */
export const CtaButton = Node.create({
  name: "ctaButton",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { label: { default: "Read more" }, url: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-cta]", getAttrs: (el) => ({ label: el.getAttribute("data-label") || "", url: el.getAttribute("data-url") || "" }) }];
  },
  renderHTML({ node }) {
    return ["div", { "data-cta": "", "data-label": node.attrs.label, "data-url": node.attrs.url }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CtaView);
  },
  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const url = safeUrl(node.attrs.url) || "#";
          state.write(`[${clean(node.attrs.label || "Read more").replace(/[[\]]/g, "")}](${url.replace(/\s/g, "%20")}){button}`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

/** Stored Markdown -> what the editor can load (link buttons become placeholders the CtaButton block understands). */
export function toEditorMarkdown(md) {
  return String(md || "").replace(
    /^\[([^\]]+)\]\(([^)\s]+)\)\{button\}[ \t]*$/gm,
    (_, label, url) => `<div data-cta data-label="${attr(label)}" data-url="${attr(url)}"></div>`
  );
}

/** Editor -> stored Markdown, minus the empty-paragraph placeholders the serializer emits. */
export function tidyMarkdown(md) {
  return String(md || "")
    .replace(/^\s*&nbsp;\s*$/gm, "")
    .replace(/^#{1,3}[ \t]*$/gm, "") // an empty subheading is not content
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
