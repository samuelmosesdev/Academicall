import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";

/** Human-readable designation from role + plan */
export function roleBadge(role, plan, subscription) {
  if (role === "alphaAgent") return "Alpha Agent";
  if (role === "agent") return "Agent";
  if (role === "admin") return "Admin";
  if (role === "courseRep") return "Course Rep";
  const pro =
    plan === "annual" ||
    plan === "paid" ||
    plan === "pro" ||
    subscription === "pro" ||
    subscription === "annual" ||
    subscription === "paid";
  if (pro) return "Pro";
  return null;
}

export function displayLabel(profile, fallback = "Student") {
  if (!profile) return fallback;
  return profile.nickname || profile.nickName || profile.name || profile.email || fallback;
}

export function getUserIdentity(profile, fallback = "User") {
  const name = profile?.nickname || profile?.nickName || profile?.name || profile?.email || fallback;
  return {
    name,
    email: profile?.email || "",
  };
}

export function isProUser(profile) {
  if (!profile) return false;
  return (
    profile.plan === "annual" ||
    profile.plan === "paid" ||
    profile.plan === "pro" ||
    profile.subscription === "pro" ||
    profile.subscription === "annual" ||
    profile.subscription === "paid"
  );
}

const STAFF_ROLES = ["admin", "alphaAgent", "agent"];

/**
 * Keep a popover inside the viewport. Prefers below the trigger, flips above
 * when there isn't room, and clamps left/right with a 16px gutter.
 */
function placePopover(trigger, pop) {
  const gutter = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = trigger.getBoundingClientRect();
  const w = Math.min(pop.offsetWidth || 240, vw - gutter * 2);
  const h = pop.offsetHeight || 0;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(gutter, Math.min(left, vw - w - gutter));
  const below = vh - r.bottom - gutter;
  const above = r.top - gutter;
  let top;
  if (h + 8 <= below || below >= above) top = r.bottom + 8;
  else top = Math.max(gutter, r.top - 8 - h);
  const maxHeight = top > r.top ? vh - top - gutter : r.top - 8 - gutter;
  return { left, top, maxHeight: Math.max(160, maxHeight) };
}

function useIsNarrow(query = "(max-width: 639px)") {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [query]);
  return narrow;
}

