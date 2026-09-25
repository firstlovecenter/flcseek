import { z } from 'zod'
import { QUESTION_FACTORS } from './engine/config'
import { MEETING_DAYS, normaliseTime } from './engine/meeting-slot'
import { signalSchema } from './engine/signals'
import { PERMISSION_KEYS, SCOPE_LEVELS, type Permission } from './permissions'
import { ATTENDANCE_EVENTS, MILESTONE_KINDS } from './progress'

/**
 * Request body schemas for /api/ccg/*. Dates travel as 'YYYY-MM-DD', times as
 * 'HH:MM' (24h; '7:00 PM' accepted), ids as UUIDs, question answers keyed by
 * question key.
 */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), 'Invalid date')

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()

const uuid = z.string().uuid()
/** Optional email; '' clears it; stored lower-case. */
const email = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().trim().toLowerCase().email('Enter a valid email address').max(254).nullable().optional()
)
const code = z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, - and _ only')
const unitStatus = z.enum(['active', 'paused', 'inactive'])

const meetingTime = z
  .string()
  .nullable()
  .optional()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v.trim() === '') return v === undefined ? undefined : null
    const t = normaliseTime(v)
    if (!t) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a time like 19:00 or 7:00 PM' })
      return z.NEVER
    }
    return t
  })

// --------------------------------------------------------------------------
// Structure
// --------------------------------------------------------------------------
/** A campus groups streams; `leader` is its Campus Leader (needs roles.manage). */
export const campusSchema = z.object({
  leader: z.object({ person_id: uuid }).nullable().optional(),
  /** Generated when left out (CMP-0001, …); not shown in the app. */
  code: code.optional(),
  name: z.string().trim().min(1).max(120),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: text(2000),
})
export const campusUpdateSchema = campusSchema.partial()

export const streamSchema = z.object({
  campus_id: uuid.nullable().optional(),
  /** Generated when left out (STR-0001, CCF-0001, …); not shown in the app. */
  code: code.optional(),
  name: z.string().trim().min(1).max(120),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: text(2000),
})
export const streamUpdateSchema = streamSchema.partial()

/** A stream's sheep seeking group. */
export const seekingGroupSchema = z.object({
  stream_id: uuid,
  name: z.string().trim().min(1, 'Give the group a name').max(120),
  notes: text(2000),
})
export const seekingGroupUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  notes: text(2000),
  status: z.enum(['active', 'inactive']).optional(),
})
export const groupSeekerSchema = z.object({ user_id: uuid })
export const groupConvertsSchema = z.object({ person_ids: z.array(uuid).min(1).max(500) })

/** Appoint a Sheep Seeker: an existing member, or a new person of the stream (no CCF needed). */
export const addSeekerSchema = z.union([
  z.object({ person_id: uuid }),
  z.object({
    first_name: z.string().trim().min(1, 'Enter their first name').max(80),
    middle_name: text(80),
    last_name: z.string().trim().min(1, 'Enter their last name').max(80),
    phone: z.string().trim().min(7, 'Enter their phone number').max(20),
    email: z.string().trim().email('Enter a valid email address').max(254),
  }),
])

/**
 * Optional on council / CCG / CCF: the member who leads it (needs roles.manage).
 * A member without a login gets one and is emailed a link to set a password.
 * null clears it.
 */
const leader = z.object({ person_id: uuid }).nullable().optional()

export const councilSchema = z.object({
  stream_id: uuid.nullable().optional(),
  leader,
  /** Generated when left out (STR-0001, CCF-0001, …); not shown in the app. */
  code: code.optional(),
  name: z.string().trim().min(1).max(120),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: text(2000),
})
export const councilUpdateSchema = councilSchema.partial()

export const ccgSchema = z.object({
  council_id: uuid.nullable().optional(),
  leader,
  /** Generated when left out (STR-0001, CCF-0001, …); not shown in the app. */
  code: code.optional(),
  name: z.string().trim().min(1).max(120),
  status: unitStatus.default('active'),
  notes: text(2000),
})
export const ccgUpdateSchema = ccgSchema.partial()

