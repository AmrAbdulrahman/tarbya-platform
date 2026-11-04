-- CreateEnum
CREATE TYPE "TrackableType" AS ENUM ('COUNT', 'BOOLEAN', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "TrackingCycle" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('MENTEE', 'MENTOR');

-- CreateTable
CREATE TABLE "Trackable" (
    "id" UUID NOT NULL,
    "menteeId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "impersonatorId" UUID,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "type" "TrackableType" NOT NULL,
    "cycle" "TrackingCycle" NOT NULL,
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "target" DOUBLE PRECISION,
    "startsOn" DATE NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trackable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackableEntry" (
    "id" UUID NOT NULL,
    "trackableId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "source" "EntrySource" NOT NULL,
    "interactionId" UUID,
    "authorId" UUID NOT NULL,
    "impersonatorId" UUID,
    "needsHelp" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackableReply" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "impersonatorId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackableReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" UUID NOT NULL,
    "menteeId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "impersonatorId" UUID,
    "interactionId" UUID,
    "title" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeComment" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "impersonatorId" UUID,
    "interactionId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trackable_menteeId_archivedAt_idx" ON "Trackable"("menteeId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrackableEntry_trackableId_periodStart_key" ON "TrackableEntry"("trackableId", "periodStart");

-- CreateIndex
CREATE INDEX "TrackableReply_entryId_idx" ON "TrackableReply"("entryId");

-- CreateIndex
CREATE INDEX "Challenge_menteeId_resolvedAt_idx" ON "Challenge"("menteeId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ChallengeComment_challengeId_createdAt_idx" ON "ChallengeComment"("challengeId", "createdAt");

-- AddForeignKey
ALTER TABLE "Trackable" ADD CONSTRAINT "Trackable_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trackable" ADD CONSTRAINT "Trackable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trackable" ADD CONSTRAINT "Trackable_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableEntry" ADD CONSTRAINT "TrackableEntry_trackableId_fkey" FOREIGN KEY ("trackableId") REFERENCES "Trackable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableEntry" ADD CONSTRAINT "TrackableEntry_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableEntry" ADD CONSTRAINT "TrackableEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableEntry" ADD CONSTRAINT "TrackableEntry_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableReply" ADD CONSTRAINT "TrackableReply_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TrackableEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableReply" ADD CONSTRAINT "TrackableReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableReply" ADD CONSTRAINT "TrackableReply_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeComment" ADD CONSTRAINT "ChallengeComment_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeComment" ADD CONSTRAINT "ChallengeComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeComment" ADD CONSTRAINT "ChallengeComment_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeComment" ADD CONSTRAINT "ChallengeComment_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ── Data: development plans become weekly count trackables (US-4.5 → BR-TRK) ──
-- Weeks start on Saturday; days are in the organisation zone (Africa/Cairo).
INSERT INTO "Trackable" (id, "menteeId", "createdById", "impersonatorId", name, goal, type, cycle,
  "higherIsBetter", target, "startsOn", "archivedAt", "createdAt", "updatedAt")
SELECT id, "menteeId", "createdById", "impersonatorId", name, goal, 'COUNT', 'WEEKLY',
  "higherIsBetter", target, ("createdAt" AT TIME ZONE 'Africa/Cairo')::date, "closedAt", "createdAt", "updatedAt"
FROM "DevelopmentPlan";

-- One entry per week: the latest reading of each week wins.
INSERT INTO "TrackableEntry" (id, "trackableId", "periodStart", value, note, source, "interactionId",
  "authorId", "impersonatorId", "needsHelp", "recordedAt")
SELECT DISTINCT ON (r."planId", w.start)
  r.id, r."planId", w.start, r.value, r.note,
  CASE r.source WHEN 'CHECK_IN' THEN 'MENTEE'::"EntrySource" ELSE 'MENTOR'::"EntrySource" END,
  r."interactionId", r."authorId", r."impersonatorId", r."needsHelp", r."recordedAt"
FROM "PlanReading" r
CROSS JOIN LATERAL (
  SELECT d - ((EXTRACT(DOW FROM d)::int - 6 + 7) % 7) AS start
  FROM (SELECT (r."recordedAt" AT TIME ZONE 'Africa/Cairo')::date AS d) x
) w
ORDER BY r."planId", w.start, r."recordedAt" DESC;

INSERT INTO "TrackableReply" (id, "entryId", "authorId", "impersonatorId", body, "createdAt")
SELECT p.id, p."readingId", p."authorId", p."impersonatorId", p.body, p."createdAt"
FROM "PlanReply" p
WHERE p."readingId" IN (SELECT id FROM "TrackableEntry");

-- ── Data: each follow-up's challenges become the mentee's challenges (BR-CHL-1) ──
-- The same challenge written in several follow-ups becomes one, from the first of them.
INSERT INTO "Challenge" (id, "menteeId", "createdById", "impersonatorId", "interactionId", title, "createdAt", "updatedAt")
SELECT DISTINCT ON (m."menteeId", lower(trim(c.title)))
  gen_random_uuid(), m."menteeId", i."createdById", i."impersonatorId", i.id, trim(c.title), i."startsAt", i."startsAt"
FROM "Interaction" i
JOIN "Mentorship" m ON m.id = i."mentorshipId"
CROSS JOIN LATERAL unnest(i.challenges) AS c(title)
WHERE trim(c.title) <> ''
ORDER BY m."menteeId", lower(trim(c.title)), i."startsAt";

-- ── Settings: plans.* become trackables.*; check-in days give way to cycles ──
UPDATE "Setting" SET key = 'trackables.trendWindow' WHERE key = 'plans.trendWindow';
UPDATE "Setting" SET key = 'trackables.trendSteadyBand' WHERE key = 'plans.trendSteadyBand';
DELETE FROM "Setting" WHERE key = 'plans.checkInDays';

-- DropForeignKey
ALTER TABLE "DevelopmentPlan" DROP CONSTRAINT "DevelopmentPlan_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DevelopmentPlan" DROP CONSTRAINT "DevelopmentPlan_impersonatorId_fkey";

-- DropForeignKey
ALTER TABLE "DevelopmentPlan" DROP CONSTRAINT "DevelopmentPlan_menteeId_fkey";

-- DropForeignKey
ALTER TABLE "DevelopmentPlan" DROP CONSTRAINT "DevelopmentPlan_trackingMethodId_fkey";

-- DropForeignKey
ALTER TABLE "PlanReading" DROP CONSTRAINT "PlanReading_authorId_fkey";

-- DropForeignKey
ALTER TABLE "PlanReading" DROP CONSTRAINT "PlanReading_impersonatorId_fkey";

-- DropForeignKey
ALTER TABLE "PlanReading" DROP CONSTRAINT "PlanReading_interactionId_fkey";

-- DropForeignKey
ALTER TABLE "PlanReading" DROP CONSTRAINT "PlanReading_planId_fkey";

-- DropForeignKey
ALTER TABLE "PlanReply" DROP CONSTRAINT "PlanReply_authorId_fkey";

-- DropForeignKey
ALTER TABLE "PlanReply" DROP CONSTRAINT "PlanReply_impersonatorId_fkey";

-- DropForeignKey
ALTER TABLE "PlanReply" DROP CONSTRAINT "PlanReply_readingId_fkey";

-- AlterTable
ALTER TABLE "Interaction" DROP COLUMN "challenges";

-- DropTable
DROP TABLE "DevelopmentPlan";

-- DropTable
DROP TABLE "PlanReading";

-- DropTable
DROP TABLE "PlanReply";

-- DropTable
DROP TABLE "TrackingMethod";

-- DropEnum
DROP TYPE "ReadingSource";

