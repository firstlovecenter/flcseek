import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { checklistItemSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { authorisePlacement } from '@/lib/ccg/server/placement-routes'
import { placementProgress, setChecklistItem } from '@/lib/ccg/server/progress'

export const dynamic = 'force-dynamic'
type P = { id: string }

/**
 * PUT /api/ccg/placements/[id]/checklist — tick or untick one checklist item
 * (Seeing and Hearing, introduction to the Overseer). The milestone completes
 * itself when every active item is ticked.
 */
export const PUT = withCcg<z.infer<typeof checklistItemSchema>, P>(
  { permission: 'milestones.update', schema: checklistItemSchema },
  async ({ user, scope, body, params }) => {
    await authorisePlacement(scope, 'milestones.update', params.id)
    const { graduated } = await setChecklistItem(params.id, body, user.id)
    return success({ graduated, progress: await placementProgress(params.id) })
  }
)
