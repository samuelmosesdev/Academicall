import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const questionSchema = z.object({
  courseId: z.string().optional().nullable(), documentId: z.string().optional().nullable(), source: z.string().optional().nullable(), courseCode: z.string().optional().nullable(),
  courseTitle: z.string().optional().nullable(), topic: z.string().optional().nullable(),
  faculty: z.string().optional().nullable(), department: z.string().optional().nullable(),
  level: z.string().optional().nullable(), questionText: z.string().min(1),
  options: z.array(z.string()).length(4), correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().optional().nullable(), difficulty: z.string().optional(),
});

export async function listQuestions(_req: Request, res: Response) {
  const questions = await prisma.cbtQuestion.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
  res.json({ questions });
}
export async function createQuestion(req: Request, res: Response) {
  try { const question = await prisma.cbtQuestion.create({ data: questionSchema.parse(req.body) }); res.status(201).json({ question }); }
  catch (err) { if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors }); res.status(500).json({ error: "Create failed" }); }
}
export async function updateQuestion(req: Request, res: Response) {
  try { const question = await prisma.cbtQuestion.update({ where: { id: String(req.params.id) }, data: questionSchema.partial().parse(req.body) }); res.json({ question }); }
  catch (err) { if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors }); res.status(500).json({ error: "Update failed" }); }
}
export async function deleteQuestion(req: Request, res: Response) { await prisma.cbtQuestion.delete({ where: { id: String(req.params.id) } }); res.status(204).send(); }

const eventSchema = z.object({ title: z.string().min(1), description: z.string().optional().nullable(), startAt: z.coerce.date().optional().nullable(), endAt: z.coerce.date().optional().nullable(), location: z.string().optional().nullable(), courseId: z.string().optional().nullable(), courseCode: z.string().optional().nullable(), dayOfWeek: z.number().int().min(0).max(6).optional(), startTime: z.string().optional(), endTime: z.string().optional(), reminderMinutes: z.number().int().min(0).optional(), reminderEnabled: z.boolean().optional(), notes: z.string().optional().nullable() });
export async function listEvents(req: Request, res: Response) { if (!req.user) return res.status(401).json({ error: "Unauthenticated" }); const events = await prisma.timetableEvent.findMany({ where: { userId: req.user.id }, orderBy: { startAt: "asc" } }); res.json({ events }); }
export async function createEvent(req: Request, res: Response) { if (!req.user) return res.status(401).json({ error: "Unauthenticated" }); try { const event = await prisma.timetableEvent.create({ data: { ...eventSchema.parse(req.body), userId: req.user.id } }); res.status(201).json({ event }); } catch (err) { if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors }); res.status(500).json({ error: "Create failed" }); } }
export async function updateEvent(req: Request, res: Response) { if (!req.user) return res.status(401).json({ error: "Unauthenticated" }); const event = await prisma.timetableEvent.updateMany({ where: { id: String(req.params.id), userId: req.user.id }, data: eventSchema.partial().parse(req.body) }); if (!event.count) return res.status(404).json({ error: "Event not found" }); res.json({ ok: true }); }
export async function deleteEvent(req: Request, res: Response) { if (!req.user) return res.status(401).json({ error: "Unauthenticated" }); await prisma.timetableEvent.deleteMany({ where: { id: String(req.params.id), userId: req.user.id } }); res.status(204).send(); }

const classEventSchema = z.object({ title: z.string().min(1), courseCode: z.string().optional().nullable(), venue: z.string().optional().nullable(), notes: z.string().optional().nullable(), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional().nullable(), faculty: z.string().optional().nullable(), department: z.string().min(1), level: z.string().optional().nullable() });
export async function listClassEvents(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { department: true, faculty: true, level: true, courseRepMeta: true } });
  const meta = user?.courseRepMeta as { department?: string; level?: string; faculty?: string } | null;
  const department = user?.department || meta?.department;
  const level = user?.level || meta?.level;
  const events = await prisma.classEvent.findMany({ where: { ...(department ? { department } : {}), ...(level ? { OR: [{ level }, { level: null }] } : {}) }, orderBy: { startsAt: "asc" }, take: 200 });
  res.json({ events });
}
export async function createClassEvent(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  try { const body = classEventSchema.parse(req.body); const event = await prisma.classEvent.create({ data: { ...body, createdBy: req.user.id, createdByName: req.body.createdByName || req.user.email } }); res.status(201).json({ event }); }
  catch (err) { if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors }); res.status(500).json({ error: "Create failed" }); }
}
export async function deleteClassEvent(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const canDeleteAny = ["admin", "alphaAgent", "agent"].includes(req.user.role);
  const result = await prisma.classEvent.deleteMany({ where: { id: String(req.params.id), ...(canDeleteAny ? {} : { createdBy: req.user.id }) } });
  if (!result.count) return res.status(404).json({ error: "Class event not found" });
  res.status(204).send();
}

const claimSchema = z.object({ plan: z.string().optional(), reference: z.string().optional(), amount: z.number().int().optional(), meta: z.any().optional() });
export async function listClaims(req: Request, res: Response) { if (!req.user) return res.status(401).json({ error: "Unauthenticated" }); const claims = await prisma.paymentClaim.findMany({ where: req.user.role === "user" ? { userId: req.user.id } : undefined, include: { user: { select: { id: true, name: true, email: true, uniqueId: true, plan: true } } }, orderBy: { createdAt: "desc" }, take: 100 }); res.json({ claims }); }
export async function createClaim(req: Request, res: Response) { if (!req.user) return res.status(401).json({ error: "Unauthenticated" }); try { const claim = await prisma.paymentClaim.create({ data: { ...claimSchema.parse(req.body), userId: req.user.id, status: "awaiting_review" } }); res.status(201).json({ claim }); } catch (err) { if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors }); res.status(500).json({ error: "Claim failed" }); } }
export async function approveClaim(req: Request, res: Response) { const claim = await prisma.paymentClaim.update({ where: { id: String(req.params.id) }, data: { status: "activated" } }); await prisma.user.update({ where: { id: claim.userId }, data: { plan: "pro" } }); res.json({ claim }); }

