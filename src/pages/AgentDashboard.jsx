import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import {
  FileText,
  BookOpen,
  ClipboardList,
  Upload,
  Sparkles,
  MessageSquare,
  ArrowRight,
  Megaphone,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AiCourseImportModal from "../components/AiCourseImportModal";
import { isAgent, isAlpha, isAdmin } from "../lib/roles";
import { useCbtData } from "../hooks/useCbtData";
import { useAdminDocuments } from "../hooks/useAdminDocuments";
import StaffFeed from "../components/StaffFeed";

export default function AgentDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [showAiImport, setShowAiImport] = useState(false);
  const { courses, questions, loading: cbtLoading } = useCbtData({ withQuestions: true });
  const { documents, loading: docsLoading } = useAdminDocuments();

  const firstName =
    profile?.nickname ||
    profile?.nickName ||
    profile?.name?.split(" ")[0] ||
    "Agent";

  const cards = [
    {
      label: "Documents",
      value: docsLoading ? "—" : documents.length,
      icon: FileText,
      to: "/agent/documents",
      hint: "Upload reading materials",
    },
    {
      label: "Courses",
      value: cbtLoading ? "—" : courses.length,
      icon: BookOpen,
      to: "/agent/courses",
      hint: "Manage course list",
    },
    {
      label: "CBT questions",
      value: cbtLoading ? "—" : questions.length,
      icon: ClipboardList,
      to: "/agent/cbt-builder",
      hint: "Add or import questions",
    },
  ];

  return (
    <div className="space-y-7 animate-fade-in">
      <section className="rounded-2xl border border-border-subtle bg-bg-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-text-primary sm:text-xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Content ops workspace — documents, courses, CBT, and the staff channel.
            </p>
          </div>
        </div>
      </section>

      {/* Staff HQ card */}
      <button
        type="button"
        onClick={() => navigate("/agent/staff-chat")}
        className="group relative w-full overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent-soft/70 via-bg-panel to-bg-panel p-5 text-left shadow-sm transition hover:border-accent/45 hover:shadow-md"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-bg-app">
              <MessageSquare size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">Staff HQ</p>
              <p className="mt-0.5 text-xs text-text-muted sm:text-sm">
                Chat with Admin &amp; other agents — text, images, voice notes &amp; reactions.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
            Open <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </button>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, to, hint }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(to)}
            className="rounded-2xl border border-border-subtle bg-bg-panel p-5 text-left transition hover:border-accent/40 hover:shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon size={18} />
              </span>
              <span className="text-2xl font-bold text-text-primary">{value}</span>
            </div>
            <p className="text-sm font-semibold text-text-primary">{label}</p>
            <p className="mt-0.5 text-xs text-text-muted">{hint}</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/agent/documents")}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-bg-app hover:opacity-95"
          >
            <Upload size={15} /> Upload document
          </button>
          <button
            type="button"
            onClick={() => navigate("/agent/courses")}
            className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-panel-alt"
          >
            <BookOpen size={15} /> Add course
          </button>
          <button
            type="button"
            onClick={() => navigate("/agent/cbt-builder")}
            className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-panel-alt"
          >
            <ClipboardList size={15} /> CBT Builder
          </button>
          <button
            type="button"
            onClick={() => navigate("/agent/staff-chat")}
            className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm font-medium text-accent"
          >
            <MessageSquare size={15} /> Staff HQ
          </button>
          {(isAgent(profile) || isAlpha(profile) || isAdmin(profile)) && (
            <button
              type="button"
              onClick={() => setShowAiImport(true)}
              className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-panel-alt"
            >
              <Sparkles size={15} /> AI import courses
            </button>
          )}
        </div>
      </div>

      <AiCourseImportModal
        open={showAiImport}
        onClose={() => setShowAiImport(false)}
        mode="direct"
        defaultFaculty={profile?.faculty || ""}
        defaultDepartment={profile?.department || ""}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Megaphone size={15} className="text-accent" />
            Latest department feeds
          </h2>
          <Link
            to="/agent/feeds"
            className="text-xs font-medium text-accent hover:underline"
          >
            View all →
          </Link>
        </div>
        <StaffFeed compact maxItems={5} />
      </section>
    </div>
  );
}
