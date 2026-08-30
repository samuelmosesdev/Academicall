import { useEffect, useState } from "react";
import { Camera, Loader2, Save } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usersApi } from "../lib/api";
import { uploadImageToCloudinary } from "../lib/cloudinaryUpload";
import { ROLE_LABELS } from "../lib/roles";

const field =
  "w-full rounded-xl border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none";

export default function StaffProfile() {
  const { user, profile } = useAuth();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || "");
    setNickname(profile.nickname || profile.nickName || "");
    setPhone(profile.phone || "");
    setBio(profile.bio || "");
    setPhotoURL(profile.photoURL || profile.avatarUrl || "");
  }, [profile]);

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setErr("");
    try {
      const res = await uploadImageToCloudinary(file);
      const url = res.secure_url;
      setPhotoURL(url);
      await usersApi.updateMe({ photoUrl: url });
      setMsg("Photo updated");
      setTimeout(() => setMsg(""), 2000);
    } catch (ex) {
      setErr(ex.message || "Photo upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function save(e) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setErr("");
    try {
      await usersApi.updateMe({
        name: name.trim(),
        nickname: nickname.trim(),
        phone: phone.trim() || null,
        bio: bio.trim(),
        photoUrl: photoURL || null,
      });
      setMsg("Profile saved");
      setTimeout(() => setMsg(""), 2500);
    } catch (ex) {
      setErr(ex.message || "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const initials = (name || "S")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Your profile</h1>
        <p className="text-sm text-text-secondary">
          {ROLE_LABELS[profile?.role] || profile?.role} · {profile?.email}
        </p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-panel p-6">
        <div className="flex items-end gap-4">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-accent-soft text-lg font-bold text-accent">
              {photoURL ? (
                <img src={photoURL} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-accent text-bg-app shadow">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} disabled={uploading} />
            </label>
          </div>
          <div className="pb-1 text-sm text-text-muted">
            Tap the camera to change your photo
          </div>
        </div>

        <form onSubmit={save} className="mt-6 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Display name</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Nickname</label>
            <input className={field} value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Phone</label>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Bio</label>
            <textarea className={field} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          {err && <p className="text-sm text-status-danger">{err}</p>}
          {msg && <p className="text-sm text-accent">{msg}</p>}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-bg-app disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save profile
          </button>
        </form>
      </div>
    </div>
  );
}
