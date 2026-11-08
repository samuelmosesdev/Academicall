import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import {
  FileText,
  BookOpen,
  ClipboardList,
  Upload,
  FileScan,
  ClipboardCheck,
  Wallet,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AiCourseImportModal from "../components/AiCourseImportModal";
import { isAgent, isAlpha, isAdmin, can, ROLE_LABELS } from "../lib/roles";
import { useCbtData } from "../hooks/useCbtData";
import { useAdminDocuments } from "../hooks/useAdminDocuments";
import { useStaffQueues } from "../hooks/useStaffQueues";
import StaffFeed from "../components/StaffFeed";
import MyAccessCard from "../components/access/MyAccessCard";
import { PageHeader } from "../components/ui";
import AttentionQueue from "../components/staff/AttentionQueue";
import StaffHqCard from "../components/staff/StaffHqCard";
import { useStaffShell } from "../components/staff/StaffShellContext";
import { greetingFor, todayLabel } from "../components/staff/greeting";
import { MyTasksPanel, MyOfficePanel, TeamPanel } from "../components/org/OrgPanels";

const actionPrimary =
  "inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-bg-app transition hover:opacity-95";
const actionGhost =
  "inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-bg-panel-alt";

/**
 * Agent workspace home. Everything is shown only if the agent holds the matching
 * permission: header actions, the "waiting on you" queue and the workspace tiles.
 * Order: actions -> what is waiting -> your workspace -> feeds, with permissions
 * and Staff HQ in a side column instead of pushing the work down the page.
 */
export default function AgentDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queues = useStaffQueues();
  const { badges } = useStaffShell();
  const [showAiImport, setShowAiImport] = useState(false);
  const { courses, questions, loading: cbtLoading } = useCbtData({ withQuestions: true });
  const { documents, loading: docsLoading } = useAdminDocuments();

  const firstName = profile?.nickname || profile?.nickName || profile?.name?.split(" ")[0] || "Agent";
  const canReviewDocs = can(profile, "documents.review") || can(profile, "documents.manage");

  const tiles = [
    { label: "Documents", value: docsLoading ? "—" : documents.length, icon: FileText, to: "/agent/documents", hint: "Upload and review reading materials", cap: ["documents.review", "documents.manage"] },
    { label: "Courses", value: cbtLoading ? "—" : courses.length, icon: BookOpen, to: "/agent/courses", hint: "Manage the course list", cap: ["courses.manage"] },
    { label: "CBT questions", value: cbtLoading ? "—" : questions.length, icon: ClipboardList, to: "/agent/cbt-builder", hint: "Add or import questions", cap: ["cbt.manage"] },
  ].filter((t) => t.cap.some((k) => can(profile, k)));

  const pendingDocs = canReviewDocs && !docsLoading ? documents.filter((d) => d.status === "pending").length : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`${greetingFor()}, ${firstName}`}
        description={`${todayLabel()} · ${ROLE_LABELS[profile?.role] || "Agent"} workspace`}
        actions={
          <>
            {can(profile, "documents.manage") && (
              <button type="button" onClick={() => navigate("/agent/documents")} className={actionPrimary}><Upload size={15} /> Upload document</button>
            )}
            {can(profile, "cbt.manage") && (
              <button type="button" onClick={() => navigate("/agent/cbt-builder")} className={actionGhost}><ClipboardList size={15} /> CBT Builder</button>
            )}
            {can(profile, "courses.manage") && (
              <button type="button" onClick={() => navigate("/agent/academics?tab=institutions")} className={actionGhost}><BookOpen size={15} /> Add course</button>
            )}
            {(isAgent(profile) || isAlpha(profile) || isAdmin(profile)) && can(profile, "courses.manage") && (
              <button type="button" onClick={() => setShowAiImport(true)} className={actionGhost}><FileScan size={15} /> AI import</button>
            )}
          </>
        }
      />

      <AttentionQueue
        loading={queues.loading}
        items={[
          { key: "requests", label: "Pending requests", count: queues.requests, to: "/agent/requests", icon: ClipboardCheck, hint: "Review now" },
          { key: "documents", label: "Documents to review", count: pendingDocs, to: "/agent/documents", icon: FileText, hint: "Awaiting approval" },
          { key: "payments", label: "Payment claims", count: queues.payments, to: "/agent/payments", icon: Wallet, hint: "Awaiting review" },
          { key: "chat", label: "Unread in Staff HQ", count: badges.staffChat || 0, to: "/agent/staff-chat", icon: MessageSquare, hint: "Open the channel" },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <MyTasksPanel />
        <MyOfficePanel />
      </div>
      <TeamPanel />

      {tiles.length > 0 && (
        <section aria-label="Your workspace" className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-3">
          {tiles.map(({ label, value, icon: Icon, to, hint }) => (
            <Link key={label} to={to} className="group card-elevated flex flex-col justify-between rounded-[1.25rem] p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={18} /></span>
                <span className="num text-3xl font-light text-text-primary">{value}</span>
              </div>
              <div className="mt-5 flex items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{label}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{hint}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <section aria-label="Department feeds" className="space-y-3">
          <div className="flex justify-end">
            <Link to="/agent/feeds" className="text-xs font-medium text-accent hover:underline">View all →</Link>
          </div>
          <StaffFeed compact maxItems={5} />
        </section>
        <aside className="space-y-4" aria-label="Team and access">
          <StaffHqCard />
          <MyAccessCard profile={profile} />
        </aside>
      </div>

      <AiCourseImportModal
        open={showAiImport}
        onClose={() => setShowAiImport(false)}
        mode="direct"
        defaultFaculty={profile?.faculty || ""}
        defaultDepartment={profile?.department || ""}
      />
    </div>
  );
}
