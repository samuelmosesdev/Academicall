import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const requestSchema = z.object({
  type: z.string().optional(), title: z.string().optional(), body: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(), meta: z.any().optional(),
  requesterName: z.string().optional(), requesterEmail: z.string().optional(), requesterRole: z.string().optional(),
  field: z.string().optional(), fieldLabel: z.string().optional(), requestedValue: z.string().optional(), reason: z.string().optional(),
  reviewedAt: z.coerce.date().nullable().optional(), reviewedBy: z.string().nullable().optional(), reviewedByName: z.string().nullable().optional(), reviewNote: z.string().nullable().optional(),
});

export async function listRequests(req: Request, res: Response) {
  const requests = await prisma.request.findMany({
    where: req.user?.role === "user" ? { requesterUid: req.user.id } : undefined,
    orderBy: { createdAt: "desc" }, take: 200,
  });
  res.json({ requests });
}

export async function createRequest(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  try {
    const body = requestSchema.parse(req.body);
    const request = await prisma.request.create({ data: { ...body, requesterUid: req.user.id } });
    res.status(201).json({ request });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: "Create failed" });
  }
}

export async function updateRequest(req: Request, res: Response) {
  try {
    const body = requestSchema.partial().parse(req.body);
    const request = await prisma.request.update({ where: { id: String(req.params.id) }, data: body });
    res.json({ request });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: "Update failed" });
  }
}

const profileChangeSchema = z.object({
  userId: z.string().optional(), userName: z.string().optional(), userEmail: z.string().optional(), uniqueId: z.string().nullable().optional(),
  body: z.string().optional(),
  field: z.string().optional(), fieldLabel: z.string().optional(), currentValue: z.string().nullable().optional(), requestedValue: z.string().optional(), reason: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(), reviewedAt: z.coerce.date().nullable().optional(), reviewedBy: z.string().nullable().optional(), reviewedByName: z.string().nullable().optional(), adminNote: z.string().nullable().optional(), meta: z.any().optional(),
});

function profileChangeView(item: any) { return { ...item, userId: item.userId, userName: item.userName, userEmail: item.userEmail }; }

export async function listProfileChangeRequests(req: Request, res: Response) {
  const requests = await prisma.profileChangeRequest.findMany({ where: req.user?.role === "user" ? { userId: req.user.id } : undefined, orderBy: { createdAt: "desc" }, take: 200 });
  res.json({ requests: requests.map(profileChangeView) });
}

export async function createProfileChangeRequest(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  try {
    const body = profileChangeSchema.parse(req.body);
    const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
    const field = body.field || meta.field;
    const requestedValue = body.requestedValue || meta.requestedValue;
    if (!field || !requestedValue) return res.status(400).json({ error: "field and requestedValue are required" });
    const request = await prisma.profileChangeRequest.create({ data: {
      userId: req.user.id, userName: body.userName || meta.userName, userEmail: body.userEmail || meta.userEmail, uniqueId: body.uniqueId ?? meta.uniqueId,
      field, fieldLabel: body.fieldLabel || meta.fieldLabel, currentValue: body.currentValue ?? meta.currentValue, requestedValue,
      reason: body.reason || meta.reason || body.body, status: "pending",
    } });
    res.status(201).json({ request: profileChangeView(request) });
  } catch (err) { if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors }); res.status(500).json({ error: "Create failed" }); }
}

export async function updateProfileChangeRequest(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  try {
    const body = profileChangeSchema.partial().parse(req.body);
    const current = await prisma.profileChangeRequest.findUnique({ where: { id: String(req.params.id) } });
    if (!current) return res.status(404).json({ error: "Profile change request not found" });
    if (!["admin", "alphaAgent", "agent"].includes(req.user.role) && current.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    if (body.status === "approved") {
      const allowedFields = ["name", "phone", "faculty", "department", "level", "matricNumber"];
      if (!allowedFields.includes(current.field)) return res.status(400).json({ error: "Field cannot be approved" });
      await prisma.user.update({ where: { id: current.userId }, data: { [current.field]: current.requestedValue } });
    }
    const request = await prisma.profileChangeRequest.update({ where: { id: current.id }, data: { status: body.status, reviewedAt: body.reviewedAt || (body.status ? new Date() : undefined), reviewedBy: body.reviewedBy, reviewedByName: body.reviewedByName, adminNote: body.adminNote } });
    res.json({ request: profileChangeView(request) });
  } catch (err) { if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors }); res.status(500).json({ error: "Update failed" }); }
}

export async function deleteProfileChangeRequest(req: Request, res: Response) {
  if (!req.user || !["admin", "alphaAgent", "agent"].includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
  await prisma.profileChangeRequest.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
}