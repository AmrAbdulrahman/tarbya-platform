# Architecture

## Stack

| Concern         | Choice                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Monorepo        | Nx workspace, pnpm                                                                                              |
| Runtime         | Node.js LTS                                                                                                     |
| Web             | React SPA, TypeScript, Vite, ESLint                                                                             |
| Web UI          | Tailwind CSS + shadcn/ui, tokens from `design/README.md`                                                        |
| Routing / forms | TanStack Router, React Hook Form + Zod                                                                          |
| Server state    | TanStack Query (hooks generated from OpenAPI)                                                                   |
| i18n            | i18next + react-i18next; `ar` (default, RTL) and `en` (LTR)                                                     |
| API             | NestJS, REST, OpenAPI via `@nestjs/swagger`                                                                     |
| API client      | Orval generates typed client + TanStack Query hooks into `libs/api-client`                                      |
| Database        | PostgreSQL                                                                                                      |
| ORM             | Prisma                                                                                                          |
| Auth            | Built in Nest: argon2 passwords, email one-time codes, JWT access + rotating refresh tokens in httpOnly cookies |
| Realtime        | Server-Sent Events for notifications and messages                                                               |
| Jobs            | pg-boss (queue + cron in Postgres)                                                                              |
| Email           | SMTP (Nodemailer); Mailpit locally                                                                              |
| Files           | S3-compatible API: Railway Storage Buckets in production, SeaweedFS locally                                     |
| Tests           | Vitest (web), Jest (api), Playwright (e2e)                                                                      |
| CI              | GitHub Actions with `nx affected`                                                                               |
| Hosting         | Railway: `api` service, `web` static service, managed Postgres, storage bucket                                  |

## Workspace layout

```
apps/
  api/            NestJS app
  api-e2e/        API e2e tests (Jest + supertest against a test database)
  web/            React SPA
  web-e2e/        Playwright
libs/
  db/             Prisma schema, migrations, seed, PrismaService (api only)
  api-client/     Orval output from the api's OpenAPI spec (web only)
  shared/         Isomorphic code: enums, constants, date/calendar helpers, trend calculation
  ui/             shadcn components, Tailwind preset with design tokens
  i18n/           ar/en resource files and i18next setup
design/           Design snapshot (reference only)
docs/             Requirements, user stories, architecture
```

Nx module boundaries (enforced with `@nx/enforce-module-boundaries` tags):

- `scope:web` may use `ui`, `i18n`, `api-client`, `shared`.
- `scope:api` may use `db`, `shared`.
- `shared` depends on nothing in the workspace.

## API (NestJS)

One Nest module per domain under `apps/api/src/modules/`:

`auth`, `users`, `settings`, `lookups`, `mentorships`, `hierarchy`, `interactions` (follow-ups and activities), `trackables`, `challenges`, `notes`, `tasks`, `groups`, `gatherings`, `notifications`, `messages`, `files`, `audit`, `feed`.

Cross-cutting pieces in `apps/api/src/common/`: auth guard, `@CurrentUser()`, `@Policy()` decorator, Zod/class-validator pipes, problem-details error filter, request-scoped audit context.

Conventions:

- Controllers are thin; services own rules; Prisma access stays in services.
- DTOs carry `@ApiProperty` so the OpenAPI spec is complete; Orval regenerates the client from `apps/api/openapi.json`, which is committed and checked in CI.
- Every list endpoint is paginated by cursor.
- Errors follow RFC 9457 problem details with a stable `code` the web maps to translated messages.

## Authorization

Roles are derived, so permission checks are relationship checks, not role lists:

| Check                            | Source                                                   |
| -------------------------------- | -------------------------------------------------------- |
| super admin                      | user email equals `SUPER_ADMIN_EMAIL` (env)              |
| moderator                        | `User.isModerator`                                       |
| mentor of X                      | active `Mentorship` where mentor = me, mentee = X        |
| group admin / moderator / member | `GroupMembership.role`                                   |
| manager of X                     | X is in my subtree (recursive query on `User.managerId`) |
| can see group G                  | member of G, or in the manager chain above G's admin     |

Each module exposes a policy service (`can(user, action, resource)`) used by a `@Policy()` guard and by services for query scoping. Lists are always filtered in SQL, never after loading. Administration routes use `@Requires('admin' | 'superAdmin')` (`apps/api/src/common/access.ts`), checked by a global guard after authentication.

Private notes are excluded at the query level for anyone who isn't the mentor or a moderator.

## Hierarchies

- **Manager tree:** `User.managerId` (adjacency list). Subtree and chain queries use recursive CTEs through `$queryRaw` in the `hierarchy` module. Setting a manager runs in a transaction that checks the new manager isn't in the user's subtree.
- **Mentoring chain:** derived from active mentorships (one active mentor per mentee). Same cycle check when assigning.
- If subtree queries become hot, add a closure table maintained by the hierarchy service; the API doesn't change.

