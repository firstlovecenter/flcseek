import type { Prisma } from '@prisma/client'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { personCreateSchema, type PersonCreate } from '@/lib/ccg/schemas'
import { invalid, notFound } from '@/lib/ccg/errors'
import type { CcgScope } from '@/lib/ccg/scope'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { proposeFor } from '@/lib/ccg/server/mapping'
import { assertMemberDetails, createPerson, peopleScopeWhere, personInclude, serializePerson } from '@/lib/ccg/server/people'
import { placeDirectly } from '@/lib/ccg/server/placements'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/people?kind=&status=&ccf_id=&ccg_id=&stream_id=&seeker=<person id>|me|none&gender=&search=&duplicates=1&limit=&offset=
 * People the viewer can see: members of CCFs in scope, and converts placed or
 * proposed there. Unplaced converts are visible to global viewers only.
 */
export const GET = withCcg({ permission: 'people.view' }, async ({ scope, query }) => {
  const kind = query.get('kind')
  const status = query.get('status')
  const ccfId = query.get('ccf_id')
  const ccgId = query.get('ccg_id')
  const streamId = query.get('stream_id')
  const gender = query.get('gender')
  // seeker=me: the converts in the viewer's sheep seeking groups. seeker=<member id>: registered by
  // that Sheep Seeker (the report). seeker=none: registered by no Sheep Seeker. group=<id>: one group.
  const seeker = query.get('seeker')
  const mineOnly = seeker === 'me'
  const seekerId = mineOnly ? null : seeker
  const groupId = query.get('group')
  const search = query.get('search')?.trim()
  const limit = Math.min(Number(query.get('limit')) || 50, 200)
  const offset = Math.max(Number(query.get('offset')) || 0, 0)

  const inUnit = (unit: Prisma.CcgFamilyWhereInput): Prisma.CcgPersonWhereInput => ({
    OR: [
      { kind: 'member', ccf: unit },
      { kind: 'convert', placements: { some: { OR: [{ status: 'active', finalCcf: unit }, { status: 'proposed', proposedCcf: unit }] } } },
    ],
  })

  const where: Prisma.CcgPersonWhereInput = {
    deletedAt: null,
    ...(kind === 'member' || kind === 'convert' ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(query.get('duplicates') === '1' ? { possibleDuplicateOfId: { not: null } } : {}),
    AND: [
      peopleScopeWhere(scope, 'people.view'),
      ccfId ? inUnit({ id: ccfId }) : {},
      ccgId ? inUnit({ ccgId }) : {},
      streamId ? { OR: [inUnit({ ccg: { streamId } }), { kind: 'convert', streamId }, { kind: 'member', ccfId: null, streamId }] } : {},
      gender === 'Male' || gender === 'Female' ? { gender } : {},
      seekerId === 'none' ? { kind: 'convert', seekerPersonId: null } : seekerId ? { kind: 'convert', seekerPersonId: seekerId } : {},
      mineOnly ? { kind: 'convert', seekingGroupId: { in: scope.seekingGroupIds } } : {},
      groupId ? { kind: 'convert', seekingGroupId: groupId } : {},
      search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search.replace(/\D/g, '') || search } },
              { refCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
    ],
  }

  const [rows, total] = await Promise.all([
    prisma.ccgPerson.findMany({ where, include: personInclude, orderBy: [{ createdAt: 'desc' }], take: limit, skip: offset }),
    prisma.ccgPerson.count({ where }),
  ])
  return success({ people: rows.map((p) => serializePerson(p)) }, { total, limit, offset, hasMore: offset + rows.length < total })
})

/**
 * POST /api/ccg/people — register a member (into a CCF in scope) or a convert.
 * Converts are registered by the central team (any stream, or church-wide) or
 * by a stream's Sheep Seekers (into their stream; defaulted when they have
 * one), and matched immediately; the response includes the proposal. A CCF's
 * leaders may register a convert into their own CCF (`ccf_id`): placed there at
 * once, into the CCF's stream, past the convert limit (which is for converts placed by others).
 */
export const POST = withCcg<PersonCreate>({ permission: 'people.manage', schema: personCreateSchema }, async ({ user, scope, body }) => {
  if (body.kind === 'convert' && body.ccf_id) return registerIntoCcf(body, user.id, scope)
  // Members are added by the CCF's leaders only; converts are registered on the Sheep Seeking side.
  if (body.kind === 'member') ensure(scope.canOnMembersOf('people.manage', body.ccf_id), 'You can only add members to CCFs you lead')
  else if (!scope.can('people.manage')) {
    const seeking = scope.sheepSeeking()
    const streams = seeking.streamIds('people.manage') as string[]
    ensure(streams.length > 0, 'Converts are registered by Sheep Seekers or the central team')
    if (!body.stream_id && streams.length === 1) body.stream_id = streams[0]
    if (!body.stream_id) throw invalid('Choose the stream this convert is registered into')
    ensure(seeking.canOnStream('people.manage', body.stream_id), 'You can only register converts into your stream')
  }
  // Putting a convert in a sheep seeking group is the Overseer's call, or a seeker's for their own group
  // (left out, a seeker in one group of the stream registers into it).
  if (body.kind === 'convert' && body.seeking_group_id) {
    ensure(
      scope.can('seekers.manage') || scope.canOnStream('seekers.manage', body.stream_id) || scope.seekingGroupIds.includes(body.seeking_group_id),
      'Only the stream’s Sheep Seeking Overseer can put converts in other groups'
    )
  }
  if (body.kind === 'member') assertMemberDetails(body)
  const { kind, answers, ...core } = body
  const { person, proposal } = await createPerson({ kind, core, answers, source: 'staff', actorId: user.id })
  return created({
    id: person.id,
    possible_duplicate_of: person.possibleDuplicateOfId,
    proposal: proposal
      ? { placement_id: proposal.placement.id, status: proposal.placement.status, ccf_id: proposal.placement.proposedCcfId, hold_reason: proposal.placement.holdReason }
      : null,
  })
})

async function registerIntoCcf(body: PersonCreate, actorId: string, scope: CcgScope) {
  const ccfId = body.ccf_id!
  ensure(scope.leadership().canOnCcf('people.manage', ccfId), 'You can only register converts into CCFs you lead')
  const ccf = await prisma.ccgFamily.findFirst({ where: { id: ccfId, deletedAt: null }, include: { ccg: true } })
  if (!ccf || ccf.ccg.deletedAt) throw notFound('CCF')
  const { kind, answers, ccf_id: _ccf, seeking_group_id: _group, ...core } = body
  const { person } = await createPerson({
    kind,
    core: { ...core, stream_id: ccf.ccg.streamId },
    answers,
    source: 'staff',
    actorId,
    propose: false,
  })
  try {
    const placement = await placeDirectly(person.id, ccfId, actorId)
    return created({ id: person.id, possible_duplicate_of: person.possibleDuplicateOfId, placement: { placement_id: placement.id, status: placement.status, ccf_id: ccfId }, proposal: null })
  } catch (err) {
    // It could not be placed (the CCF is full or inactive): the convert is kept and matched like any other.
    await proposeFor(person.id, 'registration', actorId)
    throw err
  }
}
