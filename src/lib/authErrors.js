/*
  Auth error copy.

  describeAuthError(err) turns anything the auth flows can throw (a Firebase
  error, an API error from lib/api.js, a plain string we set ourselves) into:

    { kind, tone, title, message, action? }

  kind    — stable id, handy for tests/analytics
  tone    — "error" | "warn" | "info" (drives the card tint + icon)
  title   — short headline, lightly witty
  message — plain explanation + what to do next
  action  — optional { label, to } link shown under the message

  Keep the jokes to the headline. The message line must read fine on its own.
*/

const COPY = {
  wrongPassword: {
    tone: "error",
    title: "That password didn't pass the exam.",
    message: "The email or password doesn't match our records. Check for typos or caps lock and try again.",
    action: { label: "Reset your password", to: "/forgot-password" },
  },
  userNotFound: {
    tone: "error",
    title: "We checked every lecture hall.",
    message: "There's no account with that email or ID. Check the spelling, or create a new account.",
    action: { label: "Create an account", to: "/signup" },
  },
  emailInUse: {
    tone: "info",
    title: "That email already has a seat in class.",
    message: "An account with this email exists. Sign in instead, or reset the password if you've forgotten it.",
    action: { label: "Sign in instead", to: "/login" },
  },
  weakPassword: {
    tone: "warn",
    title: "That password needs a bit more revision.",
    message: "Use at least 6 characters. A mix of letters and numbers is harder to guess.",
  },
  weakPassword8: {
    tone: "warn",
    title: "That password needs a bit more revision.",
    message: "Use at least 8 characters. A mix of letters and numbers is harder to guess.",
  },
  passwordMismatch: {
    tone: "warn",
    title: "The two passwords aren't on the same page.",
    message: "Your password and confirmation don't match. Retype them and try again.",
  },
  invalidEmail: {
    tone: "warn",
    title: "That email looks a little off.",
    message: "Enter a full email address, like you@example.com.",
  },
  tooManyRequests: {
    tone: "warn",
    title: "Easy, champ.",
    message: "Too many tries in a short time. Take a short break and come back in a few minutes.",
  },
  disabled: {
    tone: "error",
    title: "This account is on a break.",
    message: "It has been suspended or deactivated. Write to info@surfwired.com and we'll sort it out.",
  },
  cancelled: {
    tone: "info",
    title: "Sign-in was cancelled.",
    message: "No harm done. Pick a sign-in option whenever you're ready.",
  },
  network: {
    tone: "warn",
    title: "Your connection skipped class.",
    message: "We couldn't reach Academicall. Check your internet and try again.",
  },
  timeout: {
    tone: "warn",
    title: "That took longer than a GST lecture.",
    message: "The server is slow to respond right now. Give it a moment and try again.",
  },
  server: {
    tone: "error",
    title: "Something tripped on our side.",
    message: "It's not you, it's us. Try again in a minute. If it keeps happening, write to info@surfwired.com.",
  },
  maintenance: {
    tone: "info",
    title: "We're tidying the classroom.",
    message: "Academicall is down for a short bit of maintenance. Please check back shortly.",
  },
  googleFailed: {
    tone: "error",
    title: "Google didn't hand us the hall pass.",
    message: "That Google sign-in didn't go through. Try again, or use your email and password.",
  },
  googleUnavailable: {
    tone: "info",
    title: "Google sign-in is out for now.",
    message: "It didn't load on this page. Use your email and password, or refresh and try again.",
  },
  codeWrong: {
    tone: "error",
    title: "That code didn't check out.",
    message: "Double-check the digits and try again.",
  },
  codeExpired: {
    tone: "warn",
    title: "That code has expired.",
    message: "Codes only last a few minutes. Sign in again to get a fresh one.",
  },
  codeLocked: {
    tone: "warn",
    title: "Too many wrong codes.",
    message: "For your safety we've reset this sign-in. Sign in again to get a new code.",
  },
  resetLinkInvalid: {
    tone: "warn",
    title: "This reset link has graduated.",
    message: "It's invalid or has expired. Request a fresh link and use it within the hour.",
    action: { label: "Send a new link", to: "/forgot-password" },
  },
  sessionEnded: {
    tone: "info",
    title: "You were signed out.",
    message: "Your session ended on this device. Sign in again to continue.",
  },
};

