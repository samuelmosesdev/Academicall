import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import PinPad from "./PinPad";
import { vaultApi } from "../../lib/vaultApi";

const WEAK = new Set(["000000", "111111", "222222", "333333", "444444", "555555", "666666", "777777", "888888", "999999", "123456", "654321", "123123", "121212", "112233", "012345", "543210"]);

function Shell({ eyebrow, title, sub, children, onBack }) {
  return (
    <div className="vault-gate">
      <div className="vault-gate-glow" aria-hidden />
      {onBack && (
        <button type="button" onClick={onBack} className="absolute left-5 top-5 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
          <ArrowLeft size={16} /> Back
        </button>
      )}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <div className="vault-seal"><ShieldCheck size={26} strokeWidth={1.8} /></div>
        <p className="eyebrow mt-6 text-aqua">{eyebrow}</p>
        <h1 className="mt-2 font-display text-[2rem] leading-tight text-white">{title}</h1>
        {sub && <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/60">{sub}</p>}
        <div className="mt-8 w-full">{children}</div>
      </div>
    </div>
  );
}

/** Create PIN → confirm → unlocked. */
export function CreatePin({ onDone }) {
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function complete(p) {
    setErr("");
    if (!first) {
      if (WEAK.has(p)) { setErr("Too easy to guess. Avoid patterns like 123456."); setPin(""); return; }
      setFirst(p); setPin(""); return;
    }
    if (p !== first) { setErr("Those PINs don't match. Start again."); setFirst(""); setPin(""); return; }
    setBusy(true);
    try { await vaultApi.createPin(p); onDone(); }
    catch (e) { setErr(e.message); setFirst(""); setPin(""); }
    finally { setBusy(false); }
  }

  return (
    <Shell
      eyebrow={first ? "Step 2 of 2" : "Step 1 of 2 · Set up"}
      title={first ? "Confirm your PIN" : <>Create your <span className="serif-i text-lemon">vault PIN</span></>}
      sub={first ? "Enter the same 6 digits again." : "Six digits only you know. You'll need it every time you open your vault."}
      onBack={first ? () => { setFirst(""); setPin(""); setErr(""); } : undefined}
    >
      <PinPad value={pin} onChange={(v) => { setPin(v); setErr(""); }} onComplete={complete} disabled={busy} error={!!err} />
      <p className="mt-5 min-h-[1.25rem] text-sm text-[#ff8a80]" role="alert">{err}</p>
      {busy && <Loader2 className="mx-auto animate-spin text-white/60" size={18} />}
    </Shell>
  );
}

/** Enter PIN to unlock. */
export function UnlockPin({ status, onDone, onForgot }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(status?.locked ? status.lockedUntil : null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!lockedUntil) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);
  const remaining = lockedUntil ? Math.max(0, new Date(lockedUntil).getTime() - now) : 0;
  const isLocked = remaining > 0;

  async function complete(p) {
    setBusy(true);
    setErr("");
    try { await vaultApi.unlock(p); onDone(); }
    catch (e) {
      setErr(e.message);
      setPin("");
      if (e.status === 423) setLockedUntil(new Date(Date.now() + 15 * 60 * 1000));
    } finally { setBusy(false); }
  }

  const mm = Math.floor(remaining / 60000);
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <Shell
      eyebrow="Academicall Vault"
      title={isLocked ? "Vault locked" : <>Enter your <span className="serif-i text-lemon">PIN</span></>}
      sub={isLocked ? `Too many wrong tries. Try again in ${mm}:${ss}, or reset your PIN with a code sent to your email.` : "Your certificates, transcripts and IDs are encrypted behind it."}
    >
      <PinPad value={pin} onChange={(v) => { setPin(v); setErr(""); }} onComplete={complete} disabled={busy || isLocked} error={!!err} />
      <p className="mt-5 min-h-[1.25rem] text-sm text-[#ff8a80]" role="alert">{err}</p>
      <button type="button" onClick={onForgot} className="mt-2 text-sm font-medium text-aqua underline-offset-4 hover:underline">
        Forgot PIN?
      </button>
    </Shell>
  );
}

/** Email OTP → new PIN → confirm. */
export function RecoverPin({ onDone, onBack }) {
  const [stage, setStage] = useState("send"); // send | code | pin | confirm
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true); setErr("");
    try { const r = await vaultApi.sendRecovery(); setSentTo(r.sentTo); setStage("code"); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }
  async function finish(p) {
    if (p !== first) { setErr("Those PINs don't match. Start again."); setFirst(""); setPin(""); setStage("pin"); return; }
    setBusy(true); setErr("");
    try { await vaultApi.resetWithCode(code, p); onDone(); }
    catch (e) {
      setErr(e.message); setPin(""); setFirst("");
      setStage(/code/i.test(e.message) ? "code" : "pin");
    } finally { setBusy(false); }
  }

  if (stage === "send") {
    return (
      <Shell eyebrow="Reset vault PIN" title={<>We'll email you a <span className="serif-i text-lemon">code</span></>} sub="We'll send a 6-digit code to the email on your Academicall account. Your files stay encrypted the whole time." onBack={onBack}>
        <button type="button" onClick={send} disabled={busy} className="btn-warm inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Send me a code
        </button>
        <p className="mt-4 min-h-[1.25rem] text-sm text-[#ff8a80]" role="alert">{err}</p>
      </Shell>
    );
  }
  if (stage === "code") {
    return (
      <Shell eyebrow="Check your email" title="Enter the code" sub={`We sent a 6-digit code to ${sentTo}. It expires in 10 minutes.`} onBack={onBack}>
        <PinPad value={code} onChange={(v) => { setCode(v); setErr(""); }} onComplete={() => setStage("pin")} error={!!err} />
        <p className="mt-5 min-h-[1.25rem] text-sm text-[#ff8a80]" role="alert">{err}</p>
        <button type="button" onClick={send} disabled={busy} className="text-sm text-aqua underline-offset-4 hover:underline">Send a new code</button>
      </Shell>
    );
  }
  return (
    <Shell
      eyebrow="Choose a new PIN"
      title={first ? "Confirm new PIN" : <>New <span className="serif-i text-lemon">vault PIN</span></>}
      sub={first ? "Enter it once more." : "Six digits. Avoid birthdays and patterns."}
      onBack={() => { setStage("code"); setFirst(""); setPin(""); }}
    >
      <PinPad
        value={pin}
        onChange={(v) => { setPin(v); setErr(""); }}
        onComplete={(p) => {
          if (!first) {
            if (WEAK.has(p)) { setErr("Too easy to guess. Avoid patterns like 123456."); setPin(""); return; }
            setFirst(p); setPin(""); return;
          }
          finish(p);
        }}
        disabled={busy}
        error={!!err}
      />
      <p className="mt-5 min-h-[1.25rem] text-sm text-[#ff8a80]" role="alert">{err}</p>
    </Shell>
  );
}
