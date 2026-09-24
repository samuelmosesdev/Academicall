import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Privacy from "./pages/Privacy";
import Login from "./pages/Login";
import LoginRedirect from "./pages/LoginRedirect";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ForceChangePassword from "./pages/ForceChangePassword";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import CompleteProfile from "./pages/CompleteProfile";
import AdminLayout from "./pages/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetail from "./pages/AdminUserDetail";
import AdminDocuments from "./pages/AdminDocuments";
import AdminCbtBuilder from "./pages/AdminCbtBuilder";
import AdminCourses from "./pages/AdminCourses";
import AdminAgents from "./pages/AdminAgents";
import AdminAgentActivity from "./pages/AdminAgentActivity";
import AdminPayments from "./pages/AdminPayments";
import AdminSettings from "./pages/AdminSettings";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import StaffFeedPage from "./pages/StaffFeedPage";
import StaffChat from "./pages/StaffChat";
import StaffProfile from "./pages/StaffProfile";
import AdminRequests from "./pages/AdminRequests";
import AdminActivityLog from "./pages/AdminActivityLog";
import AdminUserActivity from "./pages/AdminUserActivity";
import AdminActivity from "./pages/AdminActivity";
import AdminGovernance from "./pages/AdminGovernance";
import AdminAcademicCatalog from "./pages/AdminAcademicCatalog";
import AdminAuditLog from "./pages/AdminAuditLog";
import AdminNotifications from "./pages/AdminNotifications";
import AgentLayout from "./pages/AgentLayout";
import AgentDashboard from "./pages/AgentDashboard";
import AgentSettings from "./pages/AgentSettings";
import StudentSettings from "./pages/StudentSettings";
import UserLayout from "./pages/UserLayout";
import UserDashboard from "./pages/UserDashboard";
import StudentProfile from "./pages/StudentProfile";
import StudentDocuments from "./pages/StudentDocuments";
import StudentCourseReading from "./pages/StudentCourseReading";
import DocumentReader from "./pages/DocumentReader";
import StudentPractice from "./pages/StudentPractice";
import StudentUpgrade from "./pages/StudentUpgrade";
import StudentTimetable from "./pages/StudentTimetable";
import StudentNotifications from "./pages/StudentNotifications";
import ArchivedNotifications from "./pages/ArchivedNotifications";
import StudentCourses from "./pages/StudentCourses";
const CourseRepPanel = lazy(() => import("./pages/CourseRepPanel"));
import StudentReference from "./pages/StudentReference";
import StudentDepartment from "./pages/StudentDepartment";
import StudentMaterials from "./pages/StudentMaterials";
import StudentDocumentsComingSoon from "./pages/StudentDocumentsComingSoon";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login-redirect" element={<LoginRedirect />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ForceChangePassword />
                </ProtectedRoute>
              }
            />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/verify-email"
              element={
                <ProtectedRoute>
                  <VerifyEmail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/complete-profile"
              element={
                <ProtectedRoute>
                  <CompleteProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:userId" element={<AdminUserDetail />} />
              <Route path="users/:userId/activity" element={<AdminUserActivity />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="governance" element={<AdminGovernance />} />
              <Route path="governance/academic-catalog" element={<AdminAcademicCatalog />} />
              <Route path="audit-log" element={<AdminAuditLog />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="agents" element={<AdminAgents />} />
              <Route path="agents/:agentId" element={<AdminAgentActivity />} />
              <Route path="documents" element={<AdminDocuments />} />
              <Route path="courses" element={<AdminCourses />} />
              <Route path="cbt-builder" element={<AdminCbtBuilder />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="activity-log" element={<AdminActivityLog />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="profile" element={<StaffProfile />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="feeds" element={<StaffFeedPage />} />
              <Route path="staff-chat" element={<StaffChat />} />
            </Route>

            <Route
              path="/agent"
              element={
                <ProtectedRoute requiredRole={["agent", "alphaAgent"]}>
                  <AgentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AgentDashboard />} />
              <Route path="documents" element={<AdminDocuments />} />
              <Route path="courses" element={<AdminCourses />} />
              <Route path="cbt-builder" element={<AdminCbtBuilder />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="feeds" element={<StaffFeedPage />} />
              <Route path="staff-chat" element={<StaffChat />} />
              <Route path="settings" element={<AgentSettings />} />
              <Route path="profile" element={<StaffProfile />} />
              <Route
                path="users"
                element={
                  <ProtectedRoute requiredRole="approver">
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users/:userId"
                element={
                  <ProtectedRoute requiredRole="approver">
                    <AdminUserDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="activity-log"
                element={
                  <ProtectedRoute requiredRole="approver">
                    <AdminActivityLog />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredRole={["user", "courseRep"]}>
                  <UserLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<UserDashboard />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="reading-hub" element={<StudentDocuments />} />
              <Route path="reading-hub/doc/:docId" element={<DocumentReader />} />
              <Route path="reading-hub/:courseCode" element={<StudentCourseReading />} />
              <Route path="practice" element={<StudentPractice />} />
              <Route path="upgrade" element={<StudentUpgrade />} />
              <Route path="timetable" element={<StudentTimetable />} />
              <Route path="notifications" element={<StudentNotifications />} />
              <Route path="notifications/archived" element={<ArchivedNotifications />} />
              <Route path="courses" element={<StudentCourses />} />
              <Route path="department" element={<StudentDepartment />} />
              <Route path="materials" element={<StudentMaterials />} />
              <Route path="documents" element={<StudentDocumentsComingSoon />} />
              <Route path="settings" element={<StudentSettings />} />
              <Route
                path="course-rep"
                element={
                  <ProtectedRoute requiredRole="courseRep">
                    <Suspense fallback={<div className="p-4">Loading…</div>}>
                      <CourseRepPanel />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="reference" element={<StudentReference />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
