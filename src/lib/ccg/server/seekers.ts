import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '../access'
import { conflict, forbidden, notFound } from '../errors'
import type { CcgScope } from '../scope'
import { iso } from './common'
import { createPerson } from './people'
import { assignRoleToMember, endAssignment } from './roles'

/**
 * Sheep Seekers: stream-level members who bring converts in, register them and
 * see them placed. Each convert records the seeker who brought them
 * (ccg_people.seeker_person_id).
 */

const DAY = 86_400_000
const SUCCESS_OUTCOMES = ['graduated', 'made_member']

/** Current Sheep Seekers (their member records), optionally only in some streams. */
export async function seekersIn(streams: string[] | 'all') {
  const rows = await prisma.ccgRoleAssignment.findMany({
    where: { roleKey: 'sheep_seeker', ...(streams === 'all' ? {} : { streamId: { in: streams } }), ...currentAssignmentWhere() },
    select: {
      id: true,
      streamId: true,
      stream: { select: { id: true, name: true } },
      user: { select: { ccgPeople: { where: { kind: 'member', deletedAt: null }, select: { id: true, fullName: true }, take: 1 } } },
    },
  })
  const byPerson = new Map<string, { person_id: string; name: string; streams: Array<{ id: string; name: string }> }>()
  for (const r of rows) {
    const person = r.user.ccgPeople[0]
    if (!person || !r.stream) continue
    const entry = byPerson.get(person.id) ?? { person_id: person.id, name: person.fullName, streams: [] }
    if (!entry.streams.some((s) => s.id === r.stream!.id)) entry.streams.push(r.stream)
    byPerson.set(person.id, entry)
  }
  return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// A Sheep Seeker's home screen
// ---------------------------------------------------------------------------

function startOfWeek(now: Date) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)) // Monday
  return d
}

/** The signed-in Sheep Seeker's converts: what needs doing, and how they are getting on. Null when they are not a seeker. */
export async function seekerHome(userId: string) {
  const me = await prisma.ccgPerson.findFirst({ where: { userId, kind: 'member', deletedAt: null }, select: { id: true, fullName: true } })
  if (!me) return null
  const streams = await prisma.ccgRoleAssignment.findMany({
    where: { userId, roleKey: 'sheep_seeker', ...currentAssignmentWhere() },
    select: { stream: { select: { id: true, name: true } } },
  })
  if (streams.length === 0) return null

  const now = new Date()
  // Their converts: those in their sheep seeking groups.
  const groups = (await prisma.ccgSeekingGroupSeeker.findMany({ where: { userId, group: { deletedAt: null } }, select: { groupId: true } })).map((g) => g.groupId)
  const mine: Prisma.CcgPersonWhereInput = { kind: 'convert', seekingGroupId: { in: groups }, deletedAt: null }
  const [registeredThisWeek, awaiting, held, placed, succeeded, heldList, followUps, recent] = await Promise.all([
    prisma.ccgPerson.count({ where: { ...mine, createdAt: { gte: startOfWeek(now) } } }),
    prisma.ccgPerson.count({ where: { ...mine, status: 'proposed' } }),
    prisma.ccgPerson.count({ where: { ...mine, status: { in: ['new', 'needs_info'] } } }),
    prisma.ccgPlacement.count({ where: { status: 'active', person: mine } }),
    prisma.ccgPlacement.count({ where: { outcome: { in: SUCCESS_OUTCOMES }, person: mine } }),
    prisma.ccgPlacement.findMany({
      where: { status: 'held', person: mine },
      orderBy: { createdAt: 'asc' },
      take: 8,
      select: { holdReason: true, createdAt: true, person: { select: { id: true, fullName: true } } },
    }),
    prisma.ccgPlacement.findMany({
      where: { status: 'active', person: mine, checkIns: { some: {} } },
      select: {
        finalCcf: { select: { name: true } },
        person: { select: { id: true, fullName: true } },
        checkIns: { orderBy: { recordedAt: 'desc' }, take: 1, select: { followUpRequired: true, recordedAt: true, notes: true } },
      },
    }),
    prisma.ccgPerson.findMany({
      where: mine,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, fullName: true, status: true, createdAt: true },
    }),
  ])

  return {
    seeker: { person_id: me.id, name: me.fullName },
    streams: streams.map((s) => s.stream).filter((s): s is { id: string; name: string } => !!s),
    counts: {
      registered_this_week: registeredThisWeek,
      awaiting_approval: awaiting,
      on_hold: held,
      in_assessment: placed,
      became_members: succeeded,
    },
    on_hold: heldList.map((h) => ({
      person_id: h.person.id,
      name: h.person.fullName,
      reason: h.holdReason,
      waiting_days: h.createdAt ? Math.floor((now.getTime() - h.createdAt.getTime()) / DAY) : null,
    })),
    follow_ups: followUps
      .filter((f) => f.checkIns[0]?.followUpRequired)
      .map((f) => ({
        person_id: f.person.id,
        name: f.person.fullName,
        ccf: f.finalCcf?.name ?? null,
        noted_at: iso(f.checkIns[0].recordedAt),
        notes: f.checkIns[0].notes,
      })),
    recent: recent.map((r) => ({ person_id: r.id, name: r.fullName, status: r.status, created_at: iso(r.createdAt) })),
  }
}

