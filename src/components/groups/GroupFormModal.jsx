import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ShieldCheck, Users } from "lucide-react";
import Modal from "../Modal";
import { GroupAvatar } from "./common";
import { groupsApi } from "../../lib/api";
import { prepareFile, uploadToCloudinary } from "../../lib/groupUploads";
import { notify } from "../../lib/dialogs";

const field =
  "w-full rounded-2xl border border-border-subtle bg-bg-panel-alt px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20";

const SCOPES = [
  { value: "program", label: "My programme & level", hint: "Students in your programme and level" },
  { value: "course", label: "One course", hint: "Students in your programme and level, for one course" },
  { value: "department", label: "My whole department", hint: "All levels in your department" },
  { value: "faculty", label: "My faculty", hint: "Everyone in your faculty" },
];

function Toggle({ checked, onChange, label, hint, icon: Icon }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-2xl border border-border-subtle bg-bg-panel px-4 py-3 text-left transition hover:border-violet/40"
    >
      {Icon && <Icon size={18} className="mt-0.5 shrink-0 text-violet" />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text-primary">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-text-muted">{hint}</span>}
      </span>
      <span className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition ${checked ? "bg-violet" : "bg-border-strong"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[1.125rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** Create a group, or edit one (creator only) when `group` is passed. */
export default function GroupFormModal({ open, onClose, group = null, isCourseRep = false, onSaved }) {
  const editing = Boolean(group);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState(null);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [official, setOfficial] = useState(false);
  const [scopeType, setScopeType] = useState("program");
  const [courseCode, setCourseCode] = useState("");
  const [uploading, setUploading] = useState(null); // percent
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(group?.name || "");
    setDescription(group?.description || "");
    setIconUrl(group?.iconUrl || null);
    setApprovalRequired(group ? group.approvalRequired : true);
    setOfficial(false);
    setScopeType("program");
    setCourseCode("");
    setError("");
    setUploading(null);
  }, [open, group]);

  async function pickIcon(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const prepared = await prepareFile(file, "image");
      setUploading(0);
      const res = await uploadToCloudinary(prepared.file, "image", { onProgress: setUploading });
      setIconUrl(res.secure_url);
    } catch (err) {
      notify.error(err.message || "Could not upload the picture");
    } finally {
      setUploading(null);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 3) return setError("Give the group a name of at least 3 characters.");
    if (official && scopeType === "course" && !courseCode.trim()) return setError("Add the course code, e.g. CSC 301.");
    setBusy(true);
    try {
      const body = { name: name.trim(), description: description.trim() || null, iconUrl, approvalRequired };
      const res = editing
        ? await groupsApi.update(group.id, body)
        : await groupsApi.create({ ...body, ...(official ? { official: true, scopeType, courseCode: courseCode.trim() || null } : {}) });
      notify.success(editing ? "Group updated" : "Group created. Share the link to invite classmates.");
      onSaved?.(res.group);
      onClose?.();
    } catch (err) {
      setError(err.message || "Could not save the group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose?.()} title={editing ? "Edit group" : "New study group"}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative shrink-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet"
            aria-label="Choose a group picture"
          >
            <GroupAvatar group={{ id: group?.id || name, name: name || "New group", iconUrl }} size={72} />
            <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-midnight/45 text-white opacity-0 transition group-hover:opacity-100">
              {uploading !== null ? <span className="text-xs font-semibold">{uploading}%</span> : <Camera size={20} />}
            </span>
            {uploading !== null && (
              <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-midnight/55 text-xs font-semibold text-white">{uploading}%</span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickIcon} />
          <div className="min-w-0 flex-1">
            <label className="eyebrow mb-1.5 block text-text-muted" htmlFor="group-name">Group name</label>
            <input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. CSC 301 Exam Prep" className={field} autoFocus />
          </div>
        </div>

        <div>
          <label className="eyebrow mb-1.5 block text-text-muted" htmlFor="group-desc">Description <span className="normal-case tracking-normal">(optional)</span></label>
          <textarea id="group-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="What will you study together?" className={`${field} resize-none`} />
          <p className="mt-1 text-right text-[11px] text-text-muted">{description.length}/500</p>
        </div>

        <Toggle
          checked={approvalRequired}
          onChange={setApprovalRequired}
          icon={ShieldCheck}
          label="Approve new members"
          hint={approvalRequired ? "People with the link ask to join; you or a moderator approve them." : "Anyone with the link joins straight away."}
        />

        {!editing && isCourseRep && (
          <div className="space-y-3">
            <Toggle
              checked={official}
              onChange={setOfficial}
              icon={Users}
              label="Class group for my students"
              hint="Only students in your class can join, and you can invite all of them at once."
            />
            {official && (
              <div className="grid gap-2 sm:grid-cols-2">
                {SCOPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setScopeType(s.value)}
                    className={`rounded-2xl border px-3 py-2.5 text-left transition ${scopeType === s.value ? "border-violet bg-violet-soft" : "border-border-subtle bg-bg-panel hover:border-violet/40"}`}
                  >
                    <span className="block text-sm font-semibold text-text-primary">{s.label}</span>
                    <span className="block text-[11px] leading-snug text-text-muted">{s.hint}</span>
                  </button>
                ))}
                {scopeType === "course" && (
                  <input value={courseCode} onChange={(e) => setCourseCode(e.target.value.toUpperCase())} maxLength={20} placeholder="Course code, e.g. CSC 301" className={`${field} sm:col-span-2`} />
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-text-muted">Up to 200 members and 3 moderators per group.</p>

        {error && <p className="rounded-2xl bg-status-danger/10 px-4 py-2.5 text-sm text-status-danger">{error}</p>}

        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-border-strong px-5 py-3 text-sm font-medium text-text-primary transition hover:bg-bg-panel-alt">
            Cancel
          </button>
          <button type="submit" disabled={busy || uploading !== null} className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-sm disabled:opacity-60">
            {busy && <Loader2 size={15} className="animate-spin" />}
            {editing ? "Save changes" : "Create group"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