const FIREBASE = {
  "auth/invalid-credential": "wrongPassword",
  "auth/wrong-password": "wrongPassword",
  "auth/invalid-login-credentials": "wrongPassword",
  "auth/user-not-found": "userNotFound",
  "auth/email-already-in-use": "emailInUse",
  "auth/weak-password": "weakPassword",
  "auth/invalid-email": "invalidEmail",
  "auth/missing-email": "invalidEmail",
  "auth/too-many-requests": "tooManyRequests",
  "auth/user-disabled": "disabled",
  "auth/popup-closed-by-user": "cancelled",
  "auth/cancelled-popup-request": "cancelled",
  "auth/network-request-failed": "network",
  "auth/expired-action-code": "resetLinkInvalid",
  "auth/invalid-action-code": "resetLinkInvalid",
};

const API_CODES = {
  challenge_expired: "codeExpired",
  challenge_locked: "codeLocked",
  bad_code: "codeWrong",
  session_revoked: "sessionEnded",
  maintenance: "maintenance",
};

// Message patterns (API error strings and the ones our own pages set).
const PATTERNS = [
  [/invalid email or password|incorrect (email|password)|current password is incorrect/i, "wrongPassword"],
  [/user not found|no account/i, "userNotFound"],
  [/inactive|suspended|deactivated|disabled/i, "disabled"],
  [/already registered|already exists|already in use/i, "emailInUse"],
  [/passwords? do(es)? not match/i, "passwordMismatch"],
  [/(at least|minimum of?) 8 characters/i, "weakPassword8"],
  [/(at least|minimum of?) 6 characters|password.*(too short|weak)|string must contain at least 6/i, "weakPassword"],
  [/valid email|invalid email/i, "invalidEmail"],
  [/too many/i, "tooManyRequests"],
  [/reset link|token.*(invalid|expired|missing)|missing its token/i, "resetLinkInvalid"],
  [/code has expired|code expired|sign in again\.?$/i, "codeExpired"],
  [/code isn't right|invalid code|code must be/i, "codeWrong"],
  [/took too long|timed? ?out/i, "timeout"],
  [/failed to fetch|network|load failed|connection/i, "network"],
  [/google.*(unavailable|did not load|not configured)/i, "googleUnavailable"],
  [/google/i, "googleFailed"],
  [/cancell?ed/i, "cancelled"],
];

function build(kind, extra) {
  return { kind, ...COPY[kind], ...extra };
}

/**
 * @param {unknown} err  Error | { code, status, message, data } | string
 * @param {{ fallback?: string }} [opts]  fallback headline context, e.g. "Login failed"
 */
export function describeAuthError(err, opts = {}) {
  if (!err) return null;
  if (typeof err === "object" && err.title && err.message && err.kind) return err; // already described

  const code = typeof err === "object" ? err.code : undefined;
  const apiCode = typeof err === "object" ? err.data?.code : undefined;
  const status = typeof err === "object" ? err.status : undefined;
  const message = typeof err === "string" ? err : err?.message || "";

  if (code && FIREBASE[code]) return build(FIREBASE[code]);
  if (apiCode && API_CODES[apiCode]) {
    const extra = apiCode === "bad_code" && Number.isFinite(err.data?.attemptsLeft)
      ? { message: `Double-check the digits and try again. ${err.data.attemptsLeft} ${err.data.attemptsLeft === 1 ? "try" : "tries"} left.` }
      : undefined;
    return build(API_CODES[apiCode], extra);
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return build("network");

  for (const [re, kind] of PATTERNS) if (re.test(message)) return build(kind);

  if (status === 429) return build("tooManyRequests");
  if (status === 503) return build("maintenance");
  if (status >= 500) return build("server");

  // Unknown: keep the real message so nothing useful is hidden.
  return {
    kind: "unknown",
    tone: "error",
    title: opts.fallback || "That didn't go through.",
    message: message && !/^Request failed with status/.test(message)
      ? message
      : "Something unexpected happened. Please try again.",
  };
}

/** Back-compat: short one-line message for a Firebase code (or null). */
export function friendlyAuthError(code) {
  const kind = FIREBASE[code];
  return kind ? COPY[kind].message : null;
}
