import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "./ui";

function homeForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "agent" || role === "alphaAgent") return "/agent";
  return "/dashboard";
}

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, profileReady, loading } = useAuth();
  const location = useLocation();

  if (loading || (user && !profileReady)) {
    return <LoadingState message="Checking your session…" />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = profile?.role || user?.role || "user";
  const isStaff = role === "admin" || role === "agent" || role === "alphaAgent";
  if (!profile && !isStaff) {
    return <Navigate to="/complete-profile" replace />;
  }

  const isStudentSide = role === "user" || role === "courseRep";
  const verified = Boolean((profile && profile.emailVerified) || (user && user.emailVerified));
  const needsEmailVerification = isStudentSide && !verified;
  const needsProfileSetup = isStudentSide && verified && !(profile && profile.profileComplete);
  const onboardingDone = !isStudentSide || (verified && profile && profile.profileComplete);

  // Agents / staff created by admin must set their own password first
  const needsPasswordChange = Boolean(profile?.mustChangePassword);
  if (needsPasswordChange && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (!needsPasswordChange && location.pathname === "/change-password") {
    return <Navigate to={homeForRole(role)} replace />;
  }

  if (needsEmailVerification && location.pathname !== "/verify-email") {
    return <Navigate to="/verify-email" replace />;
  }

  if (needsProfileSetup && location.pathname !== "/complete-profile") {
    return <Navigate to="/complete-profile" replace />;
  }

  if (
    onboardingDone &&
    (location.pathname === "/verify-email" ||
      location.pathname === "/complete-profile")
  ) {
    return <Navigate to={homeForRole(role)} replace />;
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    // Special: approver
    if (requiredRole === "approver") {
      if (!(role === "admin" || role === "alphaAgent")) {
        return <Navigate to={homeForRole(role)} replace />;
      }
    } else if (!allowed.includes(role)) {
      return <Navigate to={homeForRole(role)} replace />;
    }
  }

  // Suspended agents
  if (
    (role === "agent" || role === "alphaAgent") &&
    profile.status === "suspended" &&
    location.pathname !== "/login"
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-text-secondary">
        Your agent account is suspended. Contact an administrator.
      </div>
    );
  }

  return children;
}
