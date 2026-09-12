# FLC Seek → Synago Member Graph Integration

Register graduated converts into the First Love member directory, and surface the
church leadership structure for contact.

**Branch:** `feat/synago-member-graph-integration`
**Status:** planning — not yet implemented

---

## 1. Context

FLC Seek tracks new converts through 18 discipleship milestones in its own Postgres
(Neon) database. The First Love member directory lives elsewhere: a Neo4j graph behind
an Apollo GraphQL API, owned by the `fl-admin-portal` repo.

This work connects the two:

1. **Write** — once a convert completes their milestones, register them into the member
   graph as a real `Member`.
2. **Read** — surface the church leadership structure so leaders can look up and call
   the right person.

### The two systems

| | FLC Seek | Synago member graph |
| --- | --- | --- |
| Store | Postgres (Neon) via Prisma | Neo4j 5 |
| API | Next.js route handlers | Apollo Server 4 + `@neo4j/graphql` v7 |
| Unit of grouping | `Group` — a month cohort ("January 2025") | `Bacenta` — a church cell |
| Identity | local `users` table, bcrypt + JWT | FL auth service, HS256 JWT |

`Group` and `Bacenta` are **not** the same concept and do not map onto each other.

---

## 2. Verified API contract

Everything below was confirmed against the live dev environment, not inferred.

### Endpoints

| Purpose | URL |
| --- | --- |
| Graph (prod) | `https://api-synago.firstlovecenter.com/graphql` |
| Graph (dev) | `https://dev-api-synago.firstlovecenter.com/graphql` |
| Auth | `https://rgldisl2bxl3l2upaauxodtrhy0uxkot.lambda-url.eu-west-2.on.aws` |

- Prod graph has **introspection disabled**; dev has it **enabled**. Generate typed
  clients from dev.
- Both are Lambda-backed. Expect **cold starts up to ~2 minutes** after idle — set
  generous timeouts in any tooling.
- Auth service routes live at `/auth/*` on the function-URL root: `/auth/login`,
  `/auth/verify`, `/auth/refresh-token`, `/auth/signup`, `/auth/setup-password`,
  `/auth/reset-password`, `/auth/forgot-password`, `/auth/logout`, `/auth/delete-account`.

> **Path gotcha.** `fl-admin-portal`'s `VITE_AUTH_API_URL` ends in `/auth`, and its
> client appends `/auth/login`, producing `/auth/auth/login` — which **404s**. The
> working path is `/auth/login`. Do not copy that base-URL convention.

### Authentication

`POST /auth/login` with `{ email, password }` returns:

```json
{
  "message": "...",
  "tokens": { "accessToken": "<jwt>" },
  "user": { "id", "email", "firstName", "lastName", "roles": [] },
  "membership": {
    "stream":       { "id", "name" },
    "council":      { "id", "name" },
    "governorship": { "id", "name" },
    "bacenta":      { "id", "name" }
  }
}
```

`membership` is undocumented in the portal's client types but returns the caller's
church placement directly — no graph round-trip needed.

Decoded access-token claims:

| Claim | Value |
| --- | --- |
| `userId`, `email`, `firstName`, `lastName` | user identity |
| `roles` | e.g. `["leaderBacenta", "fishers"]` |
| `churchScopes` | e.g. `{ "leadsBacentaOf": { "id", "name" } }` |
| `iss` / `aud` | `fl-auth-service` / `fl-admin-portal` |
| `exp` | **30 minutes** after `iat` |
| alg | HS256 |

Refresh token is set as a cookie:

```
fl_refresh_token=...; Path=/auth; Max-Age=604800;
HttpOnly; Secure; SameSite=Strict
```

`SameSite=Strict` is a **browser**-enforced policy. A server-side HTTP client may store
and replay this cookie freely, so unattended refresh from a Next.js route handler is
viable. 7-day lifetime.

> **Audience caveat.** The graph rejects mismatched `aud` when configured
> (`api/src/resolvers/utils/verify-jwt.ts`). Tokens currently carry
> `aud: "fl-admin-portal"`. FLC Seek reusing that works but silently conflates two
> clients — request a distinct audience from the portal team.

### Church hierarchy

Seven levels, all implementing a common `Church` interface, linked by `[:HAS]`:

```
Denomination → Oversight → Campus → Stream → Council → Governorship → Bacenta
```

Members attach at the bottom: `(:Member)-[:BELONGS_TO]->(:Bacenta)`.
`Basonta` is an orthogonal ministry axis (choir, ushers).

Leadership edges run Member → church level: `LEADS`, `DEPUTY_LEADS`, `IS_ADMIN_FOR`,
`DOES_ARRIVALS_FOR`.

### `CreateMember`

