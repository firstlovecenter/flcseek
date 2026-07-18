# FLCSeek — Church New Convert Tracking System

A performance-optimized Progressive Web App (PWA) for tracking new-convert
spiritual growth, milestone progression, and attendance across monthly groups.
Each church/site runs its own independent deployment (Netlify + Neon Postgres).

> This is the single project document. Setup, architecture, operations, and
> troubleshooting all live here. The only other doc is `DESIGN.md` — a
> reusable frontend design-system spec (typography, tokens, component
> conventions) for building sibling apps with the same look and feel.

---

## Features

- **Month-based organization** — converts are organized by registration month (January–December), one group per month per year
- **18-milestone progression** — customizable spiritual growth stages, with optional auto-completion rules (attendance count, time elapsed, previous milestone)
- **Attendance tracking** — Sunday attendance with a 26-week goal; the attendance milestone auto-completes at the goal
- **Role-based access control** — Super Admin, Lead Pastor, Overseer, Admin (month admin), Leader
- **Bulk registration** — Excel import for registering many converts at once
- **Analytics** — dashboards, cohort analysis, growth forecasting, risk scoring, achievement badges
- **PWA** — installable, offline-capable, with light/dark themes

### Roles & permissions

| Feature | Super Admin | Lead Pastor / Overseer | Admin | Leader |
|---|---|---|---|---|
| View all months | ✅ | ✅ | ❌ | ❌ |
| Manage assigned month | ✅ | ❌ | ✅ | ✅ (view) |
| Register converts | ✅ | ❌ | ✅ | ❌ |
| Mark milestones | ✅ | ❌ | ✅ | ❌ |
| Track attendance | ✅ | ✅ | ✅ | ✅ |
| Create users / edit milestones | ✅ | ❌ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ❌ | ❌ |
| Database management / bulk delete | ✅ | ❌ | ❌ | ❌ |

Leaders and admins are scoped to their **month name across all years**
(implemented in `resolveGroupScope` — the single source of truth for
role-based data scoping).

---

## Tech stack & architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4, Radix UI |
| API | Next.js route handlers (`src/app/api/*`) |
| Database | Neon Postgres via Prisma 7 (`@prisma/adapter-neon`) |
| Auth | JWT (httpOnly cookie) + DB-backed verification |
| Hosting | Netlify (free tier) — functions have a ~10s execution limit |
| Background jobs | Netlify Scheduled Functions (`netlify/functions/`) |

### Code layering

```
src/app/api/*/route.ts     → thin route handlers: auth + validation + delegation
src/lib/api/               → middleware (requireAuth/requireRole), response helpers, handler wrapper
src/lib/db/queries/*       → repository layer (all Prisma access for domain reads/writes)
src/lib/*                  → domain services (milestone auto-calc, rollover, notifications, …)
prisma/schema.prisma       → schema; prisma/migrations/*.sql → numbered SQL migrations
```

Route handlers must go through `requireAuth` / `requireRole` /
`getVerifiedAuthUser` (in `src/lib/api/middleware.ts`) — never raw token
decoding.

### Authentication model

- Login sets an **httpOnly cookie** (`auth_token`, 7 days). The JWT is an
  *identity assertion only*.
- Every authenticated request re-resolves the user from the database
  (`src/lib/auth-verify.ts`): role, group assignment, soft-delete status, and
  `users.token_version` are checked fresh. Bumping `token_version` (password
  change, role change) instantly revokes all outstanding tokens for that user.
- Edge middleware (`src/middleware.ts`) verifies JWT signatures with `jose`
  before a route function is even invoked.
- Rate limiting (`src/lib/rate-limit.ts`): security-critical endpoints (login,
  exports, bulk delete) are enforced through a **shared database counter**
  (`rate_limit_records`) so limits hold across serverless instances; the
  in-memory counter is only a per-instance backstop.

### Scheduled jobs (Netlify Scheduled Functions)

Schedules are declared **in-code** via the exported `config` in each function
file — `netlify.toml` intentionally has no schedule blocks.

| Function | Schedule | Purpose |
|---|---|---|
| `scheduled-analytics` | daily 02:00 UTC | milestone auto-completion (set-based; fixed query count regardless of convert volume) |
| `scheduled-cleanup` | Sun 03:00 UTC | delete notifications older than 30 days |
| `scheduled-yearly-rollover` | Jan 1 00:15 UTC | clone previous-year groups into the new year |

Jobs act as a non-loginable `system` user (auto-created; its stored password
is random bytes, not a bcrypt hash, so login is impossible). Override with
`SYSTEM_USER_ID` if you want a specific account.

---

## Quick start

### Prerequisites
- Node.js 18+ and npm
- A Neon database (free tier is fine)

### 1. Clone and install
```bash
git clone https://github.com/firstlovecenter/flcseek.git
cd flcseek
npm install --legacy-peer-deps
```

### 2. Configure environment
Create `.env.local` (see `.env.example` for the full list):

```env
NEON_DATABASE_URL=postgresql://username:password@host.neon.tech/database?sslmode=require
JWT_SECRET=<random 32+ char secret>
```

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Optional variables:

| Variable | Purpose |
|---|---|
| `SYSTEM_USER_ID` | User id automated jobs act as (auto-created `system` user if unset) |
| `ENABLE_DB_EDITOR` | Set exactly `true` to enable the in-app raw DB editor (off by default) |
| `DB_EDITOR_USERS` | Comma-separated usernames additionally allowed to use the DB editor |

### 3. Initialize the database
```bash
npm run db:setup
```
Creates the schema, indexes, seed milestones, month groups, and a default
superadmin (`superadmin` / `admin123` — **change this immediately**).

### 4. Run
```bash
npm run dev     # http://localhost:3000
```

---

## Database & migrations

