/** Canonical roles for UofA Readers */

export const ROLES = {
  ADMIN: "admin",
  ALPHA: "alphaAgent",
  AGENT: "agent",
  COURSE_REP: "courseRep",
  NEWS_AGENT: "newsAgent",
  USER: "user",
  ASPIRANT: "aspirant",
};

export const ROLE_LABELS = {
  admin: "Admin",
  alphaAgent: "Agent Alpha (Elevated)",
  agent: "Agent (Beta)",
  courseRep: "Course Rep",
  newsAgent: "News Agent",
  user: "Student",
  aspirant: "Aspirant",
};

/** Roles an Admin may assign (News and Secretary are duties, not roles) */
export const ADMIN_ASSIGNABLE = [
  "user",
  "courseRep",
  "agent",
  "alphaAgent",
  "admin",
];

/** Add-on duties any user can hold on top of their role */
export const DUTY_LABELS = { news: "News Agent", secretary: "Secretary", newsChief: "Chief News Agent", houseLeader: "House Leader" };

/** Prospective student seeking admission */
export function isAspirant(profile) {
  return roleOf(profile) === "aspirant";
}
/** Runs one or more Aspirant Houses */
export function isHouseLeader(profile) {
  return hasTag(profile, "houseLeader");
}
/** Chief News Agent (admins can do everything a chief can) */
export function isNewsChief(profile) {
  return roleOf(profile) === "admin" || hasTag(profile, "newsChief");
}

export function hasTag(profile, tag) {
  return Array.isArray(profile?.staffTags) && profile.staffTags.includes(tag);
}

/**
 * Capability check. The API computes each person's capabilities (the admin
 * chooses them per agent); admins always have all of them.
 */
export function can(profile, cap) {
  if (roleOf(profile) === "admin") return true;
  return Array.isArray(profile?.capabilities) && profile.capabilities.includes(cap);
}
export function canAny(profile, ...caps) {
  return caps.some((c) => can(profile, c));
}

/** Runs the Secretariat */
export function isSecretary(profile) {
  return roleOf(profile) === "admin" || hasTag(profile, "secretary");
}

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

export function isNewsAgent(profile) {
  return hasTag(profile, "news") || hasTag(profile, "newsChief") || roleOf(profile) === ROLES.NEWS_AGENT;
}

export function isStaff(profile) {
  const r = roleOf(profile);
  return r === ROLES.ADMIN || r === ROLES.ALPHA || r === ROLES.AGENT;
}

/** Can write and publish Academicall News */
export function canWriteNews(profile) {
  return roleOf(profile) === ROLES.ADMIN || isNewsAgent(profile);
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
  const isStudentSide = r === ROLES.USER || r === ROLES.COURSE_REP || r === ROLES.NEWS_AGENT || r === ROLES.ASPIRANT;
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
  if (typeof requiredRole === "string" && requiredRole.startsWith("cap:")) {
    return requiredRole.slice(4).split("|").some((c) => can(profile, c));
  }
  if (requiredRole === "secretariat") return isSecretary(profile);
  if (Array.isArray(requiredRole)) return requiredRole.includes(r);
  if (requiredRole === "staff") return isStaff(profile);
  if (requiredRole === "approver") return canApprove(profile);
  if (requiredRole === "user") return r === "user" || r === "courseRep" || r === "newsAgent";
  if (requiredRole === "newsDesk") return canWriteNews(profile);
  if (requiredRole === "houseDesk") return isHouseLeader(profile) || canAny(profile, "houses.manage");
  if (requiredRole === "aspirant") return r === "aspirant";
  if (requiredRole === "agent") return r === "agent" || r === "alphaAgent";
  return r === requiredRole;
}