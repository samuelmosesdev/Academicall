import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

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

export async function courseRepStatus(req: Request, res: Response) {
  const department = normalizeScope(req.query.department);
  const level = String(req.query.level || "").trim();
  if (!department || !level) return res.json({ hasCourseRep: false });

  const reps = await prisma.user.findMany({
    where: { role: "courseRep", status: { not: "deleted" } },
    select: { department: true, program: true, level: true, courseRepMeta: true },
  });
  const hasCourseRep = reps.some((rep) => {
    const meta = rep.courseRepMeta as { department?: string; program?: string; level?: string } | null;
    const assignedScopes = [meta?.department, rep.department, meta?.program, rep.program]
      .filter(Boolean)
      .map(normalizeScope);
    const assignedLevel = meta?.level || rep.level;
    return assignedScopes.includes(department) && levelsMatch(assignedLevel, level);
  });

  res.json({ hasCourseRep });
}

export async function listUsers(req: Request, res: Response) {
  const role = req.query.role as string | undefined;
  const search = req.query.q as string | undefined;

  // Course Rep access includes Pro features. Repair older assignments that
  // were created before this rule was enforced.
  await prisma.user.updateMany({
    where: { role: "courseRep", plan: { not: "pro" } },
    data: { plan: "pro" },
  });

  const users = await prisma.user.findMany({
    where: {
      status: { not: "deleted" },
      ...(role ? { role: role as Role } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { uniqueId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      uniqueId: true,
      department: true,
      program: true,
      faculty: true,
      level: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json({ users });
}

export async function getUser(req: Request, res: Response) {
  await prisma.user.updateMany({
    where: { id: String(req.params.id), role: "courseRep", plan: { not: "pro" } },
    data: { plan: "pro" },
  });
  const user = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      uniqueId: true,
      department: true,
      program: true,
      courseRepMeta: true,
      photoUrl: true,
      status: true,
      profileComplete: true,
      coursesEnrolledCount: true,
      questionsPracticedCount: true,
      studyStreakDays: true,
      createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
}

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  department: z.string().optional().nullable(),
  program: z.string().optional().nullable(),
  faculty: z.string().optional().nullable(),
  level: z.string().optional().nullable(),
  matricNumber: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  interests: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  nickname: z.string().optional().nullable(),
  showDepartment: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  allowAnonymousComments: z.boolean().optional(),
  studyStreakDays: z.number().int().min(0).optional(),
  materialsOpenedCount: z.number().int().min(0).optional(),
  lastActiveDate: z.string().optional().nullable(),
  lastActiveAt: z.coerce.date().optional().nullable(),
  photoUrl: z.string().max(2000000).optional().nullable(),
  avatarUrl: z.string().max(2000000).optional().nullable(),
  fcmToken: z.string().optional().nullable(),
  deviceToken: z.string().optional().nullable(),
  settings: z.record(z.any()).optional().nullable(),
  profileComplete: z.boolean().optional(),
  uniqueId: z.string().optional(), // only allowed if currently null
  canImportAI: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
  courseRepMeta: z.record(z.any()).nullable().optional(),
  customCourses: z.array(z.any()).optional(),
});

async function createUniqueId() {
  const year = new Date().getFullYear().toString().slice(-2);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `UAR-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await prisma.user.findUnique({ where: { uniqueId: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique ID. Please try again.");
}

export async function updateMe(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ error: "Unauthenticated" });

  try {
    const body = updateProfileSchema.parse(req.body);
    const current = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!current) return res.status(404).json({ error: "User not found" });

    // uniqueId can only be set once
    if (body.uniqueId && current.uniqueId) {
      return res.status(400).json({ error: "uniqueId already set" });
    }

    const generatedUniqueId = body.profileComplete && !current.uniqueId
      ? await createUniqueId()
      : undefined;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: body.name,
        department: body.department,
        program: body.program,
        faculty: body.faculty,
        level: body.level,
        matricNumber: body.matricNumber,
        phone: body.phone,
        bio: body.bio,
        interests: body.interests,
        dob: body.dob,
        gender: body.gender,
        nickname: body.nickname,
        showDepartment: body.showDepartment,
        showPhone: body.showPhone,
        allowAnonymousComments: body.allowAnonymousComments,
        photoUrl: body.photoUrl,
        avatarUrl: body.avatarUrl,
        fcmToken: body.fcmToken,
        deviceToken: body.deviceToken,
        ...(body.settings !== undefined ? { settings: body.settings === null ? Prisma.JsonNull : body.settings } : {}),
        profileComplete: body.profileComplete,
        studyStreakDays: body.studyStreakDays,
        materialsOpenedCount: body.materialsOpenedCount,
        lastActiveDate: body.lastActiveDate,
        lastActiveAt: body.lastActiveAt,
        ...(body.uniqueId && !current.uniqueId
          ? { uniqueId: body.uniqueId }
          : generatedUniqueId
            ? { uniqueId: generatedUniqueId }
            : {}),
          canImportAI: body.canImportAI,
          autoPublish: body.autoPublish,
          ...(body.courseRepMeta !== undefined
            ? { courseRepMeta: body.courseRepMeta === null ? Prisma.JsonNull : body.courseRepMeta }
            : {}),
          customCourses: body.customCourses,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        uniqueId: true,
        department: true,
        program: true,
        photoUrl: true,
        faculty: true,
        level: true,
        matricNumber: true,
        phone: true,
        bio: true,
        interests: true,
        dob: true,
        gender: true,
        nickname: true,
        showDepartment: true,
        showPhone: true,
        allowAnonymousComments: true,
        profileComplete: true,
        studyStreakDays: true,
        materialsOpenedCount: true,
        lastActiveDate: true,
        lastActiveAt: true,
        emailVerified: true,
      },
    });

    res.json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
}

const adminUpdateSchema = z.object({
  role: z.enum(["admin", "alphaAgent", "agent", "courseRep", "user"]).optional(),
  plan: z.enum(["free", "pro", "annual"]).optional(),
  status: z.enum(["active", "suspended", "deleted"]).optional(),
  name: z.string().optional(),
  department: z.string().optional(),
  program: z.string().nullable().optional(),
  faculty: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  mustChangePassword: z.boolean().optional(),
  assignedBy: z.string().nullable().optional(),
  assignedAt: z.coerce.date().nullable().optional(),
  courseRepMeta: z.record(z.any()).nullable().optional(),
  fcmToken: z.string().nullable().optional(),
  deviceToken: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});

export async function adminUpdateUser(req: Request, res: Response) {
  try {
    const body = adminUpdateSchema.parse(req.body);
    const current = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: { role: true, plan: true },
    });
    if (!current) return res.status(404).json({ error: "User not found" });

    const nextRole = body.role || current.role;
    const roleChangedToCourseRep = nextRole === "courseRep";
    const roleRemovedFromCourseRep = current.role === "courseRep" && body.role && nextRole !== "courseRep";
    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: {
        ...body,
        ...(roleChangedToCourseRep
          ? { plan: "pro" }
          : roleRemovedFromCourseRep
            ? { plan: "free" }
            : {}),
        courseRepMeta: undefined,
        ...(body.courseRepMeta !== undefined
          ? { courseRepMeta: body.courseRepMeta === null ? Prisma.JsonNull : body.courseRepMeta }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        status: true,
        department: true,
        program: true,
      },
    });

    res.json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error("adminUpdateUser failed:", err);
    const reason =
      err instanceof Prisma.PrismaClientValidationError
        ? "Invalid update — one of the fields sent doesn't match the database schema."
        : err instanceof Prisma.PrismaClientKnownRequestError
        ? `Database error (${err.code})`
        : err instanceof Error
        ? err.message
        : "Unknown error";
    res.status(500).json({ error: "Update failed", reason });
  }
}

function generateTempPassword() {
  // 12 random chars from an unambiguous alphabet (no 0/O/1/l/I) — easy to
  // read aloud over a phone call when handing it to a user who lost access.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * Admin-triggered password reset for a user who lost access to their email.
 *
 * IMPORTANT: this does NOT expose the user's existing password or its hash —
 * bcrypt hashes are one-way, so there is no way to "recover" a lost password
 * from its hash even if you could see it. Showing hashes to admins would add
 * real security risk (offline cracking, leak surface) without solving the
 * actual problem. Instead this issues a brand-new temporary password, shown
 * to the admin exactly once in this response, and forces the user to change
 * it on next login. Verify the user's identity through another channel
 * (student ID, phone call, etc.) before handing over the temp password.
 */
export async function adminResetPassword(req: Request, res: Response) {
  try {
    const userId = String(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const tempPassword = generateTempPassword();
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(tempPassword, 12),
        mustChangePassword: true,
        passwordResetHash: null,
        passwordResetExpiresAt: null,
      },
    });

    return res.json({
      email: user.email,
      tempPassword,
      note: "Share this with the verified user through a secure channel. It is shown only once — run this again to issue a new one if it's lost.",
    });
  } catch (err) {
    console.error("adminResetPassword failed:", err);
    return res.status(500).json({ error: "Could not reset password" });
  }
}

const createAgentSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(6),
  name: z.string().trim().min(1).optional(),
  role: z.enum(["agent", "alphaAgent"]),
});

export async function createAgent(req: Request, res: Response) {
  try {
    const body = createAgentSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
        name: body.name || body.email.split("@")[0],
        role: body.role,
        emailVerified: true,
        profileComplete: true,
        mustChangePassword: true,
        agentDomain: body.email.split("@")[1],
        createdByAdmin: true,
        createdByUid: req.user?.id,
      },
      select: { id: true, email: true, name: true, role: true, plan: true, uniqueId: true, status: true, emailVerified: true, profileComplete: true, mustChangePassword: true },
    });
    return res.status(201).json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    return res.status(500).json({ error: "Could not create agent" });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    await prisma.user.update({ where: { id: String(req.params.id) }, data: { status: "deleted" } });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(404).json({ error: "User not found" });
  }
}