- Schema of record: `prisma/schema.prisma` (core tables: `users`, `groups`,
  `milestones`, `new_converts`, `progress_records`, `attendance_records`, plus
  supporting tables for audit logs, notifications, saved searches, badges,
  alerts, report templates, and rate limits).
- Migrations are **numbered SQL files** in `prisma/migrations/`, applied
  manually per instance:
  ```bash
  psql $NEON_DATABASE_URL -f prisma/migrations/<file>.sql
  ```

> ⚠️ **Production databases:** always review a migration before applying it,
> and take a Neon branch or note a point-in-time-restore timestamp first.
> Migration `018_attendance_unique_and_token_version.sql` **must be applied
> before deploying** code that expects it (it adds `users.token_version` and
> the attendance uniqueness constraint, deduplicating existing attendance rows
> in the process — review duplicates with a `SELECT` first if in doubt).

Key invariants enforced by the schema:
- `UNIQUE (person_id, date_attended)` on `attendance_records` — a person can't
  be marked present twice for the same Sunday
- `UNIQUE (person_id, stage_number)` on `progress_records`
- `UNIQUE (name, year)` on `groups`

*Roadmap note:* the long-term plan is to adopt `prisma migrate` (tracked
migrations per database) and retire the hand-numbered files.

---

## Year rollover

On **January 1st at 00:15 UTC** each instance clones all active groups from
the previous year into the new year (same names, descriptions, leaders;
**converts are not migrated** — new-year groups start empty). Groups already
present in the current year are skipped, so the job is idempotent.

- Automatic: `netlify/functions/scheduled-yearly-rollover.ts`
- Manual: **Superadmin → Groups → "Clone <previous year> Groups"** (same
  idempotent service — running both is harmless)
- Verify: Superadmin → Activity Logs → `CLONE_GROUP` entries; or the function
  log in the Netlify dashboard

No external cron, GitHub Actions workflow, or long-lived token is involved.

---

## Multi-instance setup

Each church/site = one Netlify site + one Neon database, fully independent.
Per instance: create the database, set a **unique** `JWT_SECRET`, run
`npm run db:setup` (or apply migrations), deploy. Scheduled jobs ship with the
app and need no extra configuration.

---

## Deployment (Netlify)

1. Connect the repo to a Netlify site (build settings come from `netlify.toml`).
2. Set `NEON_DATABASE_URL` and `JWT_SECRET` in the site's environment variables.
3. Apply any pending SQL migrations to that instance's database **before**
   deploying code that depends on them.
4. Deploy. Security headers (CSP, HSTS, frame denial) are set in `netlify.toml`.

Free-tier constraints to keep in mind: ~10s function execution limit (keep
jobs set-based), no background functions, no paid add-ons (shared state such
as rate limiting uses the Neon database, not Redis).

---

## Development

```bash
npm run dev          # dev server
npm run build        # production build (runs prisma generate first)
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm test             # vitest run (unit tests in src/**/__tests__)
npm run test:watch   # vitest watch mode
npm run prisma:studio# browse the DB (careful on prod!)
```

### Tests & CI

Unit tests (Vitest) cover the security- and correctness-critical pure logic:
role hierarchy and group scoping, attendance date validation, milestone
auto-trigger conditions, and JWT/password handling. CI
(`.github/workflows/ci.yml`) runs typecheck + lint + tests on every push/PR to
`main`. Please keep new domain logic in pure, testable functions
(see `src/lib/milestone-auto-calc.ts` for the pattern).

---

## API overview

All endpoints live under `/api/*` and require the httpOnly session cookie
(or an `Authorization: Bearer` token). Responses follow
`{ success, data, error, meta }` (see `src/lib/api/response.ts`).

Main resource groups: `auth`, `people`, `groups`, `milestones`, `attendance`,
`progress`, `stats`, `export`, `notifications`, plus `superadmin/*`
(user/group/milestone management, analytics, activity logs, database tools).

Notable behaviors:
- Attendance can only be recorded for Sundays; non-superadmins only for the
  most recent Sunday (`src/lib/utils/attendance-validation.ts`)
- List endpoints cap `limit` at 500
- Login is rate-limited to 5 attempts / 15 min per IP (DB-enforced);
  exports 10/hour; bulk deletes 5/hour

---

## Troubleshooting

| Problem | Check |
|---|---|
| Can't connect to DB | `NEON_DATABASE_URL` includes `?sslmode=require`; Neon project isn't suspended |
| Login fails for everyone | `JWT_SECRET` set in the deploy environment; migration 018 applied (`users.token_version` must exist) |
| Login fails for one user | Their `token_version` was bumped (password/role change) — they must log in again |
| Build errors | `rm -rf .next && npm run build`; ensure `prisma generate` ran |
| Milestones not auto-completing | Netlify function log for `scheduled-analytics`; milestone's auto-trigger config is `enabled` |
| No new-year groups on Jan 1 | Function log for `scheduled-yearly-rollover`; use the manual Clone button as fallback |
| Slow queries | Verify indexes exist (`\d+ progress_records` etc.) — see migrations 013/015 |

---

## Security notes

- JWTs are held in an httpOnly cookie; the client never stores the token in
  `localStorage`
- All authorization state is re-checked against the DB per request (revocation
  via `users.token_version`)
- Brute-force, export, and bulk-delete limits are enforced through a shared DB
  counter, keyed by the Netlify-provided client IP
  (`x-nf-client-connection-ip`)
- The raw DB editor is disabled unless `ENABLE_DB_EDITOR=true`, restricted to
  DB-verified superadmins (optionally narrowed by `DB_EDITOR_USERS`), and
  fully audit-logged
- Every sensitive action (logins, registrations, deletions, DB edits, clones)
  is written to `activity_logs`
