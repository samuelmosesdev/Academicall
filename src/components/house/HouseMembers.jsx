import { useCallback, useEffect, useState } from "react";
import { AtSign, Loader2, Mail, MessageCircle, Phone, RotateCcw, UserMinus, Users, VolumeX } from "lucide-react";
import { housesApi, institutionTitle } from "../../lib/aspirantApi";
import { timeAgo } from "../../lib/newsApi";
import { appPrompt, appConfirm, notify } from "../../lib/dialogs";
import { Pager, SearchField } from "../ui";
import { Avatar } from "./Mentions";

const TABS = [["", "Members"], ["muted", "Muted"], ["removed", "Removed"]];

/** House Leaders manage members: search, see choices and UTME details, mute, remove, restore, mention. */
export default function HouseMembers({ houseId, onMention }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try { setData(await housesApi.members(houseId, { q, status, page, pageSize: 25 })); } catch (e) { setErr(e.message); }
  }, [houseId, q, status, page]);
  useEffect(() => { load(); }, [load]);

  async function change(m, next) {
    let reason = null;
    if (next === "muted" || next === "removed") {
      reason = await appPrompt(next === "muted" ? `Mute ${m.name}? They can still read but not reply. Add a reason (optional):` : `Remove ${m.name} from the house? Add a reason (optional):`, { placeholder: "e.g. Posting spam links", confirmLabel: next === "muted" ? "Mute" : "Remove" });
      if (reason === null) return;
    } else if (!(await appConfirm(`Restore ${m.name} as a full member?`, { confirmLabel: "Restore" }))) return;
    setBusy(m.userId);
    try { await housesApi.setMember(houseId, m.userId, next, reason || null); notify.success(next === "active" ? "Restored" : next === "muted" ? "Muted" : "Removed from the house"); load(); }
    catch (e) { notify.error(e.message); }
    finally { setBusy(""); }
  }

  const counts = data?.counts || {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setStatus(id); setPage(1); }} className={`news-cat ${status === id ? "on" : ""}`}>
            {label} <span className="ml-1 opacity-60">{(id ? counts[id] : (counts.active || 0) + (counts.muted || 0)) || 0}</span>
          </button>
        ))}
        <SearchField value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name or email" className="ml-auto w-full sm:w-64" />
      </div>
      {err && <p className="rounded-2xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{err}</p>}
      {!data && !err && <div className="flex items-center gap-2 py-8 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Loading members…</div>}
      {data && data.members.length === 0 && (
        <div className="rounded-[1.4rem] border border-dashed border-border-strong bg-bg-panel px-6 py-12 text-center">
          <Users className="mx-auto text-text-muted" />
          <p className="mt-2 text-sm text-text-secondary">{q ? `No one matches “${q}”.` : status ? `No ${status} members.` : "No members yet. Aspirants join when they pick this institution."}</p>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {data?.members.map((m) => (
          <div key={m.userId} className={`house-member ${m.status !== "active" ? "is-dim" : ""}`}>
            <div className="flex items-start gap-3">
              <Avatar person={m} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-semibold text-text-primary">{m.name}</p>
                  <span className={`acx-chip-sm ${m.choiceRank === 1 ? "is-lemon" : ""}`}>{m.choiceRank === 1 ? "1st choice" : m.choiceRank === 2 ? "2nd choice" : "Former choice"}</span>
                  {m.status === "muted" && <span className="acx-chip-sm is-danger">Muted</span>}
                  {m.status === "removed" && <span className="acx-chip-sm is-danger">Removed</span>}
                </div>
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
                  {m.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {m.email}</span>}
                  {m.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {m.phone}</span>}
                </p>
                <div className="mt-2 space-y-1 text-[0.8rem] text-text-secondary">
                  {(m.choices || []).map((c) => (
                    <p key={c.rank} className="truncate"><span className="font-semibold text-text-primary">{c.rank === 1 ? "1st" : "2nd"}:</span> {c.course ? `${c.course} · ` : ""}{institutionTitle(c.institution)}</p>
                  ))}
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-text-muted">
                  {m.meta?.utmeScore != null && <span>UTME {m.meta.utmeScore}{m.meta.utmeYear ? ` (${m.meta.utmeYear})` : ""}</span>}
                  {m.meta?.stateOfOrigin && <span>{m.meta.stateOfOrigin}</span>}
                  <span className="inline-flex items-center gap-1"><MessageCircle size={10} /> {m.replies} replies</span>
                  <span>Joined {timeAgo(m.joinedAt)}</span>
                </p>
                {m.reason && m.status !== "active" && <p className="mt-1.5 text-[11px] italic text-text-muted">Reason: {m.reason}</p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border-subtle pt-3">
              {m.status !== "removed" && onMention && <button type="button" className="acx-btn-ghost !py-1.5 !text-xs" onClick={() => onMention(m)}><AtSign size={12} /> Mention</button>}
              {m.status === "active" && <button type="button" disabled={busy === m.userId} className="acx-btn-ghost !py-1.5 !text-xs" onClick={() => change(m, "muted")}><VolumeX size={12} /> Mute</button>}
              {m.status !== "active" && <button type="button" disabled={busy === m.userId} className="acx-btn-ghost !py-1.5 !text-xs" onClick={() => change(m, "active")}><RotateCcw size={12} /> Restore</button>}
              {m.status !== "removed" && <button type="button" disabled={busy === m.userId} className="acx-btn-ghost !py-1.5 !text-xs hover:!border-status-danger hover:!text-status-danger" onClick={() => change(m, "removed")}><UserMinus size={12} /> Remove</button>}
            </div>
          </div>
        ))}
      </div>
      {data && data.total > data.pageSize && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </div>
  );
}
