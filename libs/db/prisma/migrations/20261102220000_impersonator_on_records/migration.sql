-- AlterTable
ALTER TABLE "AdminNote" ADD COLUMN     "impersonatorId" UUID;

-- AlterTable
ALTER TABLE "DevelopmentPlan" ADD COLUMN     "impersonatorId" UUID;

-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "impersonatorId" UUID;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "impersonatorId" UUID;

-- AlterTable
ALTER TABLE "PlanReading" ADD COLUMN     "impersonatorId" UUID;

-- AlterTable
ALTER TABLE "PlanReply" ADD COLUMN     "impersonatorId" UUID;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "impersonatorId" UUID;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_onBehalfOfId_fkey" FOREIGN KEY ("onBehalfOfId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReading" ADD CONSTRAINT "PlanReading_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReply" ADD CONSTRAINT "PlanReply_impersonatorId_fkey" FOREIGN KEY ("impersonatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

