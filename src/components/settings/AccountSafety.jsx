/**
 * Settings sections for account safety and control:
 *   TwoFactorSection  – two-step sign-in (authenticator app or email code, backup codes)
 *   DevicesSection    – signed-in devices and recent sign-ins
 *   PushSection       – push notifications by category, quiet hours
 *   PrivacySection    – who sees your profile, blocked people
 *   DataSection       – download your data, ask staff to delete the account, data saver
 *
 * Used on the student Settings page and on staff settings/profile pages.
 */
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Smartphone, BellRing, EyeOff, Database, Copy, Download } from "lucide-react";
import QRCode from "qrcode";
import { twoFactorApi, sessionsApi, meApi, timeAgo, fmtDateTime } from "../../lib/gapsApi";
import { appConfirm, appPrompt, notify } from "../../lib/dialogs";
import { Switch } from "../access/AccessEditor";
import { useAuth } from "../../context/AuthContext";
import { nativePushAvailable, nativePushPermission, registerNativePush } from "../../lib/pushNative";
import { browserPushAvailability, browserPushRegistered, registerFcmToken } from "../../lib/fcm";
import { useDataSaver } from "../../lib/dataSaver";

const SECTION = "acs-section";
const H = ({ icon: Icon, children }) => (
  <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
    <Icon size={16} className="text-ink-muted" /> {children}
  </h2>
);

const OUTCOME = {
  success: "Signed in", code_passed: "Signed in with a code", code_sent: "Code sent", code_failed: "Wrong code",
  bad_password: "Wrong password", inactive: "Blocked (account inactive)",
};

