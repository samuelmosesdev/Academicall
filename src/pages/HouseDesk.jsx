import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Loader2, MessageCircle, Plus, Shield, Users } from "lucide-react";
import { housesApi, institutionTitle } from "../lib/aspirantApi";
import { timeAgo } from "../lib/newsApi";
import { useAuth } from "../context/AuthContext";
import { can, homePathFor } from "../lib/roles";
import { ErrorState, LoadingState } from "../components/ui";
import { HouseHeader, ThreadComposer, ThreadList, ThreadView } from "../components/house/HouseView";
import HouseMembers from "../components/house/HouseMembers";

/**
 * House desk — where House Leaders (students or agents the admin picked) run their houses:
 * start and pin threads, mention members, and manage membership.
 * Routes: /house-desk, /house-desk/:houseId, /house-desk/:houseId/members, /house-desk/:houseId/t/:threadId
 */
export function HouseDeskLayout() {
  const { profile } = useAuth();
  const [mine, setMine] = useState(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => housesApi.mine().then(setMine).catch((e) => setError(e.message)), []);
  useEffect(() => { reload(); }, [reload]);
  return (
    <div className="sec-shell">
      <header className="sec-mast">
        <div className="sec-mast-inner">
          <Link to={homePathFor(profile)} className="sec-back"><ArrowLeft size={15} /> Dashboard</Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="sec-eyebrow"><Shield size={13} /> House Leader</p>
              <h1 className="sec-title">House desk</h1>
              <p className="sec-sub">Post updates, pin what matters, mention members and keep each Aspirant House friendly.</p>
            </div>
            {can(profile, "houses.manage") && (
              <Link to={profile?.role === "admin" ? "/admin/houses" : "/agent/houses"} className="sec-new"><Building2 size={16} /> All houses</Link>
            )}
          </div>
        </div>
      </header>
      <main className="sec-main">
        {error ? <ErrorState title="House desk unavailable" message={error} onRetry={reload} /> : !mine ? <LoadingState message="Opening your houses…" /> : <Outlet context={{ mine, reload }} />}
      </main>
    </div>
  );
}

export function HouseDeskHome() {
  const { mine } = useOutletContext();
  const { profile } = useAuth();
  const first = profile?.nickname || profile?.name?.split(" ")[0] || "there";
  if (!mine.leading.length) {
    return (
      <div className="rounded-[1.4rem] border border-dashed border-border-strong bg-bg-panel px-6 py-14 text-center">
        <Shield className="mx-auto text-text-muted" />
        <p className="mt-3 font-display text-xl text-text-primary">No houses assigned yet</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">An admin chooses which Aspirant Houses you lead. They'll appear here as soon as you're added.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <p className="font-display text-[1.6rem] leading-tight text-text-primary">Hi {first}. <span className="text-text-muted">You lead {mine.leading.length === 1 ? "one house" : `${mine.leading.length} houses`}.</span></p>
      <div className="grid gap-4 md:grid-cols-2">
        {mine.leading.map((h) => (
          <Link key={h.id} to={`/house-desk/${h.id}`} className="group relative overflow-hidden rounded-[1.5rem] bg-midnight p-6 text-white">
            {h.coverUrl && <img src={h.coverUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-25" />}
            <div className="relative">
              <p className="eyebrow text-aqua">{institutionTitle(h.institution)}</p>
              <p className="mt-2 font-display text-[1.6rem] leading-tight">{h.name}</p>
              <div className="mt-5 flex items-center gap-4 text-sm text-white/70">
                <span className="inline-flex items-center gap-1.5"><Users size={14} /> {h.memberCount}</span>
                <span className="inline-flex items-center gap-1.5"><MessageCircle size={14} /> {h.threadCount}</span>
                {h.lastThreadAt && <span>Last post {timeAgo(h.lastThreadAt)}</span>}
                <ArrowRight size={16} className="ml-auto transition group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function HouseDeskHouse() {
  const { houseId, threadId } = useParams();
  const navigate = useNavigate();
  const [house, setHouse] = useState(null);
  const [err, setErr] = useState("");
  const [composer, setComposer] = useState(null); // { mention }
  const [refreshKey, setRefreshKey] = useState(0);
  const location = useLocation();
  const tab = location.pathname.endsWith("/members") ? "members" : "threads";

  useEffect(() => {
    let alive = true;
    setHouse(null); setErr("");
    housesApi.get(houseId).then((h) => alive && setHouse(h)).catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [houseId]);

  if (err) return <ErrorState title="Couldn't open this house" message={err} />;
  if (!house) return <div className="flex items-center gap-2 py-10 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Loading house…</div>;
  const base = `/house-desk/${houseId}`;

  return (
    <div className="space-y-5">
      <Link to="/house-desk" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-accent"><ArrowLeft size={15} /> My houses</Link>
      {!threadId && (
        <HouseHeader
          house={house.house}
          leaders={house.leaders}
          viewer={house.viewer}
          actions={house.viewer.canPost && <button type="button" onClick={() => setComposer({})} className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-sm font-semibold text-midnight"><Plus size={15} /> New thread</button>}
        />
      )}
      {!threadId && (
        <nav className="sec-tabs !mt-0 !border-0">
          <NavLink to={base} end className={() => (tab === "threads" ? "is-on" : "")}><MessageCircle size={15} /> Threads</NavLink>
          <NavLink to={`${base}/members`} className={() => (tab === "members" ? "is-on" : "")}><Users size={15} /> Members <span className="ml-1 opacity-60">{house.house.memberCount}</span></NavLink>
        </nav>
      )}
      {threadId
        ? <ThreadView houseId={houseId} threadId={threadId} basePath={base} viewer={house.viewer} />
        : tab === "members"
          ? <HouseMembers houseId={houseId} onMention={(m) => setComposer({ mention: m })} />
          : <ThreadList houseId={houseId} basePath={base} viewer={house.viewer} refreshKey={refreshKey} />}
      {composer && (
        <MentionStarter
          houseId={houseId}
          mention={composer.mention}
          onClose={() => setComposer(null)}
          onSaved={(t) => { setComposer(null); setRefreshKey((k) => k + 1); navigate(`${base}/t/${t.id}`); }}
        />
      )}
    </div>
  );
}

/** Opens the composer, pre-filled with an @mention when started from the member list. */
function MentionStarter({ houseId, mention, onClose, onSaved }) {
  const seed = mention ? { id: null, title: "", body: `@[${mention.name}](user:${mention.userId}) `, imageUrl: "", pinned: false, _seed: true } : null;
  return <ThreadComposer houseId={houseId} thread={seed} onClose={onClose} onSaved={onSaved} />;
}
