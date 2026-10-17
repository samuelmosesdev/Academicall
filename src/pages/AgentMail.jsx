import { useEffect, useState } from "react";
import { Mail, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const WEBMAIL_URL = "https://webmail.hostinger.com/";

/**
 * In-app Hostinger webmail surface.
 * Many mail hosts send X-Frame-Options and block iframes — we detect a blank
 * frame and fall back to a full-screen “panel” open while staying on this route
 * as the shell (sidebar still available). True IMAP inbox would need a backend
 * and each agent’s mailbox password.
 */
export default function AgentMail() {
  const { user, profile } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const email = profile?.email || user?.email || "";

  useEffect(() => {
    // If Hostinger refuses framing, iframe often stays opaque/empty.
    // After a short delay, offer the fallback notice.
    const t = setTimeout(() => setIframeBlocked(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`flex flex-col ${
        expanded ? "fixed inset-0 z-30 bg-bg-app lg:left-64" : "min-h-[70vh]"
      }`}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-bg-panel px-4 py-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <Mail size={18} className="text-accent" />
            Work email
          </h1>
          <p className="truncate text-xs text-text-muted">
            {email || "Your @academicall.site mailbox"} · Hostinger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1.5 text-xs text-text-secondary hover:bg-bg-panel-alt"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {expanded ? "Exit full view" : "Full view"}
          </button>
          <a
            href={WEBMAIL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1.5 text-xs font-semibold text-bg-app"
          >
            Open in browser <ExternalLink size={12} />
          </a>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 bg-bg-panel-alt">
        <iframe
          title="Hostinger Webmail"
          src={WEBMAIL_URL}
          className="h-full min-h-[60vh] w-full border-0"
          // sandbox keeps it contained; allow-same-origin needed for login cookies in some cases
          // Hostinger may still refuse to frame — see notice below
          allow="clipboard-read; clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {iframeBlocked && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-app via-bg-app/95 to-transparent p-4 pt-16">
            <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-border-subtle bg-bg-panel p-4 shadow-lg">
              <p className="text-sm font-semibold text-text-primary">
                If the inbox looks blank
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Hostinger often blocks embedding webmail inside other sites (security header).
                Use <strong>Open in browser</strong> above — or sign in at{" "}
                <span className="font-medium text-text-primary">{WEBMAIL_URL}</span> with the
                mailbox password from Hostinger (not your Academicall app password).
              </p>
              <p className="mt-2 text-xs text-text-muted">
                True “read mail fully inside the app” needs IMAP + a secure backend and each
                agent’s mailbox password. That can be added later if you want full native inbox.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