// ---------------------------------------------------------------------------
// Report: per seeker, per week or month
// ---------------------------------------------------------------------------

export type ReportPeriod = 'week' | 'month'

function periodRange(period: ReportPeriod, offset: number, now = new Date()) {
  if (period === 'week') {
    const from = startOfWeek(now)
    from.setUTCDate(from.getUTCDate() - 7 * offset)
    const to = new Date(from.getTime() + 7 * DAY)
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    return { from, to, label: `${fmt(from)} – ${fmt(new Date(to.getTime() - DAY))}` }
  }
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
  return { from, to, label: from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
}

export async function seekerReport(scope: CcgScope, opts: { streamId: string | null; period: ReportPeriod; offset: number }) {
  const inScope = scope.streamIds('reports.view')
  if (opts.streamId && !scope.canOnStream('reports.view', opts.streamId)) throw forbidden('You can only see reports for your streams')
  const streams: string[] | 'all' = opts.streamId ? [opts.streamId] : inScope
  if (streams !== 'all' && streams.length === 0) throw forbidden('Sheep Seeker reports are for streams you oversee')

  const { from, to, label } = periodRange(opts.period, Math.max(0, opts.offset))
  const seekers = await seekersIn(streams)
  const inPeriod = { gte: from, lt: to }
  // Converts counted: those of these seekers, plus unassigned converts in these streams.
  const people: Prisma.CcgPersonWhereInput = {
    kind: 'convert',
    deletedAt: null,
    OR: [
      { seekerPersonId: { in: seekers.map((s) => s.person_id) } },
      { seekerPersonId: null, ...(streams === 'all' ? {} : { streamId: { in: streams } }) },
    ],
  }
  const [registered, placed, ended, active] = await Promise.all([
    prisma.ccgPerson.findMany({ where: { ...people, createdAt: inPeriod }, select: { seekerPersonId: true } }),
    prisma.ccgPlacement.findMany({
      where: { decision: { in: ['approved', 'remapped'] }, decidedAt: inPeriod, person: people },
      select: { person: { select: { seekerPersonId: true } } },
    }),
    prisma.ccgPlacement.findMany({
      where: { status: 'ended', endedAt: inPeriod, outcome: { not: null }, person: people },
      select: { outcome: true, person: { select: { seekerPersonId: true } } },
    }),
    prisma.ccgPlacement.findMany({ where: { status: 'active', person: people }, select: { person: { select: { seekerPersonId: true } } } }),
  ])

  type Row = { registered: number; placed: number; became_members: number; dropped: number; in_assessment: number }
  const empty = (): Row => ({ registered: 0, placed: 0, became_members: 0, dropped: 0, in_assessment: 0 })
  const rows = new Map<string, Row>()
  const row = (id: string | null) => {
    const key = id ?? 'none'
    if (!rows.has(key)) rows.set(key, empty())
    return rows.get(key)!
  }
  for (const r of registered) row(r.seekerPersonId).registered++
  for (const p of placed) row(p.person.seekerPersonId).placed++
  for (const e of ended) {
    if (SUCCESS_OUTCOMES.includes(e.outcome!)) row(e.person.seekerPersonId).became_members++
    else row(e.person.seekerPersonId).dropped++
  }
  for (const a of active) row(a.person.seekerPersonId).in_assessment++

  const out = seekers.map((s) => ({ ...s, ...(rows.get(s.person_id) ?? empty()) }))
  const unassigned = rows.get('none')
  const total = [...out, ...(unassigned ? [unassigned] : [])].reduce<Row>((t, r) => {
    for (const k of Object.keys(t) as Array<keyof Row>) t[k] += r[k]
    return t
  }, empty())

  return {
    period: opts.period,
    offset: opts.offset,
    range: { from: iso(from), to: iso(to), label },
    seekers: out,
    /** Converts in these streams with no Sheep Seeker recorded. */
    unassigned: unassigned ?? empty(),
    total,
  }
}

/** A stream's Sheep Seeking Overseer and Sheep Seekers (with their assignment ids, to stand them down). */
export async function streamTeam(streamId: string) {
  const rows = await prisma.ccgRoleAssignment.findMany({
    where: { streamId, roleKey: { in: ['seeking_overseer', 'sheep_seeker'] }, ...currentAssignmentWhere() },
    orderBy: { startsOn: 'asc' },
    select: {
      id: true,
      roleKey: true,
      startsOn: true,
      userId: true,
      user: { select: { ccgPeople: { where: { kind: 'member', deletedAt: null }, select: { id: true, fullName: true }, take: 1 } } },
    },
  })
  const holder = (r: (typeof rows)[number]) => ({
    assignment_id: r.id,
    user_id: r.userId,
    person_id: r.user.ccgPeople[0]?.id ?? null,
    name: r.user.ccgPeople[0]?.fullName ?? 'Unknown',
    since: iso(r.startsOn),
  })
  const overseer = rows.find((r) => r.roleKey === 'seeking_overseer')
  return { overseer: overseer ? holder(overseer) : null, seekers: rows.filter((r) => r.roleKey === 'sheep_seeker').map(holder) }
}

// ---------------------------------------------------------------------------
// Appointing a Sheep Seeker
// ---------------------------------------------------------------------------

export type AddSeeker =
  | { person_id: string }
  | { first_name: string; middle_name?: string | null; last_name: string; phone: string; email: string }

/**
 * Make someone a Sheep Seeker of a stream. They need not be in any CCF: new
 * people are added as members of the stream only. Someone already in the app
 * with the same email (e.g. a CCF member) is reused, so they keep one login
 * and switch roles. A person without a login is emailed a link to set their
 * password.
 */
export async function addSeeker(streamId: string, body: AddSeeker, actorId: string, origin: string) {
  return appointInStream(streamId, 'sheep_seeker', body, actorId, origin)
}

/**
 * Make someone the stream's Sheep Seeking Overseer (one per stream: the
 * current one, if different, stands down).
 */
export async function setSeekingOverseer(streamId: string, body: AddSeeker, actorId: string, origin: string) {
  return appointInStream(streamId, 'seeking_overseer', body, actorId, origin)
}

/** The person to appoint: an existing member, one with the same email, or someone new of the stream. */
async function personFor(streamId: string, body: AddSeeker, actorId: string) {
  if ('person_id' in body) return { personId: body.person_id, reused: false }
  const email = body.email.trim().toLowerCase()
  const existing = await prisma.ccgPerson.findFirst({
    where: { kind: 'member', deletedAt: null, email: { equals: email, mode: 'insensitive' } },
    select: { id: true, status: true },
  })
  if (existing) {
    if (existing.status !== 'active') throw conflict(`${email} belongs to a member who is not active yet`)
    return { personId: existing.id, reused: true }
  }
  const { person } = await createPerson({
    kind: 'member',
    core: { first_name: body.first_name, middle_name: body.middle_name ?? null, last_name: body.last_name, phone: body.phone, email, stream_id: streamId },
    answers: {},
    source: 'staff',
    actorId,
  })
  return { personId: person.id, reused: false }
}

async function appointInStream(streamId: string, roleKey: 'sheep_seeker' | 'seeking_overseer', body: AddSeeker, actorId: string, origin: string) {
  const stream = await prisma.ccgStream.findFirst({ where: { id: streamId, deletedAt: null } })
  if (!stream) throw notFound('Stream')
  const { personId, reused } = await personFor(streamId, body, actorId)

  const current = await prisma.ccgRoleAssignment.findMany({
    where: { roleKey, streamId, ...currentAssignmentWhere() },
    select: { id: true, user: { select: { ccgPeople: { where: { deletedAt: null }, select: { id: true } } } } },
  })
  const holds = current.find((a) => a.user.ccgPeople.some((p) => p.id === personId))
  const label = roleKey === 'sheep_seeker' ? 'a Sheep Seeker' : 'the Sheep Seeking Overseer'
  if (holds) throw conflict(`They are already ${label} for ${stream.name}`)
  // One Sheep Seeking Overseer per stream.
  if (roleKey === 'seeking_overseer') for (const a of current) await endAssignment(a.id, actorId)
  const { assignment, invite } = await assignRoleToMember({ person_id: personId, role_key: roleKey, stream_id: streamId }, actorId, origin)
  return { person_id: personId, assignment_id: assignment.id, reused, invite }
}

/** Stand a Sheep Seeker of this stream down: they also come off the stream's sheep seeking groups. */
export async function standDownSeeker(streamId: string, assignmentId: string, actorId: string) {
  const a = await prisma.ccgRoleAssignment.findFirst({ where: { id: assignmentId, streamId, roleKey: 'sheep_seeker' } })
  if (!a) throw notFound('Sheep Seeker')
  await endAssignment(a.id, actorId)
  await prisma.ccgSeekingGroupSeeker.deleteMany({ where: { userId: a.userId, group: { streamId } } })
}

// ---------------------------------------------------------------------------
// Graduated: converts who completed their assessment and became CCF members
// ---------------------------------------------------------------------------

/**
 * The Sheep Seeking side's record of converts who graduated into membership,
 * for statistics. Read-only: they are CCF members now, followed up in City
 * Church Groups. A Sheep Seeker sees those assigned to them; an Overseer their
 * stream's; the central team everyone's.
 */
export async function graduatedList(scope: CcgScope, opts: { streamId: string | null; mine: boolean; search: string | null; limit: number; offset: number }) {
  const streams = scope.streamIds('reports.view')
  if (opts.streamId && !scope.canOnStream('reports.view', opts.streamId)) throw forbidden('You can only see graduates of your streams')
  const inStream = (ids: string[]): Prisma.CcgPlacementWhereInput => ({
    OR: [{ person: { streamId: { in: ids } } }, { finalCcf: { ccg: { council: { streamId: { in: ids } } } } }],
  })
  const visible: Prisma.CcgPlacementWhereInput[] = []
  if (streams === 'all') visible.push({})
  else if (streams.length) visible.push(inStream(streams))
  if (scope.seekingGroupIds.length) visible.push({ person: { seekingGroupId: { in: scope.seekingGroupIds } } })
  if (visible.length === 0) throw forbidden('Graduates are shown to Sheep Seekers and their Overseers')

  const where: Prisma.CcgPlacementWhereInput = {
    status: 'ended',
    outcome: { in: SUCCESS_OUTCOMES },
    person: { deletedAt: null },
    AND: [
      { OR: visible },
      opts.streamId ? inStream([opts.streamId]) : {},
      opts.mine ? { person: { seekingGroupId: { in: scope.seekingGroupIds } } } : {},
      opts.search ? { person: { fullName: { contains: opts.search, mode: 'insensitive' } } } : {},
    ],
  }
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const [rows, total, thisMonth, thisYear] = await Promise.all([
    prisma.ccgPlacement.findMany({
      where,
      orderBy: { endedAt: 'desc' },
      take: opts.limit,
      skip: opts.offset,
      select: {
        id: true,
        decidedAt: true,
        endedAt: true,
        person: { select: { id: true, fullName: true, seeker: { select: { id: true, fullName: true } } } },
        finalCcf: { select: { id: true, name: true, ccg: { select: { name: true } } } },
      },
    }),
    prisma.ccgPlacement.count({ where }),
    prisma.ccgPlacement.count({ where: { AND: [where, { endedAt: { gte: monthStart } }] } }),
    prisma.ccgPlacement.count({ where: { AND: [where, { endedAt: { gte: yearStart } }] } }),
  ])
  return {
    counts: { total, this_month: thisMonth, this_year: thisYear },
    graduates: rows.map((r) => ({
      placement_id: r.id,
      person: { id: r.person.id, full_name: r.person.fullName },
      ccf: r.finalCcf ? { id: r.finalCcf.id, name: r.finalCcf.name, ccg: r.finalCcf.ccg.name } : null,
      seeker: r.person.seeker ? { id: r.person.seeker.id, full_name: r.person.seeker.fullName } : null,
      placed_on: iso(r.decidedAt),
      graduated_on: iso(r.endedAt),
      days: r.decidedAt && r.endedAt ? Math.round((r.endedAt.getTime() - r.decidedAt.getTime()) / DAY) : null,
    })),
  }
}
