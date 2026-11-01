# Tarbya

A closed mentorship platform: mentors and mentees, development plans with progress trends, groups with gatherings and attendance, and a management hierarchy. Arabic/RTL by default, English/LTR supported.

- Requirements and user stories: [docs/requirements](docs/requirements)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Design snapshot: [design](design)
- Commands and conventions: [CLAUDE.md](CLAUDE.md)

## Quick start

Needs Node 22, pnpm 10 and Docker.

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm nx run db:migrate-deploy
pnpm nx run db:seed
pnpm nx run-many -t serve -p api web
```

Open http://localhost:4200. API docs are at http://localhost:3000/api/docs.
