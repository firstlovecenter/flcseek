import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { ccfSchema } from '@/lib/ccg/schemas'
import { getCcgConfig, logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { canBuildIn, canLeadBeneath } from '@/lib/ccg/server/admin-access'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { loadProfiles } from '@/lib/ccg/server/profiles'
import { loadQuestionBank } from '@/lib/ccg/server/questions'
import { assertCcgExists, ccfInclude, createWithCode, serializeCcf, serializeProfile } from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/ccfs?ccg_id=&council_id=&stream_id=&campus_id=&with_profile=1
 * CCFs the viewer leads. A stream's sheep seeking roles also get its CCFs (with
 * their CCG), to place converts into, but never their profiles. Profiles are
 * optional (they cost more to build).
 */
export const GET = withCcg({}, async ({ scope, query }) => {
  const led = scope.ccfIds('people.view')
  const placeStreams = scope.sheepSeeking().streamIds('placements.view')
  const ccgId = query.get('ccg_id')
  const streamId = query.get('stream_id')
  const councilId = query.get('council_id')
  const campusId = query.get('campus_id')
  const visibility =
    led === 'all' || placeStreams === 'all'
      ? {}
      : { OR: [{ id: { in: led } }, ...(placeStreams.length ? [{ ccg: { streamId: { in: placeStreams } } }] : [])] }
  const ccfs = await prisma.ccgFamily.findMany({
    where: {
      deletedAt: null,
      ccg: { deletedAt: null, ...(streamId ? { streamId } : {}), ...(councilId ? { councilId } : {}), ...(campusId ? { stream: { campusId } } : {}) },
      ...(ccgId ? { ccgId } : {}),
      ...visibility,
    },
    include: ccfInclude,
    orderBy: { name: 'asc' },
  })
  const profiled = ccfs.filter((f) => scope.canOnCcf('people.view', f.id))
  if (query.get('with_profile') !== '1' || profiled.length === 0) {
    return success({ ccfs: ccfs.map((f) => serializeCcf(f)) })
  }
  const [bank, config] = await Promise.all([loadQuestionBank(), getCcgConfig()])
  const { byCcf } = await loadProfiles({ bank, config, ccfIds: profiled.map((f) => f.id) })
  return success({
    ccfs: ccfs.map((f) => {
      const p = byCcf.get(f.id)
      return serializeCcf(f, p ? { profile: serializeProfile(p, bank) } : {})
    }),
  })
})

/** POST /api/ccg/ccfs (the central team, or the admins of its CCG and above; its Coordinator needs leaders.appoint there) */
export const POST = withCcg<z.infer<typeof ccfSchema>>(
  { permission: 'units.edit', schema: ccfSchema },
  async ({ request, user, scope, body }) => {
    ensure(canBuildIn(scope, 'ccg', body.ccg_id), 'Only the central team, or the CCG’s admins, add CCFs to it')
    if (body.leader) ensure(canLeadBeneath(scope, 'ccg', body.ccg_id), 'You cannot choose this CCF’s Coordinator')
    await assertCcgExists(body.ccg_id)
    const f = await createWithCode('ccf', body.code, (code) => prisma.ccgFamily.create({
      data: {
        ccgId: body.ccg_id,
        code,
        name: body.name,
        meetingLocation: body.meeting_location ?? null,
        meetingDay: body.meeting_day ?? null,
        meetingTime: body.meeting_time ?? null,
        meetingFrequency: body.meeting_frequency,
        status: body.status,
        notes: body.notes ?? null,
        createdBy: user.id,
      },
    }))
    await logCcg({ userId: user.id, action: 'CCF_CREATED', entityType: 'ccg_family', entityId: f.id, newValues: body })
    const leader_invite = body.leader ? await setUnitLeader('ccf', f.id, body.leader, user.id, new URL(request.url).origin) : null
    return created({ id: f.id, leader_invite })
  }
)
