-- Removes everything the e2e suites create, and nothing else:
-- users with an @tarbya.test email (a reserved test domain) with all their rows,
-- sessions the suites open for the super admin (both mark their user agent "tarbya-e2e"),
-- and lookups whose English name starts with "e2e ".
-- Run with `pnpm nx run db:e2e-cleanup`; both e2e suites run it when they finish.
BEGIN;

CREATE TEMP TABLE e2e_users ON COMMIT DROP AS
  SELECT id FROM "User" WHERE email LIKE '%@tarbya.test';

CREATE TEMP TABLE e2e_mentorships ON COMMIT DROP AS
  SELECT id FROM "Mentorship"
  WHERE "mentorId" IN (SELECT id FROM e2e_users) OR "menteeId" IN (SELECT id FROM e2e_users);

UPDATE "User" SET "managerId" = NULL WHERE "managerId" IN (SELECT id FROM e2e_users);
DELETE FROM "AdminNote"
  WHERE "subjectId" IN (SELECT id FROM e2e_users)
     OR "authorId" IN (SELECT id FROM e2e_users);
-- Replies go with their reading (ON DELETE CASCADE).
DELETE FROM "PlanReading"
  WHERE "authorId" IN (SELECT id FROM e2e_users)
     OR "planId" IN (SELECT id FROM "DevelopmentPlan" WHERE "menteeId" IN (SELECT id FROM e2e_users) OR "createdById" IN (SELECT id FROM e2e_users));
DELETE FROM "PlanReply" WHERE "authorId" IN (SELECT id FROM e2e_users);
DELETE FROM "DevelopmentPlan"
  WHERE "menteeId" IN (SELECT id FROM e2e_users) OR "createdById" IN (SELECT id FROM e2e_users);
DELETE FROM "Note"
  WHERE "mentorshipId" IN (SELECT id FROM e2e_mentorships)
     OR "authorId" IN (SELECT id FROM e2e_users);
DELETE FROM "Task"
  WHERE "assigneeId" IN (SELECT id FROM e2e_users)
     OR "createdById" IN (SELECT id FROM e2e_users);
-- Participants go with their interaction (ON DELETE CASCADE).
DELETE FROM "Interaction"
  WHERE "createdById" IN (SELECT id FROM e2e_users)
     OR "mentorshipId" IN (SELECT id FROM e2e_mentorships)
     OR id IN (SELECT "interactionId" FROM "InteractionParticipant" WHERE "userId" IN (SELECT id FROM e2e_users));
DELETE FROM "AuditLog"
  WHERE "actorId" IN (SELECT id FROM e2e_users)
     OR "onBehalfOfId" IN (SELECT id FROM e2e_users)
     OR "entityId" IN (SELECT id::text FROM e2e_users);
DELETE FROM "Session"
  WHERE "userId" IN (SELECT id FROM e2e_users)
     OR "impersonatedUserId" IN (SELECT id FROM e2e_users)
     OR "userAgent" LIKE '%tarbya-e2e%';
DELETE FROM "PasswordCredential" WHERE "userId" IN (SELECT id FROM e2e_users);
DELETE FROM "Mentorship" WHERE id IN (SELECT id FROM e2e_mentorships);
DELETE FROM "ContactChange" WHERE "userId" IN (SELECT id FROM e2e_users);
CREATE TEMP TABLE e2e_files ON COMMIT DROP AS
  SELECT "avatarFileId" AS id FROM "User" WHERE id IN (SELECT id FROM e2e_users) AND "avatarFileId" IS NOT NULL;
DELETE FROM "OneTimeCode" WHERE email LIKE '%@tarbya.test';
DELETE FROM "User" WHERE id IN (SELECT id FROM e2e_users);
-- The objects stay in the bucket; local test files are small and harmless.
DELETE FROM "FileObject" WHERE id IN (SELECT id FROM e2e_files);

DELETE FROM "ActivityType" WHERE "nameEn" LIKE 'e2e %';
DELETE FROM "TrackingMethod" WHERE "nameEn" LIKE 'e2e %';

COMMIT;