## Authentication

- Password: argon2id. One-time codes: 6 digits, hashed, 10-minute expiry, 5 attempts, rate-limited.
- Access token: JWT, 15 minutes, httpOnly `Secure` `SameSite=Lax` cookie, path `/api`.
- Refresh token: opaque random value, 30 days, stored hashed in `Session`, rotated on every use; reuse of an old one revokes the session family.
- Sign-in allowed if the user is active, has an email, and holds a role listed in the `auth.signInRoles` setting (super admin always).
- CSRF: same-site cookies plus a required custom header (`X-Requested-With`) on mutating requests.
- Impersonation (BR-ADM-5): the super admin's session stores `impersonatedUserId`; its access tokens then carry the user as `sub` and the super admin as `act`, and every request checks them against the session, so stopping takes effect at once. The audit service records changes made meanwhile with `actorId` = super admin and `onBehalfOfId` = the user. Records written meanwhile (interactions, tasks, notes, admin notes, plans, readings, replies) store `impersonatorId`, returned as `impersonator` next to the author. `GET /audit?userId=` gives admins a member's change log. Routes marked `@NotWhileImpersonating()` (password, email/phone, sign out everywhere) refuse with `IMPERSONATION_RESTRICTED`.
- v2 acting on behalf: a short-lived access token with an `act` claim (`{ sub: member, act: { sub: manager } }`); the audit context records both; a separate allow-list defines which endpoints accept it.

## Data model (first cut)

Prisma models, grouped. All have `id` (uuid), `createdAt`, `updatedAt`.

