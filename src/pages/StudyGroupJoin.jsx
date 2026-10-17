import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, BadgeCheck, Clock, Loader2, Lock, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { groupsApi } from "../lib/api";
import { notify } from "../lib/dialogs";
import { useRealtime } from "../lib/realtime";
import { PENDING_INVITE_KEY } from "../lib/groupInvite";
import { GroupAvatar } from "../components/groups/common";
import { refreshGroups, upsertGroup } from "../hooks/useGroups";

export { PENDING_INVITE_KEY } from "../lib/groupInvite";

/**
 * /study/:code — the public invite link. Remembers the code so it survives
 * sign-in, sign-up and profile setup, then opens the join screen.
 */
export function StudyInviteRedirect() {
  const { code } = useParams();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (code && /^[A-Za-z0-9]{6,16}$/.test(code)) localStorage.setItem(PENDING_INVITE_KEY, code);
  }, [code]);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: { pathname: `/dashboard/groups/join/${code}` } }} />;
  return <Navigate to={`/dashboard/groups/join/${code}`} replace />;
}

export default function StudyGroupJoin() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [group, setGroup] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await groupsApi.preview(code);
      setGroup(res.group);
      if (res.group.myStatus === "active") navigate(`/dashboard/groups/${res.group.id}`, { replace: true });
    } catch (err) {
      setError(err.message || "This invite link doesn't work");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    localStorage.removeItem(PENDING_INVITE_KEY);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Approval arrives live.
  useRealtime(["group.member"], (data) => {
    if (group && data?.groupId === group.id && data.userId === profile?.id) {
      if (data.status === "active") {
        notify.success(`You're in! Welcome to ${group.name}`);
        refreshGroups();
        navigate(`/dashboard/groups/${group.id}`, { replace: true });
      } else load();
    }
  });

  async function join() {
    setBusy(true);
    try {
      const res = await groupsApi.join(code);
      if (res.status === "active") {
        upsertGroup({ ...res.group, unreadCount: 0 }, user?.uid);
        notify.success(`You joined ${group.name}`);
        navigate(`/dashboard/groups/${res.group.id}`, { replace: true });
      } else {
        setGroup((g) => ({ ...g, myStatus: "pending" }));
        refreshGroups();
        notify.success("Request sent. You'll be let in once it's approved.");
      }
    } catch (err) {
      notify.error(err.message || "Couldn't join the group");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await groupsApi.cancelRequest(group.id);
      setGroup((g) => ({ ...g, myStatus: null }));
      refreshGroups();
    } catch (err) {
      notify.error(err.message || "Couldn't cancel the request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
      <div className="w-full rounded-[1.25rem] border border-border-subtle bg-bg-panel p-7 text-center shadow-[var(--shadow-pop)]">
        {loading ? (
          <Loader2 size={22} className="mx-auto animate-spin text-violet" />
        ) : error ? (
          <>
            <AlertCircle size={28} className="mx-auto text-status-danger" />
            <p className="mt-3 font-display text-xl text-text-primary">Invite link not found</p>
            <p className="mt-1 text-sm text-text-muted">{error}</p>
            <button type="button" onClick={() => navigate("/dashboard/groups")} className="btn-primary mt-5 px-5 py-2.5 text-sm">Go to my groups</button>
          </>
        ) : (
          <>
            <p className="eyebrow text-text-muted">You're invited to</p>
            <GroupAvatar group={group} size={84} className="mx-auto mt-4" />
            <h1 className="mt-3 font-display text-2xl text-text-primary">{group.name}</h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-text-muted">
              <Users size={13} /> {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
              {group.official && <><span>·</span><BadgeCheck size={13} className="text-midnight" /> Class group</>}
            </p>
            {group.scopeLabel && <p className="mt-1 text-xs text-text-muted">{group.scopeLabel}</p>}
            {group.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-text-secondary">{group.description}</p>}
            <p className="mt-3 text-xs text-text-muted">Created by {group.createdByName}</p>

            <div className="mt-6 space-y-2 rounded-2xl bg-bg-panel-alt p-3 text-left text-xs text-text-secondary">
              <p className="flex items-start gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-violet" />{group.approvalRequired ? "The creator or a moderator approves new members." : "You'll join straight away."}</p>
              <p className="flex items-start gap-2"><Lock size={14} className="mt-0.5 shrink-0 text-violet" />You'll see messages sent after you join. You can ask for earlier ones.</p>
            </div>

            {group.myStatus === "pending" ? (
              <div className="mt-6">
                <p className="flex items-center justify-center gap-1.5 rounded-full bg-lemon-soft px-4 py-2.5 text-sm font-semibold text-midnight"><Clock size={15} /> Waiting for approval</p>
                <button type="button" disabled={busy} onClick={cancel} className="mt-3 text-xs font-semibold text-text-muted underline">Cancel request</button>
              </div>
            ) : !group.eligible ? (
              <p className="mt-6 rounded-2xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">This class group is only for {group.scopeLabel || "a specific programme"} students.</p>
            ) : group.full ? (
              <p className="mt-6 rounded-2xl bg-bg-panel-alt px-4 py-3 text-sm text-text-secondary">This group is full ({group.maxMembers} members).</p>
            ) : (
              <button type="button" disabled={busy} onClick={join} className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm">
                {busy && <Loader2 size={15} className="animate-spin" />}
                {group.myStatus === "rejected" || group.myStatus === "removed" ? "Ask to join again" : group.approvalRequired ? "Ask to join" : "Join group"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
