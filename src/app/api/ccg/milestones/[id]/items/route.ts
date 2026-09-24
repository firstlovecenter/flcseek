import type { z } from 'zod'
import { created } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { invalid, notFound } from '@/lib/ccg/errors'
import { milestoneItemSchema } from '@/lib/ccg/schemas'
import { logCcg } from '@/lib/ccg/server/common'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { syncAutoMilestones } from '@/lib/ccg/server/progress'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/milestones/[id]/items (settings.manage) — add a checklist item.
 * A new active item re-opens the milestone for anyone who has not ticked it.
 */
export const POST = withCcg<z.infer<typeof milestoneItemSchema>, { id: string }>(
  { permission: 'settings.manage', schema: milestoneItemSchema },
  async ({ user, scope, body, params }) => {
    ensure(scope.can('settings.manage'))
    const m = await prisma.ccgMilestone.findUnique({ where: { id: params.id } })
    if (!m) throw notFound('Milestone')
    if (m.kind !== 'checklist') throw invalid('Only checklist milestones have items')
    const item = await prisma.ccgMilestoneItem.create({
      data: { milestoneId: m.id, key: body.key, label: body.label, help: body.help ?? null, sortOrder: body.sort_order, isActive: body.is_active },
    })
    const synced = body.is_active ? await syncAutoMilestones('all_active') : null
    await logCcg({ userId: user.id, action: 'MILESTONE_ITEM_CREATED', entityType: 'ccg_milestone', entityId: m.id, newValues: body })
    return created({ id: item.id, milestones_changed: synced?.changed ?? 0 })
  }
)
