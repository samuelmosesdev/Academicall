import { useEffect } from "react";

const DEFAULT_TITLE = "Academicall — your semester, in one place";

/**
 * Keeps the tab title, description and canonical link in step with the page
 * a person is reading. (Link previews in WhatsApp etc. come from the server,
 * since those apps don't run JavaScript.)
 */
export function usePageMeta({ title, description, canonical } = {}) {
  useEffect(() => {
    if (!title) return undefined;
    const prev = document.title;
    document.title = title;
    const set = (selector, attr, value) => {
      if (!value) return null;
      const el = document.head.querySelector(selector);
      if (!el) return null;
      const old = el.getAttribute(attr);
      el.setAttribute(attr, value);
      return () => el.setAttribute(attr, old);
    };
    const undo = [
      set('meta[name="description"]', "content", description),
      set('link[rel="canonical"]', "href", canonical),
      set('meta[property="og:title"]', "content", title),
      set('meta[property="og:description"]', "content", description),
      set('meta[property="og:url"]', "content", canonical),
    ].filter(Boolean);
    return () => { document.title = prev || DEFAULT_TITLE; undo.forEach((u) => u()); };
  }, [title, description, canonical]);
}
