# City Church Group (CCG) API

The backend contract for the CCG app. The CCG app lives in the same repo as Seek and will replace it over time. The two apps share only the `users` table and the sign-in.

- Base path: `/api/ccg`
- Code: `src/lib/ccg/` (engine, services) and `src/app/api/ccg/` (routes)
- Schema: `prisma/migrations/020_ccg_app.sql`

## Conventions

- **Auth.** Sign in with `POST /api/auth/login`, the same as Seek. After that, the `auth_token` cookie (or a Bearer token) authenticates every call.
  - A user can use CCG if they are a **Seek superadmin** (full access) or hold at least one current CCG role assignment.
  - `GET /api/auth/me` and the login response include `ccg_access: true | undefined`.
- **Envelope.** Successful responses look like `{ success: true, data, meta? }`. Errors look like `{ success: false, error: { code, message, details? } }`.

  | Code | HTTP status | When |
  |---|---|---|
  | `UNAUTHORIZED` | 401 | Not signed in |
  | `FORBIDDEN` | 403 | No permission for this unit or action |
  | `VALIDATION_ERROR` | 400 | `details` holds zod `fieldErrors`, or `details.answers` holds per-question errors |
  | `NOT_FOUND` | 404 | |
  | `CONFLICT` | 409 | e.g. the CCF filled up, or a duplicate code |
  | `RATE_LIMITED` | 429 | Public forms |

- **Formats.** Field names are snake_case. Dates are `YYYY-MM-DD`, times are 24-hour `HH:MM` (`7:00 PM` is accepted on input), and IDs are UUIDs.
- **Lists.** Lists accept `limit` (default 50, maximum 200) and `offset`. `meta` returns `{ total, limit, offset, hasMore }`.
- **Answers.** Answers are keyed by **question key**:
  - `single`: an option key
  - `multi`: an array of option keys
  - `scale5`: a number from 1 to 5
  - `text`: a string

  Sending `null`, `""` or `[]` clears an answer.

## Structure and permissions

**Structure:** council → **CCG** (City Church Group) → **CCF** (City Church Family). Members belong to one CCF. Converts are placed into a CCF, and its CCG follows.

**Roles** are rows in `ccg_roles`, each with a level and a set of permissions. Assigning a role gives a user that role over one unit. A grant covers everything below that unit.

| Role | Level | Permissions |
|---|---|---|
| Seek superadmin | global (implicit) | all |
| `ccg_admin` CCG Admin | global | all |
| `sheep_seeker` Sheep Seeker | stream | people.view/manage, links.intake, placements.view/approve, attendance.mark, milestones.update, checkins.record, reports.view. Registers converts into their stream and handles their mapping. |
| `overseer` Overseer | council | people.view, placements.view, attendance.mark, milestones.update, checkins.record, activities.record, reports.view |
| `ccg_governor` City Church Governor | CCG | units.edit, people.view/manage, members.confirm, links.manage, placements.view, attendance.mark, milestones.update, checkins.record, activities.record, reports.view |
| `ccf_coordinator` City Church Family Coordinator | CCF | people.view/manage, members.confirm, links.manage, placements.view, attendance.mark, milestones.update, checkins.record, reports.view |

**Permissions:**
- `structure.manage`, `units.edit`
- `people.view`, `people.manage`, `members.confirm`
- `links.manage`, `links.intake`
- `placements.view`, `placements.approve`
- `milestones.update`, `checkins.record`, `attendance.mark`, `activities.record`
- `reports.view`
- `settings.manage`, `roles.manage`

Routes always check a permission against the unit concerned, never a role name. `GET /me` returns what the current user holds.

## Statuses

- **Member:** `pending` (self-registered, not yet counted) → `active` or `inactive`. Only active members shape their CCF's profile.
- **Convert:** `new` → `proposed` → `placed` → `integrated`. A convert can also be `needs_info` or `inactive`.
- **Placement:**
  - `proposed` → `active` (decision `approved`, or `remapped` with a reason) → `ended`
  - `proposed` → `held` → `active` (by remapping)
  - An open proposal becomes `superseded` when the convert is matched again.
- **Milestone state** (worked out, never stored): `done`, `overdue`, `due_soon` (7 days or less), `upcoming` or `no_deadline`. It counts from the approval date plus `target_days`.

## How matching works

