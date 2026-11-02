-- CreateEnum
CREATE TYPE "InteractionKind" AS ENUM ('FOLLOW_UP', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('SHARED', 'PRIVATE');

-- CreateTable
CREATE TABLE "Interaction" (
    "id" UUID NOT NULL,
    "kind" "InteractionKind" NOT NULL,
    "mentorshipId" UUID,
    "activityTypeId" UUID,
    "createdById" UUID NOT NULL,
    "title" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "place" TEXT,
    "sharedNotes" TEXT,
    "privateNotes" TEXT,
    "challenges" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionParticipant" (
    "interactionId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "InteractionParticipant_pkey" PRIMARY KEY ("interactionId","userId")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "assigneeId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "interactionId" UUID,
    "title" TEXT NOT NULL,
    "dueOn" DATE,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" UUID NOT NULL,
    "mentorshipId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "visibility" "NoteVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interaction_mentorshipId_startsAt_idx" ON "Interaction"("mentorshipId", "startsAt");

-- CreateIndex
CREATE INDEX "Interaction_createdById_startsAt_idx" ON "Interaction"("createdById", "startsAt");

-- CreateIndex
CREATE INDEX "InteractionParticipant_userId_idx" ON "InteractionParticipant"("userId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_doneAt_idx" ON "Task"("assigneeId", "doneAt");

-- CreateIndex
CREATE INDEX "Note_mentorshipId_createdAt_idx" ON "Note"("mentorshipId", "createdAt");

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_mentorshipId_fkey" FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionParticipant" ADD CONSTRAINT "InteractionParticipant_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionParticipant" ADD CONSTRAINT "InteractionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_mentorshipId_fkey" FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
