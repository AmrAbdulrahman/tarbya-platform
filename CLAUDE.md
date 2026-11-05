# Tarbya platform

A closed mentorship platform for one organisation: mentors and mentees, trackables measured per cycle with trends, challenges, groups with gatherings and attendance, and a management hierarchy separate from mentorship. Arabic/RTL by default, English/LTR supported.

## Read before working

- @docs/requirements/business-requirements.md — rules with `BR-…` ids and v1/v2 release tags
- @docs/requirements/user-stories.md — stories with `US-…` ids and acceptance criteria
- @docs/architecture.md — stack, workspace layout, auth, data model, build order
- `design/` — screen snapshots (`design/screens/*.dc.html`) and `design/DECISIONS.md`; read the screen a story names before building its UI

## Working rules

- Build v1 only unless told otherwise; keep v2 (management dashboard, acting on behalf, manager messaging) possible in the data model.
- Reference story and requirement ids in commit messages and PR descriptions.
- Roles are derived from relationships; never add a single "role" column.
- Private notes must be filtered out in the database query for anyone but the mentor and moderators.
- Use Tailwind logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`), never `ml-`/`mr-`/`left-`/`right-`.
- All user-facing strings go through i18next with both `ar` and `en` keys.
- Times are stored in UTC and shown in `Africa/Cairo`; format dates only through the shared date helper.
- After changing API DTOs, regenerate `apps/api/openapi.json` and `libs/api-client`.

## Workspace

| Project                              | Path          | Tag            |
| ------------------------------------ | ------------- | -------------- |
| web (React SPA)                      | `apps/web`    | `scope:web`    |
| api (NestJS)                         | `apps/api`    | `scope:api`    |
| web-e2e (Playwright), api-e2e (Jest) | `apps/*-e2e`  |                |
| ui, i18n, api-client                 | `libs/*`      | `scope:web`    |
| db (Prisma)                          | `libs/db`     | `scope:api`    |
| shared                               | `libs/shared` | `scope:shared` |

Web code may not import `scope:api` libs and vice versa (ESLint enforces it).

## Commands

Always run tasks through Nx with pnpm (`pnpm nx …`), not the underlying tools.

```bash
cp .env.example .env            # first time
docker compose up -d            # Postgres, Mailpit (http://localhost:8025), SeaweedFS (S3 on :9000, file browser http://localhost:8888/buckets/)
pnpm nx run db:migrate-deploy   # apply migrations
pnpm nx run db:seed             # default settings + super admin user
pnpm nx run-many -t serve -p api web   # api :3000 (/api/docs), web :4200
```

| Task                                        | Command                                         |
| ------------------------------------------- | ----------------------------------------------- |
| All checks                                  | `pnpm nx run-many -t lint typecheck test build` |
| Only what changed                           | `pnpm nx affected -t lint typecheck test build` |
| New migration                               | `pnpm nx run db:migrate-dev -- --name <name>`   |
| Regenerate Prisma client                    | `pnpm nx run db:prisma-generate`                |
| Regenerate OpenAPI spec + web client        | `pnpm nx run api-client:generate`               |
| Web e2e                                     | `pnpm nx e2e web-e2e`                           |
| API e2e (starts the api; needs DB, Mailpit) | `pnpm nx e2e api-e2e`                           |
| Format                                      | `pnpm nx format:write`                          |

## Gotchas

- `libs/db` generates the Prisma client as CommonJS (`moduleFormat = "cjs"`) because the api bundle is CommonJS.
- `apps/api/webpack.config.js` keeps npm packages external and bundles only `@tarbya/*` libs; don't remove `ApiBundlePlugin`.
- `apps/web-e2e/playwright.config.mts` must not import from `nx`/`@nx/*`: it crashes Node 22's ESM loader.
- `apps/api/openapi.json` and `libs/api-client/src/generated` are committed; CI fails if they're stale.
- Every non-GET request needs an `X-Requested-With` header (CSRF); the generated client sends it. Routes need a session unless marked `@Public()`.
- While the super admin impersonates someone, `auth.userId` is that user and `auth.impersonatorId` is the super admin. Routes that change sign-in details take `@NotWhileImpersonating()`. New authored records spread `...impersonation()` into their data so they show "X on behalf of Y".
- `nx serve api` writes webpack output into `apps/api/dist`, which the api typecheck also uses; if typecheck reports TS6305 while the dev server runs, delete `apps/api/dist/tsconfig.app.tsbuildinfo` and rerun.
- Admin-only routes take `@Requires('admin')` (super admin or moderator) or `@Requires('superAdmin')`. Sensitive changes go through `AuditService.record(…, tx)` inside the same transaction.
- The e2e suites write to the database in `.env` (your dev database) and clean up after themselves with `libs/db/prisma/e2e-cleanup.sql`. Test data must use `@tarbya.test` emails and `e2e `-prefixed lookup names, or it won't be removed. `pnpm nx run db:e2e-cleanup` runs the cleanup by hand.
- API errors are problem details with a stable `code` from `libs/shared/src/lib/errors.ts`; add a matching `errors.<code>` string in both locales.
- Notify through `NotificationsService.notify(userIds, type, payload, { actorId })`: it skips users who can't sign in and the actor, and applies each user's channel choices. A new type needs an entry in `libs/shared/src/lib/notifications.ts` (category, defaults, link), email copy in `apps/api/src/modules/notifications/notification-mail.ts`, and web text under `notifications.text` in both locales.
- Background jobs register with `JobsService.register(name, handler, cron?)` (pg-boss, crons in the organisation zone); `JOBS_ENABLED=false` turns the queue off and runs sent jobs inline.
- `routeTree.gen.ts` is generated by the TanStack Router Vite plugin on dev/build; commit it.
