import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { coursesApi } from "../lib/api";
import { questionsApi } from "../lib/api";

/**
 * Live CBT data.
 *
 * Firestore collections:
 *  - courses          { title, code, faculty, department, level, semester, description, thumbnailUrl, createdAt }
 *  - cbtQuestions     {
 *                       courseCode, courseTitle, topic, faculty, department, level,
 *                       questionText, options: string[4], correctIndex: 0-3,
 *                       explanation?, difficulty: "easy"|"medium"|"hard", createdAt
 *                     }
 *
 * COST NOTES — this hook is imported by nine pages, so its defaults matter:
 *
 *  1. `courses` uses ONE shared listener, ref-counted across every mount, with a
 *     short grace period before teardown. Nine components on a page used to mean
 *     nine independent listeners, and every route change re-billed the whole
 *     collection.
 *  2. `cbtQuestions` is opt-in (`{ withQuestions: true }`) and is fetched once
 *     per session with getDocs, not streamed. It used to be an unbounded live
 *     listener that every page paid for — including the five that only ever read
 *     `courses`. On a 2,000-question bank that was 2,000 reads per page view.
 *
 * Pass `withQuestions: true` only if you read `questions` or `practiceSets`.
 */

const COURSES_LIMIT = 500;
const QUESTIONS_LIMIT = 5000;
let apiCoursesState = { data: [], loading: true };
const apiCoursesSubscribers = new Set();

async function loadApiCourses() {
  const { courses: apiCourses = [] } = await coursesApi.list();
  const list = [...apiCourses].sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
  apiCoursesState = { data: list, loading: false };
  apiCoursesSubscribers.forEach((subscriber) => subscriber(apiCoursesState));
  return list;
}

export function refreshCbtCourses() {
  return loadApiCourses();
}
// Keep the shared listener warm briefly so navigating between two pages that
// both use it doesn't tear down and re-attach (which re-bills every document).
const TEARDOWN_GRACE_MS = 30_000;

// ---------- shared `courses` listener ----------

let coursesState = { data: [], loading: true };
const coursesSubscribers = new Set();
let coursesUnsub = null;
let coursesTeardownTimer = null;

function emitCourses(next) {
  coursesState = next;
  coursesSubscribers.forEach((fn) => fn(coursesState));
}

function acquireCourses(onChange) {
  coursesSubscribers.add(onChange);
  if (coursesTeardownTimer) {
    clearTimeout(coursesTeardownTimer);
    coursesTeardownTimer = null;
  }
  if (!coursesUnsub) {
    coursesUnsub = onSnapshot(
      query(collection(db, "courses"), limit(COURSES_LIMIT)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
        emitCourses({ data: list, loading: false });
      },
      () => emitCourses({ data: [], loading: false })
    );
  }
  onChange(coursesState);

  return () => {
    coursesSubscribers.delete(onChange);
    if (coursesSubscribers.size > 0) return;
    coursesTeardownTimer = setTimeout(() => {
      coursesUnsub?.();
      coursesUnsub = null;
      coursesTeardownTimer = null;
    }, TEARDOWN_GRACE_MS);
  };
}

// ---------- session-cached `cbtQuestions` ----------

let questionsCache = null;
let questionsInflight = null;
const questionsSubscribers = new Set();

function loadQuestions() {
  if (questionsCache) return Promise.resolve(questionsCache);
  if (questionsInflight) return questionsInflight;

  questionsInflight = getDocs(
    query(collection(db, "cbtQuestions"), limit(QUESTIONS_LIMIT))
  )
    .then((snap) => {
      questionsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      questionsSubscribers.forEach((fn) => fn(questionsCache));
      return questionsCache;
    })
    .catch(() => [])
    .finally(() => {
      questionsInflight = null;
    });

  return questionsInflight;
}

