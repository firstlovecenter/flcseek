# FLCSeek — Architecture

FLCSeek is a Next.js 15 (App Router) PWA for tracking new-convert discipleship.
Data lives in Postgres (Neon) and is accessed exclusively through **Prisma 7**
(`@prisma/adapter-neon`). Auth is stateless JWT (7-day httpOnly `auth_token`
cookie, with `Bearer` supported for API clients); passwords are bcrypt-hashed.

## Layering

Requests flow through explicit layers so concerns stay separated and route
handlers stay thin:

```
Browser (client pages, "use client")
  │  fetch via src/lib/api/client.ts (30s GET cache + in-flight dedupe)
  ▼
Route handler  src/app/api/**/route.ts
  │  withApiHandler: auth (cookie+Bearer) → Zod validation → error contract
  ▼
Service layer  src/lib/services/* (domain logic: analytics, badges, alerts, …)
  │
  ▼
Repository     src/lib/db/queries/* (the ONLY place that touches Prisma)
  │
  ▼
Prisma client  src/lib/prisma.ts ──► Neon Postgres
```

### Route handlers (`src/app/api/**`)
Keep handlers thin. Prefer `withApiHandler` (`src/lib/api/handler.ts`) which
centralizes:
- **Auth**: `getAuthUser` reads the httpOnly cookie first, then `Bearer`.
  Never parse `Authorization` by hand in a route.
- **Authorization**: pass `{ auth: { roles } | { minRole } }`.
- **Validation**: pass a Zod `schema`; the parsed value arrives as `ctx.body`.
- **Responses**: one contract via `src/lib/api/response.ts` —
  `{ success: true, data, meta? }` / `{ success: false, error: { code, message } }`.
  Use the `success` / `created` / `errors.*` helpers.

### Group scoping
Role-based data scoping has a single source of truth:
`resolveGroupScope(user, params)` in `src/lib/api/middleware.ts`. It returns
`{ groupId?, groupName? }` and is applied identically by people, attendance,
stats, and person-detail routes. Do not re-implement per-route scoping.

### Validation
Zod is the single validation source. Shared/server schemas live in
`src/lib/schemas/*` (e.g. `api.ts`) and are imported by both client forms and
API routes. The legacy hand-rolled `src/lib/api/validators.ts` is being phased
out in favor of Zod.

### Services (`src/lib/services`)
Domain/business logic (analytics, forecasting, badges, alerts, notifications,
risk scoring, exports). Services depend only on repositories — never on
`NextRequest`/`NextResponse`. `src/lib/services/index.ts` is the single import
surface.

### Repositories (`src/lib/db/queries`)
The only modules that import Prisma. They expose snake_case domain shapes for
API compatibility and own all query construction (filters, pagination,
batching). Route handlers and services never import `prisma` directly.

> Legacy note: `src/lib/neon.ts` is a deprecated raw-SQL pool retained **only**
> for `scripts/`. It is not part of the app runtime.

## Performance notes
- `people.findManyWithProgress` is hard-capped (`MAX_PROGRESS_ROWS`) so the
  eager progress+attendance load can never run unbounded.
- **`include=grid`** / `GET /api/groups/[id]/bundle` use `findManyForGrid`: only
  completed stage numbers + attendance counts (~10× smaller JSON than full
  progress objects). The group dashboard uses the bundle endpoint (one HTTP
  round-trip for milestones + people).
- Bulk writes are batched + de-duplicated in a single round trip
  (`attendance.createMany`, `people.createMany`, clone-previous-year) instead of
  per-row queries.
- The reports route code-splits its analytics dashboards via `next/dynamic` and
  only mounts a tab's content once it is selected; its data load runs three API
  calls in parallel (`people?include=grid`, milestones, attendance). Per-row/per-badge
  gauges use a CSS conic-gradient ring instead of a Recharts `PieChart` per item.
- Attendance and progress summary pages use `include=stats` (counts only).
- The API client uses tiered GET cache TTLs (milestones 5m, groups 2m, bundle 20s).
- Group-year resolution is centralized in the `useGroupYears` hook
  (`src/hooks/use-group-years.ts`).

## Module resolution
`@/*` resolves to `src/*` only (see `tsconfig.json`). All application code,
including contexts, lives under `src/`.

## Deferred / recommended next steps
- Migrate the remaining legacy superadmin routes onto `withApiHandler` and the
  unified response contract (kept on their bespoke shapes for now to avoid
  breaking their existing frontends).
- Move loose top-level feature components in `src/components/*` into
  `src/components/dashboards/` for consistency with `ui/`, `base/`, `shell/`,
  `group/`.
- Batch the background cron jobs (badge/alert recomputation) the same way the
  request-path bulk writes were batched.
