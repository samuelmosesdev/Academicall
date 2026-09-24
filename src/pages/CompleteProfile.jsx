import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, CheckCircle2, Camera } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import UniqueIdBadge from "../components/UniqueIdBadge";
import { useAcademicCatalog } from "../hooks/useAcademicCatalog";
import { fileToCompressedDataUrl } from "../lib/imageUtils";

const LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "Postgraduate"];

export default function CompleteProfile() {
  const { profile, completeProfile } = useAuth();
  const navigate = useNavigate();
  const { faculties, programsForFaculty, departmentForProgram } = useAcademicCatalog();

  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [program, setProgram] = useState("");
  const [level, setLevel] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoError, setPhotoError] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [generatedId, setGeneratedId] = useState(null);

  const programOptions = programsForFaculty(faculty);

  function handleFacultyChange(value) {
    setFaculty(value);
    setProgram("");
    setDepartment("");
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPhotoDataUrl(dataUrl);
    } catch (err) {
      setPhotoError(err.message);
    }
  }

  // Already completed (e.g. user navigated back here manually) — nothing to do.
  if (profile?.profileComplete && !generatedId) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      console.log("CompleteProfile: submitting", {
        faculty,
        department,
        level,
        matricNumber,
        phone,
        hasPhoto: Boolean(photoDataUrl),
      });
      const uniqueId = await completeProfile({
        faculty: faculty.trim(),
        department: department.trim(),
        program: program.trim(),
        level,
        matricNumber: matricNumber.trim(),
        phone: phone.trim(),
        photoURL: photoDataUrl || null,
      });
      console.log("CompleteProfile: completeProfile returned", { uniqueId });
      setGeneratedId(uniqueId);
    } catch (err) {
      console.error("CompleteProfile: completeProfile error", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (generatedId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-app px-4">
        <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-panel p-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CheckCircle2 size={24} />
          </span>
          <h1 className="mb-1 text-xl font-semibold text-text-primary">You're all set</h1>
          <p className="mb-5 text-sm text-text-secondary">
            Here's your Unique ID — you can use it (with your password) to log in from now on,
            or keep using your email.
          </p>

          <div className="mb-6 flex justify-center">
            <UniqueIdBadge uniqueId={generatedId} />
          </div>

          <button
            type="button"
            onClick={() => navigate("/dashboard", { replace: true })}
            className="w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-bg-app transition-colors hover:bg-accent-strong"
          >
            Continue to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-app px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-panel p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <GraduationCap size={18} />
          </span>
          <span className="text-[15px] font-semibold text-text-primary">Academicall</span>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-text-primary">Complete your profile</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Just a few more details before we generate your Unique ID.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <label
              htmlFor="photo-upload"
              className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border-subtle bg-bg-panel-alt text-text-muted hover:border-accent hover:text-accent"
            >
              {photoDataUrl ? (
                <img src={photoDataUrl} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                <Camera size={20} />
              )}
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <span className="text-xs text-text-muted">
              {photoDataUrl ? "Photo added — tap to change" : "Add a profile photo (optional)"}
            </span>
            {photoError && <span className="text-xs text-status-danger">{photoError}</span>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Faculty</label>
            <select
              required
              value={faculty}
              onChange={(e) => handleFacultyChange(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                Select your faculty
              </option>
              {faculties.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Program</label>
            <select
              required={programOptions.length > 0}
              disabled={!faculty || programOptions.length === 0}
              value={program}
              onChange={(e) => {
                const nextProgram = e.target.value;
                setProgram(nextProgram);
                setDepartment(departmentForProgram(nextProgram, faculty));
              }}
              className="w-full rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{programOptions.length ? "Select your program" : "No programs listed"}</option>
              {programOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Department</label>
            <input
              required
              readOnly
              value={department}
              placeholder={program ? "Derived from program" : "Select a program first"}
              className="w-full rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none read-only:opacity-75"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Current level
            </label>
            <select
              required
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                Select your level
              </option>
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Matric number <span className="text-text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={matricNumber}
              onChange={(e) => setMatricNumber(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              placeholder="e.g. 20/1234"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Phone number <span className="text-text-muted">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              placeholder="e.g. 080..."
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-bg-app transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {busy ? "Generating your ID…" : "Generate my Unique ID"}
          </button>
        </form>
      </div>
    </div>
  );
}
