-- CreateEnum
CREATE TYPE "ActivityScope" AS ENUM ('INDIVIDUAL', 'GROUP_RECURRING', 'GROUP_ONE_OFF');

-- CreateEnum
CREATE TYPE "LookupColor" AS ENUM ('PURPLE', 'NAVY', 'GREEN', 'AMBER', 'ROSE', 'SLATE');

-- CreateEnum
CREATE TYPE "ReminderLead" AS ENUM ('NONE', 'H3', 'H24', 'H48');

-- CreateTable
CREATE TABLE "ActivityType" (
    "id" UUID NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "scope" "ActivityScope" NOT NULL,
    "color" "LookupColor" NOT NULL DEFAULT 'PURPLE',
    "requiresRsvp" BOOLEAN NOT NULL DEFAULT false,
    "tracksAttendance" BOOLEAN NOT NULL DEFAULT false,
    "showInFeed" BOOLEAN NOT NULL DEFAULT true,
    "reminder" "ReminderLead" NOT NULL DEFAULT 'NONE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingMethod" (
    "id" UUID NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "onBehalfOfId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
