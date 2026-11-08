/**
 * Admin / Agent → Moderation. One queue for everything people report:
 * group messages, house threads and replies, news comments, programme posts
 * and people. Hide, warn, mute or dismiss; every action is in the audit log.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EyeOff, Loader2, ShieldAlert, VolumeX, Check, ExternalLink } from "lucide-react";
import { PageHeader } from "../components/ui";
import { Pager } from "../components/ui/DataBits";
import { moderationApi, fmtDateTime, timeAgo } from "../lib/gapsApi";
import { appConfirm, appPrompt, notify } from "../lib/dialogs";

const TYPES = [["", "Everything"], ["group_message", "Group messages"], ["house_thread", "House threads"], ["house_reply", "House replies"], ["news_comment", "News comments"], ["feed_post", "Programme posts"], ["user", "People"]];

export default function AdminModeration() {
  const [tab, setTab] = useState("open");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [mutes, setMutes] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => {
    if (tab === "muted") { moderationApi.restrictions(true).then((r) => setMutes(r.items)).catch((e) => notify.error(e.message)); return; }
    setData(null);
    moderationApi.reports({ status: tab, type: type || undefined, page }).then(setData).catch((e) => notify.error(e.message));
  };
  useEffect(() => { moderationApi.summary().then(setSummary).catch(() => {}); }, [tab]);
  useEffect(load, [tab, type, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(r, action) {
    let body = { action };
    if (action === "mute") {
      const days = await appPrompt(`For how many days? They can still read, but can't post, comment or reply. They'll be told why.`, { title: `Mute ${r.author?.name || "this person"}`, multiline: false, defaultValue: "1", placeholder: "1, 3, 7 or 30", confirmLabel: "Next" });
      if (days === null) return;
      const n = Math.max(1, Math.min(30, Number(days) || 1));
      const note = await appPrompt("A short reason they'll see (optional).", { title: "Reason", placeholder: "e.g. Spamming links in the group", confirmLabel: `Mute for ${n} day${n === 1 ? "" : "s"}` });
      if (note === null) return;
      body = { action, days: n, hide: r.targetType !== "user", note: note || null };
    } else if (action === "warn") {
      const note = await appPrompt("They get a notification with this reason. The content is also hidden.", { title: `Warn ${r.author?.name || "the author"}`, placeholder: "e.g. Keep comments respectful", confirmLabel: "Send warning" });
      if (note === null) return;
      body = { action, hide: r.targetType !== "user", note: note || null };
    } else if (action === "hide") {
      if (!(await appConfirm("It's removed for everyone. The author isn't warned.", { title: "Hide this content?", confirmLabel: "Hide" }))) return;
    } else if (action === "dismiss") {
      const note = await appPrompt("Nothing happens to the content. The reporter is told it's within the rules.", { title: "Dismiss report", placeholder: "Note for the team (optional)", confirmLabel: "Dismiss" });
      if (note === null) return;
      body = { action, note: note || null };
    }
    setBusy(r.id);
    try {
      const res = await moderationApi.act(r.id, body);
      notify.success(res.closed > 1 ? `Done. Closed ${res.closed} reports on the same content.` : "Done");
      load();
      moderationApi.summary().then(setSummary).catch(() => {});
    } catch (e) { notify.error(e.message); } finally { setBusy(null); }
  }

  async function lift(m) {
    if (!(await appConfirm(`${m.user?.name || "They"} can post again straight away.`, { title: "Lift mute?", confirmLabel: "Lift" }))) return;
    await moderationApi.lift(m.id).then(load).catch((e) => notify.error(e.message));
  }

  return (
    <div className="ctl space-y-5">
      <PageHeader title="Moderation" description="Reports from study groups, Aspirant Houses, news comments and programme posts. Act once and every report on the same content closes." />
      {summary && (
        <div className="prog-strip">
          <div><dt>Waiting</dt><dd className="num">{summary.open}</dd></div>
          <div><dt>Reported today</dt><dd className="num">{summary.today}</dd></div>
          <div><dt>Muted now</dt><dd className="num">{summary.muted}</dd></div>
          {summary.byReason.slice(0, 3).map((r) => <div key={r.reason}><dt>{r.label}</dt><dd className="num">{r.count}</dd></div>)}
        </div>
      )}
      <div className="ctl-tabs">
        {[["open", "Waiting"], ["actioned", "Acted on"], ["dismissed", "Dismissed"], ["muted", "Muted people"]].map(([k, l]) => <button type="button" key={k} className={tab === k ? "is-on" : ""} onClick={() => { setTab(k); setPage(1); }}>{l}</button>)}
      </div>

      {tab === "muted" ? (
        <section className="ctl-panel !p-0">
          {!mutes ? <p className="px-4 py-4 text-sm text-text-muted">Loading…</p> : !mutes.length ? <p className="px-4 py-4 text-sm text-text-secondary">Nobody is muted.</p> : (
            <table className="ctl-table">
              <thead><tr><th>Person</th><th>Reason</th><th className="w-40">Until</th><th className="w-32">By</th><th className="w-24" /></tr></thead>
              <tbody>{mutes.map((m) => (
                <tr key={m.id}>
                  <td>{m.user?.name || m.user?.email}<span className="block text-xs text-text-muted">{m.user?.uniqueId}</span></td>
                  <td title={m.reason}>{m.reason || "—"}</td>
                  <td className="text-xs">{fmtDateTime(m.until)}</td>
                  <td className="text-xs">{m.createdByName}</td>
                  <td><button type="button" className="ctl-btn is-ghost !py-1" onClick={() => lift(m)}>Lift</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      ) : (
        <>
          <select className="ctl-input !w-56" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          {!data ? <p className="ctl-panel text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading…</p> : !data.items.length ? (
            <div className="ctl-panel text-sm text-text-secondary">{tab === "open" ? "Nothing waiting. The queue is clear." : "Nothing here."}</div>
          ) : (
            <div className="space-y-3">
              {data.items.map((r) => (
                <article key={r.id} className="ctl-panel space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <span className="ctl-status is-removed">{r.reasonLabel}</span>
                    <span className="font-semibold text-text-primary">{r.typeLabel}</span>
                    {r.snapshot?.where && <span>in {r.snapshot.where}</span>}
                    <span>· reported {timeAgo(r.createdAt)}</span>
                    {r.sameTargetReports > 1 && <span className="ctl-tag">{r.sameTargetReports} reports</span>}
                    {r.contextUrl && <Link to={r.contextUrl} target="_blank" className="ml-auto inline-flex items-center gap-1 hover:underline">Open <ExternalLink size={11} /></Link>}
                  </div>
                  <blockquote className="mod-quote">
                    {r.snapshot?.title && <p className="font-semibold">{r.snapshot.title}</p>}
                    <p className="whitespace-pre-wrap break-words">{r.snapshot?.text || (r.snapshot?.attachmentName ? `Attachment: ${r.snapshot.attachmentName}` : "(no text)")}</p>
                    {(r.snapshot?.imageUrl || (r.snapshot?.attachmentUrl && /\.(png|jpe?g|webp|gif)/i.test(r.snapshot.attachmentUrl))) && <img src={r.snapshot.imageUrl || r.snapshot.attachmentUrl} alt="" className="mt-2 max-h-48 border border-border-subtle" />}
                  </blockquote>
                  <p className="text-sm text-text-secondary">
                    By <b className="text-text-primary">{r.author?.name || r.snapshot?.author || "unknown"}</b>
                    {r.author?.uniqueId ? ` (${r.author.uniqueId})` : ""}
                    {r.authorPriorActions ? <span className="text-status-danger"> · {r.authorPriorActions} earlier warning{r.authorPriorActions === 1 ? "" : "s"}/mute{r.authorPriorActions === 1 ? "" : "s"}</span> : null}
                    {r.author?.mutedUntil && new Date(r.author.mutedUntil) > new Date() ? " · muted now" : ""}
                    {" · "}reported by {r.reporter?.name || "someone"}{r.note ? `: “${r.note}”` : ""}
                  </p>
                  {tab === "open" ? (
                    <div className="flex flex-wrap gap-2">
                      {r.targetType !== "user" && <button type="button" className="ctl-btn is-ghost" disabled={busy === r.id} onClick={() => act(r, "hide")}><EyeOff size={14} /> Hide</button>}
                      <button type="button" className="ctl-btn is-ghost" disabled={busy === r.id || !r.author} onClick={() => act(r, "warn")}><ShieldAlert size={14} /> {r.targetType === "user" ? "Warn" : "Hide + warn"}</button>
                      <button type="button" className="ctl-btn is-ghost" disabled={busy === r.id || !r.author} onClick={() => act(r, "mute")}><VolumeX size={14} /> {r.targetType === "user" ? "Mute" : "Hide + mute"}</button>
                      <button type="button" className="ctl-btn is-ghost" disabled={busy === r.id} onClick={() => act(r, "dismiss")}><Check size={14} /> Dismiss</button>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">{r.action === "dismiss" ? "Dismissed" : `Action: ${r.action}`} by {r.handledByName} · {fmtDateTime(r.handledAt)}{r.actionNote ? ` · ${r.actionNote}` : ""}</p>
                  )}
                </article>
              ))}
              <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
