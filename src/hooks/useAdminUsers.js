import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usersApi } from "../lib/api";

/**
 * Loads students, course reps, and agents for the Admin Users page.
 * (Previously only role == "user", so Course Reps disappeared after assignment.)
 */
export function useAdminUsers() {
  const { authMode } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      usersApi.list().then(({ users: list = [] }) => {
        if (!alive) return;
        setUsers(list);
        setLoading(false);
        setError(null);
      }).catch((err) => {
        if (!alive) return;
        setError(err.message || "Failed to load users");
        setLoading(false);
      });
      return () => { alive = false; };
    }

    // Prefer one query for the roles we care about.
    // Firestore "in" supports up to 30 values.
    const q = query(
      collection(db, "users"),
      where("role", "in", ["user", "courseRep", "agent", "alphaAgent"]),
      limit(500)
    );

    // Firestore discards an error callback's return value, so the fallback
    // listener below has to be held somewhere the cleanup can reach it.
    // Previously it leaked a live whole-collection listener on every mount.
    let fallbackUnsub = null;

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        setUsers(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        // Fallback: if "in" query fails (rules/index), load all and filter client-side
        console.warn("useAdminUsers query failed, falling back:", err?.message);
        fallbackUnsub?.();
        fallbackUnsub = onSnapshot(
          query(collection(db, "users"), limit(500)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((u) => {
                const r = u.role || "user";
                return (
                  r === "user" ||
                  r === "courseRep" ||
                  r === "agent" ||
                  r === "alphaAgent"
                );
              });
            list.sort(
              (a, b) =>
                (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
            );
            setUsers(list);
            setLoading(false);
            setError(null);
          },
          (err2) => {
            setError(err2.message || "Failed to load users");
            setLoading(false);
          }
        );
      }
    );

    return () => {
      unsub();
      fallbackUnsub?.();
    };
  }, [authMode]);

  function retry() {
    setLoading(true);
    setError(null);
  }

  return { users, loading, error, retry };
}