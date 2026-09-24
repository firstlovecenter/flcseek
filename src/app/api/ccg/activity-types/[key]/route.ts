import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/ccg/errors'
import { activityTypeUpdateSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { withCcg } from '@/lib/ccg/server/handler'
import { serializeActivityType } from '@/lib/ccg/server/activities'

export const dynamic = 'force-dynamic'

/** PATCH /api/ccg/activity-types/[key] (settings.manage) — keys are fixed; deactivate instead of deleting. */
export const PATCH = withCcg<z.infer<typeof activityTypeUpdateSchema>, { key: string }>(
  { permission: 'settings.manage', schema: activityTypeUpdateSchema },
  async ({ user, body, params }) => {
    const before = await prisma.ccgActivityType.findUnique({ where: { key: params.key } })
    if (!before) throw notFound('Activity type')
    const t = await prisma.ccgActivityType.update({
      where: { key: params.key },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.cadence !== undefined ? { cadence: body.cadence } : {}),
        ...(body.schedule !== undefined ? { schedule: body.schedule } : {}),
        ...(body.guidance !== undefined ? { guidance: body.guidance } : {}),
        ...(body.is_active !== undefined ? { isActive: body.is_active } : {}),
        ...(body.sort_order !== undefined ? { sortOrder: body.sort_order } : {}),
        updatedAt: new Date(),
      },
    })
    await logCcg({ userId: user.id, action: 'ACTIVITY_TYPE_UPDATED', entityType: 'ccg_activity_type', oldValues: before, newValues: body })
    return success({ activity_type: serializeActivityType(t) })
  }
)
