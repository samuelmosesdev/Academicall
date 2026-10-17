import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, Check, Crown, Eye, EyeOff, Loader2, Pencil, RotateCcw, Search, ShieldAlert, ShieldCheck, Trash2, Undo2, UserMinus } from "lucide-react";
import { chiefApi, timeAgo } from "../../lib/newsApi";
import { appConfirm, appPrompt, notify } from "../../lib/dialogs";
import { Prose } from "./NewsBits";

const STATUS_STYLE = { published: "bg-aqua-soft text-aqua-deep", review: "bg-lemon-soft text-[#6b6800]", hidden: "bg-status-danger/10 text-status-danger", draft: "bg-bg-elevated text-ink-muted" };
const STATUS_LABEL = { published: "published", review: "awaiting approval", hidden: "taken down", draft: "draft" };

async function moderate(post, action, onDone) {
  let note = null;
  if (action === "reject" || action === "hide") {
    note = await appPrompt(action === "reject" ? "Send it back to the writer. What should they fix?" : "Take this story down. Why? (the writer sees this)", { placeholder: "e.g. Please confirm the date with the registry", confirmLabel: action === "reject" ? "Send back" : "Take down" });
    if (note === null) return;
  } else if (action === "unpublish" && !(await appConfirm("Unpublish this story? It goes back to the writer's drafts.", { confirmLabel: "Unpublish" }))) return;
  try {
    const r = await chiefApi.moderate(post.id, action, note || null);
    notify.success({ approve: "Approved and published", reject: "Sent back to the writer", hide: "Taken down", restore: "Restored", unpublish: "Unpublished" }[action]);
    onDone?.(r.post);
  } catch (e) { notify.error(e.message); }
}
async function destroy(post, onDone) {
  const reason = await appPrompt(`Delete “${post.title}” permanently? Comments and reactions go too. Reason for the writer (optional):`, { confirmLabel: "Delete story", tone: "danger" });
  if (reason === null) return;
  try { await chiefApi.remove(post.id, reason || null); notify.success("Story deleted"); onDone?.(); } catch (e) { notify.error(e.message); }
}

