import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "./ui";

function homeForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "agent" || role === "alphaAgent") return "/agent";
  // user + courseRep both use student app
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

  // Course Rep is still a student-side account
  const isStudentSide = role === "user" || role === "courseRep";
  const verified = Boolean((profile && profile.emailVerified) || (user && user.emailVerified));
  const needsEmailVerification = isStudentSide && !verified;
  const needsProfileSetup = isStudentSide && verified && !(profile && profile.profileComplete);
  const onboardingDone = !isStudentSide || (verified && profile && profile.profileComplete);

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
    if (!allowed.includes(role)) {
      return <Navigate to={homeForRole(role)} replace />;
    }
  }

  return children;
}