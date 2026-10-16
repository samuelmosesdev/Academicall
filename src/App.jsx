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
import AdminAcademics from "./pages/AdminAcademics";
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
import StudentMaterialFolder from "./pages/StudentMaterialFolder";
import StudentMaterialsLibrary from "./pages/StudentMaterialsLibrary";
import StudentGroups from "./pages/StudentGroups";
import StudyGroupJoin, { StudyInviteRedirect } from "./pages/StudyGroupJoin";
import StudentDocumentsComingSoon from "./pages/StudentDocumentsComingSoon";
import StudentVault from "./pages/StudentVault";
import NewsHome from "./pages/NewsHome";
import NewsArticle from "./pages/NewsArticle";
import NewsDesk from "./pages/NewsDesk";
import AdminStaffAccess from "./pages/AdminStaffAccess";
import DocumentCenter from "./pages/DocumentCenter";
import { SecretariatLayout, SecretariatOverview, SecretariatRecords, SecretariatRecord, SecretariatJournal } from "./pages/Secretariat";
import { useAuth } from "./context/AuthContext";
import AspirantDashboard from "./pages/AspirantDashboard";
import AspirantHouse from "./pages/AspirantHouse";
import AspirantChoices from "./pages/AspirantChoices";
import { HouseDeskLayout, HouseDeskHome, HouseDeskHouse } from "./pages/HouseDesk";
import AdminAspirants from "./pages/AdminAspirants";
import AdminHouses from "./pages/AdminHouses";
import AdminBoard from "./pages/AdminBoard";
import NewsFollowing from "./pages/NewsFollowing";

