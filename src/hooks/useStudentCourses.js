import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDocs,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

/**
 * Live courses + the signed-in student's enrollments.
 * Enrolling writes to `enrollments` and bumps users/{uid}.coursesEnrolledCount.
 */
export function useStudentCourses() {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const unsubCourses = onSnapshot(
      collection(db, "courses"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
        setCourses(list);
        setLoading(false);
      },
      () => {
        setCourses([]);
        setLoading(false);
      }
    );
    return () => unsubCourses();
  }, []);

  useEffect(() => {
    if (!user) {
      setEnrollments([]);
      return;
    }
    const q = query(collection(db, "enrollments"), where("userId", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEnrollments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => setEnrollments([])
    );
    return () => unsub();
  }, [user?.uid]);

  const enrolledCourseIds = useMemo(() => {
    const set = new Set();
    for (const e of enrollments) {
      if (e.courseId) set.add(e.courseId);
      if (e.courseCode) set.add(e.courseCode);
    }
    return set;
  }, [enrollments]);

  function isEnrolled(course) {
    return enrolledCourseIds.has(course.id) || enrolledCourseIds.has(course.code);
  }

  async function enroll(course) {
    if (!user || !course) return;
    if (isEnrolled(course)) return;
    setBusyId(course.id);
    try {
      await addDoc(collection(db, "enrollments"), {
        userId: user.uid,
        courseId: course.id,
        courseCode: course.code || "",
        courseTitle: course.title || "",
        faculty: course.faculty || "",
        department: course.department || "",
        level: course.level || "",
        semester: course.semester || "",
        thumbnailUrl: course.thumbnailUrl || null,
        progressPct: 0,
        questionsDone: 0,
        enrolledAt: serverTimestamp(),
        lastAccessedAt: serverTimestamp(),
      });
      // Keep profile KPI in sync
      await updateDoc(doc(db, "users", user.uid), {
        coursesEnrolledCount: increment(1),
      }).catch(() => {});
    } finally {
      setBusyId(null);
    }
  }

  async function unenroll(course) {
    if (!user || !course) return;
    setBusyId(course.id);
    try {
      const matches = enrollments.filter(
        (e) => e.courseId === course.id || e.courseCode === course.code
      );
      const batch = writeBatch(db);
      for (const e of matches) {
        batch.delete(doc(db, "enrollments", e.id));
      }
      await batch.commit();
      if (matches.length) {
        await updateDoc(doc(db, "users", user.uid), {
          coursesEnrolledCount: increment(-matches.length),
        }).catch(() => {});
      }
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(course) {
    if (isEnrolled(course)) await unenroll(course);
    else await enroll(course);
  }

  return {
    courses,
    enrollments,
    loading,
    busyId,
    isEnrolled,
    enroll,
    unenroll,
    toggle,
    profile,
  };
}