The only supported write path. All auto-generated Member CRUD is disabled
(`@mutation(operations: [])`) precisely to force writes through this audited mutation.

```graphql
CreateMember(
  firstName: String!      middleName: String     lastName: String!
  email: String           phoneNumber: String!   whatsappNumber: String!
  dob: String!            maritalStatus: String! gender: String!
  occupation: String      visitationArea: String!
  bacenta: String!        basonta: String        pictureUrl: String!
): Member!
```

Signature verified live against dev introspection — matches the repo SDL exactly.

Server-side behaviour worth relying on (`directory-resolvers.ts:41`):

1. Requires a bacenta-level-or-above leader/admin role.
2. `assertChurchScope` — the destination bacenta must be within the caller's scope.
3. Matches **inactive** members on email/WhatsApp and **reactivates** rather than
   duplicating.
4. Throws named `DuplicateEmail` / `DuplicateWhatsappNumber` on active collisions.
5. Writes a `HistoryLog` attributed to the calling user.

---

## 3. Decisions

| Question | Decision |
| --- | --- |
| When does registration happen? | Milestone completion makes a convert **eligible**; a human completes it |
| Who performs it? | **Group leaders and admins** (`leader` and above) |
| Which bacenta? | **One fixed bacenta** for all FLC Seek registrations — id TBC |
| What credential? | **Service account** scoped to that single bacenta |

### Why a human step

Registration was initially specified as fully automatic. It became human-triggered
because:

- **It is irreversible.** FLC Seek cannot undo a `CreateMember`; the graph offers only
  `MakeMemberInactive`. An automated write turns a local data-quality problem into a
  permanent directory record.
- **Duplicates need judgement.** Converts often already exist in the graph. A background
  job can only fail or guess; a leader can decide "same person, link them."
- **A photo is required.** `pictureUrl: String!`, and FLC Seek stores no photo. Capturing
  one needs the convert present — as do date of birth and marital status.

### Why a service account rather than per-user tokens

With one fixed bacenta, per-user tokens would require every FLC Seek leader to hold a
servant edge on that specific bacenta in the graph — which will not be true. A single
service member holding `leaderBacenta` on exactly that bacenta is least-privilege and
gives clean provenance ("registered via FLC Seek").

---

## 4. Field mapping

FLC Seek's intake form (`src/lib/schemas/register-convert.ts`) already **requires** most
of what `CreateMember` needs.

| `CreateMember` | FLC Seek source | Status |
| --- | --- | --- |
| `firstName!` / `lastName!` | `first_name` / `last_name` — required | ready |
| `phoneNumber!` | `phone_number` — required | ready |
| `gender!` | `gender` — `z.enum(['Male','Female'])` | **exact match**, no mapping |
| `visitationArea!` | `residential_location` — required | ready |
| `occupation` | `occupation_type` — `Worker\|Student\|Unemployed` | loose map |
| `bacenta!` | `SYNAGO_BACENTA_ID` config | ready |
| `email`, `middleName`, `basonta` | — | optional, omit |
| `whatsappNumber!` | — | **collect** |
| `maritalStatus!` | — | **collect** |
| `pictureUrl!` | — | **collect** |
| `dob!` | `date_of_birth` | **incompatible — see below** |

### The date-of-birth problem

`RegisterConvertForm.tsx:142` collects **day and month only**:

> `Date of Birth (DD-MM)` — *"Pick the day and month (year is not stored)."* e.g. `15-03`

But `createMember` runs `MERGE (date:TimeGraph {date: date($dob)})`, and Neo4j's `date()`
requires full ISO `YYYY-MM-DD`. `"15-03"` will not parse.

The year was deliberately not stored and cannot be reconstructed, so **birth year must be
collected at graduation** and combined with the stored `DD-MM`.

### Accepted enum values

The graph resolves these by node lookup, not by enum type:

| Field | Accepted values |
| --- | --- |
| `gender` | `Male`, `Female` |
| `maritalStatus` | `Single`, `Married` |

There is no `Divorced` or `Widowed`. Anything outside these sets matches no node.

---

## 5. Architecture

```
Leader opens the eligible worklist
  → selects a convert, opens the graduation form
  → completes: WhatsApp, marital status, birth year, photo
  → route handler:
        requireMinRole(LEADER) + assertPersonAccess
        validate all 10 required fields non-null
        persist the collected fields locally          ← first, always
        CreateMember via service-account token
        assert a real member.id came back
        store synago_member_id, status = registered
```

A single synchronous mutation, well inside Netlify's 10s function limit. No background
job or queue infrastructure required.

---

## 6. Phases

### Phase 1 — Service credential and token manager

`src/lib/synago/token.ts`

