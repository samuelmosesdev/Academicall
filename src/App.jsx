import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
const Privacy = lazy(() => import("./pages/Privacy"));
import Login from "./pages/Login";
const LoginRedirect = lazy(() => import("./pages/LoginRedirect"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForceChangePassword = lazy(() => import("./pages/ForceChangePassword"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const AdminLayout = lazy(() => import("./pages/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminUserDetail = lazy(() => import("./pages/AdminUserDetail"));
const AdminDocuments = lazy(() => import("./pages/AdminDocuments"));
const AdminCbtBuilder = lazy(() => import("./pages/AdminCbtBuilder"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const AdminAgents = lazy(() => import("./pages/AdminAgents"));
const AdminAgentActivity = lazy(() => import("./pages/AdminAgentActivity"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const AdminBilling = lazy(() => import("./pages/AdminBilling"));
import { PremiumGate } from "./lib/billing";
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminAnnouncements = lazy(() => import("./pages/AdminAnnouncements"));
const StaffFeedPage = lazy(() => import("./pages/StaffFeedPage"));
const StaffChat = lazy(() => import("./pages/StaffChat"));
const AgentMail = lazy(() => import("./pages/AgentMail"));
const AdminOrganization = lazy(() => import("./pages/AdminOrganization"));
const AdminTasks = lazy(() => import("./pages/AdminTasks"));
const StaffMyWork = lazy(() => import("./pages/StaffMyWork"));
const StaffMyTeam = lazy(() => import("./pages/StaffMyTeam"));
const StaffProfile = lazy(() => import("./pages/StaffProfile"));
const AdminRequests = lazy(() => import("./pages/AdminRequests"));
const AdminActivityLog = lazy(() => import("./pages/AdminActivityLog"));
const AdminUserActivity = lazy(() => import("./pages/AdminUserActivity"));
const AdminActivity = lazy(() => import("./pages/AdminActivity"));
const AdminGovernance = lazy(() => import("./pages/AdminGovernance"));
const AdminAcademics = lazy(() => import("./pages/AdminAcademics"));
const AdminAcademicCatalog = lazy(() => import("./pages/AdminAcademicCatalog"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AgentLayout = lazy(() => import("./pages/AgentLayout"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const AgentSettings = lazy(() => import("./pages/AgentSettings"));
const StudentSettings = lazy(() => import("./pages/StudentSettings"));
const UserLayout = lazy(() => import("./pages/UserLayout"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const StudentDocuments = lazy(() => import("./pages/StudentDocuments"));
const StudentCourseReading = lazy(() => import("./pages/StudentCourseReading"));
const DocumentReader = lazy(() => import("./pages/DocumentReader"));
const StudentPractice = lazy(() => import("./pages/StudentPractice"));
const UtmeCbt = lazy(() => import("./pages/UtmeCbt"));
const UtmeExam = lazy(() => import("./pages/UtmeExam"));
const StudentUpgrade = lazy(() => import("./pages/StudentUpgrade"));
const StudentTimetable = lazy(() => import("./pages/StudentTimetable"));
const StudentNotifications = lazy(() => import("./pages/StudentNotifications"));
const ArchivedNotifications = lazy(() => import("./pages/ArchivedNotifications"));
const StudentCourses = lazy(() => import("./pages/StudentCourses"));
const CourseRepPanel = lazy(() => import("./pages/CourseRepPanel"));
const StudentReference = lazy(() => import("./pages/StudentReference"));
const StudentDepartment = lazy(() => import("./pages/StudentDepartment"));
const StudentMaterials = lazy(() => import("./pages/StudentMaterials"));
const StudentMaterialFolder = lazy(() => import("./pages/StudentMaterialFolder"));
const StudentMaterialsLibrary = lazy(() => import("./pages/StudentMaterialsLibrary"));
const StudentGroups = lazy(() => import("./pages/StudentGroups"));
import StudyGroupJoin, { StudyInviteRedirect } from "./pages/StudyGroupJoin";
const StudentDocumentsComingSoon = lazy(() => import("./pages/StudentDocumentsComingSoon"));
const StudentVault = lazy(() => import("./pages/StudentVault"));
const NewsHome = lazy(() => import("./pages/NewsHome"));
const NewsArticle = lazy(() => import("./pages/NewsArticle"));
const NewsDesk = lazy(() => import("./pages/NewsDesk"));
const AdminStaffAccess = lazy(() => import("./pages/AdminStaffAccess"));
const DocumentCenter = lazy(() => import("./pages/DocumentCenter"));
import { SecretariatLayout, SecretariatOverview, SecretariatRecords, SecretariatRecord, SecretariatJournal } from "./pages/Secretariat";
import { useAuth } from "./context/AuthContext";
import { FeaturesProvider, FeatureRedirect, MaintenanceScreen } from "./lib/features";
import { SafetyHost } from "./components/safety/SafetyActions";

const PREFETCH = {
  guest: [() => import("./pages/NewsHome"), () => import("./pages/NewsArticle"), () => import("./pages/Signup")],
  student: [
    () => import("./pages/StudentCourses"),
    () => import("./pages/NewsHome"),
    () => import("./pages/StudentMaterials"),
    () => import("./pages/StudentNotifications"),
  ],
  staff: [
    () => import("./pages/AdminDocuments"),
    () => import("./pages/StaffMyWork"),
    () => import("./pages/AdminOrganization"),
    () => import("./pages/AdminTasks"),
  ],
};

function RoutePrefetcher() {
  const { profile, loading } = useAuth();
  const role = profile?.role;
  const group = !role
    ? "guest"
    : ["admin", "agent", "alphaAgent", "staff", "supervisor"].includes(role)
      ? "staff"
      : "student";

  useEffect(() => {
    if (loading) return undefined;
    const connection = navigator.connection;
    if (connection?.saveData || /(^|-)slow-2g$|(^|-)2g$|(^|-)3g$/.test(connection?.effectiveType || "")) {
      return undefined;
    }

    let cancelled = false;
    let timer;
    const queue = [...PREFETCH[group]];
    const idle = (callback) => {
      if (window.requestIdleCallback) window.requestIdleCallback(callback, { timeout: 2000 });
      else setTimeout(callback, 400);
    };
    const next = () => {
      if (cancelled || !queue.length) return;
      idle(() => {
        if (cancelled) return;
        Promise.resolve(queue.shift()())
          .catch((error) => console.debug("Route prefetch failed", error))
          .finally(() => {
            timer = setTimeout(next, 700);
          });
      });
    };
    timer = setTimeout(next, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [group, loading]);

  return null;
}
const SecuritySetup = lazy(() => import("./pages/SecuritySetup"));
const AdminModeration = lazy(() => import("./pages/AdminModeration"));
const AdminTests = lazy(() => import("./pages/AdminTests"));
const AdminSecurity = lazy(() => import("./pages/AdminSecurity"));
const AdminData = lazy(() => import("./pages/AdminData"));
const StudentResults = lazy(() => import("./pages/StudentResults"));
const StudentDownloads = lazy(() => import("./pages/StudentDownloads"));
const StudentTests = lazy(() => import("./pages/StudentTests"));
const TestExam = lazy(() => import("./pages/TestExam"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const AdminFeatures = lazy(() => import("./pages/AdminFeatures"));
const AdminUtmeBank = lazy(() => import("./pages/AdminUtmeBank"));
const AspirantDashboard = lazy(() => import("./pages/AspirantDashboard"));
const AspirantHouse = lazy(() => import("./pages/AspirantHouse"));
const AspirantChoices = lazy(() => import("./pages/AspirantChoices"));
import { HouseDeskLayout, HouseDeskHome, HouseDeskHouse } from "./pages/HouseDesk";
const AdminAspirants = lazy(() => import("./pages/AdminAspirants"));
const AdminHouses = lazy(() => import("./pages/AdminHouses"));
const AdminBoard = lazy(() => import("./pages/AdminBoard"));
const NewsFollowing = lazy(() => import("./pages/NewsFollowing"));

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
        <FeaturesProvider>
        <BrowserRouter>
          <RoutePrefetcher />
          <FeatureRedirect />
          <PremiumGate />
          <MaintenanceScreen />
          <SafetyHost />
          <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-text-muted" role="status">Loading…</div>}>
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
            <Route
              path="/security-setup"
              element={
                <ProtectedRoute>
                  <SecuritySetup />
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
              <Route path="billing" element={<AdminBilling />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="activity-log" element={<AdminActivityLog />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="profile" element={<StaffProfile />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="feeds" element={<StaffFeedPage />} />
              <Route path="staff-chat" element={<StaffChat />} />
              <Route path="mail" element={<AgentMail />} />
              <Route path="organization" element={<AdminOrganization />} />
              <Route path="tasks" element={<AdminTasks />} />
              <Route path="aspirants" element={<AdminAspirants />} />
              <Route path="houses" element={<AdminHouses />} />
              <Route path="board" element={<AdminBoard />} />
              <Route path="utme" element={<AdminUtmeBank />} />
              <Route path="features" element={<AdminFeatures />} />
              <Route path="moderation" element={<AdminModeration />} />
              <Route path="tests" element={<AdminTests />} />
              <Route path="security" element={<AdminSecurity />} />
              <Route path="data" element={<AdminData />} />
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
                  <ProtectedRoute requiredRole="cap:academics.manage|courses.manage">
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
              <Route
                path="utme"
                element={
                  <ProtectedRoute requiredRole="cap:utme.manage">
                    <AdminUtmeBank />
                  </ProtectedRoute>
                }
              />
              <Route
                path="moderation"
                element={
                  <ProtectedRoute requiredRole="cap:moderation.manage">
                    <AdminModeration />
                  </ProtectedRoute>
                }
              />
              <Route
                path="tests"
                element={
                  <ProtectedRoute requiredRole="cap:tests.manage">
                    <AdminTests />
                  </ProtectedRoute>
                }
              />
              <Route path="feeds" element={<StaffFeedPage />} />
              <Route path="staff-chat" element={<StaffChat />} />
              <Route path="mail" element={<AgentMail />} />
              <Route path="my-work" element={<StaffMyWork />} />
              <Route path="my-team" element={<StaffMyTeam />} />
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
              path="/test/:id"
              element={
                <ProtectedRoute requiredRole={["user", "courseRep", "newsAgent", "aspirant"]}>
                  <TestExam />
                </ProtectedRoute>
              }
            />

            <Route
              path="/utme/exam"
              element={
                <ProtectedRoute requiredRole={["user", "courseRep", "newsAgent", "aspirant"]}>
                  <UtmeExam />
                </ProtectedRoute>
              }
            />

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
              <Route path="utme" element={<UtmeCbt />} />
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
              <Route path="results" element={<StudentOnly><StudentResults /></StudentOnly>} />
              <Route path="downloads" element={<StudentDownloads />} />
              <Route path="tests" element={<StudentTests />} />
              <Route path="search" element={<SearchPage />} />
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
          </Suspense>
        </BrowserRouter>
        </FeaturesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
