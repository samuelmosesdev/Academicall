import { useEffect, useRef, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { notify } from "../lib/dialogs";

/**
 * Share a public page. Uses the phone's share sheet when there is one,
 * otherwise a small menu of the apps people actually use here.
 * The preview card those apps show comes from the server (functions/ogPage.js).
 */
const TARGETS = [
  { id: "whatsapp", label: "WhatsApp", href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { id: "x", label: "X", href: (u, t) => `https://x.com/intent/post?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { id: "facebook", label: "Facebook", href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { id: "linkedin", label: "LinkedIn", href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
  { id: "telegram", label: "Telegram", href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
];

export default function ShareMenu({ url, title, text, className = "", label = "Share" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  const link = url || window.location.href;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function onClick() {
    if (navigator.share && window.matchMedia?.("(pointer: coarse)").matches) {
      try { await navigator.share({ title, text: text || title, url: link }); } catch { /* dismissed */ }
      return;
    }
    setOpen((v) => !v);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); notify.success("Link copied"); setTimeout(() => setCopied(false), 1800); } catch { notify.info(link, { title: "Copy this link" }); }
  }

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-ink" aria-haspopup="menu" aria-expanded={open}>
        <Share2 size={13} /> {label}
      </button>
      {open && (
        <span role="menu" className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-border-subtle bg-bg-panel p-1.5 text-sm shadow-[var(--shadow-pop)]">
          {TARGETS.map((t) => (
            <a key={t.id} role="menuitem" href={t.href(link, title || "")} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-text-primary hover:bg-bg-hover">{t.label}</a>
          ))}
          <button type="button" role="menuitem" onClick={copy} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-text-primary hover:bg-bg-hover">
            {copied ? <Check size={14} /> : <Copy size={14} />} Copy link
          </button>
        </span>
      )}
    </span>
  );
}
