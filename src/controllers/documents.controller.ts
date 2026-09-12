import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

export async function listDocuments(req: Request, res: Response) {
  const courseId = req.query.courseId as string | undefined;
  const q = req.query.q as string | undefined;

  const documents = await prisma.document.findMany({
    where: {
      ...(courseId ? { courseId } : {}),
      ...(q
        ? { title: { contains: q, mode: "insensitive" } }
        : {}),
    },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json({ documents });
}

export async function getDocument(req: Request, res: Response) {
  const doc = await prisma.document.findUnique({
    where: { id: String(req.params.id) },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      course: true,
    },
  });

  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.json({ document: doc });
}

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  fileUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional().nullable(),
  courseId: z.string().min(1).optional().nullable(),
  source: z.string().optional(),
  fileName: z.string().optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  faculty: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  level: z.string().optional().nullable(),
});

export async function createDocument(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });

  try {
    const body = createSchema.parse(req.body);

    const doc = await prisma.document.create({
      data: {
        ...body,
        tags: body.tags === null ? Prisma.JsonNull : body.tags,
        uploadedById: req.user.id,
        source: body.source || (req.user.role === "courseRep" ? "courseRep" : "staff"),
      },
    });

    res.status(201).json({ document: doc });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: "Create failed" });
  }
}

export async function updateDocument(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });

  const existing = await prisma.document.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: "Document not found" });

  // owner or staff
  const isStaff = ["admin", "alphaAgent", "agent"].includes(req.user.role);
  if (existing.uploadedById !== req.user.id && !isStaff) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const doc = await prisma.document.update({
    where: { id: String(req.params.id) },
    data: req.body,
  });

  res.json({ document: doc });
}

export async function deleteDocument(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });

  const existing = await prisma.document.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: "Document not found" });

  const isStaff = ["admin", "alphaAgent", "agent"].includes(req.user.role);
  if (existing.uploadedById !== req.user.id && !isStaff) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await prisma.document.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
}
