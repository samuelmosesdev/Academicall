import { useEffect, useState } from "react";
import { BookOpen, Image as ImageIcon, Loader2, Lock, Newspaper, Unlock } from "lucide-react";
import { newsApi } from "../../lib/newsApi";
import { notify } from "../../lib/dialogs";

const MODES = [
  { id: "open", icon: Unlock, title: "Open reading", text: "Guests read every story in full without a sign-in prompt." },
  { id: "soft", icon: BookOpen, title: "Gentle invitation", text: "Guests read the full story and see a skippable invitation to join." },
  { id: "preview", icon: Lock, title: "Preview, then sign in", text: "Guests read a preview, then sign in to continue." },
];
const IMAGES = [
  { id: "cover", icon: ImageIcon, title: "Headline photo", text: "Show the story's cover photo on its own, or the story card when there is no cover." },
  { id: "card", icon: Newspaper, title: "Story card", text: "Show the cover photo with the headline, standfirst and author, like the News page." },
];

function Choice({ item, value, onPick }) {
  const Icon = item.icon;
  const selected = value === item.id;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onPick(item.id)}
      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${selected ? "border-accent bg-accent-soft" : "border-border-subtle hover:bg-bg-panel-alt"}`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-accent text-bg-app" : "bg-bg-panel-alt text-text-secondary"}`}>
        <Icon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-primary">{item.title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-text-secondary">{item.text}</span>
      </span>
    </button>
  );
}

export default function NewsAccessPanel() {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [limits, setLimits] = useState({ previewCharsMin: 150, previewCharsMax: 6000 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const response = await newsApi.accessSettings();
      setSaved(response.settings);
      setForm(response.settings);
      if (response.limits) setLimits(response.limits);
    } catch (loadError) {
      setError(loadError?.message || "Couldn't load the news settings.");
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true);
    try {
      const response = await newsApi.saveAccessSettings(form);
      setSaved(response.settings);
      setForm(response.settings);
      notify.success("News settings saved");
    } catch (saveError) {
      notify.error(saveError?.message || "Couldn't save the news settings.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <section className="ctl-panel space-y-3" aria-label="News settings">
        <p className="ctl-error">{error}</p>
        <button type="button" className="ctl-btn is-ghost" onClick={load}>Try again</button>
      </section>
    );
  }
  if (!form) {
    return <div className="ctl-panel flex items-center gap-2 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Loading news settings…</div>;
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const approxWords = Math.round(form.previewChars / 6);

  return (
    <section className="ctl-panel space-y-5" aria-label="News settings">
      <div>
        <p className="font-semibold text-text-primary">News: readers who aren't signed in</p>
        <p className="text-sm text-text-secondary">Choose what guests can read. Comments and reactions always need an account.</p>
      </div>

      <div role="radiogroup" aria-label="Sign-in behaviour" className="grid gap-2.5 lg:grid-cols-3">
        {MODES.map((item) => (
          <Choice key={item.id} item={item} value={form.mode} onPick={(mode) => setForm((current) => ({ ...current, mode }))} />
        ))}
      </div>

      {form.mode === "preview" && (
        <div className="rounded-2xl border border-border-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="news-preview-chars" className="text-sm font-semibold text-text-primary">Guest preview length</label>
            <span className="num rounded-full bg-bg-panel-alt px-3 py-1 text-xs text-text-secondary">
              {form.previewChars.toLocaleString()} characters · about {approxWords} words
            </span>
          </div>
          <input
            id="news-preview-chars"
            type="range"
            min={limits.previewCharsMin}
            max={limits.previewCharsMax}
            step={50}
            value={form.previewChars}
            onChange={(event) => setForm((current) => ({ ...current, previewChars: Number(event.target.value) }))}
            className="mt-3 w-full accent-[var(--color-accent)]"
          />
          <div className="mt-1 flex justify-between text-[0.7rem] text-text-muted"><span>Short teaser</span><span>Long preview</span></div>
          <p className="mt-2 text-xs text-text-muted">The preview ends at a paragraph break where possible.</p>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Picture shown when a story link is shared</p>
        <div role="radiogroup" aria-label="Link preview picture" className="grid gap-2.5 lg:grid-cols-2">
          {IMAGES.map((item) => (
            <Choice key={item.id} item={item} value={form.ogImage} onPick={(ogImage) => setForm((current) => ({ ...current, ogImage }))} />
          ))}
        </div>
        <p className="mt-2 text-xs text-text-muted">Social platforms cache link previews, so a change may take time to appear on links already shared.</p>
      </div>

      <div className="flex items-center justify-end gap-2">
        {dirty && <button type="button" className="ctl-btn is-ghost" onClick={() => setForm(saved)}>Undo changes</button>}
        <button type="button" className="ctl-btn" disabled={!dirty || busy} onClick={save}>
          {busy ? "Saving…" : "Save news settings"}
        </button>
      </div>
    </section>
  );
}