export default function UserAvatar({
  profile,
  name,
  nickname,
  photoURL,
  program,
  phone,
  role,
  plan,
  subscription,
  showDepartment,
  showPhone,
  size = 36,
  className = "",
  /** When true (e.g. staff viewing a student), always show dept if present */
  forceShowDetails = false,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const narrow = useIsNarrow();
  const { user: viewer, profile: viewerProfile } = useAuth() || {};

  const viewerId = viewer?.uid || viewer?.id || viewerProfile?.uid || viewerProfile?.id || null;
  const subjectId = profile?.uid || profile?.id || null;
  const isSelf = Boolean(
    profile && ((viewerId && subjectId && viewerId === subjectId) ||
      (viewerProfile?.email && profile.email && viewerProfile.email === profile.email))
  );
  const viewerIsStaff = STAFF_ROLES.includes(viewerProfile?.role || viewer?.role);
  // E-mail stays private between peers: only you, or staff, see it.
  const canSeeEmail = isSelf || viewerIsStaff;

  const displayNick =
    nickname || profile?.nickname || profile?.nickName || null;
  const displayName =
    name || profile?.name || (canSeeEmail ? profile?.email : null) || "Student";
  const photo =
    photoURL || profile?.photoUrl || profile?.avatarUrl || profile?.photoURL || null;
  const academicProgram = program ?? profile?.program ?? null;
  const phoneVal =
    phone ?? (profile?.showPhone === true ? profile?.phone : null);
  const roleLabel = role || profile?.role || null;
  const planVal = plan ?? profile?.plan;
  const subVal = subscription ?? profile?.subscription;

  const canShowProgram =
    forceShowDetails || showDepartment === true
      ? !!academicProgram
      : showDepartment !== undefined
        ? showDepartment && !!academicProgram
        : profile?.showDepartment !== false && !!academicProgram;

  const canShowPhone =
    forceShowDetails && phone
      ? true
      : showPhone !== undefined
        ? showPhone
        : profile?.showPhone === true && !!phoneVal;

  const initials = String(displayNick || displayName)
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Desktop popover: position against the avatar and keep it on screen.
  useLayoutEffect(() => {
    if (!open || narrow) return undefined;
    const update = () => {
      if (btnRef.current && popRef.current) setPos(placePopover(btnRef.current, popRef.current));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, narrow]);

  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  const px = typeof size === "number" ? `${size}px` : size;
  const designation = roleBadge(roleLabel, planVal, subVal);

  const badgeClass =
    designation === "Pro"
      ? "bg-lemon text-midnight border-lemon-deep/40"
      : designation === "Course Rep"
        ? "bg-aqua-soft text-aqua-deep border-aqua-deep/25 dark:bg-aqua/15 dark:text-aqua"
        : designation === "Alpha Agent" || designation === "Admin"
          ? "bg-teal-soft text-teal border-teal/30"
          : designation === "Agent"
            ? "bg-violet-soft text-violet border-violet/25 dark:bg-violet/20"
            : "bg-teal-soft text-teal border-teal/30";

  const card = (
    <div className="flex flex-col items-center text-center">
      <div
        className="overflow-hidden rounded-full ring-2 ring-teal/30"
        style={{ width: 72, height: 72 }}
      >
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-teal-soft text-sm font-bold text-teal">
            {initials}
          </span>
        )}
      </div>

      {/* Nickname primary (bold); legal name secondary */}
      <p className="mt-2.5 max-w-full break-words text-base font-bold leading-tight text-ink">
        {displayNick || displayName}
      </p>
      {displayNick && displayName !== displayNick && (
        <p className="mt-0.5 max-w-full break-words text-[12px] font-normal text-ink-muted">{displayName}</p>
      )}
      {canSeeEmail && profile?.email && profile.email !== displayName && (
        <p className="mt-0.5 max-w-full break-all text-[12px] font-normal text-ink-muted">{profile.email}</p>
      )}

      {designation && (
        <span className={`mt-2 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-bold ${badgeClass}`}>
          {designation === "Pro" ? "✦ Pro" : designation}
        </span>
      )}

      {canShowProgram && academicProgram && (
        <p className="mt-2 max-w-full break-words text-xs font-medium text-ink-muted">
          <span className="text-ink-muted/80">Programme · </span>
          {academicProgram}
        </p>
      )}
      {profile?.faculty && forceShowDetails && (
        <p className="text-xs text-ink-muted">{profile.faculty}</p>
      )}
      {profile?.level && forceShowDetails && (
        <p className="text-xs text-ink-muted">{profile.level}</p>
      )}
      {canShowPhone && phoneVal && (
        <p className="mt-1 text-xs font-medium text-ink">{phoneVal}</p>
      )}
    </div>
  );

  let layer = null;
  if (open && typeof document !== "undefined") {
    layer = narrow
      ? createPortal(
          <div className="fixed inset-0 z-[90] flex items-end" role="dialog" aria-modal="true" aria-label={displayNick || displayName}>
            <button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-midnight/40"
              onClick={() => setOpen(false)}
            />
            <div
              ref={popRef}
              className="animate-stitch-in relative w-full overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border-light bg-card-light px-5 pt-3 shadow-xl"
              style={{ maxHeight: "85dvh", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            >
              <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-border-strong/60" aria-hidden="true" />
              {card}
            </div>
          </div>,
          document.body
        )
      : createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={displayNick || displayName}
            className="animate-stitch-in fixed z-[90] w-60 overflow-y-auto overscroll-contain rounded-2xl border border-border-light bg-card-light p-3.5 shadow-xl"
            style={{
              left: pos?.left ?? -9999,
              top: pos?.top ?? 0,
              maxWidth: "calc(100vw - 2rem)",
              maxHeight: pos?.maxHeight ?? "calc(100dvh - 2rem)",
              visibility: pos ? "visible" : "hidden",
            }}
          >
            {card}
          </div>,
          document.body
        );
  }

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="shrink-0 overflow-hidden rounded-full ring-2 ring-border-light focus:outline-none focus:ring-teal/40"
        style={{ width: px, height: px }}
        title={displayNick || displayName}
      >
        {photo ? (
          <img
            src={photo}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-teal-soft text-xs font-bold text-teal">
            {initials}
          </span>
        )}
      </button>
      {layer}
    </div>
  );
}

/** Inline name + designation chip for comments / posts */
export function NameWithBadge({
  name,
  nickname,
  role,
  plan,
  subscription,
  isAnonymous,
  className = "",
}) {
  const label = nickname || name || "User";
  const designation = isAnonymous ? null : roleBadge(role, plan, subscription);
  const badgeClass =
    designation === "Pro"
      ? "bg-lemon text-midnight"
      : designation === "Course Rep"
        ? "bg-aqua-soft text-aqua-deep dark:bg-aqua/15 dark:text-aqua"
        : designation === "Alpha Agent" || designation === "Admin"
          ? "bg-teal-soft text-teal"
          : designation === "Agent"
            ? "bg-violet-soft text-violet dark:bg-violet/20"
            : "";

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="font-bold">{label}</span>
      {nickname && name && nickname !== name && (
        <span className="text-xs font-normal text-ink-muted">{name}</span>
      )}
      {designation && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold ${badgeClass}`}
        >
          {designation === "Pro" ? "✦ Pro" : designation}
        </span>
      )}
    </span>
  );
}