1. A convert is registered: by staff, through an intake link, or by updating their answers or core fields while waiting.
2. The engine scores every CCF straight away. The scores feed the approval queue in real time.
3. The best eligible CCF gets a `proposed` placement.
4. If no CCF is eligible, the placement is `held` and the convert becomes `needs_info`.

A CCF is **ineligible** when:
- it is full;
- its remaining seats are held by other open proposals (`reserved`);
- it or its CCG is not active;
- the ages don't fit: a convert under 18 can only go into a `youth` CCG, and an adult never can.

The **factor scores** (0–100, or `null` when there is no data, in which case the factor is left out and the other weights are rescaled):
- Question-driven factors:
  - `interests`: shared options
  - `friendship`: preference signals
  - `social`: distance on the scale questions
  - `availability`: the CCF's meeting slot compared with when the convert is free
  - `profession`: someone in the CCF gave the same answer
- Factors from core fields:
  - `age`: the average age gap to the members
  - `location`: no data since zones were removed, so it is left out and the other weights are renormalised
  - `connection`: the convert already knows a member of this CCF

A small CCF's profile is blended with its CCG's profile (`config.smoothing`).

## Endpoints

### Account and overview

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/me` | any CCG user | `{ user, is_superadmin, roles[{role, unit}], permissions, global_permissions }` |
| GET | `/dashboard` | reports.view | Figures for the viewer's units, listed below. |

`/dashboard` returns:
- `units`: `{ active_ccfs, open_spaces, capacity, health }`
- `queue`: `{ proposed, held, oldest_proposal_days }`
- `converts_waiting`, `members_pending_confirmation`
- `placements`: `{ active, milestones_overdue, follow_ups, approved, remapped, remap_rate }`
- `milestones[]`: `{ stage_number, short_name, done, overdue, due_soon, upcoming, no_deadline }`

### Groups

Streams, councils, CCGs and CCFs are "groups" (Synago calls them churches). Each group has its own page in the app at `/ccg/groups/[type]/[id]`, with separate add and edit pages.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/groups` | any (filtered to scope) | The streams the viewer can see: `{ type:'stream', items[{ id, code, name, status, members, placed, leader }] }` |
| GET | `/groups/[type]/[id]?history=5` | people.view on the group | `{ unit, breadcrumb[], leaders[], role_holders[], stats, children{type, items[]}, history[] }`. `type` is stream, council, ccg or ccf. `stats`: members, pending_members, placed_converts, awaiting_approval, graduated, milestones_overdue, open_places (CCF only), ccf_count. |

Create and edit each level through its own collection:

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/councils` | any | Includes `ccg_count`. |
| POST | `/councils` | structure.manage | `{ code, name, status?, notes? }` |
| GET / PATCH / DELETE | `/councils/[id]` | any / structure.manage | GET returns the council's CCGs. DELETE requires it to have no CCGs. |
| GET | `/ccgs?council_id=` | any (filtered to scope) | Includes `ccf_count`. |
| POST | `/ccgs` | structure.manage | `{ code, name, council_id?, leader?, audience: adult\|youth, status?, notes? }` |
| GET | `/ccgs/[id]` | people.view on the CCG | The CCG, its combined `profile`, and `ccfs[]` each with its `profile`. |
| PATCH / DELETE | `/ccgs/[id]` | structure.manage | DELETE requires it to have no CCFs. |
| GET | `/ccfs?ccg_id=&council_id=&with_profile=1` | any (filtered to scope) | |
| POST | `/ccfs` | structure.manage | `{ ccg_id, code, name, capacity, leader?, meeting_day?, meeting_time?, meeting_location?, meeting_frequency?, status?, notes? }` |
| GET | `/ccfs/[id]` | people.view on the CCF | `ccf`, `profile`, `members[]`, `placed_converts[]`, `incoming_proposals[]` |
| PATCH | `/ccfs/[id]` | structure.manage, or units.edit for details only | With units.edit you can change only name, meeting details, capacity and notes. Capacity can't go below the number of people already in the CCF. |
| DELETE | `/ccfs/[id]` | structure.manage | Must be empty. Ends its role assignments and revokes its links. |

`leader` is `{ person_id }` (a member) or `null` to clear it, and needs roles.manage. A leader without a login is sent an invitation; the response includes `leader_invite`.

A **CCF profile** contains:
- `member_count`, `occupied`, `reserved`, `available_spaces`
- `capacity_status`: `below_minimum`, `healthy`, `near_capacity` or `full`
- `health`: `critical`, `needs_attention` or `healthy`
- `age{source,median,min,max}`, `gender_mix`, `meeting_slot`, `social_mean`
- `matching_profile[]`: blended with the CCG; this is what the matcher uses
- `own_profile[]`: this CCF's members only

Each profile entry is either `{ question, prompt, kind:'choice', respondents, top:[{key,label,share}] }` or `{ …, kind:'scale', mean }`.

### Question bank

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/questions?include_inactive=1` | any | `questions[]` with options, plus `methods_for_type` and `signal_types`. |
| POST | `/questions` | settings.manage | The question with `options[]`; rules below. |
| GET / PATCH | `/questions/[id]` | any / settings.manage | The key and type are fixed. Deactivate a question rather than delete it. |
| POST | `/questions/[id]/options` | settings.manage | `{ key, label, catch_all?, signal?, sort_order?, active? }` |
| PATCH | `/questions/[id]/options/[optionId]` | settings.manage | The key is fixed. Relabel or deactivate as needed. |

