import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const announcementSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  published: z.boolean().optional(),
  audience: z.string().optional(),
  faculty: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  courseCode: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
});

function normalizeScope(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function levelsMatch(first: unknown, second: unknown) {
  const a = normalizeScope(first).replace(/\s*level\s*/g, "");
  const b = normalizeScope(second).replace(/\s*level\s*/g, "");
  return Boolean(a && b && a === b);
}

export async function listAnnouncements(req: Request, res: Response) {
  const announcements = await prisma.announcement.findMany({
    where: ["admin", "alphaAgent", "agent"].includes(req.user?.role || "") ? undefined : { published: true }, orderBy: { createdAt: "desc" }, take: 100,
  });
  res.json({ announcements });
}

export async function createAnnouncement(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  try {
    const body = announcementSchema.parse(req.body);
    if (req.user.role === "courseRep") {
      if (body.audience !== "department" || !body.department || !body.level) {
        return res.status(403).json({ error: "Course Reps can only post to their assigned department and level" });
      }

      const rep = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { department: true, program: true, level: true, courseRepMeta: true },
      });
      const meta = rep?.courseRepMeta as { department?: string; program?: string; level?: string } | null;
      const assignedScope = normalizeScope(meta?.program || meta?.department || rep?.program || rep?.department);
      const assignedLevel = meta?.level || rep?.level;
      if (assignedScope !== normalizeScope(body.department) || !levelsMatch(assignedLevel, body.level)) {
        return res.status(403).json({ error: "You can only post to your assigned department and level" });
      }
    }
    const announcement = await prisma.announcement.create({ data: { ...body, createdBy: req.user.id } });
    if (body.audience === "department" && body.department) {
      await prisma.feedPost.create({
        data: {
          kind: "course",
          title: body.title,
          body: body.body || null,
          courseCode: body.courseCode || null,
          faculty: body.faculty || null,
          department: body.department,
          level: body.level || null,
          pinned: body.pinned || false,
          authorId: req.user.id,
          authorName: req.user.email || "Course Rep",
          authorRole: req.user.role,
          comments: [],
          reactions: [],
        },
      });
    }
    res.status(201).json({ announcement });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: "Create failed" });
  }
}

export async function updateAnnouncement(req: Request, res: Response) {
  try {
    const body = announcementSchema.partial().parse(req.body);
    const announcement = await prisma.announcement.update({ where: { id: String(req.params.id) }, data: body });
    res.json({ announcement });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: "Update failed" });
  }
}

export async function deleteAnnouncement(req: Request, res: Response) {
  await prisma.announcement.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
}

export async function listAnnouncementReads(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const reads = await prisma.announcementRead.findMany({ where: { userId: req.user.id }, take: 200 });
  res.json({ reads });
}

export async function markAnnouncementRead(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const id = `${req.user.id}_${String(req.params.id)}`;
  const read = await prisma.announcementRead.upsert({ where: { id }, create: { id, userId: req.user.id, announcementId: String(req.params.id), readAt: new Date() }, update: { readAt: new Date() } });
  res.json({ read });
}