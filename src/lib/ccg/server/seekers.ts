import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '../access'
import { conflict, forbidden, invalid, notFound } from '../errors'
import type { CcgScope } from '../scope'
import { iso, logCcg } from './common'
import { personFor, type Appointee } from './appointee'
import { assignRoleToMember, endAssignment } from './roles'

/**
 * Sheep Seekers: stream-level members who bring converts in, register them and
 * see them placed. Converts, and the links that register them, belong to the
 * stream, not to whoever registered them. A Sheep Seeker's converts are those
 * placed in the CCGs they are liaison for (ccg_seeking_liaison_ccgs): theirs to
 * follow, as they are the CCF Coordinator's. (ccg_people.seeker_person_id is
 * history only: who registered a convert before this rule; nothing reads it.)
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

/** Each Sheep Seeker's converts' CCFs: those of the CCGs they are liaison for, by their member id. */
export async function liaisonCcfsOf(personIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map(personIds.map((id) => [id, [] as string[]]))
  if (personIds.length === 0) return out
  const people = await prisma.ccgPerson.findMany({ where: { id: { in: personIds }, userId: { not: null } }, select: { id: true, userId: true } })
  const personOf = new Map(people.map((p) => [p.userId!, p.id]))
  const rows = await prisma.ccgSeekingLiaisonCcg.findMany({
    where: { userId: { in: [...personOf.keys()] }, ccg: { deletedAt: null } },
    select: { userId: true, ccg: { select: { families: { where: { deletedAt: null }, select: { id: true } } } } },
  })
  for (const r of rows) out.get(personOf.get(r.userId)!)!.push(...r.ccg.families.map((f) => f.id))
  return out
}

