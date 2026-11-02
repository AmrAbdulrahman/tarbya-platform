-- CreateEnum
CREATE TYPE "ReadingSource" AS ENUM ('FOLLOW_UP', 'CHECK_IN');

-- CreateTable
CREATE TABLE "DevelopmentPlan" (
    "id" UUID NOT NULL,
    "menteeId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "trackingMethodId" UUID NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "endsOn" DATE,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanReading" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "source" "ReadingSource" NOT NULL,
    "interactionId" UUID,
    "authorId" UUID NOT NULL,
    "needsHelp" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanReply" (
    "id" UUID NOT NULL,
    "readingId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevelopmentPlan_menteeId_closedAt_idx" ON "DevelopmentPlan"("menteeId", "closedAt");

-- CreateIndex
CREATE INDEX "PlanReading_planId_recordedAt_idx" ON "PlanReading"("planId", "recordedAt");

-- CreateIndex
CREATE INDEX "PlanReply_readingId_idx" ON "PlanReply"("readingId");

-- AddForeignKey
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_trackingMethodId_fkey" FOREIGN KEY ("trackingMethodId") REFERENCES "TrackingMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReading" ADD CONSTRAINT "PlanReading_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DevelopmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReading" ADD CONSTRAINT "PlanReading_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReading" ADD CONSTRAINT "PlanReading_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReply" ADD CONSTRAINT "PlanReply_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "PlanReading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReply" ADD CONSTRAINT "PlanReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

