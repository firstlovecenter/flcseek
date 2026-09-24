import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/ccg/errors'
import { milestoneItemUpdateSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { syncAutoMilestones } from '@/lib/ccg/server/progress'

export const dynamic = 'force-dynamic'

/** PATCH /api/ccg/milestones/[id]/items/[itemId] (settings.manage) — keys are fixed; deactivate instead of deleting. */
export const PATCH = withCcg<z.infer<typeof milestoneItemUpdateSchema>, { id: string; itemId: string }>(
  { permission: 'settings.manage', schema: milestoneItemUpdateSchema },
  async ({ user, scope, body, params }) => {
    ensure(scope.can('settings.manage'))
    const before = await prisma.ccgMilestoneItem.findFirst({ where: { id: params.itemId, milestoneId: params.id } })
    if (!before) throw notFound('Checklist item')
    await prisma.ccgMilestoneItem.update({
      where: { id: before.id },
      data: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.help !== undefined ? { help: body.help } : {}),
        ...(body.sort_order !== undefined ? { sortOrder: body.sort_order } : {}),
        ...(body.is_active !== undefined ? { isActive: body.is_active } : {}),
        updatedAt: new Date(),
      },
    })
    const synced = body.is_active !== undefined && body.is_active !== before.isActive ? await syncAutoMilestones('all_active') : null
    await logCcg({ userId: user.id, action: 'MILESTONE_ITEM_UPDATED', entityType: 'ccg_milestone', entityId: params.id, oldValues: before, newValues: body })
    return success({ id: before.id, milestones_changed: synced?.changed ?? 0 })
  }
)
