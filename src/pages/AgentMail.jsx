import { useState } from "react";
import { Mail, ExternalLink, PanelTopOpen, PanelTopClose } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui";

const WEBMAIL_URL = "https://webmail.hostinger.com/";

/**
 * Work email (Hostinger webmail). Most mail hosts forbid being embedded in another
 * site (X-Frame-Options), so the reliable way in is a new tab; an embedded view is
 * offered as an opt-in for hosts/settings that allow it. A real in-app inbox would need
 * a backend IMAP bridge and each person's mailbox password.
 */
export default function AgentMail() {
  const { user, profile } = useAuth();
  const [embedded, setEmbedded] = useState(false);
  const email = profile?.email || user?.email || "";

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Work email" description="Your Academicall mailbox, one click away." />

      <section className="rounded-2xl border border-border-subtle bg-bg-panel p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Mail size={26} /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">Hostinger webmail</p>
              <p className="mt-0.5 truncate text-sm text-text-secondary">{email || "Your @academicall.site mailbox"}</p>
              <p className="mt-1 text-xs text-text-muted">Sign in with your mailbox password (separate from your Academicall login).</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={WEBMAIL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-bg-app hover:opacity-95">
              <ExternalLink size={15} /> Open webmail
            </a>
            <button type="button" onClick={() => setEmbedded((v) => !v)} className="inline-flex items-center gap-2 rounded-full border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-panel-alt">
              {embedded ? <PanelTopClose size={15} /> : <PanelTopOpen size={15} />}
              {embedded ? "Hide embedded view" : "Try embedded view"}
            </button>
          </div>
        </div>
      </section>

      {embedded && (
        <section className="space-y-2">
          <iframe title="Hostinger webmail" src={WEBMAIL_URL} className="h-[70vh] w-full rounded-2xl border border-border-subtle bg-bg-panel" referrerPolicy="no-referrer" />
          <p className="text-xs text-text-muted">
            If this area stays blank, the mail host does not allow embedding — use <a className="text-accent hover:underline" href={WEBMAIL_URL} target="_blank" rel="noopener noreferrer">Open webmail</a> instead.
          </p>
        </section>
      )}
    </div>
  );
}
