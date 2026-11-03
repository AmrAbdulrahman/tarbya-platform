-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "impersonatedUserId" UUID;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_impersonatedUserId_fkey" FOREIGN KEY ("impersonatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

