import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ageOn, isProfileComplete, type AnswerValue } from '../engine'
import { conflict, invalid, notFound } from '../errors'
import type { PersonCore, PersonUpdate } from '../schemas'
import { inFilter, type CcgScope } from '../scope'
import { ccgTx, dateOnly, iso, logCcg, normalizePhone, num, parseDateOnly, type Db } from './common'
import { proposeFor, PROPOSABLE_STATUSES } from './mapping'
import { needsTidy, runLater, tidyPerson } from './ai'
import { loadAnswers, loadQuestionBank, saveAnswers, type AnswerNotes, type QuestionBank } from './questions'
import { currentAssignmentWhere } from '../access'

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

type ScopedPerson = {
  kind: string
  ccfId: string | null
  streamId: string | null
  placements: Array<{ status: string; finalCcfId: string | null; proposedCcfId: string | null }>
}

/** CCFs a person is attached to: members by CCF; converts by active or open placement. */
export function personCcfIds(p: ScopedPerson): string[] {
  if (p.kind === 'member') return p.ccfId ? [p.ccfId] : []
  return p.placements
    .filter((x) => x.status === 'active' || x.status === 'proposed')
    .map((x) => (x.status === 'active' ? x.finalCcfId : x.proposedCcfId))
    .filter((x): x is string => !!x)
}

/**
 * In scope: global rights; the CCF they are in or proposed for; or, for a
 * convert, the stream that registered them (Sheep Seekers are stream-level).
 */
export function canOnPerson(scope: CcgScope, perm: 'people.view' | 'people.manage', p: ScopedPerson): boolean {
  return (
    scope.can(perm) ||
    personCcfIds(p).some((id) => scope.canOnCcf(perm, id)) ||
    (p.kind === 'convert' && !!p.streamId && scope.canOnStream(perm, p.streamId))
  )
}

