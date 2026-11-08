/**
 * Admin → Security: require two-step sign-in for staff, see who has it on,
 * and the latest staff sign-ins (failed ones stand out).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PageHeader } from "../components/ui";
import { Switch } from "../components/access/AccessEditor";
import { securityAdminApi, fmtDateTime, timeAgo } from "../lib/gapsApi";
import { appConfirm, notify } from "../lib/dialogs";
import { ROLE_LABELS } from "../lib/roles";

const OUTCOME = { success: "Signed in", code_passed: "Signed in with code", code_sent: "Code sent", code_failed: "Wrong code", bad_password: "Wrong password", inactive: "Blocked (inactive)" };

export default function AdminSecurity() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => securityAdminApi.overview().then(setData).catch((e) => notify.error(e.message));
  useEffect(() => { load(); }, []);

  async function toggle(on) {
    const ok = await appConfirm(on
      ? `${data.coverage.total - data.coverage.on} staff without two-step sign-in will be asked to set it up before they can do anything else. They get a notification now.`
      : "Staff can turn two-step sign-in off for themselves again.", { title: on ? "Require two-step sign-in for staff?" : "Stop requiring it?", confirmLabel: on ? "Require it" : "Stop requiring" });
    if (!ok) return;
    setBusy(true);
    try { await securityAdminApi.save(on); await load(); notify.success(on ? "Two-step sign-in is now required for staff" : "No longer required"); }
    catch (e) { notify.error(e.message); } finally { setBusy(false); }
  }

  if (!data) return <p className="ctl-panel text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading…</p>;
  return (
    <div className="ctl space-y-5">
      <PageHeader title="Security" description="Two-step sign-in for staff, and every staff sign-in. Each person's devices and history are on their user page." />
      <div className="prog-strip">
        <div><dt>Staff with two-step</dt><dd className="num">{data.coverage.on} / {data.coverage.total}</dd></div>
        <div><dt>Failed staff sign-ins (24 h)</dt><dd className={`num ${data.failed24h ? "text-status-danger" : ""}`}>{data.failed24h}</dd></div>
      </div>
      <section className="ctl-panel ctl-feature !border-0">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary">Require two-step sign-in for all staff</p>
          <p className="text-sm text-text-secondary">Admins and agents can see and change other people's data. With this on, a stolen password alone can't open a staff account. Turn it on for your own account first (your profile page).</p>
          {data.settings.at && <p className="mt-1 text-xs text-text-muted">Last changed {fmtDateTime(data.settings.at)}{data.settings.byName ? ` by ${data.settings.byName}` : ""}</p>}
        </div>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Switch on={data.settings.requireStaff2fa} onChange={toggle} label="Require two-step sign-in" />}
      </section>

      <section className="ctl-panel !p-0">
        <h2 className="ctl-panel-title">Staff</h2>
        <table className="ctl-table">
          <thead><tr><th>Name</th><th className="w-40">Role</th><th className="w-44">Two-step sign-in</th><th className="w-36">Last active</th></tr></thead>
          <tbody>{data.staff.map((s) => (
            <tr key={s.id}>
              <td><Link className="ctl-qcell" to={`/admin/users/${s.id}`}>{s.name || s.email}</Link></td>
              <td>{ROLE_LABELS[s.role] || s.role}</td>
              <td>{s.twoFactorOn ? <span className="ctl-status is-added">{s.twoFactorMethod === "totp" ? "Authenticator app" : "Email code"}</span> : <span className="ctl-status is-removed">Off</span>}</td>
              <td className="text-xs">{timeAgo(s.lastActiveAt)}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <section className="ctl-panel !p-0">
        <h2 className="ctl-panel-title">Recent staff sign-ins</h2>
        <table className="ctl-table">
          <thead><tr><th className="w-40">When</th><th>Who</th><th className="w-44">Result</th><th>Device</th><th className="w-32">IP</th></tr></thead>
          <tbody>{data.logins.map((l) => (
            <tr key={l.id}>
              <td className="text-xs">{fmtDateTime(l.createdAt)}</td>
              <td>{l.name}</td>
              <td className={/bad|failed|inactive/.test(l.outcome) ? "text-status-danger" : ""}>{OUTCOME[l.outcome] || l.outcome}{l.method === "google" ? " · Google" : ""}</td>
              <td title={l.device}>{l.device}</td>
              <td className="num text-xs">{l.ip || "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}
