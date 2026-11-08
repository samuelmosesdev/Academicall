/**
 * Share a file or folder from My materials with someone, by their Unique ID.
 * Looks the person up first (name and picture only, never their email) so the
 * sender can check it's the right classmate before anything is sent.
 */
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Folder, FileText, Loader2, Send, X } from "lucide-react";
import { materialSharesApi } from "../../lib/myMaterialsApi";

const clean = (s) => s.toUpperCase().replace(/\s+/g, "");

export function PersonAvatar({ person, size = 40 }) {
  const initial = (person?.name || "?").trim().charAt(0).toUpperCase();
  return person?.avatarUrl
    ? <img src={person.avatarUrl} alt="" className="ms-avatar" style={{ width: size, height: size }} loading="lazy" />
    : <span className="ms-avatar ms-avatar--blank" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">{initial}</span>;
}

/**
 * item: { itemType: "upload"|"save"|"folder", itemId, title, meta? }
 * onPremium: called when the server says sending needs Pro.
 */
export default function ShareMaterialModal({ item, onClose, onSent, onPremium }) {
  const [uid, setUid] = useState("");
  const [person, setPerson] = useState(null);
  const [lookup, setLookup] = useState({ busy: false, error: "" });
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);
  const isFolder = item.itemType === "folder";

  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  // Look the person up shortly after they stop typing.
  useEffect(() => {
    const id = clean(uid);
    setPerson(null);
    setError("");
    if (id.length < 5) { setLookup({ busy: false, error: "" }); return undefined; }
    const mine = ++seq.current;
    setLookup({ busy: true, error: "" });
    const t = setTimeout(async () => {
      try {
        const r = await materialSharesApi.lookup(id);
        if (mine === seq.current) { setPerson(r.recipient); setLookup({ busy: false, error: "" }); }
      } catch (e) {
        if (mine !== seq.current) return;
        if (e.status === 402) { onPremium?.(); return; }
        setLookup({ busy: false, error: e.message || "Couldn't check that ID." });
      }
    }, 450);
    return () => clearTimeout(t);
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e.preventDefault();
    if (!person || sending) return;
    setSending(true);
    setError("");
    try {
      await materialSharesApi.send({ uniqueId: clean(uid), itemType: item.itemType, itemId: item.itemId, comment: comment.trim() || null });
      onSent?.(person);
    } catch (err) {
      if (err.status === 402) onPremium?.();
      else setError(err.message || "That didn't send. Try again.");
    } finally { setSending(false); }
  }

  const Icon = isFolder ? Folder : FileText;
  return (
    <div className="mm-modal" role="dialog" aria-modal="true" aria-label={`Share ${item.title}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="mm-modal__card" onSubmit={send}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Share {isFolder ? "folder" : "file"}</h2>
          <button type="button" className="mm-icon mm-icon--soft" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>

        <p className="ms-item mt-3"><Icon size={15} aria-hidden="true" /><span className="truncate">{item.title}</span>{item.meta && <em>{item.meta}</em>}</p>

        <label className="mt-5 block text-xs font-medium text-ink" htmlFor="ms-uid">Their Unique ID</label>
        <input
          id="ms-uid" autoFocus className="mm-input ms-uid mt-1" value={uid} maxLength={40} autoComplete="off" spellCheck={false}
          onChange={(e) => setUid(e.target.value.toUpperCase())} placeholder="e.g. UAR-24-8831" aria-describedby="ms-uid-help"
        />
        <div id="ms-uid-help" className="ms-who" aria-live="polite">
          {lookup.busy && <span className="text-xs text-ink-muted"><Loader2 size={13} className="mr-1 inline animate-spin" />Checking…</span>}
          {!lookup.busy && lookup.error && <span className="ms-err"><AlertCircle size={13} /> {lookup.error}</span>}
          {!lookup.busy && person && (
            <div className="ms-person">
              <PersonAvatar person={person} size={36} />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{person.name}</span><span className="block font-mono text-[0.7rem] text-ink-muted">{person.uniqueId}</span></span>
            </div>
          )}
          {!lookup.busy && !lookup.error && !person && <span className="text-xs text-ink-muted">Ask them for it. It’s on their profile page.</span>}
        </div>

        <label className="mt-4 block text-xs font-medium text-ink" htmlFor="ms-note">Note <span className="font-normal text-ink-muted">(optional)</span></label>
        <textarea id="ms-note" className="mm-input mt-1 min-h-[5rem] resize-y" value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} placeholder={isFolder ? "e.g. Everything from this semester's lectures" : "e.g. Chapter 4 is what she said to focus on"} />

        {error && <p className="ms-err mt-3"><AlertCircle size={13} /> {error}</p>}
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">{person ? `${person.name} gets` : "They get"} a notification and can add {isFolder ? "a copy of the folder" : "a copy"} to their Library. Your own {isFolder ? "folder stays" : "file stays"} as it is.</p>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="mm-btn mm-btn--line" onClick={onClose}>Cancel</button>
          <button type="submit" className="mm-btn mm-btn--ink" disabled={!person || sending}>{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send</button>
        </div>
      </form>
    </div>
  );
}
