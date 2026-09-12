import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const activitySchema = z.object({
  action: z.string().min(1),
  status: z.string().optional(),
  reference: z.string().nullable().optional(),
  meta: z.any().optional(),
});

export async function listActivity(req: Request, res: Response) {
  const activity = await prisma.activityLog.findMany({
    where: req.query.agentId ? { meta: { path: ["targetUid"], equals: String(req.query.agentId) } } : undefined,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  res.json({ activity });
}

export async function createActivity(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  try {
    const body = activitySchema.parse(req.body);
    const activity = await prisma.activityLog.create({
      data: { ...body, userId: req.user.id, userName: req.user.email },
    });
    res.status(201).json({ activity });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: "Activity log failed" });
  }
}