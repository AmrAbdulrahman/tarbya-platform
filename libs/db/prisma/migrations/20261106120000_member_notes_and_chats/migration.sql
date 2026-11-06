-- Notes belong to the member they are about (BR-NOTE-1, BR-NOTE-3); the
-- mentorship stays only as where a mentor wrote it.
ALTER TABLE "Note" ADD COLUMN "subjectId" UUID;
UPDATE "Note" n SET "subjectId" = m."menteeId"
  FROM "Mentorship" m WHERE m.id = n."mentorshipId";
ALTER TABLE "Note" ALTER COLUMN "subjectId" SET NOT NULL;
ALTER TABLE "Note" ALTER COLUMN "mentorshipId" DROP NOT NULL;
ALTER TABLE "Note" ADD CONSTRAINT "Note_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "Note_mentorshipId_createdAt_idx";
CREATE INDEX "Note_subjectId_createdAt_idx" ON "Note"("subjectId", "createdAt");

-- Admin notes become private notes.
INSERT INTO "Note" (id, "subjectId", "authorId", "impersonatorId", visibility, body, "createdAt", "updatedAt")
  SELECT id, "subjectId", "authorId", "impersonatorId", 'PRIVATE', body, "createdAt", "updatedAt"
  FROM "AdminNote";
DROP TABLE "AdminNote";

-- Group chats started by anyone.
ALTER TYPE "ConversationKind" ADD VALUE 'CHAT';
ALTER TABLE "Conversation" ADD COLUMN "title" TEXT;
