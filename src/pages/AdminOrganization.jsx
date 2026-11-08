import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, Users, Building2, Network } from "lucide-react";
import { PageHeader, LoadingState, ErrorState } from "../components/ui";
import { orgApi } from "../lib/api";
import OrgOverview from "../components/org/OrgOverview";
import StaffDirectory from "../components/org/StaffDirectory";
import OfficeManager from "../components/org/OfficeManager";
import OrgChart from "../components/org/OrgChart";
import CreateStaffModal from "../components/org/CreateStaffModal";
import StaffEditor from "../components/org/StaffEditor";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "staff", label: "Staff", icon: Users },
  { id: "offices", label: "Offices", icon: Building2 },
  { id: "chart", label: "Org chart", icon: Network },
];

/**
 * The admin's organisation workspace: create staff accounts, give each a position, office and supervisor,
 * shape the offices, and keep an eye on the work being done.
 */
export default function AdminOrganization() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      const [meta, overview, offices, staff] = await Promise.all([orgApi.meta(), orgApi.overview(), orgApi.offices(), orgApi.staff()]);
      setData({ positions: meta.positions, overview, offices: offices.offices || [], staff: staff.staff || [] });
      setError("");
    } catch (err) {
      setError(err?.message || "Could not load the organisation");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const go = (id) => setParams({ tab: id }, { replace: true });

  if (error && !data) return <ErrorState title="Organization unavailable" message={error} onRetry={load} />;
  if (!data) return <LoadingState message="Loading organization…" />;
  const activeStaff = data.staff.filter((s) => s.status !== "suspended");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Organization" description="Offices, positions and who supervises whom. Staff get a dashboard that fits the work you assign." />

      <div role="tablist" aria-label="Organization sections" className="flex gap-1 overflow-x-auto rounded-full border border-border-subtle bg-bg-panel p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => go(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${tab === id ? "bg-midnight text-white dark:bg-lemon dark:text-midnight" : "text-text-secondary hover:text-text-primary"}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OrgOverview overview={data.overview} onGo={go} />}
      {tab === "staff" && <StaffDirectory staff={data.staff} offices={data.offices} onOpen={setEditing} onAdd={() => setCreating(true)} onChanged={load} />}
      {tab === "offices" && <OfficeManager offices={data.offices} staff={activeStaff} onChanged={load} />}
      {tab === "chart" && <OrgChart offices={data.offices} staff={data.staff} />}

      <CreateStaffModal open={creating} onClose={() => setCreating(false)} positions={data.positions} offices={data.offices} staff={activeStaff} onCreated={load} />
      <StaffEditor open={!!editing} onClose={() => setEditing(null)} person={editing && (data.staff.find((s) => s.id === editing.id) || editing)}
        positions={data.positions} offices={data.offices} staff={activeStaff} onChanged={load} />
    </div>
  );
}
