import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Image as ImageIcon, ImagePlus, Loader2, Pencil, Plus, Trash2, Type, X } from "lucide-react";
import { boardApi } from "../lib/aspirantApi";
import { uploadImageToCloudinary } from "../lib/cloudinaryUpload";
import { appConfirm, notify } from "../lib/dialogs";
import { PageHeader } from "../components/ui";
import { Switch } from "../components/access/AccessEditor";
import { Slide } from "../components/board/DashboardBoard";

const EMPTY = { kind: "message", title: "", body: "", imageUrl: "", ctaLabel: "", ctaUrl: "", theme: "midnight", audience: "students", active: true, startsAt: "", endsAt: "" };
const THEMES = [["midnight", "#0f0326"], ["violet", "#454ade"], ["lemon", "#f8f32b"], ["aqua", "#44ffd1"]];
const AUDIENCE = { students: "Students", aspirants: "Aspirants", all: "Everyone" };
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

/**
 * Dashboard board — what the big panel on the student dashboard shows.
 * Admins and agents with the "Dashboard board" permission only.
 */
export default function AdminBoard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const bgRef = useRef(null);

  const load = useCallback(() => boardApi.admin().then(setData).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function settings(patch) {
    setSavingSettings(true);
    try { const r = await boardApi.settings(patch); setData((d) => ({ ...d, settings: r.settings })); notify.success("Board settings saved"); }
    catch (e) { notify.error(e.message); } finally { setSavingSettings(false); }
  }
  async function background(file) {
    if (!file) return;
    setSavingSettings(true);
    try { const r = await uploadImageToCloudinary(file); await settings({ backgroundUrl: r.secure_url }); }
    catch (e) { notify.error(e.message); setSavingSettings(false); }
  }
  async function move(idx, dir) {
    const list = [...data.slides];
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    setData((d) => ({ ...d, slides: list }));
    try { await boardApi.reorder(list.map((s) => s.id)); } catch (e) { notify.error(e.message); load(); }
  }
  async function toggle(s) {
    try { const r = await boardApi.update(s.id, { active: !s.active }); setData((d) => ({ ...d, slides: d.slides.map((x) => (x.id === s.id ? r.slide : x)) })); }
    catch (e) { notify.error(e.message); }
  }
  async function remove(s) {
    if (!(await appConfirm("Delete this slide?", { tone: "danger", confirmLabel: "Delete" }))) return;
    try { await boardApi.remove(s.id); setData((d) => ({ ...d, slides: d.slides.filter((x) => x.id !== s.id) })); } catch (e) { notify.error(e.message); }
  }

  if (err) return <p className="rounded-2xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{err}</p>;
  if (!data) return <div className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={15} className="animate-spin" /> Loading the board…</div>;
  const st = data.settings;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard board" description="The big panel at the top of every student's dashboard. Post a message, a picture, or a run of designs with no text." actions={<button type="button" className="acx-btn" onClick={() => setEditing({ ...EMPTY })}><Plus size={14} /> New slide</button>} />

      <section className="acx-card">
        <header className="acx-card-head"><div><h3>Board settings</h3><p>The background shows behind message slides that have no picture of their own.</p></div></header>
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <button type="button" onClick={() => bgRef.current?.click()} className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-dashed border-border-strong bg-midnight text-white/80">
            {st.backgroundUrl ? <img src={st.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <img src="/images/campus/library-wide.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />}
            <span className="relative inline-flex items-center gap-1.5 rounded-full bg-midnight/70 px-3 py-1.5 text-xs">{savingSettings ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} {st.backgroundUrl ? "Change background" : "Upload background"}</span>
          </button>
          <input ref={bgRef} type="file" accept="image/*" hidden onChange={(e) => { background(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="space-y-3">
            <Row label="Rotate slides" hint="Moves to the next slide on its own"><Switch on={st.rotate !== false} onChange={(v) => settings({ rotate: v })} label="Rotate slides" /></Row>
            <Row label="Seconds per slide" hint="3 to 30">
              <select className="acx-input !w-24" value={st.intervalSec || 7} onChange={(e) => settings({ intervalSec: Number(e.target.value) })}>{[4, 5, 6, 7, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}s</option>)}</select>
            </Row>
            <Row label="Personal welcome slide" hint="Greets each student by name with their next class. Turn off to show only your slides."><Switch on={st.showGreeting !== false} onChange={(v) => settings({ showGreeting: v })} label="Personal welcome slide" /></Row>
            {st.backgroundUrl && <button type="button" className="text-xs font-medium text-text-muted hover:text-status-danger" onClick={() => settings({ backgroundUrl: null })}>Use the default background</button>}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <p className="eyebrow text-text-muted">Slides, in order</p>
        {!data.slides.length && <p className="rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center text-sm text-text-muted">No slides yet. Students see their personal welcome until you add one.</p>}
        {data.slides.map((s, i) => (
          <div key={s.id} className={`flex flex-wrap items-center gap-4 rounded-[1.3rem] border border-border-subtle bg-bg-panel p-3 ${s.active ? "" : "opacity-60"}`}>
            <div className="relative h-24 w-44 shrink-0 overflow-hidden rounded-xl bg-midnight"><div className="board-mini"><Slide slide={s} background={st.backgroundUrl} /></div></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="acx-chip-sm">{s.kind === "image" ? <><ImageIcon size={10} /> Design</> : <><Type size={10} /> Message</>}</span>
                <span className="acx-chip-sm is-lemon">{AUDIENCE[s.audience]}</span>
                {!s.active && <span className="acx-chip-sm">hidden</span>}
                {s.endsAt && <span className="acx-chip-sm">until {new Date(s.endsAt).toLocaleDateString()}</span>}
              </div>
              <p className="mt-1 truncate font-semibold text-text-primary">{s.title || (s.kind === "image" ? "Image slide" : "Untitled")}</p>
              <p className="truncate text-xs text-text-muted">{s.body || s.ctaUrl || ""}{s.createdByName ? ` · by ${s.createdByName}` : ""}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" className="acx-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={14} /></button>
              <button type="button" className="acx-icon-btn" onClick={() => move(i, 1)} disabled={i === data.slides.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
              <button type="button" className="acx-icon-btn" onClick={() => toggle(s)} aria-label={s.active ? "Hide" : "Show"}>{s.active ? <Eye size={14} /> : <EyeOff size={14} />}</button>
              <button type="button" className="acx-icon-btn" onClick={() => setEditing({ ...EMPTY, ...s, startsAt: toLocal(s.startsAt), endsAt: toLocal(s.endsAt) })} aria-label="Edit"><Pencil size={14} /></button>
              <button type="button" className="acx-icon-btn is-danger" onClick={() => remove(s)} aria-label="Delete"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </section>

      {editing && <SlideEditor slide={editing} background={st.backgroundUrl} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text-primary">{label}</p>{hint && <p className="text-xs text-text-muted">{hint}</p>}</div>
      {children}
    </div>
  );
}

function SlideEditor({ slide, background, onClose, onSaved }) {
  const [f, setF] = useState(slide);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function pick(file) {
    if (!file) return;
    setUploading(1);
    try { const r = await uploadImageToCloudinary(file, setUploading); setF((x) => ({ ...x, imageUrl: r.secure_url })); }
    catch (e) { notify.error(e.message); } finally { setUploading(0); }
  }
  async function save() {
    setBusy(true);
    const body = {
      kind: f.kind, title: f.title || null, body: f.kind === "image" ? null : f.body || null, imageUrl: f.imageUrl || null,
      ctaLabel: f.kind === "image" ? null : f.ctaLabel || null, ctaUrl: f.ctaUrl || null, theme: f.theme, audience: f.audience, active: f.active,
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null, endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    };
    try { if (slide.id) await boardApi.update(slide.id, body); else await boardApi.create(body); notify.success("Slide saved"); onSaved(); }
    catch (e) { notify.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-midnight/55 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-label="Slide editor">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[1.6rem] bg-bg-panel shadow-2xl sm:rounded-[1.6rem]">
        <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-3.5">
          <p className="font-semibold text-text-primary">{slide.id ? "Edit slide" : "New slide"}</p>
          <button type="button" onClick={onClose} className="ml-auto rounded-full p-2 text-text-muted hover:bg-bg-hover" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[["message", Type, "Message", "Text over a background"], ["image", ImageIcon, "Design only", "A picture, no text"]].map(([k, Icon, t, h]) => (
                <button key={k} type="button" onClick={() => setF((x) => ({ ...x, kind: k }))} className={`rounded-2xl border p-3 text-left ${f.kind === k ? "border-accent bg-accent-soft" : "border-border-subtle"}`}>
                  <Icon size={16} className="text-accent" /><p className="mt-1 text-sm font-semibold text-text-primary">{t}</p><p className="text-xs text-text-muted">{h}</p>
                </button>
              ))}
            </div>
            {f.kind === "message" && (
              <>
                <input className="acx-input" value={f.title} onChange={set("title")} maxLength={120} placeholder="Headline, e.g. Exams start 3 November" />
                <textarea className="acx-input" rows={3} value={f.body} onChange={set("body")} maxLength={400} placeholder="A line or two of detail (optional)" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary">Colour</span>
                  {THEMES.map(([k, c]) => <button key={k} type="button" onClick={() => setF((x) => ({ ...x, theme: k }))} className={`h-7 w-7 rounded-full ring-offset-2 ${f.theme === k ? "ring-2 ring-accent" : ""}`} style={{ background: c }} aria-label={k} />)}
                </div>
              </>
            )}
            <div>
              <div className="flex items-center gap-2">
                <button type="button" className="acx-btn-ghost" onClick={() => fileRef.current?.click()}>{uploading ? <><Loader2 size={13} className="animate-spin" /> {uploading}%</> : <><ImagePlus size={13} /> {f.imageUrl ? "Change picture" : f.kind === "image" ? "Upload design" : "Add a picture (optional)"}</>}</button>
                {f.imageUrl && <button type="button" className="text-xs text-text-muted hover:text-status-danger" onClick={() => setF((x) => ({ ...x, imageUrl: "" }))}>Remove</button>}
              </div>
              <p className="mt-1 text-[11px] text-text-muted">{f.kind === "image" ? "Use a wide design (about 1600 × 700). It fills the whole panel." : "Without a picture, the board background is used."}</p>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {f.kind === "message" && <input className="acx-input" value={f.ctaLabel} onChange={set("ctaLabel")} maxLength={40} placeholder="Button text (optional)" />}
              <input className={`acx-input ${f.kind === "image" ? "col-span-2" : ""}`} value={f.ctaUrl} onChange={set("ctaUrl")} placeholder={f.kind === "image" ? "Link when tapped (optional), e.g. /news" : "Button link, e.g. /dashboard/practice"} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-text-secondary">Show to<select className="acx-input mt-1" value={f.audience} onChange={set("audience")}>{Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="text-xs text-text-secondary">Starts<input type="datetime-local" className="acx-input mt-1" value={f.startsAt} onChange={set("startsAt")} /></label>
              <label className="text-xs text-text-secondary">Ends<input type="datetime-local" className="acx-input mt-1" value={f.endsAt} onChange={set("endsAt")} /></label>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Preview</p>
            <div className="relative min-h-[17rem] overflow-hidden rounded-[1.4rem] bg-midnight">
              {f.kind === "image" && !f.imageUrl ? <p className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Upload a design to preview</p> : <Slide slide={f} background={background} />}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3.5">
          <button type="button" className="acx-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="acx-btn" disabled={busy || !!uploading} onClick={save}>{busy ? "Saving…" : "Save slide"}</button>
        </div>
      </div>
    </div>
  );
}
