import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ExternalLink, FileText, Crown, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStudentDocuments } from "../hooks/useStudentDocuments";
import { FREE_LIMITS, isPro } from "../lib/subscription";

export default function StudentCourseReading() {
  const { courseCode: rawCode } = useParams();
  const courseCode = decodeURIComponent(rawCode || "");
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { documents, loading } = useStudentDocuments();
  const pro = isPro(profile);

  const courseDocs = useMemo(() => {
    const key = courseCode || "GENERAL";
    return documents
      .filter((d) => (d.courseCode || "GENERAL") === key)
      .sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0));
  }, [documents, courseCode]);

  const meta = useMemo(() => {
    if (courseDocs.length === 0) return null;
    const first = courseDocs[0];
    return {
      courseCode: first.courseCode || courseCode || "GENERAL",
      courseTitle: first.courseTitle || first.courseCode || courseCode || "General",
      faculty: first.faculty,
      department: first.department,
      level: first.level,
    };
  }, [courseDocs, courseCode]);

  const { visible, lockedCount } = useMemo(() => {
    if (pro) return { visible: courseDocs, lockedCount: 0 };
    const limit = FREE_LIMITS.documentsPerCourse;
    return {
      visible: courseDocs.slice(0, limit),
      lockedCount: Math.max(0, courseDocs.length - limit),
    };
  }, [courseDocs, pro]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-ink-muted">Loading course materials…</div>
    );
  }

  if (!meta || courseDocs.length === 0) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/dashboard/reading-hub")}
          className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> Back to Reading Hub
        </button>
        <div className="rounded-xl border border-border-light bg-card-light px-4 py-12 text-center">
          <BookOpen size={28} className="mx-auto mb-2 opacity-50 text-ink-muted" />
          <p className="text-sm text-ink-muted">
            No materials found for course code <strong className="text-ink">{courseCode || "—"}</strong>.
          </p>
          <Link
            to="/dashboard/reading-hub"
            className="mt-4 inline-block text-sm font-medium text-teal hover:underline"
          >
            Browse all courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate("/dashboard/reading-hub")}
          className="mb-3 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> Back to Reading Hub
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-teal/15 px-2 py-0.5 text-xs font-bold text-teal">
                {meta.courseCode}
              </span>
              <h1 className="text-lg font-semibold text-ink">{meta.courseTitle}</h1>
            </div>
            {(meta.faculty || meta.department || meta.level) && (
              <p className="mt-1 text-sm text-ink-muted">
                {[meta.faculty, meta.department, meta.level].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-muted">
              {courseDocs.length} material{courseDocs.length !== 1 ? "s" : ""}
              {lockedCount > 0 ? ` · ${lockedCount} locked on Free` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-light bg-card-light">
        <div className="divide-y divide-border-light">
          {visible.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
                  <FileText size={16} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{d.title}</div>
                  <div className="text-xs text-ink-muted">
                    {d.fileSize ? `${(d.fileSize / 1024 / 1024).toFixed(1)} MB` : "PDF"}
                    {d.description ? ` · ${d.description}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to={`/dashboard/reading-hub/doc/${d.id}`}
                  className="flex items-center gap-1.5 rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-dark"
                >
                  Read in app
                </Link>
                
              </div>
            </div>
          ))}
        </div>
      </div>

      {lockedCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
              <Lock size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">
                {lockedCount} more material{lockedCount !== 1 ? "s" : ""} locked
              </p>
              <p className="text-xs text-ink-muted">
                Free plan allows {FREE_LIMITS.documentsPerCourse} document per course. Upgrade to unlock all.
              </p>
            </div>
            <Link
              to="/dashboard/upgrade"
              className="inline-flex items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              <Crown size={14} /> Go Pro
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}