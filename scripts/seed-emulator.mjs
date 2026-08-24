/**
 * Seed the local Firebase emulator suite with throwaway test data.
 *
 *   firebase emulators:start --project demo-uofa-reader --only auth,firestore,storage
 *   node scripts/seed-emulator.mjs
 *
 * Talks to the emulator REST APIs only — no Admin SDK, no service account, and
 * it refuses to run against anything that isn't a "demo-" project on localhost.
 * Every credential in here is fake and local.
 */

const PROJECT = process.env.EMU_PROJECT || "demo-uofa-reader";
const HOST = process.env.EMU_HOST || "127.0.0.1";
const AUTH = `http://${HOST}:9099`;
const FS = `http://${HOST}:8080`;
const DB = `projects/${PROJECT}/databases/(default)/documents`;

if (!PROJECT.startsWith("demo-")) {
  console.error(`Refusing to seed non-demo project "${PROJECT}".`);
  process.exit(1);
}

// Local-only throwaway logins. These exist solely inside the emulator.
export const ACCOUNTS = {
  student: { email: "student@example.test", password: "emulator-only-pw" },
  admin: { email: "admin@example.test", password: "emulator-only-pw" },
};

// ---------- Firestore REST value encoding ----------

function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  switch (typeof v) {
    case "string":
      return { stringValue: v };
    case "boolean":
      return { booleanValue: v };
    case "number":
      return Number.isInteger(v)
        ? { integerValue: String(v) }
        : { doubleValue: v };
    case "object":
      return { mapValue: { fields: fields(v) } };
    default:
      throw new Error(`unsupported value type: ${typeof v}`);
  }
}

const fields = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)]));

async function putDoc(path, data) {
  const res = await fetch(`${FS}/v1/${DB}/${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      // The emulator treats "owner" as a superuser, bypassing firestore.rules.
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({ fields: fields(data) }),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
}

// ---------- Auth emulator ----------

async function createUser({ email, password }) {
  const signUp = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const body = await signUp.json();
  if (!signUp.ok) {
    if (body?.error?.message === "EMAIL_EXISTS") {
      const signIn = await fetch(
        `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
      );
      const existing = await signIn.json();
      if (!signIn.ok) throw new Error(JSON.stringify(existing));
      return existing.localId;
    }
    throw new Error(JSON.stringify(body));
  }

  // Mark verified so the app skips the /verify-email gate.
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts:update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({ localId: body.localId, emailVerified: true }),
  }).catch(() => {});

  return body.localId;
}

// ---------- seed ----------

const now = new Date();

const studentUid = await createUser(ACCOUNTS.student);
const adminUid = await createUser(ACCOUNTS.admin);

await putDoc(`users/${studentUid}`, {
  email: ACCOUNTS.student.email,
  name: "Test Student",
  role: "user",
  status: "active",
  plan: "free",
  subscription: "free",
  faculty: "Science",
  department: "Computer Science",
  level: "300 Level",
  uniqueId: "UAR-26-1001",
  selectedCourseIds: ["csc301", "csc305"],
  emailVerified: true,
  profileComplete: true,
  studyStreakDays: 4,
  materialsOpenedCount: 12,
  createdAt: now,
});

await putDoc(`users/${adminUid}`, {
  email: ACCOUNTS.admin.email,
  name: "Test Admin",
  role: "admin",
  status: "active",
  plan: "annual",
  emailVerified: true,
  profileComplete: true,
  createdAt: now,
});

const courses = [
  { id: "csc301", code: "CSC301", title: "Algorithms", faculty: "Science", department: "Computer Science", level: "300 Level", semester: "First" },
  { id: "csc305", code: "CSC305", title: "Operating Systems", faculty: "Science", department: "Computer Science", level: "300 Level", semester: "First" },
  { id: "mth201", code: "MTH201", title: "Linear Algebra", faculty: "Science", department: "Mathematics", level: "200 Level", semester: "Second" },
];
for (const c of courses) {
  const { id, ...rest } = c;
  await putDoc(`courses/${id}`, { ...rest, createdAt: now });
}

// Enough questions that a regression back to "stream the whole bank" would be
// obvious in the network panel.
const difficulties = ["easy", "medium", "hard"];
for (let i = 0; i < 60; i++) {
  const c = courses[i % courses.length];
  await putDoc(`cbtQuestions/q${i}`, {
    courseId: c.id,
    courseCode: c.code,
    courseTitle: c.title,
    topic: `Topic ${(i % 5) + 1}`,
    faculty: c.faculty,
    department: c.department,
    level: c.level,
    questionText: `Sample question ${i} for ${c.code}?`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctIndex: i % 4,
    explanation: "Seeded explanation.",
    difficulty: difficulties[i % 3],
    createdAt: now,
  });
}

for (let i = 0; i < 12; i++) {
  await putDoc(`staffChat/m${i}`, {
    body: `Seeded staff message ${i}`,
    authorUid: i % 2 === 0 ? adminUid : "someone-else",
    authorName: i % 2 === 0 ? "Test Admin" : "Other Staff",
    authorRole: "admin",
    createdAt: new Date(now.getTime() - (12 - i) * 60_000),
    clientAt: new Date(now.getTime() - (12 - i) * 60_000).toISOString(),
  });
}

for (const c of courses.slice(0, 2)) {
  await putDoc(`enrollments/${studentUid}_${c.id}`, {
    userId: studentUid,
    courseId: c.id,
    courseCode: c.code,
    courseTitle: c.title,
    progressPct: 40,
    questionsDone: 15,
    lastAccessedAt: now,
    createdAt: now,
  });
}

for (let i = 0; i < 3; i++) {
  await putDoc(`notifications/n${i}`, {
    userId: studentUid,
    type: "announcement",
    title: `Seeded notification ${i}`,
    body: "Seeded body",
    readByUser: false,
    readByAdmin: true,
    createdAt: now,
  });
}

await putDoc("announcements/a0", {
  title: "Seeded announcement",
  body: "Visible to everyone.",
  audience: "all",
  published: true,
  priority: "normal",
  createdAt: now,
});

await putDoc("documents/d0", {
  title: "Seeded material",
  faculty: "Science",
  department: "Computer Science",
  level: "300 Level",
  source: "courseRep",
  openCount: 0,
  createdAt: now,
});

console.log("Seeded emulator project:", PROJECT);
console.log("  student:", ACCOUNTS.student.email, "/", ACCOUNTS.student.password, `(${studentUid})`);
console.log("  admin:  ", ACCOUNTS.admin.email, "/", ACCOUNTS.admin.password, `(${adminUid})`);
console.log("  courses: 3, cbtQuestions: 60, staffChat: 12, enrollments: 2");
