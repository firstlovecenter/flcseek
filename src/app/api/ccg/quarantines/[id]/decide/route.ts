import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { quarantineDecisionSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { decideQuarantine } from '@/lib/ccg/server/quarantine'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/quarantines/[id]/decide `{ decision: confirm|release|replace, note? }`
 * (seekers.manage on the convert's stream). confirm: belongs to a Bacenta, out of CCF
 * placement for good. release: back to the same CCF with their progress (if it has room).
 * replace: matched afresh for another CCF; the proposal goes to Approvals.
 */
export const POST = withCcg<z.infer<typeof quarantineDecisionSchema>, { id: string }>(
  { permission: 'seekers.manage', schema: quarantineDecisionSchema },
  async ({ user, scope, body, params }) => success(await decideQuarantine(scope, params.id, body.decision, body.note ?? null, user.id))
)