Fields and rules:
- **Question fields:** `{ key, prompt, help?, section?, type: single\|multi\|scale5\|text, max_choices?, audience: member\|convert\|both, required?, factor, method, weight?, sort_order?, active?, options[] }`
- **Which method suits which type** (`methods_for_type`):
  - `single`: `same_answer`, `share`
  - `multi`: `share`, `meeting_slot`, `preference`
  - `scale5`: `distance`
  - `text`: `none`
- **Meeting-slot options** use keys such as `weekday_evenings` or `saturday_mornings`.
- **Preference option signals.** Every option on a `preference` question needs a `signal`, and the server checks that its references exist. The six types:
  - `{type:'option_share', refs:['questionKey:optionKey', …]}`
  - `{type:'trait', questions:[…], direction:'high'|'low'}`
  - `{type:'age'}`
  - `{type:'similar', factor:'interests'}`
  - `{type:'same_answer', question}`
  - `{type:'neutral'}`: not scored

### People

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/people?kind=&status=&ccf_id=&ccg_id=&search=&duplicates=1` | people.view | Filtered to scope. Converts are visible through their placement or proposal, or through the stream that registered them (Sheep Seekers). Church-wide converts not yet placed are visible to global viewers only. |
| POST | `/people` | people.manage | Registers a member or convert; request and response below. |
| GET | `/people/[id]` | people.view | `person` (with `answers`, `placement`, `proposal`) and `placements[]` history. |
| PATCH | `/people/[id]` | people.manage | Changes core fields and/or `answers`; details below. |
| DELETE | `/people/[id]` | people.manage | Soft delete. Ends the person's placements. |
| POST | `/people/[id]/confirm` | members.confirm | Moves a member from `pending` to `active`. |
| POST | `/people/[id]/transfer` | people.manage on the person and on the new CCF | `{ ccf_id, reason }`. Moves a member, or a placed convert, to another CCF (below). |
| POST | `/people/[id]/invite` | roles.manage (global) | Emails a member who holds a role a new link to set their password. Any earlier link stops working. |
| DELETE | `/people/[id]/login` | roles.manage (global) | Unlinks a member's login. Refused while they hold any role. |
| GET | `/people/[id]/match[?live=1]` | placements.view (global, or on the convert's stream) | The latest stored run (top, eligible and ineligible with factor scores and reasons). `live=1` scores now without saving. |
| POST | `/people/[id]/match` | placements.approve (global, or on the convert's stream) | Re-matches now and replaces the open proposal. |

**Streams and converts.** A convert carries `stream_id`, the stream that registered them. They are matched **only against CCFs in that stream**, so its Sheep Seekers can approve the proposal. If the stream has no CCFs, the convert is held. A convert with no stream is church-wide. Registering a convert needs people.manage globally, or on the stream (a Sheep Seeker with one stream gets it filled in automatically). Changing a convert's stream needs rights on the new stream, and re-matches them. Rescoring by a Sheep Seeker covers only their streams' converts.

**`POST /people` request:**
- `kind`, `first_name`, `middle_name?`, `last_name`, `phone?` (the staff form requires it for members), `email?`, `gender?`, `date_of_birth?`, `landmark?`, `notes?`, `ref_code?`
- `full_name` in responses is built from the three name parts.
- Members: `ccf_id`
- Converts: `conversion_date?`, `existing_connection_member_id?`, `existing_connection_note?`
- `answers{}`

**`POST /people` response:** `{ id, possible_duplicate_of, proposal: {placement_id, status, ccf_id, hold_reason} }`. A convert is matched straight away.

**`PATCH /people/[id]`:**
- `status` accepts `active` or `inactive` for members, and `inactive` or `new` (to reopen) for converts.
- Changing a waiting convert's answers, date of birth or connection re-matches them, and the response includes the new `proposal`.
- Moving a member to another CCF needs people.manage on both CCFs.

Phone numbers are stored in normalised form: `0XXXXXXXXX` becomes `233XXXXXXXXX`. A phone number that is already in use sets `possible_duplicate_of`; records are never merged automatically.

### Placements: the approval queue

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/placements?status=proposed\|held\|active\|ended\|superseded&ccf_id=&ccg_id=` | placements.view | The queue is `status=proposed`, oldest first. Item fields below. |
| GET | `/placements/[id]` | placements.view | |
| POST | `/placements/[id]/approve` | placements.approve | Body `{ override_reason? }`. Details below. |
| POST | `/placements/bulk-approve` | placements.approve | `{ placement_ids[] }` returns `{ approved, failed, results[{id, ok, error?, code?}] }`. |
| POST | `/placements/[id]/remap` | placements.approve (on the target CCF) | `{ ccf_id, reason }`. Works on `proposed` or `held` placements. |
| POST | `/placements/[id]/hold` | placements.approve | `{ reason }`. The convert becomes `needs_info`. |
| POST | `/placements/rescore` | placements.approve (global) | `{ person_ids? }` re-matches every waiting convert and returns `{ rescored, proposed, held }`. |
| POST | `/placements/[id]/end` | people.manage | `{ reason, reopen? }`. With `reopen: true` the convert is matched again straight away. |
| POST | `/placements/[id]/integrate` | milestones.update | Sets the convert to `integrated`. The placement stays active. |
| POST | `/placements/[id]/make-member` | people.manage | The convert becomes an active member of the CCF. |

