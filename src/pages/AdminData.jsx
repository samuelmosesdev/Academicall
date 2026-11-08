/**
 * Admin → Data & backups: people's data requests (downloads and deletion
 * requests), exporting any account, and the state of database backups.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Database, Play } from "lucide-react";
import { PageHeader } from "../components/ui";
import { dataAdminApi, fmtDateTime } from "../lib/gapsApi";
import { appPrompt, notify } from "../lib/dialogs";
import { formatBytes } from "../lib/offlinePacks";

const HEALTH = { ok: ["is-added", "Healthy"], late: ["is-edited", "Late"], stale: ["is-removed", "Overdue"], none: ["is-removed", "No backup recorded"] };

export default function AdminData() {
  const [tab, setTab] = useState("pending");
  const [reqs, setReqs] = useState(null);
  const [backups, setBackups] = useState(null);
  const loadReqs = () => dataAdminApi.requests(tab === "all" ? {} : { status: tab }).then(setReqs).catch((e) => notify.error(e.message));
  const loadBackups = () => dataAdminApi.backups().then(setBackups).catch((e) => notify.error(e.message));
  useEffect(() => { setReqs(null); loadReqs(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadBackups(); }, []);

  async function close(r, status) {
    const note = await appPrompt(status === "done"
      ? (r.kind === "delete" ? "Delete the account from their user page first. This note goes to them." : "This note goes to them.")
      : "Tell them why (they'll see this).", { title: status === "done" ? "Mark as done" : "Decline request", placeholder: "Optional note", confirmLabel: status === "done" ? "Mark done" : "Decline" });
    if (note === null) return;
    await dataAdminApi.update(r.id, { status, note: note || null }).then(loadReqs).catch((e) => notify.error(e.message));
  }
  async function exportUser(r) {
    const reason = await appPrompt("This is recorded in the audit log.", { title: `Export ${r.userName || r.userEmail}'s data`, placeholder: "Reason, e.g. their data request", required: true, multiline: false, confirmLabel: "Download" });
    if (!reason) return;
    await dataAdminApi.exportUser(r.userId, reason).catch((e) => notify.error(e.message));
  }
  async function runBackup() {
    try { await dataAdminApi.runBackup(); notify.success("Backup started"); setTimeout(loadBackups, 3000); } catch (e) { notify.error(e.message); }
  }

  const [hClass, hLabel] = HEALTH[backups?.health || "none"];
  return (
    <div className="ctl space-y-5">
      <PageHeader title="Data & backups" description="Requests people make about their data, and whether the database is being backed up." />

      <section className="ctl-panel space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Database size={18} className="text-text-muted" />
          <h2 className="font-semibold text-text-primary">Backups</h2>
          {backups && <span className={`ctl-status ${hClass}`}>{hLabel}</span>}
          <span className="flex-1" />
          {backups?.canRunHere && <button type="button" className="ctl-btn is-ghost" onClick={runBackup}><Play size={14} /> Back up now</button>}
        </div>
        {!backups ? <p className="text-sm text-text-muted">Loading…</p> : (
          <>
            <p className="text-sm text-text-secondary">
              {backups.lastOk ? <>Last good backup {fmtDateTime(backups.lastOk.finishedAt || backups.lastOk.startedAt)} ({backups.hoursSinceLastOk} h ago){backups.lastOk.sizeBytes ? `, ${formatBytes(backups.lastOk.sizeBytes)}` : ""}.</> : "No backup has reported in yet."}
              {!backups.reportConfigured && " Set BACKUP_REPORT_TOKEN on the API and run scripts/backup.sh daily so backups report here."}
            </p>
            {backups.items.length > 0 && (
              <table className="ctl-table">
                <thead><tr><th className="w-44">Started</th><th className="w-24">Result</th><th className="w-24">Kind</th><th className="w-24">Size</th><th>Note</th></tr></thead>
                <tbody>{backups.items.slice(0, 10).map((b) => (
                  <tr key={b.id}>
                    <td className="text-xs">{fmtDateTime(b.startedAt)}</td>
                    <td><span className={`ctl-status ${b.status === "ok" ? "is-added" : b.status === "failed" ? "is-removed" : "is-edited"}`}>{b.status}</span></td>
                    <td className="text-xs">{b.kind}</td>
                    <td className="num text-xs">{b.sizeBytes ? formatBytes(b.sizeBytes) : "—"}</td>
                    <td className="text-xs" title={b.note || b.location}>{b.note || b.location || ""}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            <p className="text-xs text-text-muted">Practise a restore once a term: restore the latest dump into a spare database and open the app against it. Steps are in the release notes.</p>
          </>
        )}
      </section>

      <div className="ctl-tabs">
        {[["pending", `Waiting${reqs?.pending ? ` (${reqs.pending})` : ""}`], ["done", "Done"], ["all", "Everything"]].map(([k, l]) => <button type="button" key={k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <section className="ctl-panel !p-0">
        {!reqs ? <p className="px-4 py-4 text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading…</p> : !reqs.items.length ? <p className="px-4 py-4 text-sm text-text-secondary">No requests here.</p> : (
          <table className="ctl-table">
            <thead><tr><th className="w-40">When</th><th>Person</th><th className="w-36">Request</th><th>Note</th><th className="w-72" /></tr></thead>
            <tbody>{reqs.items.map((r) => (
              <tr key={r.id}>
                <td className="text-xs">{fmtDateTime(r.createdAt)}</td>
                <td>{r.userId ? <Link className="ctl-qcell" to={`/admin/users/${r.userId}`}>{r.userName || r.userEmail}</Link> : r.userEmail}</td>
                <td>{r.kind === "delete" ? "Delete account" : r.source === "staff" ? "Export (by staff)" : "Downloaded data"}<span className="block text-xs text-text-muted">{r.status}{r.handledByName ? ` · ${r.handledByName}` : ""}</span></td>
                <td className="text-xs" title={r.note}>{r.note || "—"}</td>
                <td>
                  <span className="flex justify-end gap-1.5">
                    {r.userId && <button type="button" className="ctl-btn is-ghost !py-1" onClick={() => exportUser(r)}>Export</button>}
                    {r.status === "pending" && <button type="button" className="ctl-btn is-ghost !py-1" onClick={() => close(r, "done")}>Done</button>}
                    {r.status === "pending" && <button type="button" className="ctl-btn is-ghost !py-1" onClick={() => close(r, "rejected")}>Decline</button>}
                  </span>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
