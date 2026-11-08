import StaffSidebar from "./staff/StaffSidebar";

/**
 * Admin sidebar. The navigation model now lives in `staff/staffNav.js` and is
 * rendered by the shared StaffSidebar; this wrapper keeps the old import path working.
 * It must be rendered inside <StaffShell variant="admin"> (AdminLayout does that).
 */
export default function Sidebar({ onNavigate }) {
  return <StaffSidebar onNavigate={onNavigate} />;
}