**Queue item fields:**
- `person{…, possible_duplicate}`, `proposed_ccf`, `proposed_score`, `waiting_days`
- `match{ warnings, proposed{factors, reasons, cautions}, alternatives[#2, #3] }`

**Approving:**
- Approval locks the CCF, so two approvals can never take its last seat.
- If the CCF filled up after the proposal was made, approval returns `409 CONFLICT` with `details.reason = 'ccf_full'`. Rescore to get a new proposal.
- Placing someone over capacity needs `config.allowFullOverride` to be on and an `override_reason`.

### Milestones, attendance and check-ins

The milestones come from the CCG Manual (migration 022) and are stored in the database, as in Seek. Each milestone has a `kind`:
- `manual`: ticked by a leader. Water baptism, Holy Ghost baptism, first and second visitation.
- `attendance`: completes itself when marked attendance at `attendance_event` reaches `attendance_target`. 10 Sundays, 10 online fellowships, 5 in-person fellowships.
- `checklist`: completes itself when every active item is ticked. Seeing and Hearing (20 items), and the introduction to the Overseer (4 items).

**The assessment year.** Each convert is assessed for `config.assessmentDays` (365 by default) from the approval of their placement, and every milestone falls due within that year. `assessment` on each progress row is `{ ends_on, days_left, state }`, where `state` is `in_progress`, `complete` or `ended_incomplete`. The dashboard counts active placements in each state under `placements.assessments`.

**Graduation.** When a convert reaches every active milestone, they become an active **member** of their CCF automatically. Their placement ends with `outcome: 'graduated'`. The responses from `PUT /placements/[id]/progress` and `PUT /placements/[id]/checklist` include `graduated: true`, and `PUT /attendance` lists the graduates in `graduated[]`. Placements also record `outcome: 'made_member'` (made a member early, by hand) or `'ended'`.

**Transfers.** Members and placed converts can be moved to another CCF, the smallest unit anyone belongs to; moving to another CCG means choosing one of its CCFs. The move is checked like an approval: capacity, the age rule, and the CCF and CCG being active. A convert keeps their placement, milestones and assessment year. If the new CCF is in another stream, a convert who has a stream moves to that stream too. Converts still awaiting placement are moved with *Place elsewhere* on the approvals screen instead. Every move is recorded (`transfers[]` on `GET /people/[id]`). Changing a member's `ccf_id` through PATCH is refused, so that every move goes through transfer.

