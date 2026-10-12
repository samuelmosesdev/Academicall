ALTER TABLE "notifications"
ADD COLUMN "readByAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "notifications_readByAdmin_idx"
ON "notifications"("readByAdmin");