export const ccfSchema = z.object({
  ccg_id: uuid,
  leader,
  /** Generated when left out (STR-0001, CCF-0001, …); not shown in the app. */
  code: code.optional(),
  name: z.string().trim().min(1).max(120),
  meeting_location: text(200),
  meeting_day: z.enum(MEETING_DAYS).nullable().optional(),
  meeting_time: meetingTime,
  meeting_frequency: z.string().trim().min(1).max(20).default('Weekly'),
  capacity: z.number().int().min(1).max(500),
  status: unitStatus.default('active'),
  notes: text(2000),
})
export const ccfUpdateSchema = ccfSchema.partial()
/** What a governor (units.edit) may change — not the CCG, code or status. */
export const CCF_UNIT_EDIT_FIELDS = ['name', 'meeting_location', 'meeting_day', 'meeting_time', 'meeting_frequency', 'capacity', 'notes'] as const

// --------------------------------------------------------------------------
// People
// --------------------------------------------------------------------------
const answers = z.record(z.unknown())

export const personCoreSchema = z.object({
  ref_code: text(20),
  // Names are taken separately; the full name is built from them.
  first_name: z.string().trim().min(1, 'Enter their first name').max(80),
  middle_name: text(80),
  last_name: z.string().trim().min(1, 'Enter their last name').max(80),
  phone: text(20),
  /** Members: their invitation is emailed here when they are given a role. */
  email,
  gender: z.enum(['Male', 'Female']).nullable().optional(),
  date_of_birth: isoDate.nullable().optional(),
  landmark: text(150),
  notes: text(2000),
  // members
  ccf_id: uuid.nullable().optional(),
  // converts
  /** The stream registering them; matching stays inside it. Empty = church-wide. */
  stream_id: uuid.nullable().optional(),
  conversion_date: isoDate.nullable().optional(),
  existing_connection_member_id: uuid.nullable().optional(),
  existing_connection_note: text(300),
  /** The Sheep Seeker (a member) who registered them; defaults to the registering Sheep Seeker. */
  seeker_person_id: uuid.nullable().optional(),
  /** Converts: their sheep seeking group (its Sheep Seekers look after them). */
  seeking_group_id: uuid.nullable().optional(),
})
export type PersonCore = z.infer<typeof personCoreSchema>

export const personCreateSchema = personCoreSchema.extend({
  kind: z.enum(['member', 'convert']),
  answers: answers.default({}),
})
export type PersonCreate = z.infer<typeof personCreateSchema>

export const personUpdateSchema = personCoreSchema.partial().extend({
  answers: answers.optional(),
  /** member: active | inactive · convert: inactive | new (reopen) */
  status: z.enum(['active', 'inactive', 'new']).optional(),
})
export type PersonUpdate = z.infer<typeof personUpdateSchema>

// --------------------------------------------------------------------------
// Placements
// --------------------------------------------------------------------------
export const approveSchema = z.object({ override_reason: text(1000) }).default({})
export const bulkApproveSchema = z.object({ placement_ids: z.array(uuid).min(1).max(200) })
export const remapSchema = z.object({ ccf_id: uuid, reason: z.string().trim().min(1, 'Give a reason').max(1000) })
export const holdSchema = z.object({ reason: z.string().trim().min(1, 'Say what is needed').max(1000) })
export const endSchema = z.object({
  reason: z.string().trim().min(1, 'Give a reason').max(1000),
  /** Re-propose a new CCF straight away (e.g. the convert moved). */
  reopen: z.boolean().default(false),
})
/** Move a member or placed convert to another CCF. */
export const transferSchema = z.object({
  ccf_id: uuid,
  reason: z.string().trim().min(1, 'Give a reason').max(1000),
})

export const rescoreSchema = z.object({ person_ids: z.array(uuid).max(500).optional() }).default({})

export const progressSchema = z.object({
  stage_number: z.number().int().min(1),
  is_completed: z.boolean(),
  date_completed: isoDate.nullable().optional(),
  notes: text(1000),
})
/** Tick or untick one checklist item (Seeing and Hearing, Overseer introduction). */
export const checklistItemSchema = z.object({
  item_id: uuid,
  done: z.boolean(),
  date_completed: isoDate.nullable().optional(),
})

/** Save a CCF attendance register for one event on one day. */
export const attendanceSchema = z.object({
  ccf_id: uuid,
  event_type: z.enum(ATTENDANCE_EVENTS),
  event_date: isoDate,
  entries: z
    .array(z.object({ person_id: uuid, present: z.boolean() }))
    .min(1, 'Mark at least one person')
    .max(500),
})