**Every role is held by a member.** Roles are given to an active member (`person_id`), never to a bare login. The first time a member gets a role:
1. A login is created with their **email** as the sign-in name, and no usable password. If the email is missing, the request is refused with `reason: 'email_required'`. If a login (for example a Seek account) already uses that email, it is linked instead.
2. They are emailed a one-time link, valid for 7 days, to `/welcome/[token]`, where they choose their own password. Nobody sets a password for someone else.

Email goes through Resend and needs `RESEND_API_KEY` and `CCG_EMAIL_FROM`. Until those are set, the response's `invite` has `sent: false` and a `link` for the admin to pass on privately. The Seek superadmin has full access without any role, so a new system can still be set up.

Auto-completed milestones are stored as progress records with `source: 'auto'`. They are re-synced whenever attendance, a checklist item, or an attendance target changes, and when a placement is approved or remapped. Attendance is kept per person, so a remapped convert keeps their count. Each milestone carries the manual's `guidance`.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/progress?ccf_id=&ccg_id=&overdue=1` | placements.view | The grid; row fields below. |
| GET / PUT | `/placements/[id]/progress` | placements.view / milestones.update | GET includes checklist items and the milestones with guidance. PUT is for **manual** milestones only. |
| PUT | `/placements/[id]/checklist` | milestones.update | `{ item_id, done, date_completed? }` |
| GET | `/attendance?ccf_id=&event_type=&date=` | attendance.mark | The CCF's register: placed converts, `present`, and their running `total`. |
| PUT | `/attendance` | attendance.mark | `{ ccf_id, event_type, event_date, entries[{person_id, present}] }`. Present people are recorded and absent ones removed. The date can't be in the future. |
| GET / POST | `/placements/[id]/check-ins` | placements.view / checkins.record | `{ convert_rating?, group_rating?, follow_up_required, notes? }` |
| GET / POST | `/milestones` | any / settings.manage | `{ stage_number, kind, attendance_event?, attendance_target?, name, short_name, description?, guidance?, target_days?, is_active? }` |
| PATCH | `/milestones/[id]` | settings.manage | The stage number, kind and event are fixed. Changing the target re-syncs everyone. |
| POST | `/milestones/[id]/items` | settings.manage | Checklist item: `{ key, label, help?, sort_order?, is_active? }` |
| PATCH | `/milestones/[id]/items/[itemId]` | settings.manage | The key is fixed; deactivate an item rather than deleting it. |

`event_type` is one of `sunday_service`, `online_fellowship` or `in_person_fellowship`.

**`GET /progress`** returns `{ milestones[], rows[] }`. Each row has:
- `placement_id`, `person`, `ccf`, `placed_at`, `days_since_placement`
- `stages[{stage_number, kind, state, due_date, is_completed, date_completed, notes, progress}]`. `progress` is `{done, total}` for attendance and checklist milestones.
- `completed`, `overdue`, `latest_check_in`

**`PUT /placements/[id]/progress`** takes `{ stage_number, is_completed, date_completed?, notes? }`. The completion date must fall between the approval date and today.

### CCG activities

These are the manual's CCG-level duties: the **weekly half hour of intercession** (Wednesday 5:00–5:30am, praying for the converts by name) and the **quarterly informal fellowship over food**. The activity types are stored in the database with the manual's guidance.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/activity-types?include_inactive=1` | any | |
| PATCH | `/activity-types/[key]` | settings.manage | name, cadence, schedule, guidance, is_active, sort_order |
| GET | `/group-activities?ccg_id=&type=&limit=` | activities.record or reports.view | `{ activities[], summary[{ccg, types[{key, cadence, period_start, last_held_on, held_this_period}]}] }` |
| POST | `/group-activities` | activities.record | `{ ccg_id, type_key, held_on, attendee_count?, notes?, person_ids[] }`. Posting the same CCG, type and day again updates that entry. `person_ids` must be converts placed in that CCG. |
| DELETE | `/group-activities/[id]` | activities.record | |

### Self-service links and public forms

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/links?kind=&ccf_id=&stream_id=&include_inactive=1` | links.manage or links.intake | Member links for CCFs in scope, intake links for the viewer's streams (or all, globally), person links for global people.manage. Each link has a `state`: `active`, `revoked`, `expired` or `used_up`. |
| POST | `/links` | depends on the kind (below) | Details below. |
| DELETE | `/links/[id]` | as for creating | Revokes the link immediately. |
| GET | `/public/forms/[token]` | **no login** | The form definition; details below. |
| POST | `/public/forms/[token]` | **no login** | Submits the form; details below. |

