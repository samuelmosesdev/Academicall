/** Canonical roles for UofA Readers */

export const ROLES = {
  ADMIN: "admin",
  ALPHA: "alphaAgent",
  AGENT: "agent",
  COURSE_REP: "courseRep",
  USER: "user",
};

export const ROLE_LABELS = {
  admin: "Admin",
  alphaAgent: "Agent Alpha (Elevated)",
  agent: "Agent (Beta)",
  courseRep: "Course Rep",
  user: "Student",
};

/** Roles an Admin may assign */
export const ADMIN_ASSIGNABLE = [
  "user",
  "courseRep",
  "agent",
  "alphaAgent",
  "admin",
];

/** Roles an Alpha Agent may assign (never admin) */
export const ALPHA_ASSIGNABLE = ["user", "courseRep"];

export function roleOf(profile) {
  return profile?.role || "user";
}

export function isAdmin(profile) {
  return roleOf(profile) === ROLES.ADMIN;
}

export function isAlpha(profile) {
  return roleOf(profile) === ROLES.ALPHA;
}

export function isAgent(profile) {
  return roleOf(profile) === ROLES.AGENT;
}

export function isCourseRep(profile) {
  return roleOf(profile) === ROLES.COURSE_REP;
}

export function isStaff(profile) {
  const r = roleOf(profile);
  return r === ROLES.ADMIN || r === ROLES.ALPHA || r === ROLES.AGENT;
}

/** Can approve requests */
export function canApprove(profile) {
  return isAdmin(profile) || isAlpha(profile);
}

/** Can send platform announcements */
export function canAnnounce(profile) {
  return isAdmin(profile) || isAlpha(profile);
}

/** Dashboard path after login */
export function homePathFor(profile) {
  const r = roleOf(profile);
  if (r === ROLES.ADMIN) return "/admin";
  if (r === ROLES.ALPHA || r === ROLES.AGENT) return "/agent";
  return "/dashboard";
}

/**
 * Where a signed-in user still needs to go before they can reach their
 * dashboard — a forced password change, email verification, or profile
 * completion. Returns null once they're fully onboarded. Mirrors the order
 * ProtectedRoute enforces, so Landing (and anywhere else) can redirect
 * straight to the right step instead of dead-ending on a "go to dashboard"
 * CTA that just bounces back.
 */
export function nextOnboardingPath(profile) {
  if (!profile) return null;
  if (profile.mustChangePassword) return "/change-password";
  const r = roleOf(profile);
  const isStudentSide = r === ROLES.USER || r === ROLES.COURSE_REP;
  if (isStudentSide) {
    if (!profile.emailVerified) return "/verify-email";
    if (!profile.profileComplete) return "/complete-profile";
  }
  return null;
}

/**
 * ProtectedRoute-style check.
 * requiredRole: single role or array. Special:
 *  - "staff" => admin | alpha | agent
 *  - "approver" => admin | alpha
 *  - "user" => student side including courseRep
 */
export function matchesRequiredRole(profile, requiredRole) {
  if (!requiredRole) return true;
  const r = roleOf(profile);
  if (Array.isArray(requiredRole)) return requiredRole.includes(r);
  if (requiredRole === "staff") return isStaff(profile);
  if (requiredRole === "approver") return canApprove(profile);
  if (requiredRole === "user") return r === "user" || r === "courseRep";
  if (requiredRole === "agent") return r === "agent" || r === "alphaAgent";
  return r === requiredRole;
}