/** Prisma filter restricting people to the scope. */
export function peopleScopeWhere(scope: CcgScope, perm: 'people.view' | 'people.manage'): Prisma.CcgPersonWhereInput {
  const ids = scope.ccfIds(perm)
  if (ids === 'all') return {}
  const within = inFilter(ids)!
  const streams = scope.streamIds(perm) as string[]
  return {
    OR: [
      { kind: 'member', ccfId: within },
      {
        kind: 'convert',
        placements: {
          some: {
            OR: [
              { status: 'active', finalCcfId: within },
              { status: 'proposed', proposedCcfId: within },
            ],
          },
        },
      },
      ...(streams.length ? [{ kind: 'convert', streamId: { in: streams } }] : []),
    ],
  }
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export const personInclude = {
  stream: { select: { id: true, code: true, name: true } },
  user: { select: { id: true, username: true } },
  ccf: { include: { ccg: true } },
  existingConnection: { select: { id: true, fullName: true, ccfId: true } },
  seeker: { select: { id: true, fullName: true } },
  possibleDuplicateOf: { select: { id: true, fullName: true, kind: true } },
  placements: {
    where: { status: { in: ['proposed', 'held', 'active'] } },
    include: { proposedCcf: { include: { ccg: true } }, finalCcf: { include: { ccg: true } } },
  },
} satisfies Prisma.CcgPersonInclude

export type PersonRow = Prisma.CcgPersonGetPayload<{ include: typeof personInclude }>

const unitRef = (f: { id: string; code: string; name: string; ccg: { id: string; code: string; name: string } } | null) =>
  f ? { id: f.id, code: f.code, name: f.name, ccg: { id: f.ccg.id, code: f.ccg.code, name: f.ccg.name } } : null

export function serializePerson(p: PersonRow, answers?: Record<string, AnswerValue>, answerNotes?: AnswerNotes) {
  const active = p.placements.find((x) => x.status === 'active')
  const open = p.placements.find((x) => x.status === 'proposed' || x.status === 'held')
  return {
    id: p.id,
    kind: p.kind,
    ref_code: p.refCode,
    full_name: p.fullName,
    first_name: p.firstName,
    middle_name: p.middleName,
    last_name: p.lastName,
    phone: p.phone,
    email: p.email,
    gender: p.gender,
    date_of_birth: dateOnly(p.dateOfBirth),
    age: ageOn(p.dateOfBirth),
    landmark: p.landmark,
    conversion_date: dateOnly(p.conversionDate),
    ccf: unitRef(p.ccf),
    stream: p.stream,
    /** Members who lead: their login. */
    login: p.user ? { user_id: p.user.id, username: p.user.username } : null,
    existing_connection: p.existingConnection
      ? { id: p.existingConnection.id, full_name: p.existingConnection.fullName, ccf_id: p.existingConnection.ccfId }
      : null,
    existing_connection_note: p.existingConnectionNote,
    /** The member above was matched by the AI from the note. */
    connection_by_ai: p.connectionByAi,
    /** Converts: the Sheep Seeker who brought or registered them. */
    seeker: p.seeker ? { id: p.seeker.id, full_name: p.seeker.fullName } : null,
    possible_duplicate_of: p.possibleDuplicateOf
      ? { id: p.possibleDuplicateOf.id, full_name: p.possibleDuplicateOf.fullName, kind: p.possibleDuplicateOf.kind }
      : null,
    status: p.status,
    source: p.source,
    notes: p.notes,
    placement: active
      ? { id: active.id, status: active.status, ccf: unitRef(active.finalCcf), decided_at: iso(active.decidedAt) }
      : null,
    proposal: open
      ? {
          id: open.id,
          status: open.status,
          ccf: unitRef(open.proposedCcf),
          score: num(open.proposedScore),
          hold_reason: open.holdReason,
          created_at: iso(open.createdAt),
        }
      : null,
    ...(answers ? { answers } : {}),
    ...(answerNotes ? { answer_notes: answerNotes } : {}),
    created_at: iso(p.createdAt),
    updated_at: iso(p.updatedAt),
  }
}
export type PersonDTO = ReturnType<typeof serializePerson>

/** The full name, built from its parts (kept for display, search and sorting). */
export function joinName(first: string, middle: string | null | undefined, last: string | null | undefined): string {
  return [first, middle, last].map((x) => x?.trim()).filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

async function assertCcf(db: Db, ccfId: string | null | undefined) {
  if (!ccfId) return
  const f = await db.ccgFamily.findFirst({ where: { id: ccfId, deletedAt: null, ccg: { deletedAt: null } } })
  if (!f) throw invalid('CCF not found')
}

async function assertStream(db: Db, streamId: string | null | undefined) {
  if (!streamId) return
  const s = await db.ccgStream.findFirst({ where: { id: streamId, deletedAt: null } })
  if (!s) throw invalid('Stream not found')
}

/** A Sheep Seeker: a live member holding the role (for this stream, when given). */
async function assertSeeker(db: Db, seekerId: string | null | undefined, streamId: string | null | undefined) {
  if (!seekerId) return
  const m = await db.ccgPerson.findFirst({ where: { id: seekerId, kind: 'member', deletedAt: null }, select: { userId: true } })
  const holds =
    m?.userId &&
    (await db.ccgRoleAssignment.count({
      where: { userId: m.userId, roleKey: 'sheep_seeker', ...(streamId ? { streamId } : {}), ...currentAssignmentWhere() },
    }))
  if (!holds) throw invalid(streamId ? 'Choose a Sheep Seeker of this stream' : 'Choose a Sheep Seeker', { seeker_person_id: 'Not a Sheep Seeker' })
}

/** The acting user's own member record when they are a Sheep Seeker (of this stream, when given): the default owner of converts they register. */
export async function seekerSelf(db: Db, actorId: string | null, streamId: string | null | undefined): Promise<string | null> {
  if (!actorId) return null
  const m = await db.ccgPerson.findFirst({ where: { userId: actorId, kind: 'member', deletedAt: null }, select: { id: true } })
  if (!m) return null
  const holds = await db.ccgRoleAssignment.count({
    where: { userId: actorId, roleKey: 'sheep_seeker', ...(streamId ? { streamId } : {}), ...currentAssignmentWhere() },
  })
  return holds ? m.id : null
}

async function assertConnection(db: Db, memberId: string | null | undefined, selfId?: string) {
  if (!memberId) return
  if (memberId === selfId) throw invalid('A person cannot be their own connection')
  const m = await db.ccgPerson.findFirst({ where: { id: memberId, kind: 'member', deletedAt: null } })
  if (!m) throw invalid('Existing connection must be a CCF member')
}

/** Another live person with the same phone, if any. */
async function findDuplicate(db: Db, phone: string | null, excludeId?: string) {
  if (!phone) return null
  return db.ccgPerson.findFirst({
    where: { phone, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
}

function coreData(core: Partial<PersonCore>, kind: 'member' | 'convert') {
  const d: Prisma.CcgPersonUncheckedUpdateInput = {}
  if (core.ref_code !== undefined) d.refCode = core.ref_code
  if (core.first_name !== undefined) d.firstName = core.first_name
  if (core.middle_name !== undefined) d.middleName = core.middle_name
  if (core.last_name !== undefined) d.lastName = core.last_name
  if (core.phone !== undefined) d.phone = normalizePhone(core.phone)
  if (core.email !== undefined) d.email = core.email
  if (core.gender !== undefined) d.gender = core.gender
  if (core.date_of_birth !== undefined) d.dateOfBirth = parseDateOnly(core.date_of_birth)
  if (core.landmark !== undefined) d.landmark = core.landmark
  if (core.notes !== undefined) d.notes = core.notes
  if (kind === 'member') {
    if (core.ccf_id !== undefined) d.ccfId = core.ccf_id
  } else {
    if (core.stream_id !== undefined) d.streamId = core.stream_id
    if (core.conversion_date !== undefined) d.conversionDate = parseDateOnly(core.conversion_date)
    if (core.existing_connection_member_id !== undefined) {
      d.existingConnectionMemberId = core.existing_connection_member_id
      d.connectionByAi = false
    }
    if (core.seeker_person_id !== undefined) d.seekerPersonId = core.seeker_person_id
    if (core.existing_connection_note !== undefined) d.existingConnectionNote = core.existing_connection_note
  }
  return d
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

export interface CreatePersonArgs {
  kind: 'member' | 'convert'
  core: Partial<PersonCore> & { first_name: string; last_name: string }
  answers: Record<string, unknown>
  source: 'staff' | 'self'
  actorId: string | null
  /** Members: 'active' (staff) or 'pending' (self-registered). */
  memberStatus?: 'active' | 'pending'
  bank?: QuestionBank
  /** Run matching for a new convert (default true). */
  propose?: boolean
}

/**
 * Register a member or convert with their answers. A new convert is matched
 * immediately and gets a proposal (real-time mapping).
 */
export async function createPerson(args: CreatePersonArgs) {
  const bank = args.bank ?? (await loadQuestionBank())
  if (args.kind === 'member' && !args.core.ccf_id) throw invalid('A member must belong to a CCF')
  if (args.kind === 'convert' && args.core.ccf_id) throw invalid('Converts are placed through matching, not assigned a CCF directly')

  const person = await ccgTx(async (tx) => {
    await assertCcf(tx, args.core.ccf_id)
    await assertStream(tx, args.kind === 'convert' ? args.core.stream_id : null)
    await assertConnection(tx, args.core.existing_connection_member_id)
    // Converts belong to the Sheep Seeker who brought them: the one chosen, or
    // the registering user when they are one.
    let seekerId: string | null = null
    if (args.kind === 'convert') {
      seekerId = args.core.seeker_person_id ?? (await seekerSelf(tx, args.actorId, args.core.stream_id))
      // (A self-registration keeps its link's seeker even if they have since stepped down.)
      if (args.core.seeker_person_id && args.source === 'staff') await assertSeeker(tx, seekerId, args.core.stream_id)
    }
    const phone = normalizePhone(args.core.phone)
    const dup = await findDuplicate(tx, phone)

    const created = await tx.ccgPerson.create({
      data: {
        ...(coreData(args.core, args.kind) as Prisma.CcgPersonUncheckedCreateInput),
        kind: args.kind,
        fullName: joinName(args.core.first_name, args.core.middle_name, args.core.last_name),
        phone,
        status: args.kind === 'member' ? args.memberStatus ?? 'active' : 'new',
        source: args.source,
        possibleDuplicateOfId: dup?.id ?? null,
        seekerPersonId: seekerId,
        createdBy: args.actorId,
      },
    })
    await saveAnswers(tx, {
      personId: created.id,
      kind: args.kind,
      input: args.answers,
      bank,
      source: args.source,
      userId: args.actorId,
      enforceRequired: args.source === 'self',
    })
    await logCcg(
      {
        userId: args.actorId,
        action: args.kind === 'member' ? 'MEMBER_REGISTERED' : 'CONVERT_REGISTERED',
        entityType: 'ccg_person',
        entityId: created.id,
        newValues: { source: args.source, ccf_id: created.ccfId, stream_id: created.streamId, possible_duplicate_of: dup?.id ?? null },
      },
      tx
    )
    return created
  })

  // Free text ("Other" answers, who they know) is tidied by the AI after the
  // response; it re-matches if that changes anything, then summarises.
  const tidy = await needsTidy(person.id)
  const proposal =
    args.kind === 'convert' && args.propose !== false
      ? await proposeFor(person.id, 'registration', args.actorId, { summarise: !tidy })
      : null
  if (tidy) runLater(() => tidyPerson(person.id))
  return { person, proposal }
}

/** Core fields whose change affects a convert's matching. */
const MATCHING_FIELDS: Array<keyof PersonCore> = ['date_of_birth', 'existing_connection_member_id', 'stream_id']

export async function updatePerson(
  id: string,
  patch: PersonUpdate,
  opts: { actorId: string | null; source: 'staff' | 'self' }
) {
  const bank = await loadQuestionBank()
  const before = await prisma.ccgPerson.findFirst({ where: { id, deletedAt: null } })
  if (!before) throw notFound('Person')
  const kind = before.kind as 'member' | 'convert'
  const { answers, status, ...core } = patch

  if (kind === 'convert' && core.ccf_id) throw invalid('Converts are placed through matching, not assigned a CCF directly')
  if (kind === 'member' && core.ccf_id === null) throw invalid('A member must belong to a CCF')
  if (status) validateStatusChange(kind, before.status, status)

  const previous = (await loadAnswers([id], bank)).get(id) ?? {}
  const result = await ccgTx(async (tx) => {
    await assertCcf(tx, core.ccf_id)
    await assertStream(tx, kind === 'convert' ? core.stream_id : null)
    await assertConnection(tx, core.existing_connection_member_id, id)
    if (kind === 'convert' && core.seeker_person_id) {
      await assertSeeker(tx, core.seeker_person_id, core.stream_id !== undefined ? core.stream_id : before.streamId)
    }

    const data = coreData(core, kind)
    if (core.first_name !== undefined || core.middle_name !== undefined || core.last_name !== undefined) {
      data.fullName = joinName(
        core.first_name ?? before.firstName,
        core.middle_name !== undefined ? core.middle_name : before.middleName,
        core.last_name ?? before.lastName
      )
    }
    if (core.phone !== undefined) {
      const phone = normalizePhone(core.phone)
      data.possibleDuplicateOfId = (await findDuplicate(tx, phone, id))?.id ?? null
    }
    if (status) data.status = status
    data.updatedAt = new Date()
    await tx.ccgPerson.update({ where: { id }, data })

    let answersChanged = false
    let otherChanged = false
    if (answers) {
      ;({ changed: answersChanged, otherChanged } = await saveAnswers(tx, {
          personId: id,
          kind,
          input: answers,
          bank,
          source: opts.source,
          userId: opts.actorId,
          enforceRequired: false,
          previous,
        }))
    }
    await logCcg(
      {
        userId: opts.actorId,
        action: 'PERSON_UPDATED',
        entityType: 'ccg_person',
        entityId: id,
        newValues: { fields: Object.keys(core), answers: answers ? Object.keys(answers) : [], status },
      },
      tx
    )
    return { answersChanged, otherChanged }
  })

  const matchingChanged = result.answersChanged || MATCHING_FIELDS.some((f) => core[f] !== undefined) || status === 'new'
  const tidy =
    (result.otherChanged || core.existing_connection_note !== undefined || core.existing_connection_member_id !== undefined) &&
    (await needsTidy(id))
  let proposal = null
  if (kind === 'convert' && matchingChanged) {
    const now = await prisma.ccgPerson.findUnique({ where: { id }, select: { status: true } })
    if (now && (PROPOSABLE_STATUSES as readonly string[]).includes(now.status)) {
      proposal = await proposeFor(id, status === 'new' ? 'manual' : 'answers_changed', opts.actorId, { summarise: !tidy })
    }
  }
  if (tidy) runLater(() => tidyPerson(id))
  return { proposal }
}

function validateStatusChange(kind: 'member' | 'convert', from: string, to: string) {
  if (kind === 'member') {
    if (!['active', 'inactive'].includes(to)) throw invalid('A member can be active or inactive')
    if (from === 'pending' && to === 'active') throw invalid('Use confirm to activate a self-registered member')
    return
  }
  if (to === 'active') throw invalid('A convert cannot be set active; approve a placement instead')
  if (['placed', 'integrated'].includes(from)) throw conflict('End the placement first')
  if (to === 'new' && from !== 'inactive') throw invalid('Only an inactive convert can be reopened')
}

export async function confirmMember(id: string, actorId: string) {
  return ccgTx(async (tx) => {
    const p = await tx.ccgPerson.findFirst({ where: { id, deletedAt: null } })
    if (!p || p.kind !== 'member') throw notFound('Member')
    if (p.status !== 'pending') throw conflict(`This member is already ${p.status}`)
    await tx.ccgPerson.update({ where: { id }, data: { status: 'active', updatedAt: new Date() } })
    await logCcg({ userId: actorId, action: 'MEMBER_CONFIRMED', entityType: 'ccg_person', entityId: id }, tx)
    return p
  })
}

export async function removePerson(id: string, actorId: string) {
  return ccgTx(async (tx) => {
    const p = await tx.ccgPerson.findFirst({ where: { id, deletedAt: null } })
    if (!p) throw notFound('Person')
    await tx.ccgPlacement.updateMany({
      where: { personId: id, status: { in: ['proposed', 'held'] } },
      data: { status: 'superseded', updatedAt: new Date() },
    })
    await tx.ccgPlacement.updateMany({
      where: { personId: id, status: 'active' },
      data: { status: 'ended', endedAt: new Date(), endReason: 'Person removed', updatedAt: new Date() },
    })
    await tx.ccgPerson.update({ where: { id }, data: { deletedAt: new Date() } })
    await logCcg({ userId: actorId, action: 'PERSON_REMOVED', entityType: 'ccg_person', entityId: id }, tx)
    return p
  })
}

export { isProfileComplete }
