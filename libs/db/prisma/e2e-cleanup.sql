-- Removes everything the e2e suites create, and nothing else:
-- users with an @tarbya.test email (a reserved test domain) with all their rows,
-- sessions the suites open for the super admin (both mark their user agent "tarbya-e2e"),
-- and lookups whose English name starts with "e2e ".
-- Run with `pnpm nx run db:e2e-cleanup`; both e2e suites run it when they finish.
BEGIN;

CREATE TEMP TABLE e2e_users ON COMMIT DROP AS
  SELECT id FROM "User" WHERE email LIKE '%@tarbya.test';

UPDATE "User" SET "managerId" = NULL WHERE "managerId" IN (SELECT id FROM e2e_users);
DELETE FROM "AuditLog"
  WHERE "actorId" IN (SELECT id FROM e2e_users)
     OR "entityId" IN (SELECT id::text FROM e2e_users);
DELETE FROM "Session"
  WHERE "userId" IN (SELECT id FROM e2e_users)
     OR "userAgent" LIKE '%tarbya-e2e%';
DELETE FROM "PasswordCredential" WHERE "userId" IN (SELECT id FROM e2e_users);
DELETE FROM "Mentorship"
  WHERE "mentorId" IN (SELECT id FROM e2e_users)
     OR "menteeId" IN (SELECT id FROM e2e_users);
DELETE FROM "OneTimeCode" WHERE email LIKE '%@tarbya.test';
DELETE FROM "User" WHERE id IN (SELECT id FROM e2e_users);

DELETE FROM "ActivityType" WHERE "nameEn" LIKE 'e2e %';
DELETE FROM "TrackingMethod" WHERE "nameEn" LIKE 'e2e %';

COMMIT;