/** Log a CCG activity (intercession, fellowship over food). */
export const groupActivitySchema = z.object({
  ccg_id: uuid,
  type_key: z.string().trim().min(1).max(40),
  held_on: isoDate,
  attendee_count: z.number().int().min(0).max(100000).nullable().optional(),
  notes: text(2000),
  /** Converts prayed for by name (types that list people). */
  person_ids: z.array(uuid).max(500).default([]),
})

export const activityTypeUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    cadence: z.enum(['weekly', 'monthly', 'quarterly']),
    schedule: text(120),
    guidance: text(10000),
    is_active: z.boolean(),
    sort_order: z.number().int(),
  })
  .partial()

export const checkInSchema = z.object({
  convert_rating: z.number().int().min(1).max(5).nullable().optional(),
  group_rating: z.number().int().min(1).max(5).nullable().optional(),
  follow_up_required: z.boolean().default(false),
  notes: text(2000),
})

// --------------------------------------------------------------------------
// Question bank
// --------------------------------------------------------------------------
const questionKey = z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and _ only')

export const questionSchema = z
  .object({
    key: questionKey,
    prompt: z.string().trim().min(1).max(300),
    help: text(500),
    section: text(60),
    type: z.enum(['single', 'multi', 'scale5', 'text']),
    max_choices: z.number().int().min(1).max(50).nullable().optional(),
    audience: z.enum(['member', 'convert', 'both']).default('both'),
    required: z.boolean().default(false),
    factor: z.enum([...QUESTION_FACTORS, 'none']).default('none'),
    method: z.enum(['share', 'same_answer', 'distance', 'meeting_slot', 'preference', 'none']).default('none'),
    weight: z.number().min(0).max(100).default(1),
    sort_order: z.number().int().default(0),
    active: z.boolean().default(true),
  })
  .superRefine((q, ctx) => validateScoring(q, ctx))

export const questionUpdateSchema = z.object({
  prompt: z.string().trim().min(1).max(300).optional(),
  help: text(500),
  section: text(60),
  max_choices: z.number().int().min(1).max(50).nullable().optional(),
  audience: z.enum(['member', 'convert', 'both']).optional(),
  required: z.boolean().optional(),
  factor: z.enum([...QUESTION_FACTORS, 'none']).optional(),
  method: z.enum(['share', 'same_answer', 'distance', 'meeting_slot', 'preference', 'none']).optional(),
  weight: z.number().min(0).max(100).optional(),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional(),
})

/** Which scoring methods suit which question types. */
export const METHODS_FOR_TYPE: Record<string, string[]> = {
  single: ['same_answer', 'share', 'none'],
  multi: ['share', 'meeting_slot', 'preference', 'none'],
  scale5: ['distance', 'none'],
  text: ['none'],
}

export function validateScoring(
  q: { type: string; factor?: string; method?: string },
  ctx: z.RefinementCtx
) {
  const factor = q.factor ?? 'none'
  const method = q.method ?? 'none'
  if ((factor === 'none') !== (method === 'none')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['method'], message: 'Set both a factor and a method, or neither' })
  }
  if (!METHODS_FOR_TYPE[q.type]?.includes(method)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['method'], message: `A ${q.type} question cannot use "${method}"` })
  }
}

const optionKey = questionKey
export const optionSchema = z.object({
  key: optionKey,
  label: z.string().trim().min(1).max(150),
  catch_all: z.boolean().default(false),
  signal: signalSchema.nullable().optional(),
  sort_order: z.number().int().default(0),
  active: z.boolean().default(true),
})
export const optionUpdateSchema = optionSchema.omit({ key: true }).partial()

// --------------------------------------------------------------------------
// Milestones, settings
// --------------------------------------------------------------------------
const milestoneFields = {
  name: z.string().trim().min(1).max(120),
  short_name: z.string().trim().min(1).max(30),
  description: text(1000),
  guidance: text(20000),
  target_days: z.number().int().min(0).max(3650).nullable().optional(),
  attendance_target: z.number().int().min(1).max(1000).nullable().optional(),
  is_active: z.boolean().default(true),
}

