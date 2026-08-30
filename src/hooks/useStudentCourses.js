import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { coursesApi, enrollmentsApi } from "../lib/api";

export function useStudentCourses() {
  const { user, profile, authMode } = useAuth();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (authMode !== "api" || !user) {
      setCourses([]);
      setEnrollments([]);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    Promise.all([coursesApi.list(), enrollmentsApi.list()])
      .then(([courseData, enrollmentData]) => {
        if (!alive) return;
        setCourses(courseData.courses || []);
        setEnrollments((enrollmentData.enrollments || []).map((item) => ({
          ...item,
          courseId: item.courseId || item.course?.id,
          courseCode: item.course?.code || item.courseCode,
          courseTitle: item.course?.title || item.courseTitle,
        })));
      })
      .catch(() => alive && setCourses([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [authMode, user]);

  const enrolledCourseIds = useMemo(() => {
    const ids = new Set();
    enrollments.forEach((enrollment) => {
      if (enrollment.courseId) ids.add(enrollment.courseId);
      if (enrollment.courseCode) ids.add(enrollment.courseCode);
    });
    return ids;
  }, [enrollments]);

  function isEnrolled(course) {
    return enrolledCourseIds.has(course.id) || enrolledCourseIds.has(course.code);
  }

  async function enroll(course) {
    if (!user || !course || authMode !== "api" || isEnrolled(course)) return;
    setBusyId(course.id);
    try {
      const { enrollment } = await enrollmentsApi.create({ courseId: course.id });
      setEnrollments((current) => [...current, enrollment]);
    } finally {
      setBusyId(null);
    }
  }

  async function unenroll(course) {
    if (!user || !course || authMode !== "api") return;
    setBusyId(course.id);
    try {
      const matches = enrollments.filter((item) => item.courseId === course.id || item.courseCode === course.code);
      await Promise.all(matches.map((item) => enrollmentsApi.remove(item.id)));
      setEnrollments((current) => current.filter((item) => !matches.some((match) => match.id === item.id)));
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(course) {
    if (isEnrolled(course)) await unenroll(course);
    else await enroll(course);
  }

  return { courses, enrollments, loading, busyId, isEnrolled, enroll, unenroll, toggle, profile };
}
