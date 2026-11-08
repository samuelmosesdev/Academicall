/**
 * Downloads: everything saved for use without data.
 *  - Materials saved offline (Android app)
 *  - UTME subject packs (website; the Android app already carries the whole bank)
 *  - Storage used, and practice sessions waiting to sync
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Loader2, Trash2, Check, WifiOff } from "lucide-react";
import { PageHeader } from "../components/ui";
import { isNativeApp } from "../lib/platform";
import { listOfflineMaterials, removeMaterialOffline } from "../lib/offlineMaterials";
import { bankBuiltIn, formatBytes, packsSupported, removePack, savePack, savedPacks } from "../lib/offlinePacks";
import { loadIndex, pendingSyncCount, flushUtmeQueue } from "../lib/utmeBank";
import { appConfirm, notify } from "../lib/dialogs";
import { useFeatures } from "../lib/features";
import { useDataSaver } from "../lib/dataSaver";
import { Switch } from "../components/access/AccessEditor";
import { fmtDate } from "../lib/gapsApi";

export default function StudentDownloads() {
  const native = isNativeApp();
  const { isOn } = useFeatures();
  const [materials, setMaterials] = useState(null);
  const [index, setIndex] = useState(null);
  const [packs, setPacks] = useState(savedPacks);
  const [progress, setProgress] = useState({}); // slug -> [done, total]
  const [usage, setUsage] = useState(null);
  const [pending, setPending] = useState(pendingSyncCount);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [saver, setSaver] = useDataSaver();
  const showUtme = isOn("utme");

  const refreshUsage = () => navigator.storage?.estimate?.().then(setUsage).catch(() => {});
  useEffect(() => {
    listOfflineMaterials().then(setMaterials).catch(() => setMaterials([]));
    if (showUtme) loadIndex().then(setIndex).catch(() => setIndex({ subjects: [] }));
    refreshUsage();
    const on = () => { setOnline(true); flushUtmeQueue().then(() => setPending(pendingSyncCount())).catch(() => {}); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [showUtme]);

  async function getPack(s) {
    try {
      setProgress((p) => ({ ...p, [s.slug]: [0, 1] }));
      await savePack(s.slug, s.name, (d, t) => setProgress((p) => ({ ...p, [s.slug]: [d, t] })));
      setPacks(savedPacks());
      notify.success(`${s.name} is saved for offline practice`);
      refreshUsage();
    } catch (e) { notify.error(e.message); } finally {
      setProgress((p) => { const n = { ...p }; delete n[s.slug]; return n; });
    }
  }
  async function dropPack(s) {
    if (!(await appConfirm(`Remove the offline copy of ${s.name}? You can download it again any time.`, { title: "Remove download?", confirmLabel: "Remove" }))) return;
    await removePack(s.slug);
    setPacks(savedPacks());
    refreshUsage();
  }
  async function dropMaterial(m) {
    await removeMaterialOffline(m.id);
    setMaterials((xs) => xs.filter((x) => x.id !== m.id));
    refreshUsage();
  }

  const totalMaterials = (materials || []).reduce((n, m) => n + (m.size || 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Downloads" description="Save materials and past questions to this device, then read and practise without data." />

      {!online && <p className="ctl-note flex items-center gap-2"><WifiOff size={15} /> You're offline. Everything saved here still works.</p>}
      {pending > 0 && <p className="ctl-note">{pending} UTME session{pending === 1 ? "" : "s"} finished offline will sync when you're back online.</p>}

      <div className="prog-strip">
        <div><dt>Materials</dt><dd className="num">{materials?.length ?? "—"}</dd></div>
        <div><dt>UTME packs</dt><dd className="num">{bankBuiltIn() ? "All" : Object.keys(packs).length}</dd></div>
        <div><dt>Space used</dt><dd className="num">{usage ? formatBytes(usage.usage || 0) : "—"}</dd></div>
        <div className="!flex items-center gap-3">
          <span><dt>Data saver</dt><dd className="text-sm">{saver ? "On" : "Off"}</dd></span>
          <Switch on={saver} onChange={setSaver} label="Data saver" />
        </div>
      </div>

      {isOn("materials") && (
        <section className="ctl-panel !p-0">
          <h2 className="ctl-panel-title">Materials on this device {totalMaterials ? `· ${formatBytes(totalMaterials)}` : ""}</h2>
          {!native ? (
            <p className="px-4 py-4 text-sm text-text-secondary">Saving materials offline works in the Academicall Android app. Open a folder there and tap Offline, or Download folder.</p>
          ) : !materials ? <p className="px-4 py-4 text-sm text-text-muted">Loading…</p> : !materials.length ? (
            <p className="px-4 py-4 text-sm text-text-secondary">Nothing saved yet. Open a <Link to="/dashboard/materials" className="font-semibold underline">materials folder</Link> and tap Download folder.</p>
          ) : (
            <ul>
              {materials.map((m) => (
                <li key={m.id} className="ctl-feature">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text-primary">{m.title}</p>
                    <p className="text-xs text-text-muted">{m.courseCode || "General"} · {formatBytes(m.size || 0)} · saved {fmtDate(m.savedAt)}</p>
                  </div>
                  <button type="button" className="ctl-icon is-danger" onClick={() => dropMaterial(m)} aria-label="Remove download"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showUtme && (
        <section className="ctl-panel !p-0">
          <h2 className="ctl-panel-title">UTME past questions</h2>
          {bankBuiltIn() ? (
            <p className="px-4 py-4 text-sm text-text-secondary"><Check size={14} className="mr-1 inline" />Every subject is built into the app, so UTME CBT already works without data. Sessions you finish offline sync later.</p>
          ) : !packsSupported() ? (
            <p className="px-4 py-4 text-sm text-text-secondary">This browser can't save subjects for offline use. Try Chrome, or the Android app.</p>
          ) : !index ? <p className="px-4 py-4 text-sm text-text-muted">Loading subjects…</p> : (
            <ul>
              {index.subjects.map((s) => {
                const saved = packs[s.slug];
                const prog = progress[s.slug];
                return (
                  <li key={s.slug} className="ctl-feature">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text-primary">{s.name}</p>
                      <p className="text-xs text-text-muted">
                        <span className="num">{s.count.toLocaleString()}</span> questions
                        {saved ? ` · saved ${fmtDate(saved.savedAt)} · ${formatBytes(saved.bytes || 0)}` : ""}
                      </p>
                      {prog && <div className="prog-bar mt-1.5 max-w-xs"><span style={{ width: `${prog[1] ? Math.round((prog[0] / prog[1]) * 100) : 5}%` }} /></div>}
                    </div>
                    {prog ? <span className="text-xs text-text-muted num"><Loader2 size={13} className="mr-1 inline animate-spin" />{prog[0]}/{prog[1]}</span>
                      : saved ? (
                        <span className="flex gap-1.5">
                          <button type="button" className="ctl-btn is-ghost !py-1" onClick={() => getPack(s)} disabled={!online}>Update</button>
                          <button type="button" className="ctl-icon is-danger" onClick={() => dropPack(s)} aria-label={`Remove ${s.name}`}><Trash2 size={14} /></button>
                        </span>
                      ) : <button type="button" className="ctl-btn is-ghost !py-1" onClick={() => getPack(s)} disabled={!online}><Download size={14} /> Download</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
