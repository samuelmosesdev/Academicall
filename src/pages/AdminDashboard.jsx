import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users,
  UserCog,
  FileText,
  CreditCard,
  MessageSquare,
  ArrowRight,
  Megaphone,
} from "lucide-react";
import KpiCard from "../components/KpiCard";
import GrowthChart from "../components/GrowthChart";
import FreeVsPaidDonut from "../components/FreeVsPaidDonut";
import RecentActivityTable from "../components/RecentActivityTable";
import Modal from "../components/Modal";
import QuickAddForm from "../components/QuickAddForm";
import { useDashboardData } from "../hooks/useDashboardData";
import { PageHeader, LoadingState, ErrorState } from "../components/ui";
import StaffFeed from "../components/StaffFeed";

export default function AdminDashboard() {
  const { kpis, freeVsPaid, userGrowth, recentActivity, loading, error, retry } =
    useDashboardData();
  const [modal, setModal] = useState(null);
  const navigate = useNavigate();

  if (loading) {
    return <LoadingState message="Loading dashboard…" />;
  }

  if (error) {
    return (
      <ErrorState title="Dashboard unavailable" message={error} onRetry={retry} />
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Admin overview"
        description="Live pulse on users, content, subscriptions — and your team channel."
      />

      {/* Staff HQ highlight card */}
      <button
        type="button"
        onClick={() => navigate("/admin/staff-chat")}
        className="group relative w-full overflow-hidden rounded-2xl border border-accent/25 bg-bg-panel p-5 text-left shadow-sm transition hover:border-accent/50 hover:shadow-md sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-bg-app shadow-md shadow-accent/25">
              <MessageSquare size={22} />
            </span>
            <div>
              <p className="text-base font-semibold text-text-primary">Staff HQ</p>
              <p className="mt-0.5 max-w-xl text-sm text-text-secondary">
                Private workspace for Admin &amp; Agents — chat, voice notes, images,
                reactions, and schedule team meetings.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-app transition group-hover:gap-2.5">
            Open channel <ArrowRight size={15} />
          </span>
        </div>
      </button>

      <section aria-label="Key metrics">
        <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Users"
            value={kpis.totalUsers.toLocaleString()}
            highlight
            icon={Users}
          />
          <KpiCard label="Active Agents" value={kpis.activeAgents} icon={UserCog} />
          <KpiCard
            label="Documents Uploaded"
            value={kpis.documentsUploaded.toLocaleString()}
            icon={FileText}
          />
          <KpiCard
            label="Active Subscriptions"
            value={kpis.activeSubscriptions.toLocaleString()}
            icon={CreditCard}
          />
        </div>
      </section>

      <section
        aria-label="Growth and plan mix"
        className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]"
      >
        <GrowthChart data={userGrowth} />
        <FreeVsPaidDonut freePct={freeVsPaid.freePct} paidPct={freeVsPaid.paidPct} />
      </section>

      <section aria-label="Recent activity">
        <RecentActivityTable
          activity={recentActivity}
          onAddUser={() => setModal("user")}
          onAddAgent={() => setModal("agent")}
          onCreateCbt={() => navigate("/admin/cbt-builder")}
          onUploadAnnouncement={() => navigate("/admin/announcements")}
        />
      </section>

      <section aria-label="Department feeds" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Megaphone size={15} className="text-accent" />
            Latest department feeds
          </h2>
          <Link
            to="/admin/feeds"
            className="text-xs font-medium text-accent hover:underline"
          >
            View all →
          </Link>
        </div>
        <StaffFeed compact maxItems={5} />
      </section>

      <Modal
        title={modal === "agent" ? "Add Agent" : "Add User"}
        open={!!modal}
        onClose={() => setModal(null)}
      >
        <QuickAddForm target={modal} onDone={() => setModal(null)} />
      </Modal>
    </div>
  );
}
