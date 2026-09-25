import type { Prisma } from '@prisma/client'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { personCreateSchema, type PersonCreate } from '@/lib/ccg/schemas'
import { invalid } from '@/lib/ccg/errors'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { createPerson, peopleScopeWhere, personInclude, serializePerson } from '@/lib/ccg/server/people'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/people?kind=&status=&ccf_id=&ccg_id=&council_id=&stream_id=&seeker=<person id>|me|none&gender=&search=&duplicates=1&limit=&offset=
 * People the viewer can see: members of CCFs in scope, and converts placed or
 * proposed there. Unplaced converts are visible to global viewers only.
 */
export const GET = withCcg({ permission: 'people.view' }, async ({ user, scope, query }) => {
  const kind = query.get('kind')
  const status = query.get('status')
  const ccfId = query.get('ccf_id')
  const ccgId = query.get('ccg_id')
  const councilId = query.get('council_id')
  const streamId = query.get('stream_id')
  const gender = query.get('gender')
  // A Sheep Seeker's converts: a member id, the viewer's own ('me') or none yet.
  const seeker = query.get('seeker')
  const seekerId =
    seeker === 'me'
      ? (await prisma.ccgPerson.findFirst({ where: { userId: user.id, kind: 'member', deletedAt: null }, select: { id: true } }))?.id ?? '00000000-0000-0000-0000-000000000000'
      : seeker
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
      councilId ? inUnit({ ccg: { councilId } }) : {},
      streamId ? { OR: [inUnit({ ccg: { council: { streamId } } }), { kind: 'convert', streamId }] } : {},
      gender === 'Male' || gender === 'Female' ? { gender } : {},
      seekerId === 'none' ? { kind: 'convert', seekerPersonId: null } : seekerId ? { kind: 'convert', seekerPersonId: seekerId } : {},
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
 * one). A new convert is matched immediately; the response includes the proposal.
 */
export const POST = withCcg<PersonCreate>({ permission: 'people.manage', schema: personCreateSchema }, async ({ user, scope, body }) => {
  if (body.kind === 'member') ensure(scope.canOnCcf('people.manage', body.ccf_id), 'You can only add members to CCFs in your scope')
  else if (!scope.can('people.manage')) {
    const streams = scope.streamIds('people.manage') as string[]
    ensure(streams.length > 0, 'Converts are registered by Sheep Seekers or the central team')
    if (!body.stream_id && streams.length === 1) body.stream_id = streams[0]
    if (!body.stream_id) throw invalid('Choose the stream this convert is registered into')
    ensure(scope.canOnStream('people.manage', body.stream_id), 'You can only register converts into your stream')
  }
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
