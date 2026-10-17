import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Clock,
  Loader2,
  MessagesSquare,
  Plus,
  Search,
  Users,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { groupsApi } from "../lib/api";
import { notify } from "../lib/dialogs";
import { useRealtime } from "../lib/realtime";
import { refreshGroups, upsertGroup, useGroups } from "../hooks/useGroups";
import GroupConversation from "../components/groups/GroupConversation";
import GroupInfoPanel from "../components/groups/GroupInfoPanel";
import GroupFormModal from "../components/groups/GroupFormModal";
import { GroupAvatar, OfficialBadge, listTime } from "../components/groups/common";
import LiveIndicator from "../components/ui/LiveIndicator";

function useIsDesktop() {
  const query = "(min-width: 1024px)";
  const [desktop, setDesktop] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : true));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

function GroupRow({ group, active, onOpen }) {
  const pending = group.myStatus === "pending";
  const preview = pending
    ? "Waiting for approval"
    : group.lastMessagePreview
      ? `${group.lastMessageSender && group.lastMessageType !== "system" ? `${group.lastMessageSender}: ` : ""}${group.lastMessagePreview}`
      : "No messages yet";
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(group)}
        aria-current={active ? "true" : undefined}
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${active ? "bg-violet-soft" : "hover:bg-bg-panel-alt"}`}
      >
        <GroupAvatar group={group} size={48} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[0.95rem] font-semibold text-text-primary">{group.name}</span>
            {group.official && <OfficialBadge className="hidden shrink-0 xl:inline-flex" />}
            <span className={`ml-auto shrink-0 text-xs ${group.unreadCount ? "font-semibold text-violet" : "text-text-muted"}`}>
              {pending ? "" : listTime(group.lastMessageAt)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={`min-w-0 flex-1 truncate text-[0.83rem] ${pending ? "italic text-status-warning" : group.unreadCount ? "font-medium text-text-primary" : "text-text-muted"}`}>
              {pending && <Clock size={12} className="mr-1 inline" />}
              {preview}
            </span>
            {group.unreadCount > 0 && (
              <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-lemon px-1.5 text-[0.7rem] font-bold text-midnight">
                {group.unreadCount > 99 ? "99+" : group.unreadCount}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function StudentGroups() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const me = useMemo(() => ({ uid: user?.uid, role: profile?.role }), [user?.uid, profile?.role]);
  const { groups, loading, error } = useGroups(user?.uid);
  const desktop = useIsDesktop();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [discover, setDiscover] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    groupsApi.discover().then((r) => setDiscover(r.groups || [])).catch(() => {});
  }, []);
  useRealtime(["group.member"], () => groupsApi.discover().then((r) => setDiscover(r.groups || [])).catch(() => {}));

  useEffect(() => {
    setInfoOpen(false);
    setActiveGroup(null);
  }, [groupId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  }, [groups, query]);

  function open(group) {
    if (group.myStatus === "pending") {
      notify.info(`Your request to join ${group.name} is waiting for approval.`);
      return;
    }
    navigate(`/dashboard/groups/${group.id}`);
  }

  const showList = desktop || !groupId;
  const showChat = Boolean(groupId);

  return (
    <div className="-mx-4 -my-6 h-[calc(100dvh-4.1rem)] sm:-mx-8 sm:-my-8 lg:mx-0 lg:my-0 lg:h-[calc(100dvh-10rem)]">
      <div className="flex h-full min-h-0 overflow-hidden bg-bg-panel lg:rounded-[1.25rem] lg:border lg:border-border-subtle lg:shadow-[var(--shadow-card,0_1px_2px_rgba(15,3,38,0.04))]">
        {/* Group list */}
        {showList && (
          <section className={`min-h-0 w-full flex-col border-border-subtle lg:w-[22rem] lg:shrink-0 lg:border-r ${infoOpen && showChat ? "hidden 2xl:flex" : "flex"}`}>
            <div className="shrink-0 px-4 pb-3 pt-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="eyebrow text-text-muted">Study</p>
                  <h1 className="font-display text-2xl text-text-primary">Groups</h1>
                </div>
                <div className="flex items-center gap-2">
                  <LiveIndicator className="lg:hidden" />
                  <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm">
                    <Plus size={16} /> New
                  </button>
                </div>
              </div>
              {groups.length > 3 && (
                <label className="mt-4 flex items-center gap-2 rounded-full bg-bg-panel-alt px-3.5 py-2.5">
                  <Search size={15} className="text-text-muted" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search groups" className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none" />
                </label>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {loading && !groups.length ? (
                <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-violet" /></div>
              ) : error && !groups.length ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-text-secondary">{error}</p>
                  <button type="button" onClick={refreshGroups} className="mt-3 rounded-full bg-violet px-4 py-1.5 text-xs font-semibold text-white">Try again</button>
                </div>
              ) : (
                <>
                  {filtered.length > 0 && (
                    <ul className="space-y-0.5">
                      {filtered.map((g) => <GroupRow key={g.id} group={g} active={g.id === groupId} onOpen={open} />)}
                    </ul>
                  )}
                  {!groups.length && (
                    <div className="px-5 py-10 text-center">
                      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-soft text-violet"><Users size={24} /></span>
                      <p className="mt-4 font-display text-lg text-text-primary">Study better together</p>
                      <p className="mx-auto mt-1 max-w-[16rem] text-sm leading-relaxed text-text-muted">Create a group for a course or exam, then share its link with classmates.</p>
                      <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 text-sm">
                        <Plus size={15} /> Create a group
                      </button>
                    </div>
                  )}
                  {query && !filtered.length && groups.length > 0 && (
                    <p className="py-8 text-center text-sm text-text-muted">No groups match “{query}”.</p>
                  )}
                  {discover.length > 0 && !query && (
                    <div className="mt-5 px-2">
                      <p className="eyebrow mb-2 flex items-center gap-1.5 px-1 text-text-muted"><GraduationCap size={12} /> For your class</p>
                      <ul className="space-y-2">
                        {discover.map((g) => (
                          <li key={g.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-border-strong px-3 py-2.5">
                            <GroupAvatar group={g} size={40} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-text-primary">{g.name}</p>
                              <p className="truncate text-xs text-text-muted">{g.scopeLabel || "Class group"} · {g.memberCount} members</p>
                            </div>
                            <button type="button" onClick={() => navigate(`/study/${g.code}`)} className="rounded-full bg-lemon px-3 py-1.5 text-xs font-semibold text-midnight hover:brightness-105">
                              View
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/* Conversation */}
        {showChat ? (
          <section className={`min-h-0 min-w-0 flex-1 ${infoOpen && !desktop ? "hidden" : "flex"} flex-col`}>
            <GroupConversation
              key={groupId}
              groupId={groupId}
              me={me}
              compact={!desktop}
              infoOpen={infoOpen}
              onOpenInfo={() => setInfoOpen((v) => !v)}
              onGroupLoaded={setActiveGroup}
              refreshSignal={refreshSignal}
            />
          </section>
        ) : (
          desktop && (
            <section className="chat-wallpaper hidden flex-1 flex-col items-center justify-center p-10 text-center lg:flex">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-bg-panel text-violet shadow-sm"><MessagesSquare size={28} /></span>
              <p className="mt-4 font-display text-xl text-text-primary">Pick a group to start reading</p>
              <p className="mt-1 max-w-sm text-sm text-text-muted">Messages, photos, short videos and course documents appear here as they're sent.</p>
            </section>
          )
        )}

        {/* Info drawer */}
        {showChat && infoOpen && activeGroup && (
          <div className={desktop ? "w-[22rem] shrink-0 border-l border-border-subtle" : "flex min-h-0 w-full flex-col"}>
            <GroupInfoPanel
              group={activeGroup}
              me={me}
              onClose={() => setInfoOpen(false)}
              onUpdated={() => setRefreshSignal((n) => n + 1)}
            />
          </div>
        )}
      </div>

      <GroupFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        isCourseRep={profile?.role === "courseRep"}
        onSaved={(g) => {
          if (g) {
            upsertGroup({ ...g, unreadCount: 0 });
            navigate(`/dashboard/groups/${g.id}`);
          }
          refreshGroups();
        }}
      />
    </div>
  );
}
