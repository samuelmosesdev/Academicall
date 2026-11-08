/**
 * Report and block, available anywhere people post.
 *
 *   reportContent({ targetType, targetId, what })   → opens the report sheet
 *   blockPerson({ id, name })                       → confirm, block, update every list
 *   useBlockedIds()                                 → Set of people you've blocked (hide their posts)
 *
 * <SafetyHost /> is mounted once (App.jsx) and renders the report sheet.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { reportsApi, meApi } from "../../lib/gapsApi";
import { appConfirm, notify } from "../../lib/dialogs";

export const REPORT_REASONS = [
  ["spam", "Spam or scam"],
  ["abuse", "Insults or hate"],
  ["harassment", "Bullying or harassment"],
  ["sexual", "Sexual content"],
  ["violence", "Threats or violence"],
  ["false_info", "False information"],
  ["cheating", "Exam leaks or cheating"],
  ["other", "Something else"],
];

// ── blocked people (shared store) ───────────────────────────────────────────
let blocked = new Set();
let loaded = false;
const subs = new Set();
const emit = () => subs.forEach((f) => f());
function ensureLoaded() {
  if (loaded || !localStorage.getItem("academicall_token")) return;
  loaded = true;
  meApi.blocks().then((r) => { blocked = new Set(r.ids || []); emit(); }).catch(() => { loaded = false; });
}
export function useBlockedIds() {
  useEffect(ensureLoaded, []);
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => blocked);
}
export async function blockPerson(person) {
  const name = person?.name || "this person";
  const ok = await appConfirm(`You won't see ${name}'s messages, replies or comments, and they won't be told. You can unblock them in Settings → Privacy.`, { title: `Block ${name}?`, confirmLabel: "Block", tone: "danger" });
  if (!ok) return false;
  try {
    await meApi.block(person.id);
    blocked = new Set([...blocked, person.id]);
    emit();
    notify.success(`${name} is blocked`);
    return true;
  } catch (e) {
    notify.error(e.message);
    return false;
  }
}
export async function unblockPerson(person) {
  await meApi.unblock(person.id);
  blocked = new Set([...blocked].filter((x) => x !== person.id));
  emit();
}

// ── report sheet ────────────────────────────────────────────────────────────
const EVT = "ac:report";
export function reportContent(target) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: target }));
}

export function SafetyHost() {
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const open = (e) => { setTarget(e.detail); setReason(""); setNote(""); };
    window.addEventListener(EVT, open);
    return () => window.removeEventListener(EVT, open);
  }, []);
  if (!target) return null;

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await reportsApi.create({ targetType: target.targetType, targetId: target.targetId, reason, note: note.trim() || null });
      notify.success("Report sent. Staff will look at it.");
      setTarget(null);
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => !busy && setTarget(null)}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={send} role="dialog" aria-label="Report">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Report {target.what || "this"}</h2>
            <p className="text-sm text-text-secondary">Staff see what you report and who wrote it. The person isn't told who reported them.</p>
          </div>
          <button type="button" className="ctl-icon" onClick={() => setTarget(null)} aria-label="Close"><X size={15} /></button>
        </div>
        <fieldset className="sheet-reasons">
          <legend className="sr-only">Reason</legend>
          {REPORT_REASONS.map(([k, label]) => (
            <label key={k} className={reason === k ? "is-on" : ""}>
              <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} />
              {label}
            </label>
          ))}
        </fieldset>
        <textarea className="ctl-input" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's wrong? (optional)" />
        <div className="flex justify-end gap-2">
          <button type="button" className="ctl-btn is-ghost" onClick={() => setTarget(null)} disabled={busy}>Cancel</button>
          <button type="submit" className="ctl-btn" disabled={!reason || busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />} Send report</button>
        </div>
      </form>
    </div>
  );
}

/** A small flag button for places without a menu (comments, replies). */
export function ReportButton({ targetType, targetId, what, className = "" }) {
  return (
    <button type="button" className={`report-btn ${className}`} onClick={() => reportContent({ targetType, targetId, what })} aria-label={`Report ${what || ""}`} title="Report">
      <Flag size={12} />
    </button>
  );
}
