/**
 * "Shared" on the Library page: files and folders people sent you (accept or
 * decline), and what you've sent (with whether it was added).
 */
import { useState } from "react";
import { Check, Folder, FileText, Inbox, Loader2, Send, Undo2, X } from "lucide-react";
import { PersonAvatar } from "./ShareMaterialModal";

const when = (d) => {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
};
const contents = (s) => {
  if (s.kind !== "folder") return "File";
  const parts = [`${s.fileCount} file${s.fileCount === 1 ? "" : "s"}`];
  if (s.folderCount) parts.push(`${s.folderCount} folder${s.folderCount === 1 ? "" : "s"}`);
  return `Folder · ${parts.join(", ")}`;
};
const STATUS = { pending: "Waiting", accepted: "Added", declined: "Declined", cancelled: "Taken back" };

export default function SharedMaterials({ data, error, box, setBox, onAccept, onDecline, onCancel, onOpen }) {
  const [busy, setBusy] = useState(null);
  const act = async (id, fn) => { setBusy(id); try { await fn(); } finally { setBusy(null); } };
  const incoming = data?.incoming || [];
  const sent = data?.sent || [];
  const pending = incoming.filter((s) => s.status === "pending").length;

  return (
    <div className="ms-shared">
      <div className="mm-seg ms-tabs" role="tablist" aria-label="Shared with you">
        <button type="button" role="tab" aria-selected={box !== "sent"} className={box !== "sent" ? "on" : ""} onClick={() => setBox("in")}>Received{pending > 0 && <b>{pending}</b>}</button>
        <button type="button" role="tab" aria-selected={box === "sent"} className={box === "sent" ? "on" : ""} onClick={() => setBox("sent")}>Sent</button>
      </div>

      {error && <p className="mm-note mm-note--err mt-4">{error}</p>}
      {!data && !error && <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="mm-skel h-20" />)}</div>}

      {data && box !== "sent" && (incoming.length === 0 ? (
        <div className="ms-empty"><Inbox size={22} aria-hidden="true" /><p className="font-semibold text-ink">Nothing shared with you yet</p><p className="text-xs text-ink-muted">When a classmate sends you a file or folder, it waits here until you add it.</p></div>
      ) : (
        <ul className="ms-list">
          {incoming.map((s) => {
            const Icon = s.kind === "folder" ? Folder : FileText;
            return (
              <li key={s.id} className={`ms-row ${s.status === "pending" ? "is-new" : ""}`}>
                <PersonAvatar person={s.sender} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink"><b className="font-semibold">{s.sender?.name || "Someone"}</b> <span className="text-ink-muted">shared a {s.kind === "folder" ? "folder" : "file"} · {when(s.createdAt)}</span></p>
                  <p className="ms-title"><Icon size={14} aria-hidden="true" /><span className="truncate">{s.title}</span></p>
                  <p className="text-xs text-ink-muted">{contents(s)}</p>
                  {s.comment && <p className="ms-comment">{s.comment}</p>}
                </div>
                <div className="ms-actions">
                  {s.status === "pending" ? (
                    <>
                      <button type="button" className="mm-btn mm-btn--line" disabled={busy === s.id} onClick={() => act(s.id, () => onDecline(s))}><X size={14} /> Decline</button>
                      <button type="button" className="mm-btn mm-btn--ink" disabled={busy === s.id} onClick={() => act(s.id, () => onAccept(s))}>{busy === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Add to mine</button>
                    </>
                  ) : (
                    <button type="button" className="ms-open" onClick={() => onOpen(s)}>Added · open</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ))}

      {data && box === "sent" && (sent.length === 0 ? (
        <div className="ms-empty"><Send size={20} aria-hidden="true" /><p className="font-semibold text-ink">You haven't shared anything</p><p className="text-xs text-ink-muted">Open the menu on any file or folder and choose “Share…”.</p></div>
      ) : (
        <ul className="ms-list">
          {sent.map((s) => {
            const Icon = s.kind === "folder" ? Folder : FileText;
            return (
              <li key={s.id} className="ms-row">
                <PersonAvatar person={s.recipient} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink"><span className="text-ink-muted">To</span> <b className="font-semibold">{s.recipient?.name || "Someone"}</b> <span className="text-ink-muted">· {when(s.createdAt)}</span></p>
                  <p className="ms-title"><Icon size={14} aria-hidden="true" /><span className="truncate">{s.title}</span></p>
                  {s.comment && <p className="ms-comment">{s.comment}</p>}
                </div>
                <div className="ms-actions">
                  <span className={`ms-status is-${s.status}`}>{STATUS[s.status] || s.status}</span>
                  {s.status === "pending" && <button type="button" className="ms-open" disabled={busy === s.id} onClick={() => act(s.id, () => onCancel(s))}><Undo2 size={13} /> Take back</button>}
                </div>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}
