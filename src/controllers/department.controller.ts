import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const joinSchema = z.object({ department: z.string().min(1), program: z.string().optional().nullable(), faculty: z.string().optional().nullable(), level: z.string().optional().nullable() });
const reasonSchema = z.object({ reason: z.string().trim().min(3, "A reason is required") });

async function canReview(req: Request, membership: { department: string }) {
  if (!req.user) return false;
  if (["admin", "alphaAgent", "agent"].includes(req.user.role)) return true;
  if (req.user.role !== "courseRep") return false;
  const reviewer = await prisma.user.findUnique({ where: { id: req.user.id }, select: { department: true, program: true, courseRepMeta: true } });
  const meta = reviewer?.courseRepMeta as { department?: string; program?: string } | null;
  const scopes = [meta?.department, reviewer?.department, meta?.program, reviewer?.program].filter(Boolean);
  return scopes.some((scope) => scope === membership.department);
}

export async function joinDepartment(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const body = joinSchema.parse(req.body);
  const membership = await prisma.departmentMembership.upsert({
    where: { userId_department: { userId: req.user.id, department: body.department } },
    create: { userId: req.user.id, department: body.department, faculty: body.faculty, level: body.level, status: "pending" },
    update: { faculty: body.faculty, level: body.level, status: "pending", reviewReason: null, reviewedAt: null, reviewedById: null },
  });
  res.status(201).json({ membership, message: "Waiting for admission by your Course Rep or department staff." });
}

export async function getMyMembership(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { program: true, department: true } });
  const scopes = [...new Set([req.query.department, current?.department, current?.program].filter(Boolean).map(String))];
  let membership = null;
  for (const department of scopes) {
    membership = await prisma.departmentMembership.findUnique({ where: { userId_department: { userId: req.user.id, department } } });
    if (membership) break;
  }
  res.json({ membership });
}

export async function listMembers(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { program: true, department: true } });
  const department = String(req.query.department || current?.department || current?.program || "");
  if (!department) return res.json({ members: [] });
  const requestedStatus = String(req.query.status || "pending");
  const memberships = await prisma.departmentMembership.findMany({ where: { department, status: requestedStatus }, include: { user: { select: { id: true, name: true, email: true, uniqueId: true, department: true, level: true, faculty: true } } }, orderBy: { createdAt: "asc" } });
  const scoped = [];
  for (const membership of memberships) if (await canReview(req, membership)) scoped.push(membership);
  res.json({ members: scoped });
}

async function review(req: Request, res: Response, status: "active" | "rejected") {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const membership = await prisma.departmentMembership.findUnique({ where: { id: String(req.params.id) } });
  if (!membership || !(await canReview(req, membership))) return res.status(403).json({ error: "You cannot review this membership" });
  const body = status === "rejected" ? reasonSchema.parse(req.body) : { reason: null };
  const updated = await prisma.departmentMembership.update({ where: { id: membership.id }, data: { status, reviewReason: body.reason, reviewedById: req.user.id, reviewedAt: new Date() }, include: { user: true } });
  await prisma.activityLog.create({
    data: {
      userId: req.user.id,
      userName: req.user.email,
      action: status === "active" ? "department.admission.approved" : "department.admission.rejected",
      status: status === "active" ? "success" : "error",
      reference: updated.id,
      meta: { department: updated.department, memberId: updated.userId, reason: updated.reviewReason || null },
    },
  });
  res.json({ membership: updated });
}

export const admitMember = (req: Request, res: Response) => review(req, res, "active");
export const rejectMember = (req: Request, res: Response) => review(req, res, "rejected");
