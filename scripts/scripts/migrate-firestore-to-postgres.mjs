import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import admin from "firebase-admin";
import { PrismaClient } from "@prisma/client";

const BATCH_SIZE = 250;
const DRY_RUN = process.argv.includes("--dry-run");
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT;
if (!credentialPath) throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT before migrating.");
const resolvedCredentialPath = path.resolve(credentialPath);
if (!fs.existsSync(resolvedCredentialPath)) throw new Error(`Service account not found: ${resolvedCredentialPath}`);

admin.initializeApp({ credential: admin.credential.cert(resolvedCredentialPath) });
const firestore = admin.firestore();
const prisma = new PrismaClient();
const counts = new Map();
const userIds = new Map();
const courseIds = new Map();

function value(data, ...keys) {
  for (const key of keys) if (data[key] !== undefined && data[key] !== null) return data[key];
  return null;
}
function text(input, fallback = null) { return input === undefined || input === null ? fallback : typeof input === "string" ? input : String(input); }
function integer(input, fallback = null) { const n = Number(input); return Number.isFinite(n) ? Math.trunc(n) : fallback; }
function boolean(input, fallback = false) { return input === undefined || input === null ? fallback : Boolean(input); }
function date(input) {
  if (!input) return null;
  if (input instanceof admin.firestore.Timestamp) return input.toDate();
  if (input?._seconds !== undefined) return new Date(input._seconds * 1000);
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function json(input, fallback = null) { if (input === undefined || input === null) return fallback; try { JSON.stringify(input); return input; } catch { return fallback; } }
function enumValue(input, allowed, fallback) { return allowed.includes(input) ? input : fallback; }
function targetId(id) { return text(id) || crypto.randomUUID(); }
function relationUser(data, ...keys) { return userIds.get(text(value(data, ...keys))) || userIds.values().next().value || null; }

async function readCollection(name) {
  const snapshot = await firestore.collection(name).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}
async function write(model, operation, args) { if (!DRY_RUN) await prisma[model][operation](args); }
async function migrateCollection(name, writer) {
  const items = await readCollection(name);
  const state = { found: items.length, written: 0, skipped: 0, errors: 0 };
  counts.set(name, state);
  console.log(`[${name}] found ${items.length}${DRY_RUN ? " (dry-run)" : ""}`);
  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    const batch = items.slice(offset, offset + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((item) => writer(item)));
    results.forEach((result, index) => {
      if (result.status === "fulfilled") result.value === "skipped" ? state.skipped++ : state.written++;
      else { state.errors++; console.error(`[${name}] ${batch[index].id}: ${result.reason?.message || result.reason}`); }
    });
    console.log(`[${name}] processed ${Math.min(offset + BATCH_SIZE, items.length)}/${items.length}`);
  }
}

