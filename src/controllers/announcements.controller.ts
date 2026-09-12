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
    const announcement = await prisma.announcement.create({ data: { ...body, createdBy: req.user.id } });
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