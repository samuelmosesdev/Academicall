ALTER TABLE "users" ADD COLUMN "program" TEXT;
ALTER TABLE "documents" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved';

CREATE TABLE "department_memberships" (
	"id" TEXT NOT NULL,
	"userId" TEXT NOT NULL,
	"department" TEXT NOT NULL,
	"faculty" TEXT,
	"level" TEXT,
	"status" TEXT NOT NULL DEFAULT 'pending',
	"reviewedById" TEXT,
	"reviewedAt" TIMESTAMP(3),
	"reviewReason" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,
	CONSTRAINT "department_memberships_pkey" PRIMARY KEY ("id"),
	CONSTRAINT "department_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "department_memberships_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "department_memberships_userId_department_key" ON "department_memberships"("userId", "department");
CREATE INDEX "department_memberships_department_status_idx" ON "department_memberships"("department", "status");
