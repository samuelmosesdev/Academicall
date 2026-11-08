import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users,
  UserCog,
  FileText,
  CreditCard,
  Megaphone,
  UserPlus,
  ClipboardPlus,
  ClipboardCheck,
  Wallet,
  MessageSquare,
  KeyRound,
  Network,
} from "lucide-react";
import KpiCard from "../components/KpiCard";
import GrowthChart from "../components/GrowthChart";
import FreeVsPaidDonut from "../components/FreeVsPaidDonut";
import RecentActivityTable from "../components/RecentActivityTable";
import Modal from "../components/Modal";
import QuickAddForm from "../components/QuickAddForm";
import { useDashboardData } from "../hooks/useDashboardData";
import { useStaffQueues } from "../hooks/useStaffQueues";
import { orgApi } from "../lib/api";
import { OrgPulse } from "../components/org/OrgPanels";
import { useAuth } from "../context/AuthContext";
import { PageHeader, LoadingState, ErrorState } from "../components/ui";
import StaffFeed from "../components/StaffFeed";
import AttentionQueue from "../components/staff/AttentionQueue";
import StaffHqCard from "../components/staff/StaffHqCard";
import { useStaffShell } from "../components/staff/StaffShellContext";
import { greetingFor, todayLabel } from "../components/staff/greeting";

const actionPrimary =
  "inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-bg-app transition hover:opacity-95";
const actionGhost =
  "inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-bg-panel-alt";

/**
 * Admin overview, in the order an admin works through it:
 *   1. who/when + the four things you do most (header actions)
 *   2. what is waiting on you
 *   3. the numbers, then how they are trending
 *   4. what just happened, and what the departments are posting
 */
export default function AdminDashboard() {
  const { kpis, freeVsPaid, userGrowth, recentActivity, pendingDocuments, loading, error, retry } = useDashboardData();
  const { profile } = useAuth();
  const queues = useStaffQueues();
  const { badges } = useStaffShell();
  const [modal, setModal] = useState(null);
  const [orgOverview, setOrgOverview] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    orgApi.overview().then(setOrgOverview).catch((err) => {
      console.error("Failed to load organization overview", err);
    });
  }, []);

  if (loading) return <LoadingState message="Loading dashboard…" />;
  if (error) return <ErrorState title="Dashboard unavailable" message={error} onRetry={retry} />;

  const firstName = profile?.nickname || profile?.name?.split(" ")[0] || "Admin";

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`${greetingFor()}, ${firstName}`}
        description={`${todayLabel()} · here is where things stand.`}
        actions={
          <>
            <button type="button" onClick={() => setModal("user")} className={actionPrimary}><UserPlus size={15} /> Add user</button>
            <button type="button" onClick={() => setModal("agent")} className={actionGhost}><UserCog size={15} /> Add agent</button>
            <button type="button" onClick={() => navigate("/admin/cbt-builder")} className={actionGhost}><ClipboardPlus size={15} /> Create CBT</button>
            <button type="button" onClick={() => navigate("/admin/announcements")} className={actionGhost}><Megaphone size={15} /> Announce</button>
          </>
        }
      />

      <AttentionQueue
        loading={queues.loading}
        items={[
          { key: "requests", label: "Pending requests", count: queues.requests, to: "/admin/requests", icon: ClipboardCheck, hint: "Review now" },
          { key: "documents", label: "Documents to review", count: pendingDocuments, to: "/admin/documents", icon: FileText, hint: "Awaiting approval" },
          { key: "payments", label: "Payment claims", count: queues.payments, to: "/admin/payments", icon: Wallet, hint: "Awaiting review" },
          { key: "chat", label: "Unread in Staff HQ", count: badges.staffChat || 0, to: "/admin/staff-chat", icon: MessageSquare, hint: "Open the channel" },
          { key: "overdue", label: "Overdue staff tasks", count: orgOverview ? orgOverview.tasks.overdue : null, to: "/admin/tasks", icon: ClipboardCheck, hint: "Follow up" },
          { key: "first", label: "Staff yet to sign in", count: orgOverview ? orgOverview.staff.pendingFirstLogin : null, to: "/admin/organization?tab=staff", icon: KeyRound, hint: "Still on a temporary password" },
          { key: "nosup", label: "Staff without a supervisor", count: orgOverview ? orgOverview.staff.unsupervised : null, to: "/admin/organization?tab=staff", icon: Network, hint: "Assign one" },
        ]}
      />

      <section aria-label="Key metrics">
        <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Users" value={kpis.totalUsers.toLocaleString()} highlight icon={Users} to="/admin/users" />
          <KpiCard label="Active Agents" value={kpis.activeAgents} icon={UserCog} to="/admin/agents" />
          <KpiCard label="Documents Uploaded" value={kpis.documentsUploaded.toLocaleString()} icon={FileText} to="/admin/documents" />
          <KpiCard label="Active Subscriptions" value={kpis.activeSubscriptions.toLocaleString()} icon={CreditCard} to="/admin/payments" />
        </div>
      </section>

      <OrgPulse overview={orgOverview} />

      <section aria-label="Growth and plan mix" className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <GrowthChart data={userGrowth} />
        <FreeVsPaidDonut freePct={freeVsPaid.freePct} paidPct={freeVsPaid.paidPct} />
      </section>

      <section aria-label="Recent activity">
        <RecentActivityTable activity={recentActivity} />
      </section>

      <section aria-label="Department feeds and team" className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link to="/admin/feeds" className="text-xs font-medium text-accent hover:underline">View all →</Link>
          </div>
          <StaffFeed compact maxItems={5} />
        </div>
        <div>
          <StaffHqCard />
        </div>
      </section>

      <Modal title={modal === "agent" ? "Add Agent" : "Add User"} open={!!modal} onClose={() => setModal(null)}>
        <QuickAddForm target={modal} onDone={() => setModal(null)} />
      </Modal>
    </div>
  );
}