/**
 * kind: manual (ticked), attendance (completes at `attendance_target` marked
 * attendances of `attendance_event`), checklist (completes when all items are ticked).
 */
export const milestoneSchema = z
  .object({
    stage_number: z.number().int().min(1).max(999),
    kind: z.enum(MILESTONE_KINDS).default('manual'),
    attendance_event: z.enum(ATTENDANCE_EVENTS).nullable().optional(),
    ...milestoneFields,
  })
  .refine((m) => m.kind !== 'attendance' || (!!m.attendance_event && !!m.attendance_target), {
    message: 'An attendance milestone needs an event type and a target',
    path: ['attendance_target'],
  })
/** Kind and event are fixed once created (progress depends on them). */
export const milestoneUpdateSchema = z.object(milestoneFields).partial()

export const milestoneItemSchema = z.object({
  key: z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and _ only'),
  label: z.string().trim().min(1).max(200),
  help: text(2000),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
})
export const milestoneItemUpdateSchema = milestoneItemSchema.omit({ key: true }).partial()

// --------------------------------------------------------------------------
// Roles and users
// --------------------------------------------------------------------------
const permissionList = z
  .array(z.string())
  .refine((ps) => ps.every((p) => (PERMISSION_KEYS as string[]).includes(p)), 'Unknown permission')
  .transform((ps) => [...new Set(ps)] as Permission[])

export const roleSchema = z.object({
  key: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and _ only'),
  name: z.string().trim().min(1).max(100),
  description: text(500),
  scope_level: z.enum(SCOPE_LEVELS),
  permissions: permissionList,
  sort_order: z.number().int().default(0),
})
export const roleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: text(500),
  permissions: permissionList.optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

/** Roles are given to members; one without a login is emailed an invitation to set a password. */
export const assignmentSchema = z.object({
  /** A member (every role is held by a member)… */
  person_id: uuid.optional(),
  /** …or, for the CCG owner, any user: a Seek user is linked on their Seek login. */
  user_id: uuid.optional(),
  role_key: z.string().min(1),
  campus_id: uuid.nullable().optional(),
  stream_id: uuid.nullable().optional(),
  council_id: uuid.nullable().optional(),
  ccg_id: uuid.nullable().optional(),
  ccf_id: uuid.nullable().optional(),
  starts_on: isoDate.optional(),
})

/** Choose a password from an invitation or reset link. */
export const acceptInviteSchema = z.object({ password: z.string().min(8, 'At least 8 characters').max(200) })
export const forgotPasswordSchema = z.object({ email: z.string().trim().min(1, 'Enter your email').max(254) })
export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Enter your current password').max(200),
  new_password: z.string().min(8, 'At least 8 characters').max(200),
})

// --------------------------------------------------------------------------
// Links and public forms
// --------------------------------------------------------------------------
export const linkSchema = z.object({
  kind: z.enum(['member_ccf', 'convert_intake', 'person_update']),
  ccf_id: uuid.optional(),
  /** convert_intake: register converts into this stream (empty = church-wide). */
  stream_id: uuid.nullable().optional(),
  /** convert_intake: converts who register through it are this Sheep Seeker's (default: the creator, when a Sheep Seeker). */
  seeker_person_id: uuid.nullable().optional(),
  person_id: uuid.optional(),
  label: text(150),
  expires_at: z.string().datetime().nullable().optional(),
  /** Days from now; convenience alternative to expires_at. */
  expires_in_days: z.number().int().min(1).max(365).optional(),
  max_uses: z.number().int().min(1).max(100000).nullable().optional(),
})

export const publicSubmissionSchema = z.object({
  client_submission_id: uuid,
  person: z
    .object({
      first_name: z.string().trim().min(1).max(80),
      middle_name: text(80),
      last_name: z.string().trim().min(1).max(80),
      phone: z.string().trim().min(7).max(20),
      email,
      gender: z.enum(['Male', 'Female']).nullable().optional(),
      date_of_birth: isoDate.nullable().optional(),
      landmark: text(150),
      existing_connection_note: text(300),
    })
    .partial({ first_name: true, last_name: true, phone: true }),
  answers: answers.default({}),
})
export type PublicSubmission = z.infer<typeof publicSubmissionSchema>
