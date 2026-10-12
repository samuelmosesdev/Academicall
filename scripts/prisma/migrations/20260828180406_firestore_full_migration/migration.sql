-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'alphaAgent', 'agent', 'courseRep', 'user');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'pro', 'annual');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('general', 'payment_claim', 'class_event', 'announcement', 'system');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT,
    "googleUid" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetHash" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "uniqueId" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationHash" TEXT,
    "emailVerificationExpiresAt" TIMESTAMP(3),
    "emailVerificationSentAt" TIMESTAMP(3),
    "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "department" TEXT,
    "faculty" TEXT,
    "level" TEXT,
    "matricNumber" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "interests" TEXT,
    "dob" TEXT,
    "gender" TEXT,
    "nickname" TEXT,
    "showDepartment" BOOLEAN NOT NULL DEFAULT true,
    "showPhone" BOOLEAN NOT NULL DEFAULT false,
    "allowAnonymousComments" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "avatarUrl" TEXT,
    "settings" JSONB,
    "fcmToken" TEXT,
    "deviceToken" TEXT,
    "fcmTokens" JSONB,
    "coursesEnrolledCount" INTEGER NOT NULL DEFAULT 0,
    "questionsPracticedCount" INTEGER NOT NULL DEFAULT 0,
    "studyStreakDays" INTEGER NOT NULL DEFAULT 0,
    "materialsOpenedCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "courseRepMeta" JSONB,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3),
    "agentDomain" TEXT,
    "createdByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdByUid" TEXT,
    "canImportAI" BOOLEAN NOT NULL DEFAULT true,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "customCourses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "thumbnailUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "tags" JSONB,
    "faculty" TEXT,
    "department" TEXT,
    "level" TEXT,
    "source" TEXT,
    "uploadedById" TEXT NOT NULL,
    "courseId" TEXT,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "easyQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "mediumQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "hardQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "reactions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "faculty" TEXT,
    "department" TEXT,
    "level" TEXT,
    "semester" TEXT,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "category" TEXT,
    "source" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "approvedBy" TEXT,
    "requestedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "courseTitle" TEXT,
    "topicLabel" TEXT,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'general',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "readByUser" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT,
    "userId" TEXT,
    "readAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT,
    "reference" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_claims" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plan" TEXT,
    "reference" TEXT,
    "amount" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "reference" TEXT,
    "status" TEXT,
    "plan" TEXT,
    "amount" INTEGER,
    "currency" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orphans" (
    "id" TEXT NOT NULL,
    "reference" TEXT,
    "reason" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_orphans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT,
    "plan" TEXT,
    "provider" TEXT,
    "reference" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "status" TEXT,
    "domain" TEXT,
    "meta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "courseId" TEXT,
    "courseCode" TEXT,
    "dayOfWeek" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    "reminderMinutes" INTEGER,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "courseCode" TEXT,
    "venue" TEXT,
    "notes" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "faculty" TEXT,
    "department" TEXT,
    "level" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_saves" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "materialId" TEXT,
    "title" TEXT,
    "url" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_saves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_posts" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "courseCode" TEXT,
    "faculty" TEXT,
    "department" TEXT,
    "level" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT,
    "authorRole" TEXT,
    "authorPhoto" TEXT,
    "comments" JSONB,
    "reactions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "requesterUid" TEXT NOT NULL,
    "type" TEXT,
    "title" TEXT,
    "body" TEXT,
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "requesterRole" TEXT,
    "field" TEXT,
    "fieldLabel" TEXT,
    "requestedValue" TEXT,
    "reason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedByName" TEXT,
    "reviewNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "createdBy" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "faculty" TEXT,
    "department" TEXT,
    "level" TEXT,
    "courseCode" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbt_questions" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "documentId" TEXT,
    "courseCode" TEXT,
    "courseTitle" TEXT,
    "topic" TEXT,
    "faculty" TEXT,
    "department" TEXT,
    "level" TEXT,
    "questionText" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cbt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_chat_messages" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorUid" TEXT,
    "authorName" TEXT,
    "authorRole" TEXT,
    "authorPhoto" TEXT,
    "authorPlan" TEXT,
    "authorSubscription" TEXT,
    "type" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT,
    "mediaUrl" TEXT,
    "mediaWidth" INTEGER,
    "mediaHeight" INTEGER,
    "mediaDuration" INTEGER,
    "reactions" JSONB,
    "replyToId" TEXT,
    "replyTo" JSONB,
    "clientAt" TEXT,
    "meeting" JSONB,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedByName" TEXT,
    "deletedByRole" TEXT,
    "editedAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebaseUid_key" ON "users"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_uniqueId_key" ON "users"("uniqueId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_department_idx" ON "users"("department");

-- CreateIndex
CREATE INDEX "users_plan_idx" ON "users"("plan");

-- CreateIndex
CREATE INDEX "documents_uploadedById_idx" ON "documents"("uploadedById");

-- CreateIndex
CREATE INDEX "documents_courseId_idx" ON "documents"("courseId");

-- CreateIndex
CREATE INDEX "enrollments_userId_idx" ON "enrollments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_userId_courseId_key" ON "enrollments"("userId", "courseId");

-- CreateIndex
CREATE INDEX "notifications_userId_readByUser_idx" ON "notifications"("userId", "readByUser");

-- CreateIndex
CREATE INDEX "notifications_userId_archived_idx" ON "notifications"("userId", "archived");

-- CreateIndex
CREATE INDEX "announcement_reads_announcementId_idx" ON "announcement_reads"("announcementId");

-- CreateIndex
CREATE INDEX "announcement_reads_userId_idx" ON "announcement_reads"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "payment_claims_userId_idx" ON "payment_claims"("userId");

-- CreateIndex
CREATE INDEX "payment_claims_status_idx" ON "payment_claims"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payment_orphans_reference_idx" ON "payment_orphans"("reference");

-- CreateIndex
CREATE INDEX "subscriptions_userId_status_idx" ON "subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "agents_userId_idx" ON "agents"("userId");

-- CreateIndex
CREATE INDEX "timetable_events_userId_idx" ON "timetable_events"("userId");

-- CreateIndex
CREATE INDEX "class_events_department_level_idx" ON "class_events"("department", "level");

-- CreateIndex
CREATE INDEX "class_events_createdBy_idx" ON "class_events"("createdBy");

-- CreateIndex
CREATE INDEX "material_saves_userId_idx" ON "material_saves"("userId");

-- CreateIndex
CREATE INDEX "feed_posts_kind_department_level_idx" ON "feed_posts"("kind", "department", "level");

-- CreateIndex
CREATE INDEX "requests_requesterUid_idx" ON "requests"("requesterUid");

-- CreateIndex
CREATE INDEX "requests_status_idx" ON "requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "cbt_questions_courseCode_idx" ON "cbt_questions"("courseCode");

-- CreateIndex
CREATE INDEX "staff_chat_messages_createdAt_idx" ON "staff_chat_messages"("createdAt");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_events" ADD CONSTRAINT "timetable_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_saves" ADD CONSTRAINT "material_saves_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_requesterUid_fkey" FOREIGN KEY ("requesterUid") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
