import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { orgApi } from "../lib/api";
import { useQuietPoll } from "./useQuietPoll";

/**
 * The signed-in staff member's place in the organisation: office, position, supervisor,
 * team (if they supervise anyone) and their task counts. Refreshes quietly in the
 * background and only updates state when something actually changed.
 */
export function useMyOrg() {
  const { authMode } = useAuth();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const signature = useRef("");

  const load = useCallback(async () => {
    try {
      const data = await orgApi.my();
      const sig = JSON.stringify(data);
      if (sig !== signature.current) {
        signature.current = sig;
        setOrg(data);
      }
    } catch (error) {
      console.error("Failed to load staff organization details", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authMode === "api") load();
    else setLoading(false);
  }, [authMode, load]);
  useQuietPoll(load, { interval: 60_000, enabled: authMode === "api" });

  return { org, loading, reload: load };
}
