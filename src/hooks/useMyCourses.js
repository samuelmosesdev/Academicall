import { useCallback, useEffect, useState } from "react";
import { myCoursesApi } from "../lib/api";

/**
 * The signed-in student's course list (server-side Enrollment rows).
 * Re-loads when another page fires window "courses:changed".
 * Each item: { id, courseId, code, title, units, level, semester, source }.
 */
export function useMyCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    myCoursesApi.list()
      .then((r) => setCourses(r.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
    window.addEventListener("courses:changed", load);
    return () => window.removeEventListener("courses:changed", load);
  }, [load]);
  return { courses, loading, reload: load };
}
