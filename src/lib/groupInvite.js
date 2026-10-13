export const PENDING_INVITE_KEY = "academicall_pending_invite";

export function pendingGroupInvitePath() {
  const code = localStorage.getItem(PENDING_INVITE_KEY);
  return code && /^[A-Za-z0-9]{6,16}$/.test(code)
    ? `/dashboard/groups/join/${code}`
    : null;
}
