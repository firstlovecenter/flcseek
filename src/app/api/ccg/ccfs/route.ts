import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { ccfSchema } from '@/lib/ccg/schemas'
import { inFilter } from '@/lib/ccg/scope'
import { getCcgConfig, logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { setUnitLeader } from '@/lib/ccg/server/roles'
import { loadProfiles } from '@/lib/ccg/server/profiles'
import { loadQuestionBank } from '@/lib/ccg/server/questions'
import { assertCcgExists, ccfInclude, serializeCcf, serializeProfile } from '@/lib/ccg/server/units'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/ccfs?ccg_id=&council_id=&with_profile=1
 * CCFs the viewer can see. Profiles are optional (they cost more to build).
 */
export const GET = withCcg({}, async ({ scope, query }) => {
  const visible = inFilter(scope.ccfIds('people.view'))
  const ccgId = query.get('ccg_id')
  const councilId = query.get('council_id')
  const ccfs = await prisma.ccgFamily.findMany({
    where: {
      deletedAt: null,
      ccg: { deletedAt: null, ...(councilId ? { councilId } : {}) },
      ...(visible ? { id: visible } : {}),
      ...(ccgId ? { ccgId } : {}),
    },
    include: ccfInclude,
    orderBy: [{ ccg: { code: 'asc' } }, { code: 'asc' }],
  })
  if (query.get('with_profile') !== '1' || ccfs.length === 0) {
    return success({ ccfs: ccfs.map((f) => serializeCcf(f)) })
  }
  const [bank, config] = await Promise.all([loadQuestionBank(), getCcgConfig()])
  const { byCcf } = await loadProfiles({ bank, config, ccfIds: ccfs.map((f) => f.id) })
  return success({
    ccfs: ccfs.map((f) => {
      const p = byCcf.get(f.id)
      return serializeCcf(f, p ? { profile: serializeProfile(p, bank) } : {})
    }),
  })
})

/** POST /api/ccg/ccfs (structure.manage) */
export const POST = withCcg<z.infer<typeof ccfSchema>>(
  { permission: 'structure.manage', schema: ccfSchema },
  async ({ request, user, scope, body }) => {
    ensure(scope.can('structure.manage'))
    if (body.leader) ensure(scope.can('roles.manage'), 'Setting a leader needs permission to manage roles')
    await assertCcgExists(body.ccg_id)
    const f = await prisma.ccgFamily.create({
      data: {
        ccgId: body.ccg_id,
        code: body.code,
        name: body.name,
        meetingLocation: body.meeting_location ?? null,
        meetingDay: body.meeting_day ?? null,
        meetingTime: body.meeting_time ?? null,
        meetingFrequency: body.meeting_frequency,
        capacity: body.capacity,
        status: body.status,
        notes: body.notes ?? null,
        createdBy: user.id,
      },
    })
    await logCcg({ userId: user.id, action: 'CCF_CREATED', entityType: 'ccg_family', entityId: f.id, newValues: body })
    const leader_invite = body.leader ? await setUnitLeader('ccf', f.id, body.leader, user.id, new URL(request.url).origin) : null
    return created({ id: f.id, leader_invite })
  }
)
