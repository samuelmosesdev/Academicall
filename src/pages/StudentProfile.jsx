import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Camera,
  CheckCircle2,
  Lock,
  Shield,
  FileEdit,
  Clock,
  X,
  AlertCircle,
  User,
  Phone,
  Building2,
  GraduationCap,
  Hash,
  Sparkles,
} from "lucide-react";
import { auth, db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import ImageCropModal from "../components/ImageCropModal";
import { FACULTIES, departmentsFor } from "../data/facultyData";
import { fileToCompressedDataUrl } from "../lib/imageUtils";
import { uploadImageToCloudinary } from "../lib/cloudinaryUpload";
import { updateProfile } from "firebase/auth";
import UniqueIdBadge from "../components/UniqueIdBadge";

const LEVELS = [
  "100 Level",
  "200 Level",
  "300 Level",
  "400 Level",
  "500 Level",
  "Postgraduate",
];
const GENDERS = ["Female", "Male"];

const LOCKED_FIELDS = [
  { key: "name", label: "Full name", icon: User, type: "text" },
  { key: "phone", label: "Phone number", icon: Phone, type: "tel" },
  { key: "faculty", label: "Faculty", icon: Building2, type: "faculty" },
  { key: "department", label: "Department", icon: Building2, type: "department" },
  { key: "level", label: "Level", icon: GraduationCap, type: "level" },
  { key: "matricNumber", label: "Matric number", icon: Hash, type: "text" },
];

const fieldClass =
  "w-full rounded-xl border border-border-light bg-card-light px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

export default function StudentProfile() {
  const { user, profile } = useAuth();

  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [nickname, setNickname] = useState("");
  const [showDepartment, setShowDepartment] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [allowAnonymousComments, setAllowAnonymousComments] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [requests, setRequests] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Change-request form
  const [reqField, setReqField] = useState("name");
  const [reqValue, setReqValue] = useState("");
  const [reqFaculty, setReqFaculty] = useState("");
  const [reqDepartment, setReqDepartment] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqError, setReqError] = useState("");
  const [reqSuccess, setReqSuccess] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio || "");
    setInterests(profile.interests || "");
    setDob(profile.dob || "");
    setGender(profile.gender || "");
    setPhotoDataUrl(profile.photoURL || "");
    setNickname(profile.nickname || profile.nickName || "");
    setShowDepartment(profile.showDepartment !== false);
    setShowPhone(profile.showPhone === true);
    setAllowAnonymousComments(profile.allowAnonymousComments === true);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "profileChangeRequests"),
      where("userId", "==", user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        setRequests(list);
      },
      () => setRequests([])
    );
    return unsub;
  }, [user?.uid]);

  const pendingByField = useMemo(() => {
    const map = {};
    for (const r of requests) {
      if (r.status === "pending") map[r.field] = r;
    }
    return map;
  }, [requests]);

  const selectedFieldMeta = LOCKED_FIELDS.find((f) => f.key === reqField);

  const requestDeptOptions = useMemo(
    () => departmentsFor(reqFaculty || profile?.faculty || ""),
    [reqFaculty, profile?.faculty]
  );

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    setCropFile(file);
    setCropOpen(true);
    e.target.value = "";
  }

  async function handleSaveSoft(e) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setSaved(false);
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        bio: bio.trim(),
        interests: interests.trim(),
        dob: dob || null,
        gender: gender || null,
        photoURL: photoDataUrl || null,
        avatarUrl: photoDataUrl || null,
        nickname: nickname.trim(),
        showDepartment: !!showDepartment,
        showPhone: !!showPhone,
        allowAnonymousComments: !!allowAnonymousComments,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  function openRequestModal(fieldKey) {
    setReqField(fieldKey || "name");
    setReqValue("");
    setReqFaculty(profile?.faculty || "");
    setReqDepartment(profile?.department || "");
    setReqReason("");
    setReqError("");
    setReqSuccess(false);
    setShowRequestModal(true);
  }

  async function handleSubmitRequest(e) {
    e.preventDefault();
    if (!user || !profile) return;
    setReqError("");
    setReqSuccess(false);

    const meta = LOCKED_FIELDS.find((f) => f.key === reqField);
    if (!meta) return setReqError("Select a field to change.");

    if (pendingByField[reqField]) {
      return setReqError(
        "You already have a pending request for this field. Wait for admin review."
      );
    }

    let newValue = "";
    if (reqField === "faculty") {
      newValue = reqFaculty.trim();
    } else if (reqField === "department") {
      newValue = reqDepartment.trim();
    } else if (reqField === "level") {
      newValue = reqValue.trim();
    } else {
      newValue = reqValue.trim();
    }

    if (!newValue) return setReqError("Enter the new value you want.");
    if (!reqReason.trim() || reqReason.trim().length < 10) {
      return setReqError("Please explain why (at least 10 characters).");
    }

    const currentValue = String(profile[reqField] || "").trim();
    if (currentValue === newValue) {
      return setReqError("New value is the same as your current value.");
    }

    setReqBusy(true);
    try {
      await addDoc(collection(db, "profileChangeRequests"), {
        userId: user.uid,
        userName: profile.name || "",
        userEmail: profile.email || user.email || "",
        uniqueId: profile.uniqueId || null,
        field: reqField,
        fieldLabel: meta.label,
        currentValue: currentValue || "—",
        requestedValue: newValue,
        reason: reqReason.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
      });
      setReqSuccess(true);
      setTimeout(() => {
        setShowRequestModal(false);
        setReqSuccess(false);
      }, 1500);
    } catch (err) {
      setReqError(err.message || "Could not submit request.");
    } finally {
      setReqBusy(false);
    }
  }

  if (!profile) {
    return (
      <div className="py-16 text-center text-sm text-ink-muted">Loading profile…</div>
    );
  }

  const initials = (profile.name || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      {/* Hero card */}
      <div className="overflow-hidden rounded-2xl border border-border-light bg-card-light shadow-sm">
        <div className="h-24 bg-gradient-to-r from-teal via-teal-dark to-emerald-700 sm:h-28" />
        <div className="relative px-5 pb-5 sm:px-6">
          <div className="-mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-card-light bg-teal-soft text-2xl font-bold text-teal shadow-md">
                  {photoDataUrl ? (
                    <img
                      src={photoDataUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <label className={`absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-teal text-white shadow hover:bg-teal-dark ${photoUploading ? "opacity-60 pointer-events-none" : ""}`}>
                  <Camera size={14} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                    disabled={photoUploading}
                  />
                </label>
                {photoUploading && (
                  <p className="absolute left-0 top-full mt-1 whitespace-nowrap text-[11px] font-medium text-teal">
                    Saving photo…
                  </p>
                )}
                {photoError && (
                  <p className="absolute left-0 top-full mt-1 max-w-[14rem] text-[11px] text-red-600">
                    {photoError}
                  </p>
                )}
              </div>
              <div className="pb-1">
                <h1 className="text-xl font-bold text-ink">{profile.name || "Student"}</h1>
                <p className="text-sm text-ink-muted">{profile.email}</p>
                <div className="mt-1.5">
                  <UniqueIdBadge uniqueId={profile.uniqueId} />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openRequestModal("name")}
              className="flex items-center gap-2 rounded-xl border border-teal/30 bg-teal-soft px-4 py-2 text-sm font-semibold text-teal hover:bg-teal hover:text-white"
            >
              <FileEdit size={15} />
              Request a change
            </button>
          </div>
          {photoError && (
            <p className="mt-2 text-xs text-red-600">{photoError}</p>
          )}
        </div>
      </div>

      {/* Locked identity section */}
      <div className="rounded-2xl border border-border-light bg-card-light p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Shield size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Protected identity</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              These details are locked. To update them, submit a change request —
              an admin must approve before it applies.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LOCKED_FIELDS.map(({ key, label, icon: Icon }) => {
            const pending = pendingByField[key];
            return (
              <div
                key={key}
                className="rounded-xl border border-border-light bg-surface-light/60 px-4 py-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    <Icon size={12} />
                    {label}
                  </span>
                  <Lock size={12} className="text-ink-muted" />
                </div>
                <p className="text-sm font-medium text-ink">
                  {profile[key] || <span className="text-ink-muted">Not set</span>}
                </p>
                {pending ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                    <Clock size={11} />
                    Pending: → {pending.requestedValue}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => openRequestModal(key)}
                    className="mt-1.5 text-[11px] font-semibold text-teal hover:underline"
                  >
                    Request change
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Your pending / recent requests */}
      {requests.length > 0 && (
        <div className="rounded-2xl border border-border-light bg-card-light p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-ink">Your change requests</h2>
          <div className="space-y-2">
            {requests.slice(0, 8).map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-light px-3 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-ink">{r.fieldLabel}</span>
                  <span className="text-ink-muted">
                    {" "}
                    · {r.currentValue} → {r.requestedValue}
                  </span>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Soft / editable profile */}
      <form
        onSubmit={handleSaveSoft}
        className="space-y-4 rounded-2xl border border-border-light bg-card-light p-5 shadow-sm sm:p-6"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-teal" />
          <h2 className="text-sm font-semibold text-ink">Public profile</h2>
          <span className="text-xs text-ink-muted">(you can edit these anytime)</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Date of birth
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={fieldClass}
            >
              <option value="">Prefer not to say</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Nickname</label>
          <input
            className={fieldClass}
            placeholder="How classmates see you"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={32}
          />
        </div>

        <div className="rounded-2xl border border-border-light bg-bg-panel-alt/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Privacy on avatar card</p>
          <label className="flex items-center justify-between gap-3 text-sm text-ink">
            <span>Show department when someone taps my photo</span>
            <input type="checkbox" checked={showDepartment} onChange={(e) => setShowDepartment(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-ink">
            <span>Show phone number on my card</span>
            <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-ink">
            <span>Pro: comment anonymously</span>
            <input
              type="checkbox"
              checked={allowAnonymousComments}
              onChange={(e) => setAllowAnonymousComments(e.target.checked)}
              disabled={!(profile?.plan === "annual" || profile?.plan === "paid" || profile?.plan === "pro" || profile?.subscription === "pro")}
            />
          </label>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="A short line about yourself…"
            className={fieldClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Interests / hobbies
          </label>
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="e.g. Reading, coding, football"
            className={fieldClass}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle size={15} />
            {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 text-sm text-teal">
            <CheckCircle2 size={15} />
            Profile saved
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save public profile"}
        </button>
      </form>

      {/* Request change modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-light bg-card-light p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">Request profile change</h3>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-light"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">
                  What do you want to change?
                </label>
                <select
                  value={reqField}
                  onChange={(e) => {
                    setReqField(e.target.value);
                    setReqValue("");
                  }}
                  className={fieldClass}
                >
                  {LOCKED_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                      {pendingByField[f.key] ? " (pending)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-surface-light px-3 py-2 text-xs text-ink-muted">
                Current:{" "}
                <strong className="text-ink">
                  {profile[reqField] || "Not set"}
                </strong>
              </div>

              {reqField === "faculty" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    New faculty
                  </label>
                  <select
                    value={reqFaculty}
                    onChange={(e) => {
                      setReqFaculty(e.target.value);
                      setReqDepartment("");
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
              ) : reqField === "department" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    New department
                  </label>
                  <select
                    value={reqDepartment}
                    onChange={(e) => setReqDepartment(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Select department</option>
                    {requestDeptOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    Based on your current faculty
                    {profile?.faculty ? ` (${profile.faculty})` : ""}. If you also
                    need a faculty change, request that first.
                  </p>
                </div>
              ) : reqField === "level" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    New level
                  </label>
                  <select
                    value={reqValue}
                    onChange={(e) => setReqValue(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Select level</option>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    New {selectedFieldMeta?.label?.toLowerCase()}
                  </label>
                  <input
                    value={reqValue}
                    onChange={(e) => setReqValue(e.target.value)}
                    className={fieldClass}
                    placeholder={`Enter new ${selectedFieldMeta?.label?.toLowerCase()}`}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">
                  Reason for change
                </label>
                <textarea
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  rows={3}
                  className={fieldClass}
                  placeholder="Explain why this change is needed…"
                />
              </div>

              {reqError && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle size={14} />
                  {reqError}
                </p>
              )}
              {reqSuccess && (
                <p className="flex items-center gap-1.5 text-sm text-teal">
                  <CheckCircle2 size={14} />
                  Request submitted — awaiting admin approval.
                </p>
              )}

              <button
                type="submit"
                disabled={reqBusy || !!pendingByField[reqField]}
                className="w-full rounded-xl bg-teal py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
              >
                {reqBusy ? "Submitting…" : "Submit for admin approval"}
              </button>
            </form>
          </div>
        </div>
      )}

      <ImageCropModal
        open={cropOpen}
        file={cropFile}
        onClose={() => { setCropOpen(false); setCropFile(null); }}
        onDone={async (dataUrl) => {
          setCropOpen(false);
          setCropFile(null);
          setPhotoError("");
          if (!user) return;
          setPhotoUploading(true);
          // Optimistic local preview
          setPhotoDataUrl(dataUrl);
          try {
            let finalUrl = dataUrl;
            // Prefer Cloudinary URL (stable, small Firestore field, works everywhere)
            try {
              const res = await fetch(dataUrl);
              const blob = await res.blob();
              const file = new File([blob], `avatar-${user.uid}.jpg`, {
                type: blob.type || "image/jpeg",
              });
              const uploaded = await uploadImageToCloudinary(file);
              if (uploaded?.secure_url) finalUrl = uploaded.secure_url;
            } catch {
              // Fall back to compressed data URL if Cloudinary is offline
              try {
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
                finalUrl = await fileToCompressedDataUrl(file, {
                  maxDim: 256,
                  quality: 0.7,
                });
              } catch {
                /* keep dataUrl */
              }
            }

            // Write both field names so every UI (topbar uses avatarUrl, profile uses photoURL) updates
            await updateDoc(doc(db, "users", user.uid), {
              photoURL: finalUrl,
              avatarUrl: finalUrl,
              updatedAt: serverTimestamp(),
            });

            // Firebase Auth profile (best-effort — Auth rejects huge data URLs)
            if (auth.currentUser && String(finalUrl).startsWith("http")) {
              try {
                await updateProfile(auth.currentUser, { photoURL: finalUrl });
              } catch {
                /* ignore */
              }
            }

            setPhotoDataUrl(finalUrl);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          } catch (err) {
            setPhotoError(
              err?.message ||
                "Could not save photo. Try a smaller image, then tap Save again."
            );
          } finally {
            setPhotoUploading(false);
          }
        }}
      />
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-teal-soft text-teal border-teal/30",
    rejected: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${
        styles[status] || styles.pending
      }`}
    >
      {status}
    </span>
  );
}
