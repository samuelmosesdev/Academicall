import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const joinSchema = z.object({ program: z.string().trim().min(1), faculty: z.string().optional().nullable(), level: z.string().optional().nullable() });
const reasonSchema = z.object({ reason: z.string().trim().min(3, "A reason is required") });

function normalizeLevel(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s*level\s*/g, "").replace(/\s+/g, "");
}

async function canReview(req: Request, membership: { department: string; level: string | null }) {
  if (!req.user) return false;
  if (["admin", "alphaAgent", "agent"].includes(req.user.role)) return true;
  if (req.user.role !== "courseRep") return false;
  const reviewer = await prisma.user.findUnique({ where: { id: req.user.id }, select: { department: true, program: true, courseRepMeta: true } });
  const meta = reviewer?.courseRepMeta as { program?: string; level?: string } | null;
  return Boolean(
    meta?.program &&
    meta.program.toLowerCase() === membership.department.toLowerCase() &&
    normalizeLevel(meta.level) &&
    normalizeLevel(meta.level) === normalizeLevel(membership.level)
  );
}

export async function joinDepartment(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const body = joinSchema.parse(req.body);
  if (req.user.role !== "user") return res.status(403).json({ error: "Only students can request program membership" });
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { program: true, faculty: true, level: true } });
  if (!current?.program || current.program !== body.program) return res.status(403).json({ error: "Membership must use your assigned program" });
  const membership = await prisma.departmentMembership.upsert({
    where: { userId_department: { userId: req.user.id, department: body.program } },
    create: { userId: req.user.id, department: body.program, faculty: current.faculty, level: current.level, status: "pending" },
    update: { faculty: current.faculty, level: current.level, status: "pending", reviewReason: null, reviewedAt: null, reviewedById: null },
  });
  res.status(201).json({ membership, message: "Waiting for admission by your Course Rep or department staff." });
}

export async function getMyMembership(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { program: true, department: true } });
  const membership = current?.program
    ? await prisma.departmentMembership.findUnique({ where: { userId_department: { userId: req.user.id, department: current.program } } })
    : null;
  res.json({ membership });
}

export async function listMembers(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
  const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true, program: true, courseRepMeta: true } });
  const requestedProgram = String(req.query.program || "");
  const assignedProgram = current?.role === "courseRep"
    ? String((current.courseRepMeta as { program?: string } | null)?.program || "")
    : "";
  if (!current || (!["admin", "alphaAgent", "agent", "courseRep"].includes(current.role))) return res.status(403).json({ error: "Forbidden" });
  if (current.role === "courseRep" && requestedProgram && requestedProgram.toLowerCase() !== assignedProgram.toLowerCase()) return res.status(403).json({ error: "Wrong program scope" });
  const program = current.role === "courseRep" ? assignedProgram : requestedProgram;
  if (!program) return res.status(400).json({ error: "Program is required" });
  const requestedStatus = String(req.query.status || "pending");
  const memberships = await prisma.departmentMembership.findMany({ where: { department: program, status: requestedStatus, ...(current.role === "courseRep" ? { level: String((current.courseRepMeta as { level?: string } | null)?.level || "") } : {}) }, include: { user: { select: { id: true, name: true, email: true, uniqueId: true, department: true, program: true, level: true, faculty: true } } }, orderBy: { createdAt: "asc" } });
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