**`POST /links`:**
- Body: `{ kind, ccf_id?, stream_id?, person_id?, label?, expires_at? | expires_in_days?, max_uses? }`
- Who can create each kind:
  - `member_ccf`: links.manage on the CCF
  - `convert_intake`: links.intake, globally or on `stream_id`. Converts from a stream's link are registered into that stream; a link with no stream is church-wide and needs global rights.
  - `person_update`: people.manage on the person
- Response: `{ link, token, path }`. The **token is returned only once**; only its hash is stored.

### Passwords

Nobody sets a password for someone else. Every password is chosen by its owner through a one-time link; only the link's SHA-256 hash is stored.

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/public/password/forgot` | **no login** | `{ email }` (or username). Emails a reset link to `/reset-password/[token]`, valid for 1 hour. Always answers `{ ok: true }`, whether or not a login matches. Limited to 5 requests an hour. Works for any login with an email on record, Seek accounts included. |
| GET | `/public/invites/[token]` | **no login** | `{ purpose: 'invite' \| 'reset', name, sign_in_name }`. Returns 404 once the link is used, expired or replaced. |
| POST | `/public/invites/[token]` | **no login** | `{ password }` (at least 8 characters). Sets the password and signs out every existing session. |
| POST | `/account/password` | any CCG user | `{ current_password, new_password }`. Signs out every session; sign in again. |

The sign-in page links to `/forgot-password`. Signed-in users change their password at `/ccg/account`, and an admin can send a member a new password link from their page.

Links open the public page `/join/[token]`, which needs no login and is shown without the app shell.

**`GET /public/forms/[token]`:**
- Returns `{ kind, audience, title, ccf?, fields[], questions[], prefill? }`.
- `prefill` is included only for `person_update` links.
- An invalid, expired, used-up or revoked link returns 404.

**`POST /public/forms/[token]`:**
- Body: `{ client_submission_id (a UUID created once per form fill), person{…}, answers{} }`
- Response: `{ ok, reference }`. A retry with the same `client_submission_id` returns `duplicate_submission: true`.
- Required questions are enforced. Rate limits: 20 submissions per hour and 60 views per minute, per IP.
- What each link kind does on submission:
  - `member_ccf` creates a `pending` member.
  - `convert_intake` creates a convert and matches them straight away.
  - `person_update` updates the person's own details and answers.

### Settings, roles and users

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET / PUT | `/settings` | any / settings.manage | The matching config: `weights` (must total 100), `ageBands`, `location`, `sameAnswer`, `availability`, `connection`, `targetShare`, `similarThreshold`, `highTraitThreshold`, `lowTraitThreshold`, `smoothing`, `minMembers`, `allowFullOverride`, `reasonThresholds`. GET also returns `defaults` and `factor_labels`. |
| GET / POST | `/roles` | any / roles.manage | GET includes the permission catalogue. POST takes `{ key, name, scope_level, permissions[], description?, sort_order? }`. |
| PATCH | `/roles/[key]` | roles.manage | Changes name, permissions or active. Refused if it would leave nobody able to manage roles; a Seek superadmin always can. |
| GET / POST | `/assignments?user_id=&role_key=&council_id=&ccg_id=&ccf_id=&include_ended=1` | roles.manage | POST takes `{ person_id, role_key, stream_id? \| council_id? \| ccg_id? \| ccf_id?, starts_on? }`. The unit must match the role's level. The response includes `invite` when a login was created. |
| DELETE | `/assignments/[id]` | roles.manage | Ends the assignment today. |
| GET | `/users?search=&members=1` | roles.manage | With no search, returns users who have CCG access. `members=1` returns only logins linked to active members. |
| GET | `/activity?entity_type=&entity_id=&action=` | roles.manage | The audit trail. |

## Testing

| Command | What it does |
|---|---|
| `npm test` | Unit tests: engine, permissions, answers, milestones, and access separation. |
| `npx tsx scripts/ccg-apply-migration.ts prisma/migrations/020_ccg_app.sql` | Applies a migration to the test database in `.env.ccg-test.local`. Refuses the app's own database. |
| `npm run test:ccg-db` | Integration tests against the test database: real-time proposals, re-matching, approval, remapping, the race for a CCF's last seat, links, milestones and scope. |
| `NEON_DATABASE_URL=<test url> npx next dev -p 3100`, then `npx tsx scripts/ccg-smoke.ts` | End-to-end check of the whole flow over HTTP. |
