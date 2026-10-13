import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check, Copy, Crown, History, Link2, Loader2, LogOut, Megaphone, MoreHorizontal, Pencil, Search, Share2,
  Shield, ShieldOff, Trash2, UserMinus, Users, X,
} from "lucide-react";
import { groupsApi } from "../../lib/api";
import { appConfirm, notify } from "../../lib/dialogs";
import { useRealtime } from "../../lib/realtime";
import { GroupAvatar, OfficialBadge, PersonAvatar, RoleBadge, listTime } from "./common";
import GroupFormModal from "./GroupFormModal";
import { dropGroup, refreshGroups } from "../../hooks/useGroups";

function MemberMenu({ member, group, meId, onChanged }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isCreator = group.myRole === "creator";
  const isMod = group.myRole === "moderator";
  if (member.userId === meId || member.role === "creator") return null;
  const canRemove = isCreator || (isMod && member.role === "member");
  if (!isCreator && !canRemove) return null;

  async function run(fn, success) {
    setOpen(false);
    setBusy(true);
    try {
      await fn();
      if (success) notify.success(success);
      onChanged();
    } catch (err) {
      notify.error(err.message || "That didn't work");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-panel-alt" aria-label={`Options for ${member.name}`}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <MoreHorizontal size={16} />}
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-xl border border-border-subtle bg-bg-panel py-1 shadow-[var(--shadow-pop)]">
            {isCreator && member.role === "member" && (
              <button type="button" disabled={(group.moderatorCount || 0) >= (group.maxModerators || 3)} onClick={() => run(() => groupsApi.setRole(group.id, member.userId, "moderator"), `${member.name} is now a moderator`)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-panel-alt disabled:opacity-50">
                <Shield size={14} /> Make moderator
                {(group.moderatorCount || 0) >= (group.maxModerators || 3) && <span className="ml-auto text-[10px] text-text-muted">3 max</span>}
              </button>
            )}
            {isCreator && member.role === "moderator" && (
              <button type="button" onClick={() => run(() => groupsApi.setRole(group.id, member.userId, "member"), "Moderator privileges removed")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-panel-alt">
                <ShieldOff size={14} /> Remove as moderator
              </button>
            )}
            {isCreator && (
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  if (await appConfirm(`${member.name} will become the group creator, and you'll be a regular member.`, { title: "Make group creator?", confirmLabel: "Transfer" })) {
                    run(() => groupsApi.transfer(group.id, member.userId), "Ownership transferred");
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-panel-alt"
              >
                <Crown size={14} /> Make group creator
              </button>
            )}
            {canRemove && (
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  if (await appConfirm(`Remove ${member.name} from the group? They'll need approval to rejoin.`, { title: "Remove member", confirmLabel: "Remove", tone: "danger" })) {
                    run(() => groupsApi.removeMember(group.id, member.userId), `${member.name} was removed`);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-status-danger hover:bg-status-danger/10"
              >
                <UserMinus size={14} /> Remove from group
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RequestRow({ person, kind, onApprove, onReject }) {
  const [busy, setBusy] = useState(null);
  const act = async (which, fn) => {
    setBusy(which);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  return (
    <li className="flex items-center gap-3 py-2.5">
      <PersonAvatar person={person} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{person.name}</p>
        <p className="truncate text-xs text-text-muted">
          {[person.program, person.level].filter(Boolean).join(" · ") || person.email || ""}
          {` · ${listTime(kind === "history" ? person.historyRequestedAt : person.requestedAt)}`}
        </p>
      </div>
      <button type="button" disabled={Boolean(busy)} onClick={() => act("no", onReject)} className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-text-secondary hover:bg-bg-panel-alt" aria-label={`Decline ${person.name}`}>
        {busy === "no" ? <Loader2 size={14} className="animate-spin" /> : <X size={15} />}
      </button>
      <button type="button" disabled={Boolean(busy)} onClick={() => act("yes", onApprove)} className="flex h-9 w-9 items-center justify-center rounded-full bg-violet text-white hover:bg-violet-deep" aria-label={`Approve ${person.name}`}>
        {busy === "yes" ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
      </button>
    </li>
  );
}

export default function GroupInfoPanel({ group, me, onClose, onUpdated }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("members");
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isCreator = group?.myRole === "creator";
  const isMod = isCreator || group?.myRole === "moderator";
  const isRep = me?.role === "courseRep";

  const load = useCallback(async () => {
    if (!group?.id) return;
    try {
      const [a, p, h] = await Promise.all([
        groupsApi.members(group.id, "active"),
        isMod ? groupsApi.members(group.id, "pending") : Promise.resolve({ members: [] }),
        isMod ? groupsApi.members(group.id, "history") : Promise.resolve({ members: [] }),
      ]);
      setMembers(a.members || []);
      setPending(p.members || []);
      setHistory(h.members || []);
    } catch (err) {
      notify.error(err.message || "Couldn't load members");
    } finally {
      setLoading(false);
    }
  }, [group?.id, isMod]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["group.member", "group.request", "group.updated", "poll"], (data, type) => {
    if (type === "poll" || data?.groupId === group?.id) { load(); onUpdated?.(); }
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((m) => `${m.name} ${m.program || ""}`.toLowerCase().includes(q)) : members;
  }, [members, query]);

  const changed = () => { load(); onUpdated?.(); refreshGroups(); };

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(group.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      notify.info(group.link, { title: "Copy this link" });
    }
  }

  async function shareLink() {
    const text = `Join "${group.name}" on Academicall`;
    if (navigator.share) {
      try { await navigator.share({ title: group.name, text, url: group.link }); } catch { /* dismissed */ }
    } else copyLink();
  }

  async function toggleApproval() {
    try {
      await groupsApi.update(group.id, { approvalRequired: !group.approvalRequired });
      notify.success(group.approvalRequired ? "Anyone with the link can now join" : "New members now need approval");
      onUpdated?.();
    } catch (err) {
      notify.error(err.message || "Couldn't change the setting");
    }
  }

  async function inviteClass() {
    if (!(await appConfirm(`Send an invite to every student in ${group.scopeLabel || "your class"} who isn't in the group yet?`, { title: "Invite your class", confirmLabel: "Send invites" }))) return;
    try {
      const res = await groupsApi.inviteScope(group.id);
      notify.success(res.invited ? `Invite sent to ${res.invited} student${res.invited === 1 ? "" : "s"}` : "Everyone in your class is already invited");
    } catch (err) {
      notify.error(err.message || "Couldn't send invites");
    }
  }

  async function leave() {
    if (!(await appConfirm(isCreator ? "You're the creator. If you're the only member, the group will be deleted." : "You'll stop getting messages from this group. You can ask to rejoin with the link.", { title: `Leave ${group.name}?`, confirmLabel: "Leave group", tone: "danger" }))) return;
    try {
      await groupsApi.leave(group.id);
      dropGroup(group.id);
      notify.success("You left the group");
      navigate("/dashboard/groups", { replace: true });
    } catch (err) {
      notify.error(err.message || "Couldn't leave the group");
    }
  }

  async function removeGroup() {
    if (!(await appConfirm("Every member loses access to the messages and files. This can't be undone.", { title: `Delete ${group.name}?`, confirmLabel: "Delete group", tone: "danger" }))) return;
    try {
      await groupsApi.remove(group.id);
      dropGroup(group.id);
      notify.success("Group deleted");
      navigate("/dashboard/groups", { replace: true });
    } catch (err) {
      notify.error(err.message || "Couldn't delete the group");
    }
  }

  if (!group) return null;
  const tabs = [
    { id: "members", label: "Members", count: members.length },
    ...(isMod ? [{ id: "requests", label: "Requests", count: pending.length }, { id: "history", label: "History", count: history.length }] : []),
  ];

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-bg-panel">
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
        <p className="font-display text-lg text-text-primary">Group info</p>
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-bg-panel-alt" aria-label="Close group info">
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 pb-5 pt-6 text-center">
          <GroupAvatar group={group} size={88} className="mx-auto" />
          <h2 className="mt-3 font-display text-xl text-text-primary">{group.name}</h2>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs text-text-muted">
            <span>{group.memberCount}/{group.maxMembers} members</span>
            {group.official && <OfficialBadge />}
          </div>
          {group.scopeLabel && <p className="mt-1 text-xs text-text-muted">{group.scopeLabel}</p>}
          {group.description && <p className="mx-auto mt-3 max-w-xs whitespace-pre-line text-sm leading-relaxed text-text-secondary">{group.description}</p>}
          {isCreator && (
            <button type="button" onClick={() => setEditOpen(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-semibold text-text-primary hover:bg-bg-panel-alt">
              <Pencil size={12} /> Edit name, picture & description
            </button>
          )}
        </div>

        {/* Invite */}
        <section className="mx-4 rounded-2xl border border-border-subtle bg-bg-panel-alt p-3.5">
          <p className="eyebrow mb-2 flex items-center gap-1.5 text-text-muted"><Link2 size={12} /> Invite link</p>
          <p className="truncate rounded-xl bg-bg-panel px-3 py-2 font-mono text-xs text-text-primary">{group.link.replace(/^https?:\/\//, "")}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={copyLink} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-bg-panel px-3 py-2 text-xs font-semibold text-text-primary ring-1 ring-border-subtle hover:ring-violet/40">
              {copied ? <Check size={13} className="text-aqua-deep" /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={shareLink} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-violet px-3 py-2 text-xs font-semibold text-white hover:bg-violet-deep">
              <Share2 size={13} /> Share
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-text-muted">
            {group.approvalRequired ? "People who open the link ask to join. The link alone doesn't show any messages." : "Anyone signed in with the link joins straight away."}
          </p>
          {group.official && isMod && isRep && (
            <button type="button" onClick={inviteClass} className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-lemon px-3 py-2 text-xs font-semibold text-midnight hover:brightness-105">
              <Megaphone size={13} /> Invite my whole class
            </button>
          )}
        </section>

        {isCreator && (
          <section className="mx-4 mt-3">
            <button type="button" role="switch" aria-checked={group.approvalRequired} onClick={toggleApproval} className="flex w-full items-center gap-3 rounded-2xl border border-border-subtle px-4 py-3 text-left hover:border-violet/40">
              <Shield size={17} className="text-violet" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-text-primary">Approve new members</span>
                <span className="block text-[11px] text-text-muted">You and moderators review join requests</span>
              </span>
              <span className={`relative h-6 w-10 rounded-full transition ${group.approvalRequired ? "bg-violet" : "bg-border-strong"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${group.approvalRequired ? "left-[1.125rem]" : "left-0.5"}`} />
              </span>
            </button>
          </section>
        )}

        {/* Tabs */}
        <div className="sticky top-0 z-10 mt-4 flex gap-1 border-b border-border-subtle bg-bg-panel px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-3 py-2.5 text-sm font-semibold transition ${tab === t.id ? "text-violet" : "text-text-muted hover:text-text-primary"}`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${t.id !== "members" ? "bg-lemon text-midnight" : "bg-bg-panel-alt text-text-muted"}`}>{t.count}</span>
              )}
              {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet" />}
            </button>
          ))}
        </div>

        <div className="px-4 pb-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-violet" /></div>
          ) : tab === "members" ? (
            <>
              {members.length > 8 && (
                <label className="mt-3 flex items-center gap-2 rounded-full bg-bg-panel-alt px-3 py-2">
                  <Search size={14} className="text-text-muted" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members" className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none" />
                </label>
              )}
              <ul className="mt-1 divide-y divide-border-subtle">
                {filtered.map((m) => (
                  <li key={m.userId} className="flex items-center gap-3 py-2.5">
                    <PersonAvatar person={m} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-text-primary">
                        <span className="truncate">{m.userId === me?.uid ? "You" : m.name}</span>
                        <RoleBadge role={m.role} />
                      </p>
                      <p className="truncate text-xs text-text-muted">{[m.program, m.level].filter(Boolean).join(" · ")}</p>
                    </div>
                    <MemberMenu member={m} group={group} meId={me?.uid} onChanged={changed} />
                  </li>
                ))}
              </ul>
              {isCreator && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-text-muted">
                  <Users size={12} /> {group.moderatorCount || 0} of {group.maxModerators || 3} moderators
                </p>
              )}
            </>
          ) : tab === "requests" ? (
            pending.length ? (
              <ul className="mt-1 divide-y divide-border-subtle">
                {pending.map((p) => (
                  <RequestRow
                    key={p.userId}
                    person={p}
                    kind="join"
                    onApprove={async () => {
                      try { await groupsApi.review(group.id, p.userId, "approve"); notify.success(`${p.name} joined the group`); changed(); }
                      catch (err) { notify.error(err.message || "Couldn't approve"); }
                    }}
                    onReject={async () => {
                      try { await groupsApi.review(group.id, p.userId, "reject"); changed(); }
                      catch (err) { notify.error(err.message || "Couldn't decline"); }
                    }}
                  />
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-text-muted">No one is waiting to join.</p>
            )
          ) : history.length ? (
            <>
              <p className="mt-3 rounded-xl bg-violet-soft px-3 py-2 text-[11px] leading-snug text-violet-deep">
                <History size={12} className="mr-1 inline" />
                Approving shows earlier text messages and files up to {group.limits?.historyAttachmentMb || 2} MB. Larger files stay hidden.
              </p>
              <ul className="mt-1 divide-y divide-border-subtle">
                {history.map((p) => (
                  <RequestRow
                    key={p.userId}
                    person={p}
                    kind="history"
                    onApprove={async () => {
                      try { await groupsApi.reviewHistory(group.id, p.userId, "approve"); notify.success(`${p.name} can now see earlier messages`); changed(); }
                      catch (err) { notify.error(err.message || "Couldn't approve"); }
                    }}
                    onReject={async () => {
                      try { await groupsApi.reviewHistory(group.id, p.userId, "reject"); changed(); }
                      catch (err) { notify.error(err.message || "Couldn't decline"); }
                    }}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-text-muted">No requests for earlier messages.</p>
          )}
        </div>

        <div className="space-y-2 border-t border-border-subtle px-4 py-4">
          <button type="button" onClick={leave} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-status-danger hover:bg-status-danger/10">
            <LogOut size={16} /> Leave group
          </button>
          {isCreator && (
            <button type="button" onClick={removeGroup} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-status-danger hover:bg-status-danger/10">
              <Trash2 size={16} /> Delete group
            </button>
          )}
        </div>
      </div>

      <GroupFormModal open={editOpen} onClose={() => setEditOpen(false)} group={group} onSaved={() => { onUpdated?.(); refreshGroups(); }} />
    </aside>
  );
}
