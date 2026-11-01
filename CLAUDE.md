# Tarbya platform

A closed mentorship platform for one organisation: mentors and mentees, development plans with trends, groups with gatherings and attendance, and a management hierarchy separate from mentorship. Arabic/RTL by default, English/LTR supported.

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

## Commands

Filled in once the workspace is scaffolded.
