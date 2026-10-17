import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Building2, Compass, Loader2, Settings2, Shield } from "lucide-react";
import { housesApi, institutionTitle } from "../lib/aspirantApi";
import { useRealtime } from "../lib/realtime";
import { useAuth } from "../context/AuthContext";
import { isHouseLeader } from "../lib/roles";
import { HouseHeader, ThreadList, ThreadView } from "../components/house/HouseView";
import { EmptyState } from "../components/ui";
import { SkeletonCards } from "../components/ui/Skeleton";

/**
 * Aspirant House — one per institution of choice. Members read threads and reply;
 * House Leaders post (from here or their House desk).
 * Routes: /dashboard/house, /dashboard/house/:houseId, /dashboard/house/:houseId/t/:threadId
 */
export default function AspirantHouse() {
  const { houseId, threadId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState(null);
  const [house, setHouse] = useState(null);
  const [err, setErr] = useState("");

  const loadMine = useCallback(() => housesApi.mine().then(setMine).catch((e) => setErr(e.message)), []);
  useEffect(() => { loadMine(); }, [loadMine]);
  useRealtime(["house.thread", "house.removed", "reconnected"], () => loadMine());

  useEffect(() => {
    if (!houseId) return undefined;
    let alive = true;
    setHouse(null); setErr("");
    housesApi.get(houseId).then((h) => alive && setHouse(h)).catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [houseId]);

  if (!mine && !err) return <div className="flex items-center gap-2 py-16 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Opening your houses…</div>;

  const houses = [...(mine?.member || []), ...(mine?.leading || []).filter((l) => !(mine?.member || []).some((m) => m.id === l.id)).map((l) => ({ ...l, leading: true }))];
  if (!houseId && houses.length) return <Navigate to={`/dashboard/house/${houses[0].id}`} replace />;

  if (!houses.length && !houseId) {
    return (
      <EmptyState
        icon={Compass}
        title={profile?.role === "aspirant" ? "Pick an institution to join its house" : "You're not in an Aspirant House"}
        description={profile?.role === "aspirant" ? "Aspirant Houses are where everyone aiming for the same institution gets updates from House Leaders." : "Aspirant Houses are for people seeking admission. House Leaders find their houses in the House desk."}
        action={profile?.role === "aspirant"
          ? <Link to="/dashboard/choices" className="acx-btn">Choose institutions</Link>
          : isHouseLeader(profile) ? <Link to="/house-desk" className="acx-btn">Open House desk</Link> : null}
      />
    );
  }

  const base = `/dashboard/house/${houseId}`;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {houses.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {houses.map((h) => (
            <button key={h.id} type="button" onClick={() => navigate(`/dashboard/house/${h.id}`)} className={`house-tab ${h.id === houseId ? "is-on" : ""}`}>
              {h.leading ? <Shield size={14} /> : <Building2 size={14} />}
              <span className="max-w-[14rem] truncate">{institutionTitle(h.institution)}</span>
              <span className="text-[0.7rem] font-bold uppercase tracking-wider opacity-60">{h.leading ? "Leader" : h.choiceRank === 1 ? "1st" : "2nd"}</span>
              {h.unread > 0 && h.id !== houseId && <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-lemon px-1.5 text-[0.7rem] font-bold text-midnight">{h.unread > 9 ? "9+" : h.unread}</span>}
            </button>
          ))}
        </div>
      )}

      {err && <p className="rounded-2xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{err}</p>}
      {!house && !err && <SkeletonCards label="Loading house…" />}
      {house && (
        <>
          {!threadId && (
            <HouseHeader
              house={house.house}
              leaders={house.leaders}
              viewer={house.viewer}
              actions={
                <>
                  {house.viewer.isLeader && <Link to={`/house-desk/${house.house.id}/members`} className="inline-flex items-center gap-1.5 rounded-full bg-lemon px-4 py-2 text-sm font-semibold text-midnight"><Shield size={14} /> Manage members</Link>}
                  {profile?.role === "aspirant" && <Link to="/dashboard/choices" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"><Settings2 size={14} /> My choices</Link>}
                </>
              }
            />
          )}
          {house.house.rules && !threadId && (
            <details className="rounded-2xl border border-border-subtle bg-bg-panel px-4 py-3 text-sm text-text-secondary">
              <summary className="cursor-pointer font-semibold text-text-primary">House rules</summary>
              <p className="mt-2 whitespace-pre-line">{house.house.rules}</p>
            </details>
          )}
          {threadId
            ? <ThreadView houseId={houseId} threadId={threadId} basePath={base} viewer={house.viewer} />
            : <ThreadList houseId={houseId} basePath={base} viewer={house.viewer} />}
        </>
      )}
    </div>
  );
}
