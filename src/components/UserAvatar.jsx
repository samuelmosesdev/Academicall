import { useState, useRef, useEffect } from "react";

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
  const ref = useRef(null);

  const displayNick =
    nickname || profile?.nickname || profile?.nickName || null;
  const displayName =
    name || profile?.name || profile?.email || "Student";
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
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
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

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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

      {open && (
        <div className="absolute left-1/2 top-full z-[80] mt-2 w-60 -translate-x-1/2 rounded-2xl border border-border-light bg-card-light p-3.5 shadow-xl animate-stitch-in">
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
            {displayNick ? (
              <>
                <p className="mt-2.5 text-base font-bold leading-tight text-ink">
                  {displayNick}
                </p>
                <p className="mt-0.5 text-[12px] font-normal text-ink-muted">
                  {displayName}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2.5 text-base font-bold leading-tight text-ink">
                  {displayName}
                </p>
                {profile?.email && (
                  <p className="mt-0.5 text-[12px] font-normal text-ink-muted">
                    {profile.email}
                  </p>
                )}
              </>
            )}

            {designation && (
              <span
                className={`mt-2 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badgeClass}`}
              >
                {designation === "Pro" ? "✦ Pro" : designation}
              </span>
            )}

            {canShowProgram && academicProgram && (
              <p className="mt-2 text-[11px] font-medium text-ink-muted">
                <span className="text-ink-muted/80">Programme · </span>
                {academicProgram}
              </p>
            )}
            {profile?.faculty && forceShowDetails && (
              <p className="text-[11px] text-ink-muted">{profile.faculty}</p>
            )}
            {profile?.level && forceShowDetails && (
              <p className="text-[11px] text-ink-muted">{profile.level}</p>
            )}
            {canShowPhone && phoneVal && (
              <p className="mt-1 text-[11px] font-medium text-ink">{phoneVal}</p>
            )}
          </div>
        </div>
      )}
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
        <span className="text-[11px] font-normal text-ink-muted">{name}</span>
      )}
      {designation && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badgeClass}`}
        >
          {designation === "Pro" ? "✦ Pro" : designation}
        </span>
      )}
    </span>
  );
}
