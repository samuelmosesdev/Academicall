/**
 * On a user's admin page: their two-step sign-in, signed-in devices and
 * sign-in history; reset 2FA, sign a device out, export their data, and
 * the beta-tester flag.
 */
import { useEffect, useState } from "react";
import { Download, Loader2, ShieldCheck, FlaskConical } from "lucide-react";
import { securityAdminApi, dataAdminApi, featuresExtraApi, fmtDateTime, timeAgo } from "../../lib/gapsApi";
import { appConfirm, appPrompt, notify } from "../../lib/dialogs";
import { Switch } from "./AccessEditor";

const OUTCOME = { success: "Signed in", code_passed: "Signed in with code", code_sent: "Code sent", code_failed: "Wrong code", bad_password: "Wrong password", inactive: "Blocked (inactive)" };

export default function UserSecurityPanel({ user, canPassword, isAdminViewer }) {
  const [data, setData] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [beta, setBeta] = useState(!!user.betaTester);
  const load = () => securityAdminApi.user(user.id).then(setData).catch(() => setData(null));
  useEffect(() => { if (canPassword) load(); }, [user.id, canPassword]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reset() {
    const reason = await appPrompt("They'll be signed out everywhere and asked to set it up again. Check who you're talking to first.", { title: "Reset two-step sign-in?", placeholder: "Reason, e.g. lost phone (recorded)", required: true, confirmLabel: "Reset", tone: "danger" });
    if (!reason) return;
    await securityAdminApi.reset2fa(user.id, reason).then(() => { notify.success("Two-step sign-in reset"); load(); }).catch((e) => notify.error(e.message));
  }
  async function endSession(s) {
    if (!(await appConfirm(`${s.device} will be signed out.`, { title: "Sign out this device?", confirmLabel: "Sign out" }))) return;
    await securityAdminApi.endSession(user.id, s.id).then(load).catch((e) => notify.error(e.message));
  }
  async function exportData() {
    const reason = await appPrompt("This is recorded in the audit log.", { title: "Export this account's data", placeholder: "Reason (e.g. their data request)", required: true, multiline: false, confirmLabel: "Download" });
    if (!reason) return;
    await dataAdminApi.exportUser(user.id, reason).catch((e) => notify.error(e.message));
  }
  async function toggleBeta(on) {
    setBeta(on);
    await featuresExtraApi.setBeta(user.id, on).catch((e) => { setBeta(!on); notify.error(e.message); });
  }

  if (!canPassword && !isAdminViewer) return null;
  const logins = data?.logins || [];
  return (
    <section className="rounded-xl border border-border-subtle bg-bg-panel p-5 lg:col-span-2">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} /> Security & data</h2>
      {canPassword && !data && <p className="text-sm text-text-muted"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading…</p>}
      {canPassword && data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Two-step sign-in: {data.twoFactor.method ? <b>{data.twoFactor.method === "totp" ? "Authenticator app" : "Email code"}</b> : <span className="text-text-muted">off</span>}</span>
            {data.twoFactor.method && <span className="text-xs text-text-muted">since {fmtDateTime(data.twoFactor.enabledAt)}{data.twoFactor.method === "totp" ? ` · ${data.twoFactor.backupCodesLeft} backup codes left` : ""}</span>}
            {data.twoFactor.method && <button type="button" className="ctl-btn is-ghost !py-1" onClick={reset}>Reset</button>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-text-muted">Signed-in devices ({data.sessions.length})</p>
            {!data.sessions.length ? <p className="text-sm text-text-muted">None tracked.</p> : (
              <table className="ctl-table">
                <tbody>{data.sessions.map((s) => (
                  <tr key={s.id}>
                    <td title={s.device}>{s.device}</td>
                    <td className="w-36 text-xs">active {timeAgo(s.lastSeenAt)}</td>
                    <td className="w-32 num text-xs">{s.ip || "—"}</td>
                    <td className="w-24 text-right"><button type="button" className="ctl-btn is-ghost !py-1" onClick={() => endSession(s)}>Sign out</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-text-muted">Sign-in history</p>
            {!logins.length ? <p className="text-sm text-text-muted">No sign-ins recorded yet.</p> : (
              <table className="ctl-table">
                <tbody>{(showAll ? logins : logins.slice(0, 6)).map((l) => (
                  <tr key={l.id}>
                    <td className="w-40 text-xs">{fmtDateTime(l.createdAt)}</td>
                    <td className={`w-44 ${/bad|failed|inactive/.test(l.outcome) ? "text-status-danger" : ""}`}>{OUTCOME[l.outcome] || l.outcome}{l.method === "google" ? " · Google" : ""}</td>
                    <td title={l.device}>{l.device}</td>
                    <td className="w-32 num text-xs">{l.ip || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            {logins.length > 6 && <button type="button" className="mt-1 text-xs font-semibold text-accent" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${logins.length}`}</button>}
          </div>
        </div>
      )}
      {isAdminViewer && (
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border-subtle pt-4">
          <button type="button" className="ctl-btn is-ghost" onClick={exportData}><Download size={14} /> Export their data</button>
          <span className="flex items-center gap-2 text-sm"><FlaskConical size={15} /> Beta tester <Switch on={beta} onChange={toggleBeta} label="Beta tester" /></span>
        </div>
      )}
    </section>
  );
}