function mapUser(id, data) {
  return {
    id: targetId(id), firebaseUid: id, email: text(data.email, `${id}@firestore.invalid`), name: text(data.name, text(data.email, "Unknown user").split("@")[0]),
    role: enumValue(data.role, ["admin", "alphaAgent", "agent", "courseRep", "user"], "user"), plan: enumValue(data.plan, ["free", "pro", "annual"], "free"), status: enumValue(data.status, ["active", "suspended", "deleted"], "active"),
    uniqueId: text(data.uniqueId), emailVerified: boolean(data.emailVerified), profileComplete: boolean(data.profileComplete), department: text(data.department), faculty: text(data.faculty), level: text(data.level), matricNumber: text(data.matricNumber), phone: text(data.phone), bio: text(data.bio), interests: text(data.interests), dob: text(data.dob), gender: text(data.gender), nickname: text(value(data, "nickname", "nickName")),
    showDepartment: boolean(data.showDepartment, true), showPhone: boolean(data.showPhone), allowAnonymousComments: boolean(data.allowAnonymousComments), photoUrl: text(value(data, "photoUrl", "photoURL")), avatarUrl: text(data.avatarUrl), settings: json(data.settings), fcmToken: text(data.fcmToken), deviceToken: text(data.deviceToken), fcmTokens: json(data.fcmTokens),
    coursesEnrolledCount: integer(data.coursesEnrolledCount, 0), questionsPracticedCount: integer(data.questionsPracticedCount, 0), studyStreakDays: integer(data.studyStreakDays, 0), materialsOpenedCount: integer(data.materialsOpenedCount, 0), lastActiveDate: text(data.lastActiveDate), lastActiveAt: date(data.lastActiveAt), courseRepMeta: json(data.courseRepMeta), assignedBy: text(data.assignedBy), assignedAt: date(data.assignedAt), agentDomain: text(data.agentDomain), createdByAdmin: boolean(data.createdByAdmin), createdByUid: text(data.createdByUid), canImportAI: boolean(data.canImportAI, true), autoPublish: boolean(data.autoPublish), customCourses: json(data.customCourses), passwordHash: text(data.passwordHash), passwordChangedAt: date(data.passwordChangedAt), mustChangePassword: boolean(data.mustChangePassword), createdAt: date(data.createdAt) || undefined,
  };
}
async function migrateUsers() {
  await migrateCollection("users", async ({ id, data }) => {
    const payload = mapUser(id, data);
    const existing = !DRY_RUN && data.email ? await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }) : null;
    payload.id = existing?.id || payload.id; userIds.set(id, payload.id);
    await write("user", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined, firebaseUid: id } });
  });
}
async function migrateCourses() {
  await migrateCollection("courses", async ({ id, data }) => {
    const payload = { id: targetId(id), title: text(data.title, "Untitled course"), code: text(data.code), faculty: text(data.faculty), department: text(data.department), level: text(data.level), semester: text(data.semester), description: text(data.description), thumbnailUrl: text(data.thumbnailUrl), category: text(data.category), source: text(data.source), published: boolean(data.published, true), approvedBy: text(data.approvedBy), requestedBy: text(data.requestedBy), createdAt: date(data.createdAt) || undefined };
    courseIds.set(id, payload.id); await write("course", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } });
  });
}
async function migrateDocuments() {
  await migrateCollection("documents", async ({ id, data }) => {
    const uploadedById = relationUser(data, "uploadedById", "uploadedBy", "createdBy"); if (!uploadedById || !data.title) return "skipped";
    const payload = { id: targetId(id), title: text(data.title, "Untitled document"), description: text(data.description), fileUrl: text(data.fileUrl), thumbnailUrl: text(data.thumbnailUrl), fileName: text(data.fileName), fileSize: integer(data.fileSize), tags: json(data.tags), faculty: text(data.faculty), department: text(data.department), level: text(data.level), source: text(data.source), uploadedById, courseId: courseIds.get(text(data.courseId)) || null, openCount: integer(data.openCount, 0), questionCount: integer(data.questionCount, 0), easyQuestionCount: integer(data.easyQuestionCount, 0), mediumQuestionCount: integer(data.mediumQuestionCount, 0), hardQuestionCount: integer(data.hardQuestionCount, 0), reactions: json(data.reactions), createdAt: date(data.createdAt) || undefined };
    await write("document", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } });
  });
}
async function migrateNotifications() {
  await migrateCollection("notifications", async ({ id, data }) => {
    const userId = relationUser(data, "userId", "uid", "recipientId"); if (!userId || !data.title) return "skipped";
    const payload = { id: targetId(id), userId, createdById: relationUser(data, "createdById", "senderId"), type: enumValue(data.type, ["general", "payment_claim", "class_event", "announcement", "system"], "general"), title: text(data.title, "Notification"), body: text(data.body, text(data.message)), data: json(data.data), readByUser: boolean(value(data, "readByUser", "read")), readAt: date(data.readAt), archived: boolean(data.archived), archivedAt: date(data.archivedAt), deleted: boolean(data.deleted), deletedAt: date(data.deletedAt), createdAt: date(data.createdAt) || undefined };
    await write("notification", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } });
  });
}
async function migrateActivity() { await migrateCollection("activityLog", async ({ id, data }) => write("activityLog", "upsert", { where: { id: targetId(id) }, create: { id: targetId(id), userId: relationUser(data, "userId", "actorUid", "uid"), userName: text(data.userName, text(data.actorName)), action: text(data.action, "unknown"), status: text(data.status), reference: text(data.reference), meta: json(data.meta, json(data)), createdAt: date(data.createdAt) || undefined }, update: { action: text(data.action, "unknown"), status: text(data.status), meta: json(data.meta, json(data)) } })); }
async function migrateClaims() { await migrateCollection("paymentClaims", async ({ id, data }) => { const userId = relationUser(data, "userId", "uid"); if (!userId) return "skipped"; const payload = { id: targetId(id), userId, status: text(data.status, "pending"), plan: text(data.plan), reference: text(data.reference), amount: integer(data.amount), meta: json(data.meta, json(data)), createdAt: date(data.createdAt) || undefined }; await write("paymentClaim", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migratePayments() { await migrateCollection("payments", async ({ id, data }) => { const payload = { id: targetId(id), userId: relationUser(data, "userId", "uid"), reference: text(data.reference, text(data.trxref)), status: text(data.status), plan: text(data.plan), amount: integer(data.amount), currency: text(data.currency), meta: json(data.meta, json(data)), createdAt: date(data.createdAt) || undefined }; if (payload.reference) await write("payment", "upsert", { where: { reference: payload.reference }, create: payload, update: { ...payload, id: undefined } }); else await write("payment", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migrateOrphans() { await migrateCollection("paymentOrphans", async ({ id, data }) => write("paymentOrphan", "upsert", { where: { id: targetId(id) }, create: { id: targetId(id), reference: text(data.reference), reason: text(data.reason), data: json(data, {}), createdAt: date(data.createdAt) || undefined }, update: { reference: text(data.reference), reason: text(data.reason), data: json(data, {}) } })); }
async function migrateTimetable() { await migrateCollection("timetableEvents", async ({ id, data }) => { const userId = relationUser(data, "userId", "uid"); if (!userId || !data.title) return "skipped"; const payload = { id: targetId(id), userId, title: text(data.title, "Untitled event"), description: text(data.description), startAt: date(data.startAt), endAt: date(data.endAt), location: text(data.location), courseId: courseIds.get(text(data.courseId)) || null, courseCode: text(data.courseCode), dayOfWeek: integer(data.dayOfWeek), startTime: text(data.startTime), endTime: text(data.endTime), reminderMinutes: integer(data.reminderMinutes), reminderEnabled: boolean(data.reminderEnabled, true), notes: text(data.notes), createdAt: date(data.createdAt) || undefined }; await write("timetableEvent", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migrateClassEvents() { await migrateCollection("classEvents", async ({ id, data }) => { const createdBy = relationUser(data, "createdBy", "createdByUid"); const startsAt = date(value(data, "startsAt", "startAt")); if (!createdBy || !data.title || !startsAt) return "skipped"; const payload = { id: targetId(id), title: text(data.title, "Class event"), courseCode: text(data.courseCode), venue: text(value(data, "venue", "location")), notes: text(data.notes), startsAt, endsAt: date(value(data, "endsAt", "endAt")), faculty: text(data.faculty), department: text(data.department), level: text(data.level), createdBy, createdByName: text(data.createdByName), createdAt: date(data.createdAt) || undefined }; await write("classEvent", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migrateMaterialSaves() { await migrateCollection("materialSaves", async ({ id, data }) => { const userId = relationUser(data, "userId", "uid"); if (!userId) return "skipped"; const payload = { id: targetId(id), userId, materialId: text(value(data, "materialId", "documentId")), title: text(data.title), url: text(data.url), meta: json(data.meta, json(data)), createdAt: date(data.createdAt) || undefined }; await write("materialSave", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migrateFeed(name) { await migrateCollection(name, async ({ id, data }) => { const authorId = relationUser(data, "authorId", "authorUid", "userId", "createdBy"); if (!authorId) return "skipped"; const payload = { id: targetId(id), kind: name === "coursePosts" ? "course" : "general", title: text(data.title), body: text(data.body, text(data.text)), courseCode: text(data.courseCode), faculty: text(data.faculty), department: text(data.department), level: text(data.level), pinned: boolean(data.pinned), authorId, authorName: text(data.authorName), authorRole: text(data.authorRole), authorPhoto: text(data.authorPhoto), comments: json(data.comments), reactions: json(data.reactions), createdAt: date(data.createdAt) || undefined }; await write("feedPost", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migrateRequests(name, fallback) { await migrateCollection(name, async ({ id, data }) => { const requesterUid = relationUser(data, "requesterUid", "userId", "uid"); if (!requesterUid) return "skipped"; const payload = { id: targetId(id), requesterUid, type: text(data.type, fallback), title: text(data.title), body: text(data.body), requesterName: text(data.requesterName), requesterEmail: text(data.requesterEmail), requesterRole: text(data.requesterRole), field: text(data.field), fieldLabel: text(data.fieldLabel), requestedValue: text(value(data, "requestedValue", "value")), reason: text(data.reason), reviewedAt: date(data.reviewedAt), reviewedBy: text(data.reviewedBy), reviewedByName: text(data.reviewedByName), reviewNote: text(data.reviewNote), status: text(data.status, "pending"), meta: json(data.meta, json(data)), createdAt: date(data.createdAt) || undefined }; await write("request", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migrateAnnouncements() { await migrateCollection("announcements", async ({ id, data }) => { const payload = { id: targetId(id), title: text(data.title, "Announcement"), body: text(data.body), createdBy: text(data.createdBy), published: boolean(data.published, true), audience: text(data.audience, "all"), faculty: text(data.faculty), department: text(data.department), level: text(data.level), courseCode: text(data.courseCode), pinned: boolean(data.pinned), createdAt: date(data.createdAt) || undefined }; await write("announcement", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migrateAnnouncementReads() { await migrateCollection("announcementReads", async ({ id, data }) => write("announcementRead", "upsert", { where: { id: targetId(id) }, create: { id: targetId(id), announcementId: text(value(data, "announcementId", "announcementID")), userId: relationUser(data, "userId", "uid"), readAt: date(data.readAt) || date(data.createdAt), meta: json(data, {}), createdAt: date(data.createdAt) || undefined }, update: { announcementId: text(value(data, "announcementId", "announcementID")), userId: relationUser(data, "userId", "uid"), readAt: date(data.readAt) || date(data.createdAt), meta: json(data, {}) } })); }
async function migrateSettings() { for (const name of ["settings", "appSettings"]) await migrateCollection(name, async ({ id, data }) => { const key = name === "settings" ? id : id === "payments" ? "payments" : `appSettings:${id}`; await write("setting", "upsert", { where: { key }, create: { id: targetId(`${name}:${id}`), key, value: json(data, {}) }, update: { value: json(data, {}) } }); }); }
async function migrateQuestions() { for (const name of ["questions", "cbtQuestions"]) await migrateCollection(name, async ({ id, data }) => { if (!data.questionText && !data.question) return "skipped"; const payload = { id: targetId(id), courseId: courseIds.get(text(data.courseId)) || null, documentId: text(data.documentId), courseCode: text(data.courseCode), courseTitle: text(data.courseTitle), topic: text(data.topic), faculty: text(data.faculty), department: text(data.department), level: text(data.level), questionText: text(data.questionText, text(data.question, "")), options: json(data.options, []), correctIndex: integer(value(data, "correctIndex", "answerIndex"), 0), explanation: text(data.explanation), difficulty: text(data.difficulty, "medium"), source: text(data.source), createdAt: date(data.createdAt) || undefined }; await write("cbtQuestion", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migrateChat() { await migrateCollection("staffChat", async ({ id, data }) => { const authorId = relationUser(data, "authorId", "authorUid", "uid"); if (!authorId) return "skipped"; const payload = { id: targetId(id), authorId, authorUid: text(data.authorUid), authorName: text(data.authorName), authorRole: text(data.authorRole), authorPhoto: text(data.authorPhoto), authorPlan: text(data.authorPlan), authorSubscription: text(data.authorSubscription), type: text(data.type, "text"), text: text(data.text), mediaUrl: text(data.mediaUrl), mediaWidth: integer(data.mediaWidth), mediaHeight: integer(data.mediaHeight), mediaDuration: integer(data.mediaDuration), reactions: json(data.reactions), replyToId: text(data.replyToId), replyTo: json(data.replyTo), clientAt: text(data.clientAt), meeting: json(data.meeting), edited: boolean(data.edited), deletedAt: date(data.deletedAt), deletedBy: text(data.deletedBy), deletedByName: text(data.deletedByName), deletedByRole: text(data.deletedByRole), editedAt: date(data.editedAt), deleted: boolean(data.deleted), createdAt: date(data.createdAt) || undefined }; await write("staffChatMessage", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migrateSubscriptions() { await migrateCollection("subscriptions", async ({ id, data }) => { const payload = { id: targetId(id), userId: relationUser(data, "userId", "uid"), status: text(data.status), plan: text(data.plan), provider: text(data.provider), reference: text(data.reference), startsAt: date(value(data, "startsAt", "startAt")), endsAt: date(value(data, "endsAt", "endAt")), meta: json(data.meta, json(data)), createdAt: date(data.createdAt) || undefined }; await write("subscription", "upsert", { where: { id: payload.id }, create: payload, update: { ...payload, id: undefined } }); }); }
async function migrateAgents() { await migrateCollection("agents", async ({ id, data }) => write("agent", "upsert", { where: { id: targetId(id) }, create: { id: targetId(id), userId: relationUser(data, "userId", "uid"), name: text(data.name), email: text(data.email), status: text(data.status), domain: text(data.domain), meta: json(data, {}), createdAt: date(data.createdAt) || undefined }, update: { userId: relationUser(data, "userId", "uid"), name: text(data.name), email: text(data.email), status: text(data.status), domain: text(data.domain), meta: json(data, {}) } })); }

async function migrate() {
  console.log(`Firestore -> Prisma migration${DRY_RUN ? " (dry-run)" : ""}; batch size ${BATCH_SIZE}`);
  await migrateUsers(); await migrateCourses(); await migrateDocuments(); await migrateNotifications(); await migrateActivity(); await migrateClaims(); await migratePayments(); await migrateOrphans(); await migrateTimetable(); await migrateClassEvents(); await migrateMaterialSaves(); await migrateFeed("coursePosts"); await migrateFeed("generalPosts"); await migrateRequests("requests", "request"); await migrateRequests("profileChangeRequests", "profile_change"); await migrateAnnouncements(); await migrateAnnouncementReads(); await migrateSettings(); await migrateQuestions(); await migrateChat(); await migrateSubscriptions(); await migrateAgents();
  console.log("\nMigration summary:"); for (const [name, state] of counts) console.log(`${name}: found=${state.found} written=${state.written} skipped=${state.skipped} errors=${state.errors}`);
}
try { await migrate(); } finally { await prisma.$disconnect(); await admin.app().delete(); }
