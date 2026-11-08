import { createContext, useContext } from "react";

/**
 * What the staff shell shares with its sidebar and top bar: which workspace this is,
 * which sections the person may see, and the live unread counters (fetched once here
 * instead of once per component).
 */
const StaffShellContext = createContext({
  variant: "admin",
  sections: [],
  badges: { staffChat: 0, inbox: 0, myTasks: 0 },
  org: null,
});

export const StaffShellProvider = StaffShellContext.Provider;

// eslint-disable-next-line react-refresh/only-export-components
export function useStaffShell() {
  return useContext(StaffShellContext);
}