/** Stories restricted writers sent for approval. */
export function ChiefReview({ onEdit }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => chiefApi.overview().then(setData).catch((e) => notify.error(e.message)), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <div className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  const c = data.counts || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Awaiting approval", c.review || 0, "is-lemon"], ["Published", c.published || 0, ""], ["Taken down", c.hidden || 0, ""], ["News Agents", `${data.agents}`, "is-ink"]].map(([k, v, cls]) => (
          <div key={k} className={`acx-stat ${cls}`}><p className={`acx-stat-n ${cls === "is-ink" ? "text-white" : ""}`}>{v}</p><p className={`acx-stat-l ${cls === "is-ink" ? "text-white" : ""}`}>{k}</p>{k === "News Agents" && <p className="acx-stat-h text-white/60">{data.restricted} restricted · {data.suspended} suspended</p>}</div>
        ))}
      </div>
      {data.review.length === 0 && <p className="rounded-3xl border border-dashed border-border-strong bg-card-light px-6 py-12 text-center text-sm text-ink-muted">Nothing waiting. Stories from restricted writers land here before they go live.</p>}
      <div className="space-y-3">
        {data.review.map((p) => (
          <div key={p.id} className="rounded-3xl border border-border-light bg-card-light p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted"><span className="font-semibold text-ink">{p.author?.name}</span><span>· {p.category} · sent {timeAgo(p.updatedAt)}</span></div>
            <p className="mt-1.5 font-display text-xl leading-snug text-ink">{p.title}</p>
            {p.excerpt && <p className="mt-1 text-sm text-text-secondary">{p.excerpt}</p>}
            {open === p.id && <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-2xl bg-paper p-4"><Prose body={p.body} /></div>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="acx-btn" onClick={() => moderate(p, "approve", load)}><Check size={14} /> Approve & publish</button>
              <button type="button" className="acx-btn-ghost" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? <><EyeOff size={13} /> Hide story</> : <><Eye size={13} /> Read story</>}</button>
              <button type="button" className="acx-btn-ghost" onClick={() => onEdit(p)}><Pencil size={13} /> Edit</button>
              <button type="button" className="acx-btn-ghost" onClick={() => moderate(p, "reject", load)}><Undo2 size={13} /> Send back</button>
              <button type="button" className="acx-btn-ghost hover:!border-status-danger hover:!text-status-danger" onClick={() => destroy(p, load)}><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
/** Every story from every News Agent. */
export function ChiefNewsroom({ onEdit }) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const load = useCallback(() => chiefApi.posts({ status, q: term, page }).then(setData).catch((e) => notify.error(e.message)), [status, term, page]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[["", "All"], ["published", "Published"], ["review", "Awaiting approval"], ["draft", "Drafts"], ["hidden", "Taken down"]].map(([id, l]) => <button key={id} type="button" onClick={() => { setStatus(id); setPage(1); }} className={`news-cat ${status === id ? "on" : ""}`}>{l}</button>)}
        <label className="ml-auto flex w-full items-center gap-2 rounded-full border border-border-light bg-card-light px-4 py-2 sm:w-64"><Search size={14} className="text-ink-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Headline or writer" className="w-full bg-transparent text-sm outline-none" /></label>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border-light bg-card-light">
        {!data && <div className="flex items-center gap-2 p-6 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>}
        {data && !data.posts.length && <p className="p-8 text-center text-sm text-ink-muted">No stories match.</p>}
        {data?.posts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-border-light px-4 py-3.5 last:border-0 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wider ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                <span className="text-xs text-ink-muted">{p.author?.name} · {p.category} · {timeAgo(p.publishedAt || p.updatedAt)}</span>
              </div>
              <p className="mt-1 truncate font-medium text-ink">{p.title}</p>
              {p.moderationNote && <p className="truncate text-xs text-ink-muted">Note: {p.moderationNote}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.status === "published" && <Link to={`/news/${p.slug}`} className="acx-icon-btn" title="View"><Eye size={14} /></Link>}
              <button type="button" className="acx-icon-btn" title="Edit" onClick={() => onEdit(p)}><Pencil size={14} /></button>
              {p.status === "review" && <button type="button" className="acx-icon-btn is-good" title="Approve" onClick={() => moderate(p, "approve", load)}><Check size={14} /></button>}
              {p.status === "published" && <button type="button" className="acx-icon-btn" title="Unpublish" onClick={() => moderate(p, "unpublish", load)}><Undo2 size={14} /></button>}
              {p.status !== "hidden" && <button type="button" className="acx-icon-btn is-danger" title="Take down" onClick={() => moderate(p, "hide", load)}><EyeOff size={14} /></button>}
              {p.status === "hidden" && <button type="button" className="acx-icon-btn is-good" title="Restore" onClick={() => moderate(p, "restore", load)}><RotateCcw size={14} /></button>}
              <button type="button" className="acx-icon-btn is-danger" title="Delete" onClick={() => destroy(p, load)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>Page {data.page} of {Math.ceil(data.total / data.pageSize)}</span>
          <div className="flex gap-2"><button type="button" className="acx-btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button type="button" className="acx-btn-ghost" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</button></div>
        </div>
      )}
    </div>
  );
}

/** Every News Agent: standing, output, and the controls to restrict, suspend or remove. */
export function ChiefTeam() {
  const [agents, setAgents] = useState(null);
  const load = useCallback(() => chiefApi.agents().then((r) => setAgents(r.agents)).catch((e) => notify.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function standing(a, newsStatus) {
    let reason = null;
    if (newsStatus !== "active") {
      reason = await appPrompt(newsStatus === "restricted" ? `Restrict ${a.name}? Their stories will need your approval. Reason (they see it):` : `Suspend ${a.name}? They can't write or publish. Reason (they see it):`, { confirmLabel: newsStatus === "restricted" ? "Restrict" : "Suspend", tone: newsStatus === "suspended" ? "danger" : undefined });
      if (reason === null) return;
    }
    try { await chiefApi.setAgent(a.id, newsStatus, reason || null); notify.success(newsStatus === "active" ? "Full access restored" : newsStatus === "restricted" ? "Restricted: approval required" : "Suspended"); load(); }
    catch (e) { notify.error(e.message); }
  }
  async function removeDuty(a) {
    if (!(await appConfirm(`Remove ${a.name} from the news team? Their published stories stay up.`, { tone: "danger", confirmLabel: "Remove from team" }))) return;
    try { await chiefApi.removeDuty(a.id); notify.success("Removed from the news team"); load(); } catch (e) { notify.error(e.message); }
  }

  if (!agents) return <div className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">Admins and Alpha Agents add new News Agents from Staff access. You manage how each one works here.</p>
      {agents.length === 0 && <p className="rounded-3xl border border-dashed border-border-strong bg-card-light px-6 py-12 text-center text-sm text-ink-muted">No News Agents yet.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {agents.map((a) => (
          <div key={a.id} className="rounded-3xl border border-border-light bg-card-light p-4">
            <div className="flex items-start gap-3">
              {a.photoUrl ? <img src={a.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-soft font-semibold text-violet">{(a.name || "?")[0]}</span>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-semibold text-ink">{a.name}</p>
                  {a.chief && <span className="acx-chip-sm is-lemon"><Crown size={10} /> Chief</span>}
                  {a.newsStatus === "restricted" && <span className="acx-chip-sm is-lemon"><ShieldAlert size={10} /> Needs approval</span>}
                  {a.newsStatus === "suspended" && <span className="acx-chip-sm is-danger"><Ban size={10} /> Suspended</span>}
                  {a.newsStatus === "active" && !a.chief && <span className="acx-chip-sm is-aqua"><ShieldCheck size={10} /> Active</span>}
                </div>
                <p className="text-xs text-ink-muted">{a.email}</p>
                <p className="mt-1.5 text-xs text-ink-muted">{a.posts.published || 0} published · {a.posts.draft || 0} drafts · {a.posts.review || 0} waiting · {a.posts.hidden || 0} taken down{a.lastPublishedAt ? ` · last ${timeAgo(a.lastPublishedAt)}` : ""}</p>
                {a.newsStatusReason && a.newsStatus !== "active" && <p className="mt-1 text-xs italic text-ink-muted">“{a.newsStatusReason}”</p>}
              </div>
            </div>
            {!a.chief && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border-light pt-3">
                {a.newsStatus !== "active" && <button type="button" className="acx-btn-ghost !py-1.5 !text-xs" onClick={() => standing(a, "active")}><ShieldCheck size={12} /> Restore full access</button>}
                {a.newsStatus !== "restricted" && <button type="button" className="acx-btn-ghost !py-1.5 !text-xs" onClick={() => standing(a, "restricted")}><ShieldAlert size={12} /> Require approval</button>}
                {a.newsStatus !== "suspended" && <button type="button" className="acx-btn-ghost !py-1.5 !text-xs hover:!border-status-danger hover:!text-status-danger" onClick={() => standing(a, "suspended")}><Ban size={12} /> Suspend</button>}
                <button type="button" className="acx-btn-ghost !py-1.5 !text-xs hover:!border-status-danger hover:!text-status-danger" onClick={() => removeDuty(a)}><UserMinus size={12} /> Remove from team</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