export async function getSetting(req: Request, res: Response) { const setting = await prisma.setting.findUnique({ where: { key: String(req.params.key) } }); res.json({ value: setting?.value ?? null }); }
export async function updateSetting(req: Request, res: Response) { const setting = await prisma.setting.upsert({ where: { key: String(req.params.key) }, create: { key: String(req.params.key), value: req.body }, update: { value: req.body } }); res.json({ value: setting.value }); }

export async function listChat(req: Request, res: Response) { const messages = await prisma.staffChatMessage.findMany({ where: { deleted: false }, orderBy: { createdAt: "desc" }, take: 200 }); res.json({ messages: messages.reverse() }); }
export async function createChat(req: Request, res: Response) { if (!req.user) return res.status(401).json({ error: "Unauthenticated" }); const { authorUid, authorName, authorRole, authorPhoto, authorPlan, authorSubscription, type, text, mediaUrl, mediaWidth, mediaHeight, mediaDuration, reactions, replyTo, clientAt, meeting } = req.body; const message = await prisma.staffChatMessage.create({ data: { authorId: req.user.id, authorUid, authorName, authorRole, authorPhoto, authorPlan, authorSubscription, type, text, mediaUrl, mediaWidth, mediaHeight, mediaDuration, reactions, replyTo, clientAt, meeting } }); res.status(201).json({ message }); }
const chatUpdateSchema = z.object({
  text: z.string().nullable().optional(), edited: z.boolean().optional(),
  editedAt: z.coerce.date().nullable().optional(), reactions: z.any().optional(),
  deleted: z.boolean().optional(), deletedAt: z.coerce.date().nullable().optional(),
  deletedBy: z.string().nullable().optional(), deletedByName: z.string().nullable().optional(), deletedByRole: z.string().nullable().optional(),
});
export async function updateChat(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const existing = await prisma.staffChatMessage.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: "Message not found" });
  const isAdmin = req.user.role === "admin";
  const isReactionOnly = Object.keys(req.body || {}).length === 1 && Object.prototype.hasOwnProperty.call(req.body, "reactions");
  if (!isReactionOnly && existing.authorId !== req.user.id && !isAdmin) return res.status(403).json({ error: "Forbidden" });
  try {
    const body = chatUpdateSchema.parse(req.body);
    const message = await prisma.staffChatMessage.update({ where: { id: existing.id }, data: body });
    return res.json({ message });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: "Message update failed" });
  }
}

const postSchema = z.object({ title: z.string().optional(), body: z.string().optional(), courseCode: z.string().nullable().optional(), faculty: z.string().nullable().optional(), department: z.string().nullable().optional(), level: z.string().nullable().optional(), pinned: z.boolean().optional(), comments: z.any().optional(), reactions: z.any().optional() });
export async function listFeedPosts(req: Request, res: Response) {
  const kind = String(req.params.kind);
  const posts = await prisma.feedPost.findMany({ where: { kind, ...(req.query.department ? { department: String(req.query.department) } : {}) }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 100 });
  res.json({ posts });
}
export async function createFeedPost(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  try { const body = postSchema.parse(req.body); const post = await prisma.feedPost.create({ data: { ...body, kind: String(req.params.kind), authorId: req.user.id, authorName: req.body.authorName || req.user.email, authorRole: req.user.role } }); res.status(201).json({ post }); }
  catch (err) { if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors }); res.status(500).json({ error: "Post creation failed" }); }
}
export async function updateFeedPost(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const body = postSchema.partial().parse(req.body);
  const reactionOrCommentOnly = Object.keys(body).every((key) => key === "reactions" || key === "comments");
  const result = await prisma.feedPost.updateMany({ where: { id: String(req.params.id), ...(reactionOrCommentOnly ? {} : { authorId: req.user.id }) }, data: body });
  if (!result.count) return res.status(404).json({ error: "Post not found" });
  res.json({ ok: true });
}

const saveSchema = z.object({ materialId: z.string().min(1), title: z.string().optional(), url: z.string().optional(), meta: z.any().optional() });
export async function listMaterialSaves(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const saves = await prisma.materialSave.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
  res.json({ saves });
}
export async function createMaterialSave(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  try { const body = saveSchema.parse(req.body); const save = await prisma.materialSave.upsert({ where: { id: `${req.user.id}:${body.materialId}` }, create: { id: `${req.user.id}:${body.materialId}`, ...body, userId: req.user.id }, update: body }); res.status(201).json({ save }); }
  catch (err) { if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors }); res.status(500).json({ error: "Save failed" }); }
}
export async function deleteMaterialSave(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  await prisma.materialSave.deleteMany({ where: { id: String(req.params.id), userId: req.user.id } });
  res.status(204).send();
}
export async function deleteFeedPost(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const canDeleteAny = ["admin", "alphaAgent", "agent"].includes(req.user.role);
  const result = await prisma.feedPost.deleteMany({ where: { id: String(req.params.id), ...(canDeleteAny ? {} : { authorId: req.user.id }) } });
  if (!result.count) return res.status(404).json({ error: "Post not found" });
  res.status(204).send();
}

export async function subscriptionCount(_req: Request, res: Response) {
  const count = await prisma.subscription.count({ where: { status: "active" } });
  res.json({ count });
}