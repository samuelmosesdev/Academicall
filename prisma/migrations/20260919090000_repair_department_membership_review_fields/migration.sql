ALTER TABLE "department_memberships"
ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);