// ── Two-step sign-in ────────────────────────────────────────────────────────
export function TwoFactorSection({ required = false, onDone }) {
  const { refreshProfile } = useAuth();
  const [st, setSt] = useState(null);
  const [setup, setSetup] = useState(null); // { kind: "totp"|"email", setupId, secret?, uri?, qr? }
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => twoFactorApi.status().then(setSt).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function start(kind) {
    setErr(""); setCode(""); setBusy(true);
    try {
      if (kind === "totp") {
        const r = await twoFactorApi.totpStart();
        const qr = await QRCode.toDataURL(r.uri, { margin: 1, width: 200, color: { dark: "#0f0326", light: "#ffffff" } });
        setSetup({ kind, ...r, qr });
      } else {
        const r = await twoFactorApi.emailStart();
        setSetup({ kind, ...r });
      }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function confirm(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = setup.kind === "totp" ? await twoFactorApi.totpConfirm(setup.setupId, code) : await twoFactorApi.emailConfirm(setup.setupId, code);
      setSetup(null); setCode("");
      if (r.backupCodes) setCodes(r.backupCodes);
      await load();
      await refreshProfile?.().catch(() => {});
      notify.success("Two-step sign-in is on");
      if (!r.backupCodes) onDone?.();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function turnOff() {
    const pw = await appPrompt("Enter your password to turn off two-step sign-in. Without it, anyone with your password can sign in.", { title: "Turn off two-step sign-in?", inputType: "password", placeholder: "Password", confirmLabel: "Turn off", tone: "danger", required: true });
    if (pw === null) return;
    try {
      await twoFactorApi.disable({ password: pw, code: pw });
      await load();
      notify.success("Two-step sign-in is off");
    } catch (e) { notify.error(e.message); }
  }

  async function newCodes() {
    const pw = await appPrompt("Your old backup codes will stop working.", { title: "Make new backup codes?", inputType: "password", placeholder: "Password", confirmLabel: "Make new codes", required: true });
    if (pw === null) return;
    try {
      const r = await twoFactorApi.backupCodes({ password: pw, code: pw });
      setCodes(r.backupCodes);
      load();
    } catch (e) { notify.error(e.message); }
  }

  const on = st?.method;
  return (
    <section className={SECTION}>
      <H icon={ShieldCheck}>Two-step sign-in</H>
      {!st && !err && <p className="text-sm text-ink-muted"><Loader2 size={14} className="mr-1 inline animate-spin" />Loading…</p>}
      {err && <p className="ctl-error">{err}</p>}

      {codes && (
        <div className="acs-codes">
          <p className="text-sm font-semibold text-ink">Save these backup codes</p>
          <p className="text-sm text-ink-muted">Each one works once if you lose your phone. They won't be shown again.</p>
          <ol className="num">{codes.map((c) => <li key={c}>{c}</li>)}</ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ctl-btn is-ghost" onClick={() => { navigator.clipboard?.writeText(codes.join("\n")); notify.success("Copied"); }}><Copy size={14} /> Copy</button>
            <button type="button" className="ctl-btn" onClick={() => { setCodes(null); onDone?.(); }}>I've saved them</button>
          </div>
        </div>
      )}

      {st && !codes && on && !setup && (
        <>
          <p className="text-sm text-ink-secondary">
            On, using {on === "totp" ? "an authenticator app" : "codes sent to your email"} since {fmtDateTime(st.enabledAt)}.
            {on === "totp" && <> {st.backupCodesLeft} backup code{st.backupCodesLeft === 1 ? "" : "s"} left.</>}
          </p>
          <div className="flex flex-wrap gap-2">
            {on === "totp" && <button type="button" className="ctl-btn is-ghost" onClick={newCodes}>New backup codes</button>}
            <button type="button" className="ctl-btn is-ghost" onClick={() => start(on === "totp" ? "email" : "totp")}>Switch to {on === "totp" ? "email codes" : "an authenticator app"}</button>
            {!st.required && <button type="button" className="ctl-btn is-ghost" onClick={turnOff}>Turn off</button>}
          </div>
          {st.required && <p className="text-xs text-ink-muted">Required for staff accounts.</p>}
        </>
      )}

      {st && !codes && !on && !setup && (
        <>
          <p className="text-sm text-ink-secondary">
            {required ? "An admin requires two-step sign-in for staff accounts. " : ""}
            After your password, Academicall asks for a 6-digit code, so a stolen password alone can't open your account.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="acs-choice" onClick={() => start("totp")} disabled={busy}>
              <b>Authenticator app</b>
              <span>Google Authenticator, Microsoft Authenticator or similar. Works without data. Recommended.</span>
            </button>
            <button type="button" className="acs-choice" onClick={() => start("email")} disabled={busy}>
              <b>Email code</b>
              <span>We email you a code each time you sign in.</span>
            </button>
          </div>
        </>
      )}

      {setup && (
        <form onSubmit={confirm} className="space-y-3">
          {setup.kind === "totp" ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              <img src={setup.qr} alt="QR code for your authenticator app" className="h-[180px] w-[180px] shrink-0 border border-border-light" />
              <div className="space-y-2 text-sm text-ink-secondary">
                <p>1. In your authenticator app, add an account and scan this code.</p>
                <p>Can't scan? Enter this key:</p>
                <p className="acs-key num">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
                <p>2. Type the 6-digit code the app shows.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-secondary">{setup.delivered === false ? "Email isn't set up on this server, so the code was written to the server log." : "We sent a 6-digit code to your email. Enter it to finish."}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input className="ctl-input num !w-40 tracking-[0.25em]" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" />
            <button type="submit" className="ctl-btn" disabled={busy || code.length < 6}>{busy ? <Loader2 size={14} className="animate-spin" /> : null} Turn on</button>
            <button type="button" className="ctl-btn is-ghost" onClick={() => setSetup(null)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

// ── Devices + recent sign-ins ───────────────────────────────────────────────
export function DevicesSection() {
  const [data, setData] = useState(null);
  const [logins, setLogins] = useState(null);
  const [showLogins, setShowLogins] = useState(false);
  const load = () => sessionsApi.list().then(setData).catch(() => setData({ items: [] }));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (showLogins && !logins) sessionsApi.logins().then((r) => setLogins(r.items)).catch(() => setLogins([])); }, [showLogins, logins]);

  async function end(s) {
    if (!(await appConfirm(`${s.device} will be signed out.`, { title: "Sign out this device?", confirmLabel: "Sign out" }))) return;
    await sessionsApi.end(s.id).then(load).catch((e) => notify.error(e.message));
  }
  async function endOthers() {
    if (!(await appConfirm("Every other phone and browser signed in to your account will be signed out.", { title: "Sign out other devices?", confirmLabel: "Sign out others" }))) return;
    const r = await sessionsApi.endOthers().catch((e) => notify.error(e.message));
    if (r) { notify.success(`Signed out ${r.signedOut} device${r.signedOut === 1 ? "" : "s"}`); load(); }
  }

  const others = (data?.items || []).filter((s) => !s.current);
  return (
    <section className={SECTION}>
      <H icon={Smartphone}>Where you're signed in</H>
      {!data ? <p className="text-sm text-ink-muted">Loading…</p> : (
        <ul className="acs-list">
          {data.items.map((s) => (
            <li key={s.id}>
              <div className="min-w-0">
                <p className="font-medium text-ink">{s.device}{s.current && <span className="ctl-tag">This device</span>}</p>
                <p className="text-xs text-ink-muted">Active {timeAgo(s.lastSeenAt)} · signed in {fmtDateTime(s.createdAt)}{s.ip ? ` · ${s.ip}` : ""}</p>
              </div>
              {!s.current && <button type="button" className="ctl-btn is-ghost" onClick={() => end(s)}>Sign out</button>}
            </li>
          ))}
          {!data.items.length && <li className="text-sm text-ink-muted">This device signed in before device tracking. Sign in again to see it here.</li>}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {(others.length > 0 || data?.legacy) && <button type="button" className="ctl-btn is-ghost" onClick={endOthers}>Sign out all other devices</button>}
        <button type="button" className="ctl-btn is-ghost" onClick={() => setShowLogins((v) => !v)}>{showLogins ? "Hide" : "Show"} recent sign-ins</button>
      </div>
      {showLogins && (
        <ul className="acs-list">
          {(logins || []).map((l) => (
            <li key={l.id}>
              <div className="min-w-0">
                <p className={`font-medium ${/bad|failed|inactive/.test(l.outcome) ? "text-status-danger" : "text-ink"}`}>{OUTCOME[l.outcome] || l.outcome}{l.method === "google" ? " · Google" : ""}</p>
                <p className="text-xs text-ink-muted">{fmtDateTime(l.createdAt)} · {l.device}{l.ip ? ` · ${l.ip}` : ""}</p>
              </div>
            </li>
          ))}
          {logins && !logins.length && <li className="text-sm text-ink-muted">No sign-ins recorded yet.</li>}
        </ul>
      )}
      <p className="text-xs text-ink-muted">Don't recognise a device or a failed sign-in? Sign it out and change your password.</p>
    </section>
  );
}

// ── Push notifications ──────────────────────────────────────────────────────
export function PushSection() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [perm, setPerm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [webBusy, setWebBusy] = useState(false);
  const [webRegistered, setWebRegistered] = useState(false);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    meApi.prefs().then(setData).catch((e) => setLoadError(e.message || "Could not load notification settings."));
    setWebRegistered(browserPushRegistered());
    if (nativePushAvailable()) {
      nativePushPermission().then(setPerm).catch(() => setPerm("unavailable"));
    } else {
      setPerm(typeof Notification === "undefined" ? "unavailable" : Notification.permission);
    }
  }, []);
  if (loadError) return <section className={SECTION}><H icon={BellRing}>Phone notifications</H><p className="ctl-error">{loadError}</p></section>;
  if (!data) return <section className={SECTION}><H icon={BellRing}>Phone notifications</H><p className="text-sm text-ink-muted"><Loader2 size={14} className="mr-1 inline animate-spin" />Loading notification settings…</p></section>;
  const p = data.prefs;
  async function save(next) {
    setData((d) => ({ ...d, prefs: next }));
    setSaving(true);
    try { await meApi.savePrefs(next); } catch (e) { notify.error(e.message); } finally { setSaving(false); }
  }
  async function enableBrowserNotifications() {
    setWebBusy(true);
    try {
      await registerFcmToken(user?.uid, { requestPermission: true });
      setWebRegistered(true);
      setPerm(Notification.permission);
      setData(await meApi.prefs());
      notify.success("This browser is set up for notifications.");
    } catch (e) {
      setPerm(typeof Notification === "undefined" ? "unavailable" : Notification.permission);
      notify.error(e.message || "Could not enable browser notifications.");
    } finally {
      setWebBusy(false);
    }
  }
  const quietOn = !!(p.quietStart && p.quietEnd);
  return (
    <section className={SECTION}>
      <H icon={BellRing}>Notifications {saving && <Loader2 size={13} className="animate-spin text-ink-muted" />}</H>
      {nativePushAvailable() && perm !== "granted" && (
        <div className="ctl-note flex flex-wrap items-center justify-between gap-2">
          <span>Notifications are blocked for Academicall on this phone.</span>
          <button type="button" className="ctl-btn is-ghost" onClick={async () => { await registerNativePush(); setPerm(await nativePushPermission()); }}>Allow</button>
        </div>
      )}
      {!nativePushAvailable() && (
        <div className="ctl-note flex flex-wrap items-center justify-between gap-2">
          <span>
            {browserPushAvailability() === "unsupported"
              ? "This browser does not support web notifications."
              : browserPushAvailability() === "unconfigured"
                ? "Browser notifications are not configured for this deployment."
                : webRegistered && perm === "granted"
                  ? "This browser is registered for notifications."
                  : perm === "denied"
                    ? "Notifications are blocked for this site in your browser settings."
                    : "Allow notifications to receive alerts in this browser."}
          </span>
          {browserPushAvailability() === "available" && (
            <button type="button" className="ctl-btn is-ghost" disabled={webBusy} onClick={enableBrowserNotifications}>
              {webBusy ? <Loader2 size={14} className="animate-spin" /> : null}
              {webRegistered && perm === "granted" ? "Refresh browser registration" : "Enable browser notifications"}
            </button>
          )}
        </div>
      )}
      {!data.pushReady && <p className="text-xs text-ink-muted">The push service is not configured on the server yet. Device registration can be saved, but alerts will not be sent until the server is configured.</p>}
      <div className="acs-row">
        <span>Send notifications to my phone</span>
        <Switch on={p.push !== false} onChange={(v) => save({ ...p, push: v })} label="Push notifications" />
      </div>
      {p.push !== false && (
        <ul className="acs-list">
          {data.groups.map((g) => (
            <li key={g.key}>
              <span className="text-sm text-ink">{g.label}</span>
              <Switch on={p.types?.[g.key] !== false} onChange={(v) => save({ ...p, types: { ...(p.types || {}), [g.key]: v } })} label={g.label} />
            </li>
          ))}
        </ul>
      )}
      <div className="acs-row">
        <span>Quiet hours <span className="text-xs text-ink-muted">(no phone alerts; they wait in the app)</span></span>
        <Switch on={quietOn} onChange={(v) => save({ ...p, quietStart: v ? "22:00" : null, quietEnd: v ? "06:00" : null })} label="Quiet hours" />
      </div>
      {quietOn && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
          From <input type="time" className="ctl-input !w-32" value={p.quietStart} onChange={(e) => save({ ...p, quietStart: e.target.value })} />
          to <input type="time" className="ctl-input !w-32" value={p.quietEnd} onChange={(e) => save({ ...p, quietEnd: e.target.value })} />
          <span className="text-xs text-ink-muted">Lagos time</span>
        </div>
      )}
      <p className="text-xs text-ink-muted">Security alerts always come through.</p>
    </section>
  );
}

// ── Privacy + blocked people ────────────────────────────────────────────────
export function PrivacySection() {
  const [p, setP] = useState(null);
  const [blocks, setBlocks] = useState(null);
  useEffect(() => {
    meApi.privacy().then((r) => setP(r.privacy)).catch(() => {});
    meApi.blocks().then((r) => setBlocks(r.items)).catch(() => setBlocks([]));
  }, []);
  async function save(next) {
    setP(next);
    await meApi.savePrivacy(next).catch((e) => notify.error(e.message));
  }
  async function unblock(u) {
    await meApi.unblock(u.id).catch((e) => notify.error(e.message));
    setBlocks((xs) => xs.filter((x) => x.id !== u.id));
  }
  if (!p) return null;
  const VIS = [["everyone", "Everyone on Academicall"], ["classmates", "People in my programme"], ["nobody", "Only me and staff"]];
  return (
    <section className={SECTION}>
      <H icon={EyeOff}>Privacy</H>
      <div>
        <p className="mb-1.5 text-sm text-ink">Who can see my profile</p>
        <div className="utme-filter">
          {VIS.map(([k, label]) => <button type="button" key={k} className={p.profileVisibility === k ? "is-on" : ""} onClick={() => save({ ...p, profileVisibility: k })}>{label}</button>)}
        </div>
      </div>
      <div className="acs-row"><span>Show my department and level</span><Switch on={p.showDepartment !== false} onChange={(v) => save({ ...p, showDepartment: v })} label="Show department" /></div>
      <div className="acs-row"><span>Show my courses</span><Switch on={p.showCourses !== false} onChange={(v) => save({ ...p, showCourses: v })} label="Show courses" /></div>
      <div className="acs-row"><span>Show my phone number</span><Switch on={!!p.showPhone} onChange={(v) => save({ ...p, showPhone: v })} label="Show phone" /></div>
      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">Blocked people</p>
        {!blocks?.length ? <p className="text-sm text-ink-muted">You haven't blocked anyone. Use ⋯ on a message to block or report someone.</p> : (
          <ul className="acs-list">
            {blocks.map((b) => (
              <li key={b.id}>
                <span className="text-sm text-ink">{b.nickname || b.name}{b.uniqueId ? <span className="ml-2 text-xs text-ink-muted num">{b.uniqueId}</span> : null}</span>
                <button type="button" className="ctl-btn is-ghost" onClick={() => unblock(b)}>Unblock</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── Your data ───────────────────────────────────────────────────────────────
export function DataSection({ showDataSaver = true }) {
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState([]);
  const [saver, setSaver] = useDataSaver();
  useEffect(() => { meApi.dataRequests().then((r) => setRequests(r.items)).catch(() => {}); }, []);
  const pendingDelete = requests.find((r) => r.kind === "delete" && r.status === "pending");

  async function download() {
    setBusy(true);
    try { await meApi.downloadData(); notify.success("Your data is downloading"); } catch (e) { notify.error(e.message); } finally { setBusy(false); }
  }
  async function askDelete() {
    const note = await appPrompt("Staff will erase your account and everything in it, then tell you when it's done. You can also close the account yourself from Settings.", { title: "Ask staff to delete my account?", placeholder: "Anything staff should know (optional)", confirmLabel: "Send request", tone: "danger" });
    if (note === null) return;
    try {
      const r = await meApi.requestDeletion(note || undefined);
      setRequests((xs) => [r.request, ...xs]);
      notify.success("Request sent");
    } catch (e) { notify.error(e.message); }
  }

  return (
    <section className={SECTION}>
      <H icon={Database}>Your data</H>
      <div className="acs-row">
        <span className="text-sm text-ink-secondary">Download a copy of what Academicall holds about you: profile, courses, results, practice history, posts and sign-ins.</span>
        <button type="button" className="ctl-btn is-ghost shrink-0" onClick={download} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download</button>
      </div>
      <div className="acs-row">
        <span className="text-sm text-ink-secondary">{pendingDelete ? `Deletion request sent ${fmtDateTime(pendingDelete.createdAt)}. Staff will be in touch.` : "Ask staff to erase your account and data."}</span>
        {!pendingDelete && <button type="button" className="ctl-btn is-ghost shrink-0" onClick={askDelete}>Request deletion</button>}
      </div>
      {showDataSaver && (
        <div className="acs-row">
          <span>Data saver <span className="block text-xs text-ink-muted">Skip cover pictures and previews, and load question pictures only when you open them.</span></span>
          <Switch on={saver} onChange={setSaver} label="Data saver" />
        </div>
      )}
    </section>
  );
}
