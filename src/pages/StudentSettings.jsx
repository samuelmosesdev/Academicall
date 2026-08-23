import { useEffect, useMemo, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  User,
  Palette,
  Bell,
  BookOpen,
  Crown,
  Link2,
  Save,
  Loader2,
  LogOut,
  ExternalLink,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { isPro, planLabel, FREE_LIMITS } from "../lib/subscription";
import { db, auth } from "../firebase/config";
import { FACULTIES, departmentsFor } from "../data/facultyData";

const fieldClass =
  "w-full rounded-lg border border-border-light bg-surface-light px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-teal focus:outline-none";

const LEVELS = ["100", "200", "300", "400", "500", "Postgraduate"];

const DEFAULT_PREFS = {
  notifAnnouncements: true,
  notifClassReminders: true,
  defaultReminderMinutes: 15,
  defaultPracticeSize: 15,
  showDashboardTips: true,
};

export default function StudentSettings() {
  const { user, profile, logout } = useAuth();
  const { theme, setTheme, isDark, fontScale, setFontScale, fontScales } = useTheme();
  const navigate = useNavigate();
  const pro = isPro(profile);

  const [name, setName] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");

  const departments = useMemo(() => departmentsFor(faculty), [faculty]);
  const isEmailUser = user?.providerData?.some((p) => p.providerId === "password");

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || "");
    setFaculty(profile.faculty || "");
    setDepartment(profile.department || "");
    setLevel(profile.level || "");
    setPrefs({
      ...DEFAULT_PREFS,
      ...(profile.settings || {}),
    });
  }, [profile]);

  function setPref(key, value) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: name.trim(),
        faculty: faculty || null,
        department: department || null,
        level: level || null,
        settings: {
          notifAnnouncements: !!prefs.notifAnnouncements,
          notifClassReminders: !!prefs.notifClassReminders,
          defaultReminderMinutes: Number(prefs.defaultReminderMinutes) || 15,
          defaultPracticeSize: Number(prefs.defaultPracticeSize) || 15,
          showDashboardTips: !!prefs.showDashboardTips,
        },
        settingsUpdatedAt: serverTimestamp(),
      });
      setMsg("Settings saved.");
    } catch (ex) {
      setErr(ex.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwdMsg("");
    if (!user?.email || !isEmailUser) {
      setPwdMsg("Password change is only for email/password accounts.");
      return;
    }
    if (newPassword.length < 6) {
      setPwdMsg("New password must be at least 6 characters.");
      return;
    }
    setPwdBusy(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPwdMsg("Password updated.");
    } catch (ex) {
      setPwdMsg(ex.message || "Could not update password. Check your current password.");
    } finally {
      setPwdBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  async function enableBrowserNotifications() {
    if (typeof Notification === "undefined") {
      setMsg("Notifications are not supported here.");
      return;
    }
    const p = await Notification.requestPermission();
    setMsg(
      p === "granted"
        ? "Browser notifications allowed."
        : "Notification permission was not granted."
    );
  }

  const section = "rounded-2xl border border-border-light bg-card-light p-5 space-y-4";
  const heading = "flex items-center gap-2 text-sm font-semibold text-ink";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Settings</h1>
        <p className="text-sm text-ink-muted">Account, appearance, notifications, and plan.</p>
      </div>

      {/* 1. Account */}
      <form onSubmit={saveProfile} className={section}>
        <h2 className={heading}>
          <User size={16} className="text-teal" /> Account
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-ink-muted">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Email</label>
            <input value={profile?.email || user?.email || ""} disabled className={`${fieldClass} opacity-70`} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Unique ID</label>
            <input value={profile?.uniqueId || "—"} disabled className={`${fieldClass} opacity-70`} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Faculty</label>
            <select
              value={faculty}
              onChange={(e) => {
                setFaculty(e.target.value);
                setDepartment("");
              }}
              className={fieldClass}
            >
              <option value="">Select faculty</option>
              {FACULTIES.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={fieldClass}
              disabled={!faculty}
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Level</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={fieldClass}>
              <option value="">Select level</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isEmailUser && (
          <div className="space-y-2 border-t border-border-light pt-4">
            <p className="text-xs font-medium text-ink-muted">Change password</p>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className={fieldClass}
              autoComplete="current-password"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className={fieldClass}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={changePassword}
              disabled={pwdBusy}
              className="rounded-lg border border-border-light px-3 py-2 text-xs font-medium text-ink hover:bg-surface-light disabled:opacity-60"
            >
              {pwdBusy ? "Updating…" : "Update password"}
            </button>
            {pwdMsg && <p className="text-xs text-ink-muted">{pwdMsg}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border-light pt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save account & preferences
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-border-light px-4 py-2.5 text-sm font-medium text-ink-muted hover:text-status-danger"
          >
            <LogOut size={15} /> Log out
          </button>
        </div>
        {msg && <p className="text-sm text-teal">{msg}</p>}
        {err && <p className="text-sm text-status-danger">{err}</p>}
      </form>

      {/* 2. Appearance */}
      <section className={section}>
        <h2 className={heading}>
          <Palette size={16} className="text-teal" /> Appearance
        </h2>
        <p className="text-xs text-ink-muted">Theme applies across the student dashboard.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
              !isDark ? "border-teal bg-teal-soft text-teal" : "border-border-light text-ink-muted"
            }`}
          >
            <Sun size={16} /> Light
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
              isDark ? "border-teal bg-teal-soft text-teal" : "border-border-light text-ink-muted"
            }`}
          >
            <Moon size={16} /> Dark
          </button>
        </div>
        <p className="text-xs text-ink-muted">Current: {theme === "dark" ? "Dark" : "Light"}</p>

        <p className="mt-4 text-xs font-semibold text-ink">Text size</p>
        <p className="text-xs text-ink-muted">
          Make text larger or smaller so it is easy to read on your phone.
        </p>
        <div className="flex flex-wrap gap-2">
          {fontScales.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFontScale(s.id)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                fontScale === s.id
                  ? "border-teal bg-teal-soft text-teal"
                  : "border-border-light text-ink-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* 3. Notifications */}
      <section className={section}>
        <h2 className={heading}>
          <Bell size={16} className="text-teal" /> Notifications
        </h2>
        <label className="flex items-center justify-between gap-3 text-sm text-ink">
          <span>Announcement alerts</span>
          <input
            type="checkbox"
            checked={!!prefs.notifAnnouncements}
            onChange={(e) => setPref("notifAnnouncements", e.target.checked)}
            className="h-4 w-4 rounded border-border-light"
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm text-ink">
          <span>Class timetable reminders</span>
          <input
            type="checkbox"
            checked={!!prefs.notifClassReminders}
            onChange={(e) => setPref("notifClassReminders", e.target.checked)}
            className="h-4 w-4 rounded border-border-light"
          />
        </label>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Default reminder time</label>
          <select
            value={prefs.defaultReminderMinutes}
            onChange={(e) => setPref("defaultReminderMinutes", Number(e.target.value))}
            className={fieldClass}
          >
            <option value={5}>5 minutes before</option>
            <option value={10}>10 minutes before</option>
            <option value={15}>15 minutes before</option>
            <option value={30}>30 minutes before</option>
            <option value={60}>1 hour before</option>
          </select>
        </div>
        <button
          type="button"
          onClick={enableBrowserNotifications}
          className="rounded-lg border border-border-light px-3 py-2 text-xs font-medium text-ink hover:bg-surface-light"
        >
          Allow browser notifications
        </button>
        <p className="text-xs text-ink-muted">
          Click <strong>Save account & preferences</strong> above to store these choices.
        </p>
      </section>

      {/* 4. Learning preferences */}
      <section className={section}>
        <h2 className={heading}>
          <BookOpen size={16} className="text-teal" /> Learning preferences
        </h2>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Default practice set size</label>
          <select
            value={prefs.defaultPracticeSize}
            onChange={(e) => setPref("defaultPracticeSize", Number(e.target.value))}
            className={fieldClass}
          >
            <option value={10}>10 questions</option>
            <option value={15}>15 questions</option>
            <option value={20}>20 questions</option>
            <option value={30}>30 questions</option>
          </select>
          {!pro && (
            <p className="mt-1 text-xs text-ink-muted">
              Free plan is capped at {FREE_LIMITS.practiceQuestions} questions per set.
            </p>
          )}
        </div>
        <label className="flex items-center justify-between gap-3 text-sm text-ink">
          <span>Show tips on dashboard</span>
          <input
            type="checkbox"
            checked={!!prefs.showDashboardTips}
            onChange={(e) => setPref("showDashboardTips", e.target.checked)}
            className="h-4 w-4 rounded border-border-light"
          />
        </label>
        <Link to="/dashboard/courses" className="inline-flex text-sm font-medium text-teal hover:underline">
          Manage my courses →
        </Link>
      </section>

      {/* 5. Subscription */}
      <section className={section}>
        <h2 className={heading}>
          <Crown size={16} className="text-teal" /> Subscription
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-light px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Plan: {planLabel(profile)}</p>
            <p className="text-xs text-ink-muted">
              {pro
                ? "Full access to practice, documents, and timetable."
                : `Free limits: ${FREE_LIMITS.maxCourses} courses, ${FREE_LIMITS.practiceQuestions} Q practice, timetable locked.`}
            </p>
          </div>
          <Link
            to="/dashboard/upgrade"
            className="rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-dark"
          >
            {pro ? "View plans" : "Upgrade to Pro"}
          </Link>
        </div>
      </section>

      {/* 6. Connected services */}
      <section className={section}>
        <h2 className={heading}>
          <Link2 size={16} className="text-teal" /> Connected services
        </h2>
        <div className="rounded-xl border border-border-light px-4 py-3">
          <p className="text-sm font-medium text-ink">Google Calendar</p>
          <p className="mt-1 text-xs text-ink-muted">
            From Timetable, use the link icon on any class to open Google Calendar with the event
            pre-filled. Confirm once in Google to save it to your account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/dashboard/timetable"
              className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
            >
              Open timetable <ExternalLink size={12} />
            </Link>
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"
            >
              Open Google Calendar <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <p className="text-xs text-ink-muted">
          Sign-in method:{" "}
          {user?.providerData?.map((p) => p.providerId.replace(".com", "")).join(", ") || "email"}
        </p>
      </section>
    </div>
  );
}