- **People:** `User` (name, email?, phone?, avatarFileId?, locale, calendar, isModerator, managerId?, deactivatedAt?), `PasswordCredential`, `OneTimeCode`, `Session`, `ContactChange`.
- **Settings & lookups:** `Setting` (key, json value; keys and defaults in `libs/shared/src/lib/settings.ts`), `ActivityType` (nameAr, nameEn, scope INDIVIDUAL | GROUP_RECURRING | GROUP_ONE_OFF, color, requiresRsvp, tracksAttendance, showInFeed, reminder, active; group-specific types get a `groupId` with groups), Gathering types are the `GROUP_RECURRING` activity types, as in `design/screens/ActivityTypes.dc.html`; there is no separate `GatheringType`.
- **Mentoring:** `Mentorship` (mentorId, menteeId, startedAt, endedAt?; partial unique index on menteeId where endedAt is null).
- **Interactions:** `Interaction` (kind FOLLOW_UP | ACTIVITY, mentorshipId? for follow-ups, activityTypeId? for activities, createdById, title?, startsAt, endsAt? for multi-day activities, place?, sharedNotes?, privateNotes?, challenges text[]), `InteractionParticipant` (the mentee of a follow-up, or each activity participant), `Task` (assigneeId, createdById, interactionId?, title, dueOn? as a date, doneAt?).
- **Trackables:** `Trackable` (menteeId, createdById, templateId?, name, goal?, type COUNT | BOOLEAN | PERCENTAGE, cycle DAILY | WEEKLY | MONTHLY, higherIsBetter, target?, startsOn, weekday? (weekly only: 0 Sunday … 6 Saturday, where the log shows; not part of a template), archivedAt?) belongs to the mentee, so it survives a change of mentor; `TrackableEntry` (trackableId, periodStart = the cycle's first day, unique per trackable, value, note?, source MENTEE | MENTOR, interactionId?, authorId, needsHelp), `TrackableReply` (entryId, authorId, body), `TrackableTemplate` (authorId, name, goal?, type, cycle, higherIsBetter, target? as a suggestion, isPublic, removedAt?) — the library. A trackable that follows a template keeps copies of its name, goal, type, cycle and direction, which the template service updates in the same transaction as the template; removing a template sets its trackables' `templateId` to null. Cycle maths and stats in `libs/shared/src/lib/cycles.ts`: weeks start on Saturday; days are organisation-zone calendar days; the mentee may fill cycles that ended within the last 30 days. Trend (`trend.ts`): the average of the last N values against the N before (N = `trackables.trendWindow`); a change within `trackables.trendSteadyBand` of the scale (target, the earlier average, or 1) is steady; missed cycles count as 0 for done/not-done and are skipped otherwise; under two values is NEW.
- **Challenges:** `Challenge` (menteeId, createdById, interactionId? when raised in a follow-up, title, resolvedAt?, resolvedById?), `ChallengeComment` (challengeId, authorId, interactionId?, body).
- **Notes:** `Note` (mentorshipId, authorId, visibility SHARED | PRIVATE, body). An interaction's private notes are read in a separate query, only for its creator and admins; mentee notes are filtered by visibility in the `where`.
- **Groups:** `Group`, `GroupMembership` (role ADMIN | MODERATOR | MEMBER; one ADMIN per group), `GatheringSeries` (groupId, activityTypeId, weekday, time, place, startsOn, endsOn?), `Gathering` (occurrence; seriesId? for one-time activities, startsAt, cancelledAt?), `Rsvp`, `Attendance` (present, note).
- **Inbox:** `Notification` (userId, type, payload json, readAt?), `NotificationPreference` (userId, type, inApp, email), `Conversation` (kind DIRECT | GROUP | TEAM, groupId?), `ConversationMember` (lastReadAt), `Message`.
- **Other:** `FileObject` (key, mime, size), `AuditLog` (actorId, onBehalfOfId?, action, entity, entityId, diff json).

Trend and contact status are computed in `libs/shared` (pure functions, unit-tested) from readings and last-contact dates. The dashboard query returns the raw inputs.

- **Feed and dashboards** (`feed` module): `GET /feed?userId=` merges a member's done follow-ups and activities, their trackable entries and replies, newest first, with a `before` timestamp cursor; it carries counts, never notes. `GET /dashboard/mentor` (US-4.1) and `GET /dashboard/journey` (US-5.1) are built from the mentorship, plan and interaction services. What's waiting to be logged comes from each trackable's open cycles. Gatherings join the feed in step 8.

Gathering occurrences are materialised ahead by a daily job (next 8 weeks), so RSVPs and attendance attach to real rows.

## Jobs (pg-boss)

| Job                                     | When                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| `email.send`                            | Queued by the notifications service; retries with backoff     |
| `gatherings.materialise`                | Daily: create occurrences for the coming weeks                |
| `gatherings.rsvp-request` / `.reminder` | Scheduled per occurrence from settings lead times             |
| `contact.overdue-scan`                  | Daily: notify mentors of mentees crossing due/late thresholds |
| `trackables.cycle-due`                  | Daily: remind mentees of cycles waiting to be logged          |
| `auth.cleanup`                          | Hourly: expired codes and sessions                            |

## Realtime

`GET /api/events` is an SSE stream per signed-in user. Notification and message services publish to an in-process event bus. With more than one API instance, add Postgres `LISTEN/NOTIFY` as the fan-out; the stream contract stays the same. The web invalidates TanStack Query caches on events.

## Web

- `apps/web/src/routes/` with TanStack Router file-based routes. Route areas: `auth`, `mentor`, `journey`, `groups`, `admin`, `profile`, `inbox`, later `team`.
- App shell: sidebar with one section per role the user holds, sticky header (search, messages, notifications, avatar).
- `dir` and `lang` set on `<html>` from the active locale. Use only Tailwind logical utilities (`ms-`, `pe-`, `start-`, `text-start`); a lint rule forbids physical `ml-/mr-/left-/right-` classes.
- Dates are formatted through one helper in `libs/shared` using `Intl.DateTimeFormat` with `ca-islamic-umalqura` for Hijri, in the `Africa/Cairo` zone.
- Fonts: IBM Plex Sans Arabic, Inter, Space Grotesk for figures.

## Environments and configuration

- Local: `docker compose up` for Postgres, Mailpit and SeaweedFS (S3); `pnpm nx run-many -t serve -p api web`.
- Config is validated at boot with Zod: `DATABASE_URL`, `JWT_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` (first boot only), `SMTP_*`, `S3_*`, `APP_URL`, `ORG_TIMEZONE` (default `Africa/Cairo`).
- Railway: `api` runs `prisma migrate deploy` before start; `web` is a static build served with a proxy rule `/api/* → api`, so cookies stay same-site.

## CI (GitHub Actions)

On every PR: install with pnpm cache → `nx affected -t lint typecheck test build` → check that `openapi.json` and the generated client are up to date → api e2e against a Postgres service container → Playwright on the affected web app.

## Build order

1. Workspace scaffold, lint/format, CI, docker compose, Prisma baseline, config validation.
2. Auth (password + code), sessions, super admin bootstrap, app shell with i18n/RTL.
3. Users, moderators, manager field, settings, lookups, audit.
4. Mentorships, interactions (follow-ups, activities), tasks, notes.
5. Trackables (was development plans), entries, trend, replies; challenges.
6. Mentor dashboard, mentee profile, my journey, feed.
7. Notifications (in-app, email, preferences, SSE) and jobs.
8. Groups, gatherings, RSVP, attendance, manager-chain visibility.
9. Messages.
10. v2: team dashboard, act on behalf, manager messaging.
