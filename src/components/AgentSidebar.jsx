import StaffSidebar from "./staff/StaffSidebar";

/**
 * Agent sidebar. Items are filtered by the permissions an admin gave this agent
 * (see `staff/staffNav.js`). Wrapper kept so the old import path still works; it
 * must be rendered inside <StaffShell variant="agent"> (AgentLayout does that).
 */
export default function AgentSidebar({ onNavigate }) {
  return <StaffSidebar onNavigate={onNavigate} />;
}