/**
 * Re-read the question bank and push it to every mounted consumer.
 *
 * The bank is cached per session rather than streamed, so anything that writes
 * to `cbtQuestions` must call this afterwards or the UI will show stale data.
 * Callers: AdminCbtBuilder, ImportQuestionsModal, AiGenerateQuestionsModal,
 * AiGenerateFromDocumentModal.
 */
export function refreshCbtQuestions(authMode) {
  const mode = authMode || (localStorage.getItem("academicall_token") ? "api" : "firebase");
  if (mode === "api") {
    return questionsApi.list().then(({ questions: list = [] }) => {
      questionsCache = list;
      questionsSubscribers.forEach((fn) => fn(list));
      return list;
    });
  }
  questionsCache = null;
  return loadQuestions();
}

export function useCbtData({ withQuestions = false } = {}) {
  const { authMode } = useAuth();
  const [courses, setCourses] = useState(coursesState.data);
  const [coursesLoading, setCoursesLoading] = useState(coursesState.loading);
  const [questions, setQuestions] = useState(questionsCache || []);
  const [questionsLoading, setQuestionsLoading] = useState(withQuestions && !questionsCache);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      const onCourses = (state) => {
        if (!alive) return;
        setCourses(state.data);
        setCoursesLoading(state.loading);
      };
      apiCoursesSubscribers.add(onCourses);
      onCourses(apiCoursesState);
      loadApiCourses().catch(() => alive && onCourses({ data: [], loading: false }));
      return () => { alive = false; apiCoursesSubscribers.delete(onCourses); };
    }

    setCourses([]);
    setCoursesLoading(false);
    return undefined;
  }, [authMode]);

  useEffect(() => {
    if (!withQuestions || authMode !== "api") return;
    let alive = true;
    setQuestionsLoading(true);
    questionsApi.list().then(({ questions: list = [] }) => {
      if (!alive) return;
      setQuestions(list);
      questionsCache = list;
      setQuestionsLoading(false);
    }).catch(() => alive && setQuestionsLoading(false));
    return () => { alive = false; };
  }, [authMode, withQuestions]);

  useEffect(() => {
    if (!withQuestions || authMode === "api") return;
    let alive = true;
    const onChange = (list) => {
      if (alive) setQuestions(list);
    };
    questionsSubscribers.add(onChange);

    setQuestionsLoading(!questionsCache);
    loadQuestions().then((list) => {
      if (!alive) return;
      setQuestions(list);
      setQuestionsLoading(false);
    });

    return () => {
      alive = false;
      questionsSubscribers.delete(onChange);
    };
  }, [withQuestions, authMode]);

  /** Unique course codes that actually have questions */
  const practiceSets = useMemo(() => {
    const map = new Map();

    for (const q of questions) {
      const key = q.courseCode || "GENERAL";
      if (!map.has(key)) {
        map.set(key, {
          courseCode: key,
          courseTitle: q.courseTitle || key,
          faculty: q.faculty || "",
          department: q.department || "",
          level: q.level || "",
          topics: new Set(),
          questionCount: 0,
          difficulties: { easy: 0, medium: 0, hard: 0 },
        });
      }
      const entry = map.get(key);
      entry.questionCount += 1;
      if (q.topic) entry.topics.add(q.topic);
      if (q.difficulty && entry.difficulties[q.difficulty] !== undefined) {
        entry.difficulties[q.difficulty] += 1;
      }
    }

    // Enrich with course metadata when available
    for (const c of courses) {
      if (map.has(c.code)) {
        const entry = map.get(c.code);
        entry.courseTitle = c.title || entry.courseTitle;
        entry.faculty = c.faculty || entry.faculty;
        entry.department = c.department || entry.department;
        entry.level = c.level || entry.level;
        entry.semester = c.semester;
        entry.thumbnailUrl = c.thumbnailUrl;
      }
    }

    return Array.from(map.values())
      .map((e) => ({
        ...e,
        topics: Array.from(e.topics).sort(),
      }))
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  }, [courses, questions]);

  return {
    courses,
    questions,
    practiceSets,
    loading: coursesLoading || (withQuestions && questionsLoading),
  };
}
