import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { invalid, notFound } from '@/lib/ccg/errors'
import { milestoneUpdateSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { syncAutoMilestones } from '@/lib/ccg/server/progress'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/ccg/milestones/[id] (settings.manage). Stage number, kind and
 * attendance event are fixed — progress depends on them. Deactivate instead of
 * deleting. Changing an attendance target or re-activating re-syncs every
 * active placement.
 */
export const PATCH = withCcg<z.infer<typeof milestoneUpdateSchema>, { id: string }>(
  { permission: 'settings.manage', schema: milestoneUpdateSchema },
  async ({ user, scope, body, params }) => {
    ensure(scope.can('settings.manage'))
    const before = await prisma.ccgMilestone.findUnique({ where: { id: params.id } })
    if (!before) throw notFound('Milestone')
    if (body.attendance_target !== undefined && before.kind !== 'attendance') {
      throw invalid('Only attendance milestones have an attendance target')
    }
    if (body.attendance_target === null) throw invalid('An attendance milestone needs a target')

    await prisma.ccgMilestone.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.short_name !== undefined ? { shortName: body.short_name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.guidance !== undefined ? { guidance: body.guidance } : {}),
        ...(body.target_days !== undefined ? { targetDays: body.target_days } : {}),
        ...(body.attendance_target != null ? { attendanceTarget: body.attendance_target } : {}),
        ...(body.is_active !== undefined ? { isActive: body.is_active } : {}),
        updatedAt: new Date(),
      },
    })
    const resync =
      before.kind !== 'manual' &&
      ((body.attendance_target != null && body.attendance_target !== before.attendanceTarget) ||
        (body.is_active === true && !before.isActive))
    const synced = resync ? await syncAutoMilestones('all_active') : null
    await logCcg({ userId: user.id, action: 'MILESTONE_UPDATED', entityType: 'ccg_milestone', entityId: params.id, oldValues: before, newValues: body })
    return success({ id: params.id, milestones_changed: synced?.changed ?? 0 })
  }
)
