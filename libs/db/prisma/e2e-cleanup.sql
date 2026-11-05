-- Removes everything the e2e suites create, and nothing else:
-- users with an @tarbya.test email (a reserved test domain) with all their rows,
-- sessions the suites open for the super admin (both mark their user agent "tarbya-e2e"),
-- and lookups, trackable templates and groups whose (English) name starts with "e2e ".
-- Run with `pnpm nx run db:e2e-cleanup`; both e2e suites run it when they finish.
BEGIN;

CREATE TEMP TABLE e2e_users ON COMMIT DROP AS
  SELECT id FROM "User" WHERE email LIKE '%@tarbya.test';

CREATE TEMP TABLE e2e_mentorships ON COMMIT DROP AS
  SELECT id FROM "Mentorship"
  WHERE "mentorId" IN (SELECT id FROM e2e_users) OR "menteeId" IN (SELECT id FROM e2e_users);

CREATE TEMP TABLE e2e_groups ON COMMIT DROP AS
  SELECT id FROM "Group"
  WHERE name LIKE 'e2e %' OR "createdById" IN (SELECT id FROM e2e_users);

UPDATE "User" SET "managerId" = NULL WHERE "managerId" IN (SELECT id FROM e2e_users);
DELETE FROM "Notification" WHERE "userId" IN (SELECT id FROM e2e_users);
-- Members and messages go with their conversation (ON DELETE CASCADE).
DELETE FROM "Message" WHERE "authorId" IN (SELECT id FROM e2e_users);
DELETE FROM "ConversationMember" WHERE "userId" IN (SELECT id FROM e2e_users);
DELETE FROM "Conversation"
  WHERE "groupId" IN (SELECT id FROM e2e_groups)
     OR (kind = 'DIRECT' AND NOT EXISTS (SELECT 1 FROM "ConversationMember" cm WHERE cm."conversationId" = "Conversation".id));
-- RSVPs and attendance go with their gathering (ON DELETE CASCADE).
DELETE FROM "Rsvp" WHERE "userId" IN (SELECT id FROM e2e_users);
DELETE FROM "Attendance"
  WHERE "userId" IN (SELECT id FROM e2e_users) OR "recordedById" IN (SELECT id FROM e2e_users);
DELETE FROM "Gathering"
  WHERE "groupId" IN (SELECT id FROM e2e_groups)
     OR "activityTypeId" IN (SELECT id FROM "ActivityType" WHERE "nameEn" LIKE 'e2e %');
DELETE FROM "GatheringSeries"
  WHERE "groupId" IN (SELECT id FROM e2e_groups)
     OR "activityTypeId" IN (SELECT id FROM "ActivityType" WHERE "nameEn" LIKE 'e2e %');
DELETE FROM "GroupMembership"
  WHERE "groupId" IN (SELECT id FROM e2e_groups) OR "userId" IN (SELECT id FROM e2e_users);
DELETE FROM "ActivityType" WHERE "groupId" IN (SELECT id FROM e2e_groups);
DELETE FROM "Group" WHERE id IN (SELECT id FROM e2e_groups);
DELETE FROM "AdminNote"
  WHERE "subjectId" IN (SELECT id FROM e2e_users)
     OR "authorId" IN (SELECT id FROM e2e_users);
-- Replies go with their entry, comments with their challenge (ON DELETE CASCADE).
DELETE FROM "TrackableEntry"
  WHERE "authorId" IN (SELECT id FROM e2e_users)
     OR "trackableId" IN (SELECT id FROM "Trackable" WHERE "menteeId" IN (SELECT id FROM e2e_users) OR "createdById" IN (SELECT id FROM e2e_users));
DELETE FROM "TrackableReply" WHERE "authorId" IN (SELECT id FROM e2e_users);
DELETE FROM "Trackable"
  WHERE "menteeId" IN (SELECT id FROM e2e_users) OR "createdById" IN (SELECT id FROM e2e_users);
-- Templates the super admin saves in the web suite are named "e2e …".
UPDATE "Trackable" SET "templateId" = NULL
  WHERE "templateId" IN (SELECT id FROM "TrackableTemplate" WHERE name LIKE 'e2e %');
DELETE FROM "TrackableTemplate"
  WHERE "authorId" IN (SELECT id FROM e2e_users) OR name LIKE 'e2e %';
DELETE FROM "ChallengeComment" WHERE "authorId" IN (SELECT id FROM e2e_users);
DELETE FROM "Challenge"
  WHERE "menteeId" IN (SELECT id FROM e2e_users)
     OR "createdById" IN (SELECT id FROM e2e_users)
     OR "resolvedById" IN (SELECT id FROM e2e_users);
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

COMMIT;