/** Aspirants get their own dashboard; students keep theirs. */
function DashboardHome() {
  const { profile } = useAuth();
  return profile?.role === "aspirant" ? <AspirantDashboard /> : <UserDashboard />;
}
/** Student-only pages send aspirants to their Aspirant House instead. */
function StudentOnly({ children }) {
  const { profile } = useAuth();
  return profile?.role === "aspirant" ? <Navigate to="/dashboard/house" replace /> : children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/news" element={<NewsHome />} />
            <Route
              path="/news/desk"
              element={
                <ProtectedRoute requiredRole="newsDesk">
                  <NewsDesk />
                </ProtectedRoute>
              }
            />
            <Route path="/news/following" element={<NewsFollowing />} />
            <Route path="/news/:slug" element={<NewsArticle />} />
            <Route
              path="/house-desk"
              element={
                <ProtectedRoute requiredRole="houseDesk">
                  <HouseDeskLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HouseDeskHome />} />
              <Route path=":houseId" element={<HouseDeskHouse />} />
              <Route path=":houseId/members" element={<HouseDeskHouse />} />
              <Route path=":houseId/t/:threadId" element={<HouseDeskHouse />} />
            </Route>
            <Route
              path="/secretariat"
              element={
                <ProtectedRoute requiredRole="secretariat">
                  <SecretariatLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SecretariatOverview />} />
              <Route path="records" element={<SecretariatRecords />} />
              <Route path="records/:id" element={<SecretariatRecord />} />
              <Route path="journal" element={<SecretariatJournal />} />
            </Route>
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
            <Route path="/study/:code" element={<StudyInviteRedirect />} />
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
              <Route path="access" element={<AdminStaffAccess />} />
              <Route path="files" element={<DocumentCenter />} />
              <Route path="users/:userId" element={<AdminUserDetail />} />
              <Route path="users/:userId/activity" element={<AdminUserActivity />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="governance" element={<AdminGovernance />} />
              <Route path="governance/academic-catalog" element={<AdminAcademicCatalog />} />
              <Route path="audit-log" element={<AdminAuditLog />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="agents" element={<AdminAgents />} />
              <Route path="agents/:agentId" element={<AdminAgentActivity />} />
              <Route path="documents" element={<StudentOnly><AdminDocuments /></StudentOnly>} />
              <Route path="courses" element={<StudentOnly><AdminCourses /></StudentOnly>} />
              <Route path="academics" element={<AdminAcademics />} />
              <Route path="cbt-builder" element={<AdminCbtBuilder />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="activity-log" element={<AdminActivityLog />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="profile" element={<StaffProfile />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="feeds" element={<StaffFeedPage />} />
              <Route path="staff-chat" element={<StaffChat />} />
              <Route path="aspirants" element={<AdminAspirants />} />
              <Route path="houses" element={<AdminHouses />} />
              <Route path="board" element={<AdminBoard />} />
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
              <Route
                path="documents"
                element={
                  <ProtectedRoute requiredRole="cap:documents.review|documents.manage">
                    <AdminDocuments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="courses"
                element={
                  <ProtectedRoute requiredRole="cap:courses.manage">
                    <AdminCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="academics"
                element={
                  <ProtectedRoute requiredRole="cap:academics.manage">
                    <AdminAcademics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="cbt-builder"
                element={
                  <ProtectedRoute requiredRole="cap:cbt.manage">
                    <AdminCbtBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="requests"
                element={
                  <ProtectedRoute requiredRole="cap:requests.review">
                    <AdminRequests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="announcements"
                element={
                  <ProtectedRoute requiredRole="cap:announcements.publish">
                    <AdminAnnouncements />
                  </ProtectedRoute>
                }
              />
              <Route
                path="files"
                element={
                  <ProtectedRoute requiredRole="cap:files.center">
                    <DocumentCenter />
                  </ProtectedRoute>
                }
              />
              <Route
                path="payments"
                element={
                  <ProtectedRoute requiredRole="cap:payments.review">
                    <AdminPayments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="access"
                element={
                  <ProtectedRoute requiredRole="cap:users.news|users.secretary">
                    <AdminStaffAccess />
                  </ProtectedRoute>
                }
              />
              <Route
                path="aspirants"
                element={
                  <ProtectedRoute requiredRole="cap:aspirants.view|aspirants.manage">
                    <AdminAspirants />
                  </ProtectedRoute>
                }
              />
              <Route
                path="houses"
                element={
                  <ProtectedRoute requiredRole="cap:houses.manage|users.houseLeader">
                    <AdminHouses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="board"
                element={
                  <ProtectedRoute requiredRole="cap:board.manage">
                    <AdminBoard />
                  </ProtectedRoute>
                }
              />
              <Route path="feeds" element={<StaffFeedPage />} />
              <Route path="staff-chat" element={<StaffChat />} />
              <Route path="settings" element={<AgentSettings />} />
              <Route path="profile" element={<StaffProfile />} />
              <Route
                path="users"
                element={
                  <ProtectedRoute requiredRole="cap:users.view">
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users/:userId"
                element={
                  <ProtectedRoute requiredRole="cap:users.view">
                    <AdminUserDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="activity-log"
                element={
                  <ProtectedRoute requiredRole="cap:activity.view">
                    <AdminActivityLog />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredRole={["user", "courseRep", "newsAgent", "aspirant"]}>
                  <UserLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHome />} />
              <Route path="house" element={<AspirantHouse />} />
              <Route path="house/:houseId" element={<AspirantHouse />} />
              <Route path="house/:houseId/t/:threadId" element={<AspirantHouse />} />
              <Route path="choices" element={<ProtectedRoute requiredRole="aspirant"><AspirantChoices /></ProtectedRoute>} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="reading-hub" element={<StudentOnly><StudentDocuments /></StudentOnly>} />
              <Route path="reading-hub/doc/:docId" element={<StudentOnly><DocumentReader /></StudentOnly>} />
              <Route path="reading-hub/:courseCode" element={<StudentOnly><StudentCourseReading /></StudentOnly>} />
              <Route path="practice" element={<StudentPractice />} />
              <Route path="upgrade" element={<StudentUpgrade />} />
              <Route path="timetable" element={<StudentOnly><StudentTimetable /></StudentOnly>} />
              <Route path="notifications" element={<StudentNotifications />} />
              <Route path="notifications/archived" element={<ArchivedNotifications />} />
              <Route path="courses" element={<StudentOnly><StudentCourses /></StudentOnly>} />
              <Route path="department" element={<StudentOnly><StudentDepartment /></StudentOnly>} />
              <Route path="materials" element={<StudentOnly><StudentMaterials /></StudentOnly>} />
              <Route path="materials/folder/:courseCode" element={<StudentOnly><StudentMaterialFolder /></StudentOnly>} />
              <Route path="materials/library" element={<StudentOnly><StudentMaterialsLibrary /></StudentOnly>} />
              <Route path="groups" element={<StudentOnly><StudentGroups /></StudentOnly>} />
              <Route path="groups/join/:code" element={<StudentOnly><StudyGroupJoin /></StudentOnly>} />
              <Route path="groups/:groupId" element={<StudentOnly><StudentGroups /></StudentOnly>} />
              <Route path="documents" element={<StudentOnly><StudentDocumentsComingSoon /></StudentOnly>} />
              <Route path="vault" element={<StudentVault />} />
              <Route path="vault/:folderId" element={<StudentVault />} />
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
              <Route path="reference" element={<StudentOnly><StudentReference /></StudentOnly>} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