- Log in once with service-account credentials; cache `accessToken` in module scope.
- Token lives 30 minutes — refresh at ~25 via `/auth/refresh-token`, replaying the stored
  `fl_refresh_token` cookie.
- Fail closed: never fall back to an unauthenticated call.

Environment:

```
SYNAGO_AUTH_URL
SYNAGO_GRAPHQL_URL
SYNAGO_SERVICE_EMAIL
SYNAGO_SERVICE_PASSWORD
SYNAGO_BACENTA_ID
```

Verify with `myAuthority` that `servantTrees` contains exactly the one intended bacenta
and nothing else.

### Phase 2 — Schema and eligibility

Migration on `new_converts`:

```
whatsapp_number    text
marital_status     text
picture_url        text
birth_year         integer
synago_member_id   text
synago_status      text default 'not_eligible'
synago_synced_at   timestamptz
synago_last_error  text
```

`synago_status`: `not_eligible → eligible → registered`, plus `failed`.

Eligibility derives from `ProgressRecord` completion.
**Open:** which milestones gate it — all 18, all *active*, or a named subset?

### Phase 3 — Graduation form

Four inputs:

1. **WhatsApp number** — prefilled from `phone_number` with a "same as phone?" checkbox.
2. **Marital status** — `Single` / `Married` only.
3. **Birth year** — combined with stored `DD-MM` into `YYYY-MM-DD`.
4. **Photo** — browser → S3 direct via the graph's `generatePresignedUrl` mutation.
   Never route image bytes through a Netlify function.

Plus a **completeness gate**: re-verify `first_name`, `last_name`, `phone_number`,
`gender`, `date_of_birth`, `residential_location` are non-null and render them editable
if not. Legacy and bulk-imported converts predate the current intake validation and may
carry nulls despite the schema.

### Phase 4 — The push

- `CreateMember` with `bacenta: SYNAGO_BACENTA_ID`.
- **Assert a real `member.id`.** Treat null/empty as failure — never record
  `synago_member_id` without one.
- Catch `DuplicateEmail` / `DuplicateWhatsappNumber` **by error name** and offer
  "link to existing member", storing the existing id.
- On failure: `synago_status = 'failed'`, record the error, keep the collected data,
  stay retryable.

### Phase 5 — Eligible worklist

A queue view with a count badge, scoped via `isGroupScopedRole`. Without visible
pressure, eligible converts silently accumulate — this is the main failure mode of
making the step manual.

### Phase 6 — Leadership directory *(independent, read-only)*

Ships any time; no write risk. `myAuthority` on boot returns `servantTrees` (per-edge
authority) and `allowedChurchIds` (the spine the user may see), then per-level queries
render the org chart with `tel:` and `wa.me` links.

```graphql
{
  bacentas(where: { id_EQ: $id }) {
    name
    leader { id firstName lastName currentTitle phoneNumber whatsappNumber pictureUrl }
  }
}
```

> Use `firstName lastName currentTitle` — **not `nameWithTitle`**, which throws
> `Expected parameter(s): id` when reached through a relationship.

---

## 7. Risks

### Duplicate `Gender` / `MaritalStatus` nodes — blocking, verify before launch

Dev has **three** of each, not two:

```
genders:         Male, Female, Male
maritalStatuses: Single, Married, Single
```

`createMember` uses an unqualified `MATCH (gender:Gender {gender: $gender})`. For `Male`
or `Single` that matches **two** nodes, multiplying Cypher rows and attaching duplicate
`HAS_GENDER` / `HAS_MARITAL_STATUS` relationships. Since `Member.gender` is
single-valued, reads then return an arbitrary one.

`Female` and `Married` are unaffected — but **Male + Single is the most common
new-convert profile**.

**Action:** check prod before launch. If prod is also duplicated, it must be deduped in
the graph by the portal team. Do not work around this in FLC Seek.

### Registration is one-way

FLC Seek cannot undo a `CreateMember`. This is the core argument for the human confirm
step and for the completeness gate.

### Cold starts

Both Lambdas can take ~2 minutes to wake. Netlify functions cap at 10s. A cold graph
call **will** exceed that. Mitigate with a warm-up ping before the push, a clear retry
path, or accept an occasional first-attempt failure that the retry resolves.

### Prod schema drift

Prod introspection is disabled, so the contract was read from dev plus the repo SDL.
Dev matched the SDL exactly, but confirm the deployed prod version before go-live.

---

## 8. Open questions

1. **Which milestones gate eligibility** — all 18, all active, or a subset?
2. **The bacenta id** — to be supplied.
3. **Service-account provisioning** — who creates the member and grants `leaderBacenta`
   on that bacenta?
4. **Distinct `aud`** — will the portal team register one for FLC Seek?