/** Every CCF some Sheep Seeker is liaison for (through its CCG). */
export async function allLiaisonCcfIds(): Promise<string[]> {
  const rows = await prisma.ccgSeekingLiaisonCcg.findMany({
    where: { ccg: { deletedAt: null } },
    select: { ccg: { select: { families: { where: { deletedAt: null }, select: { id: true } } } } },
  })
  return [...new Set(rows.flatMap((r) => r.ccg.families.map((f) => f.id)))]
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
  const streamIds = streams.map((s) => s.stream?.id).filter((x): x is string => !!x)
  const liaisonFor = await prisma.ccgSeekingLiaisonCcg.findMany({
    where: { userId, ccg: { deletedAt: null, streamId: { in: streamIds } } },
    select: { ccg: { select: { id: true, name: true, families: { where: { deletedAt: null }, select: { id: true } } } } },
  })
  const liaisonCcfIds = liaisonFor.flatMap((l) => l.ccg.families.map((f) => f.id))
  // Converts belong to the stream: its registrations and mapping are every Sheep Seeker's.
  const stream: Prisma.CcgPersonWhereInput = { kind: 'convert', streamId: { in: streamIds }, deletedAt: null }
  // Their converts: those placed in the CCGs they are liaison for (none until they are liaison for one).
  const followed: Prisma.CcgPlacementWhereInput = { finalCcfId: { in: liaisonCcfIds }, person: { deletedAt: null } }
  const [registeredThisWeek, awaiting, held, placed, succeeded, heldList, followUps, recent] = await Promise.all([
    prisma.ccgPerson.count({ where: { ...stream, createdAt: { gte: startOfWeek(now) } } }),
    prisma.ccgPerson.count({ where: { ...stream, status: 'proposed' } }),
    prisma.ccgPerson.count({ where: { ...stream, status: { in: ['new', 'needs_info'] } } }),
    prisma.ccgPlacement.count({ where: { status: 'active', ...followed } }),
    prisma.ccgPlacement.count({ where: { outcome: { in: SUCCESS_OUTCOMES }, ...followed } }),
    prisma.ccgPlacement.findMany({
      where: { status: 'held', person: stream },
      orderBy: { createdAt: 'asc' },
      take: 8,
      select: { holdReason: true, createdAt: true, person: { select: { id: true, fullName: true } } },
    }),
    prisma.ccgPlacement.findMany({
      where: { status: 'active', ...followed, checkIns: { some: {} } },
      select: {
        finalCcf: { select: { name: true } },
        person: { select: { id: true, fullName: true } },
        checkIns: { orderBy: { recordedAt: 'desc' }, take: 1, select: { followUpRequired: true, recordedAt: true, notes: true } },
      },
    }),
    prisma.ccgPerson.findMany({
      where: stream,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, fullName: true, status: true, createdAt: true },
    }),
  ])

  return {
    seeker: { person_id: me.id, name: me.fullName },
    streams: streams.map((s) => s.stream).filter((s): s is { id: string; name: string } => !!s),
    /** The CCGs they are liaison for. */
    liaison_ccgs: liaisonFor.map((l) => ({ id: l.ccg.id, name: l.ccg.name })),
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

/** A campus's streams the viewer reports on (Sheep Seeking side): a campus drilled into. */
async function campusStreams(scope: CcgScope, campusId: string) {
  const rows = await prisma.ccgStream.findMany({ where: { campusId, deletedAt: null }, select: { id: true } })
  return rows.map((s) => s.id).filter((id) => scope.canOnStream('reports.view', id))
}

export async function seekerReport(full: CcgScope, opts: { streamId: string | null; campusId?: string | null; period: ReportPeriod; offset: number }) {
  const scope = full.sheepSeeking()
  const inScope = scope.streamIds('reports.view')
  if (opts.streamId && !scope.canOnStream('reports.view', opts.streamId)) throw forbidden('You can only see reports for your streams')
  const streams: string[] | 'all' = opts.streamId ? [opts.streamId] : opts.campusId ? await campusStreams(scope, opts.campusId) : inScope
  if (streams !== 'all' && streams.length === 0) throw forbidden('Sheep Seeker reports are for streams you oversee')

  const { from, to, label } = periodRange(opts.period, Math.max(0, opts.offset))
  const seekers = await seekersIn(streams)
  const inPeriod = { gte: from, lt: to }
  // A Sheep Seeker's converts are those in the CCFs of the CCGs they are liaison for. A CCG can
  // have more than one liaison, so each seeker's row counts all of them; the total counts each once.
  const ccfsOf = await liaisonCcfsOf(seekers.map((s) => s.person_id))
  const seekersOfCcf = new Map<string, string[]>()
  for (const [personId, ccfs] of ccfsOf) for (const c of ccfs) seekersOfCcf.set(c, [...(seekersOfCcf.get(c) ?? []), personId])
  const people: Prisma.CcgPersonWhereInput = { kind: 'convert', deletedAt: null, ...(streams === 'all' ? {} : { streamId: { in: streams } }) }
  const lastCcf = {
    where: { status: { in: ['active', 'ended'] }, finalCcfId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { finalCcfId: true },
  } satisfies Prisma.CcgPerson$placementsArgs
  const [registered, placed, ended, active] = await Promise.all([
    prisma.ccgPerson.findMany({ where: { ...people, createdAt: inPeriod }, select: { placements: lastCcf } }),
    prisma.ccgPlacement.findMany({ where: { decision: { in: ['approved', 'remapped'] }, decidedAt: inPeriod, person: people }, select: { finalCcfId: true } }),
    prisma.ccgPlacement.findMany({
      // (Converts confirmed as a Bacenta's are not dropped: they were never the CCF's.)
      where: { status: 'ended', endedAt: inPeriod, outcome: { notIn: ['bacenta'] }, NOT: { outcome: null }, person: people },
      select: { outcome: true, finalCcfId: true },
    }),
    prisma.ccgPlacement.findMany({ where: { status: 'active', person: people }, select: { finalCcfId: true } }),
  ])

  type Row = { registered: number; placed: number; became_members: number; dropped: number; in_assessment: number }
  const empty = (): Row => ({ registered: 0, placed: 0, became_members: 0, dropped: 0, in_assessment: 0 })
  const rows = new Map<string, Row>()
  const total = empty()
  const add = (ccfId: string | null | undefined, k: keyof Row) => {
    total[k]++
    const owners = (ccfId && seekersOfCcf.get(ccfId)) || ['none']
    for (const o of owners) {
      if (!rows.has(o)) rows.set(o, empty())
      rows.get(o)![k]++
    }
  }
  for (const r of registered) add(r.placements[0]?.finalCcfId, 'registered')
  for (const p of placed) add(p.finalCcfId, 'placed')
  for (const e of ended) add(e.finalCcfId, SUCCESS_OUTCOMES.includes(e.outcome!) ? 'became_members' : 'dropped')
  for (const a of active) add(a.finalCcfId, 'in_assessment')

  const out = seekers.map((s) => ({ ...s, ...(rows.get(s.person_id) ?? empty()) }))
  const unassigned = rows.get('none')

  return {
    period: opts.period,
    offset: opts.offset,
    range: { from: iso(from), to: iso(to), label },
    seekers: out,
    /** Converts in these streams in no liaison's CCG (not placed yet, or in a CCG with no liaison). */
    unassigned: unassigned ?? empty(),
    total,
  }
}

/** A stream's Sheep Seeking Admin, Overseer and Sheep Seekers (with their assignment ids, to stand them down). */
export async function streamTeam(streamId: string) {
  const rows = await prisma.ccgRoleAssignment.findMany({
    where: { streamId, roleKey: { in: ['seeking_admin', 'seeking_overseer', 'sheep_seeker'] }, ...currentAssignmentWhere() },
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
  const one = (key: string) => {
    const r = rows.find((x) => x.roleKey === key)
    return r ? holder(r) : null
  }
  const seekers = rows.filter((r) => r.roleKey === 'sheep_seeker')
  const liaisons = await prisma.ccgSeekingLiaisonCcg.findMany({
    where: { userId: { in: seekers.map((r) => r.userId) }, ccg: { streamId, deletedAt: null } },
    select: { userId: true, ccg: { select: { id: true, name: true } } },
    orderBy: { ccg: { name: 'asc' } },
  })
  return {
    admin: one('seeking_admin'),
    overseer: one('seeking_overseer'),
    seekers: seekers.map((r) => ({
      ...holder(r),
      /** The CCGs they are liaison for. */
      ccgs: liaisons.filter((l) => l.userId === r.userId).map((l) => l.ccg),
    })),
  }
}

/** Each campus's Sheep Seeking Admin and Overseer. */
export async function campusSeekingTeams(campusIds: string[] | 'all') {
  const [campuses, rows] = await Promise.all([
    prisma.ccgCampus.findMany({ where: { deletedAt: null, ...(campusIds === 'all' ? {} : { id: { in: campusIds } }) }, orderBy: { name: 'asc' } }),
    prisma.ccgRoleAssignment.findMany({
      where: { roleKey: { in: ['campus_seeking_admin', 'campus_seeking_overseer'] }, ...(campusIds === 'all' ? {} : { campusId: { in: campusIds } }), ...currentAssignmentWhere() },
      select: {
        id: true,
        roleKey: true,
        campusId: true,
        startsOn: true,
        userId: true,
        user: { select: { ccgPeople: { where: { kind: 'member', deletedAt: null }, select: { id: true, fullName: true }, take: 1 } } },
      },
    }),
  ])
  const holder = (r: (typeof rows)[number]) => ({
    assignment_id: r.id,
    user_id: r.userId,
    person_id: r.user.ccgPeople[0]?.id ?? null,
    name: r.user.ccgPeople[0]?.fullName ?? 'Unknown',
    since: iso(r.startsOn),
  })
  return campuses.map((c) => {
    const find = (key: string) => {
      const r = rows.find((x) => x.campusId === c.id && x.roleKey === key)
      return r ? holder(r) : null
    }
    return { id: c.id, name: c.name, admin: find('campus_seeking_admin'), overseer: find('campus_seeking_overseer') }
  })
}

// ---------------------------------------------------------------------------
// Appointing a Sheep Seeker
// ---------------------------------------------------------------------------

export type AddSeeker = Appointee

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

export const STREAM_LEADS = { admin: 'seeking_admin', overseer: 'seeking_overseer' } as const
export const CAMPUS_LEADS = { admin: 'campus_seeking_admin', overseer: 'campus_seeking_overseer' } as const
export type SeekingLead = keyof typeof STREAM_LEADS

const LEAD_LABEL: Record<string, string> = {
  seeking_admin: 'the Sheep Seeking Admin',
  seeking_overseer: 'the Sheep Seeking Overseer',
  campus_seeking_admin: 'the Campus Sheep Seeking Admin',
  campus_seeking_overseer: 'the Campus Sheep Seeking Overseer',
  sheep_seeker: 'a Sheep Seeker',
}

/** Make someone the stream's Sheep Seeking Admin or Overseer (one of each per stream: the current one stands down). */
export async function setStreamSeekingLead(streamId: string, lead: SeekingLead, body: AddSeeker, actorId: string, origin: string) {
  return appointInStream(streamId, STREAM_LEADS[lead], body, actorId, origin)
}

/** Make someone the campus's Sheep Seeking Admin or Overseer (one of each per campus). */
export async function setCampusSeekingLead(campusId: string, lead: SeekingLead, body: AddSeeker, actorId: string, origin: string) {
  const campus = await prisma.ccgCampus.findFirst({ where: { id: campusId, deletedAt: null } })
  if (!campus) throw notFound('Campus')
  const roleKey = CAMPUS_LEADS[lead]
  const { personId, reused } = await personFor(null, body, actorId)
  const current = await prisma.ccgRoleAssignment.findMany({
    where: { roleKey, campusId, ...currentAssignmentWhere() },
    select: { id: true, user: { select: { ccgPeople: { where: { deletedAt: null }, select: { id: true } } } } },
  })
  if (current.some((a) => a.user.ccgPeople.some((p) => p.id === personId))) throw conflict(`They are already ${LEAD_LABEL[roleKey]} for ${campus.name}`)
  for (const a of current) await endAssignment(a.id, actorId)
  const { assignment, invite } = await assignRoleToMember({ person_id: personId, role_key: roleKey, campus_id: campusId }, actorId, origin)
  return { person_id: personId, assignment_id: assignment.id, reused, invite }
}

/** The person to appoint: an existing member, one with the same email, or someone new (of the stream, when there is one). */

async function appointInStream(streamId: string, roleKey: 'sheep_seeker' | 'seeking_admin' | 'seeking_overseer', body: AddSeeker, actorId: string, origin: string) {
  const stream = await prisma.ccgStream.findFirst({ where: { id: streamId, deletedAt: null } })
  if (!stream) throw notFound('Stream')
  const { personId, reused } = await personFor(streamId, body, actorId)

  const current = await prisma.ccgRoleAssignment.findMany({
    where: { roleKey, streamId, ...currentAssignmentWhere() },
    select: { id: true, user: { select: { ccgPeople: { where: { deletedAt: null }, select: { id: true } } } } },
  })
  const holds = current.find((a) => a.user.ccgPeople.some((p) => p.id === personId))
  if (holds) throw conflict(`They are already ${LEAD_LABEL[roleKey]} for ${stream.name}`)
  // One Sheep Seeking Admin and one Overseer per stream.
  if (roleKey !== 'sheep_seeker') for (const a of current) await endAssignment(a.id, actorId)
  const { assignment, invite } = await assignRoleToMember({ person_id: personId, role_key: roleKey, stream_id: streamId }, actorId, origin)
  return { person_id: personId, assignment_id: assignment.id, reused, invite }
}

/** Stand a Sheep Seeker of this stream down: they also stop being liaison for the stream's CCGs. */
export async function standDownSeeker(streamId: string, assignmentId: string, actorId: string) {
  const a = await prisma.ccgRoleAssignment.findFirst({ where: { id: assignmentId, streamId, roleKey: 'sheep_seeker' } })
  if (!a) throw notFound('Sheep Seeker')
  await endAssignment(a.id, actorId)
  await prisma.ccgSeekingLiaisonCcg.deleteMany({ where: { userId: a.userId, ccg: { streamId } } })
}

// ---------------------------------------------------------------------------
// Sheep Seeking Liaisons
// ---------------------------------------------------------------------------

/**
 * Make a Sheep Seeker of this stream liaison for exactly these CCGs of the
 * stream (an empty list ends it). The converts placed in their CCFs become
 * theirs to follow, as they are the CCF Coordinator's. Logged on each CCG's history.
 */
export async function setLiaisonCcgs(streamId: string, assignmentId: string, ccgIds: string[], actorId: string) {
  const a = await prisma.ccgRoleAssignment.findFirst({ where: { id: assignmentId, streamId, roleKey: 'sheep_seeker', ...currentAssignmentWhere() } })
  if (!a) throw notFound('Sheep Seeker')
  const wanted = [...new Set(ccgIds)]
  const found = await prisma.ccgGroup.findMany({ where: { id: { in: wanted }, deletedAt: null, streamId }, select: { id: true } })
  if (found.length !== wanted.length) throw invalid('Choose CCGs of this stream')
  const current = (await prisma.ccgSeekingLiaisonCcg.findMany({ where: { userId: a.userId, ccg: { streamId } }, select: { ccgId: true } })).map((l) => l.ccgId)
  const added = wanted.filter((id) => !current.includes(id))
  const removed = current.filter((id) => !wanted.includes(id))
  await prisma.$transaction([
    prisma.ccgSeekingLiaisonCcg.deleteMany({ where: { userId: a.userId, ccgId: { in: removed } } }),
    prisma.ccgSeekingLiaisonCcg.createMany({ data: added.map((ccgId) => ({ ccgId, userId: a.userId, assignedBy: actorId })), skipDuplicates: true }),
  ])
  // On each CCG's history: "… became Time with Rev Agyei CCG Sheep Seeking Liaison".
  for (const [ids, action] of [[added, 'LIAISON_ASSIGNED'], [removed, 'LIAISON_REMOVED']] as const) {
    for (const ccgId of ids) {
      await logCcg({ userId: actorId, action, entityType: 'ccg_group', entityId: ccgId, newValues: { user_id: a.userId, ccg: ccgId } })
    }
  }
  return { ccg_ids: wanted }
}

// ---------------------------------------------------------------------------
// Graduated: converts who completed their assessment and became CCF members
// ---------------------------------------------------------------------------

/**
 * The Sheep Seeking side's record of converts who graduated into membership,
 * for statistics. Read-only: they are CCF members now, followed up in City
 * Church Groups. A Sheep Seeker sees their stream's (`mine`: those from the
 * CCFs they are liaison for); an Overseer their stream's; the central team everyone's.
 */
export async function graduatedList(
  full: CcgScope,
  opts: { streamId: string | null; campusId?: string | null; mine: boolean; search: string | null; limit: number; offset: number }
) {
  const scope = full.sheepSeeking()
  const streams = scope.streamIds('reports.view')
  if (opts.streamId && !scope.canOnStream('reports.view', opts.streamId)) throw forbidden('You can only see graduates of your streams')
  const inStream = (ids: string[]): Prisma.CcgPlacementWhereInput => ({
    OR: [{ person: { streamId: { in: ids } } }, { finalCcf: { ccg: { streamId: { in: ids } } } }],
  })
  const visible: Prisma.CcgPlacementWhereInput[] = []
  if (streams === 'all') visible.push({})
  else if (streams.length) visible.push(inStream(streams))
  if (scope.liaisonCcfIds.length) visible.push({ finalCcfId: { in: scope.liaisonCcfIds } })
  if (visible.length === 0) throw forbidden('Graduates are shown to Sheep Seekers and their Overseers')

  const where: Prisma.CcgPlacementWhereInput = {
    status: 'ended',
    outcome: { in: SUCCESS_OUTCOMES },
    person: { deletedAt: null },
    AND: [
      { OR: visible },
      opts.streamId ? inStream([opts.streamId]) : {},
      opts.campusId && !opts.streamId ? inStream(await campusStreams(scope, opts.campusId)) : {},
      opts.mine ? { finalCcfId: { in: scope.liaisonCcfIds } } : {},
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
        person: { select: { id: true, fullName: true } },
        finalCcf: {
          select: {
            id: true,
            name: true,
            ccg: {
              select: {
                name: true,
                liaisons: { select: { user: { select: { ccgPeople: { where: { kind: 'member', deletedAt: null }, select: { id: true, fullName: true }, take: 1 } } } } },
              },
            },
          },
        },
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
      /** The Sheep Seekers who are liaison for their CCG. */
      liaisons: (r.finalCcf?.ccg.liaisons ?? []).flatMap((l) => l.user.ccgPeople.map((m) => ({ id: m.id, full_name: m.fullName }))),
      placed_on: iso(r.decidedAt),
      graduated_on: iso(r.endedAt),
      days: r.decidedAt && r.endedAt ? Math.round((r.endedAt.getTime() - r.decidedAt.getTime()) / DAY) : null,
    })),
  }
}
