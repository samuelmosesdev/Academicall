import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homePathFor } from "../lib/roles";
import { LoadingState } from "../components/ui";
import { pendingGroupInvitePath } from "../lib/groupInvite";

/** After login: wait for profile, then route by role */
export default function LoginRedirect() {
  const { user, profile, profileReady, loading } = useAuth();

  // Still loading auth state
  if (loading) {
    return <LoadingState message="Signing you in…" />;
  }

  // No user at all
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Waiting for profile (mainly for Firebase)
  if (!profileReady) {
    return <LoadingState message="Loading your profile…" />;
  }

  // Force password change (old Firebase feature)
  if (profile?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  const role = profile?.role || user.role || "user";
  const isStudent = role === "user" || role === "courseRep";
  if (isStudent && !profile?.emailVerified && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  if (isStudent && !profile?.profileComplete) {
    return <Navigate to="/complete-profile" replace />;
  }

  const invitePath = isStudent ? pendingGroupInvitePath() : null;
  if (invitePath) return <Navigate to={invitePath} replace />;

  const destination = homePathFor(profile || user) || "/dashboard";

  return <Navigate to={destination} replace />;
}