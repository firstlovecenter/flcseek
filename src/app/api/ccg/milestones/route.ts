import type { z } from 'zod'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { milestoneSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { loadMilestones, serializeMilestone } from '@/lib/ccg/server/progress'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/milestones?include_inactive=1 — with kind, guidance and checklist items. */
export const GET = withCcg({}, async ({ query }) => {
  const rows = await loadMilestones(prisma, query.get('include_inactive') === '1')
  return success({ milestones: rows.map(serializeMilestone) })
})

/** POST /api/ccg/milestones (settings.manage). Add checklist items with POST /milestones/[id]/items. */
export const POST = withCcg<z.infer<typeof milestoneSchema>>(
  { permission: 'settings.manage', schema: milestoneSchema },
  async ({ user, scope, body }) => {
    ensure(scope.can('settings.manage'))
    const m = await prisma.ccgMilestone.create({
      data: {
        stageNumber: body.stage_number,
        name: body.name,
        shortName: body.short_name,
        kind: body.kind,
        attendanceEvent: body.kind === 'attendance' ? body.attendance_event ?? null : null,
        attendanceTarget: body.kind === 'attendance' ? body.attendance_target ?? null : null,
        description: body.description ?? null,
        guidance: body.guidance ?? null,
        targetDays: body.target_days ?? null,
        isActive: body.is_active,
      },
    })
    await logCcg({ userId: user.id, action: 'MILESTONE_CREATED', entityType: 'ccg_milestone', entityId: m.id, newValues: body })
    return created({ id: m.id })
  }
)
