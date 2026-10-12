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
  program: z.string().nullable().optional(),
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
  const isStaff = ["admin", "alphaAgent", "agent"].includes(req.user?.role || "");
  const user = req.user && !isStaff ? await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: true, faculty: true, department: true, program: true, level: true, courseRepMeta: true },
  }) : null;
  const meta = user?.courseRepMeta as { department?: string; program?: string; level?: string } | null;
  const scope = user?.role === "courseRep" ? meta?.program : user?.program;
  const level = user?.role === "courseRep" ? meta?.level : user?.level;
  const candidates = await prisma.announcement.findMany({
    where: isStaff ? undefined : { published: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const announcements = isStaff ? candidates : candidates.filter((item) => {
    const audience = item.audience || "all";
    if (audience === "all") return true;
    if (audience === "faculty") return normalizeScope(item.faculty) === normalizeScope(user?.faculty);
    if (audience === "department") {
      const sameScope = Boolean(scope && normalizeScope(scope) === normalizeScope(item.department));
      return sameScope && (!item.level || (level && levelsMatch(item.level, level)));
    }
    return false;
  });
  res.json({ announcements });
}

export async function createAnnouncement(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  try {
    if (!["admin", "alphaAgent", "agent", "courseRep"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only Course Reps and staff can create announcements" });
    }
    const { program, ...parsed } = announcementSchema.parse(req.body);
    if (parsed.audience === "department" && !String(program || "").trim()) {
      return res.status(400).json({ error: "Program is required for program-scoped announcements" });
    }
    const body = { ...parsed, department: String(program || "").trim() || null };
    if (req.user.role === "courseRep") {
      if (body.audience !== "department" || !body.department || !body.level) {
        return res.status(403).json({ error: "Course Reps can only post to their assigned program and level" });
      }

      const rep = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { department: true, program: true, level: true, courseRepMeta: true },
      });
      const meta = rep?.courseRepMeta as { department?: string; program?: string; level?: string } | null;
      const assignedScope = normalizeScope(meta?.program);
      const assignedLevel = meta?.level;
      if (assignedScope !== normalizeScope(body.department) || !levelsMatch(assignedLevel, body.level)) {
        return res.status(403).json({ error: "You can only post to your assigned program and level" });
      }
    }
    const announcement = await prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({ data: { ...body, createdBy: req.user!.id } });
      if (body.audience === "department" && body.department) {
        await tx.feedPost.create({
          data: {
          kind: "course",
          title: body.title,
          body: body.body || null,
          courseCode: body.courseCode || null,
          faculty: body.faculty || null,
          department: body.department,
          level: body.level || null,
          pinned: body.pinned || false,
          authorId: req.user!.id,
          authorName: req.user!.email || "Course Rep",
          authorRole: req.user!.role,
          comments: [],
          reactions: [],
          },
        });
      }
      return created;
    });
    res.status(201).json({ announcement });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: "Create failed" });
  }
}

export async function updateAnnouncement(req: Request, res: Response) {
  try {
    const { program, ...parsed } = announcementSchema.partial().parse(req.body);
    const body = program === undefined ? parsed : { ...parsed, department: program };
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