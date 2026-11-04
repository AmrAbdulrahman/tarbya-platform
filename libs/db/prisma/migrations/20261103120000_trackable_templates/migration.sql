-- AlterTable
ALTER TABLE "Trackable" ADD COLUMN     "templateId" UUID;

-- CreateTable
CREATE TABLE "TrackableTemplate" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "impersonatorId" UUID,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "type" "TrackableType" NOT NULL,
    "cycle" "TrackingCycle" NOT NULL,
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "target" DOUBLE PRECISION,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackableTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackableTemplate_authorId_idx" ON "TrackableTemplate"("authorId");

-- CreateIndex
CREATE INDEX "TrackableTemplate_isPublic_idx" ON "TrackableTemplate"("isPublic");

-- CreateIndex
CREATE INDEX "Trackable_templateId_idx" ON "Trackable"("templateId");

-- AddForeignKey
ALTER TABLE "Trackable" ADD CONSTRAINT "Trackable_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TrackableTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableTemplate" ADD CONSTRAINT "TrackableTemplate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackableTemplate" ADD CONSTRAINT "TrackableTemplate_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

