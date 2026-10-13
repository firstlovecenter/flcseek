import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { quarantineSchema } from '@/lib/ccg/schemas'
import { withCcg } from '@/lib/ccg/server/handler'
import { quarantineConvert } from '@/lib/ccg/server/quarantine'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/people/[id]/quarantine `{ reason }` — set aside a convert who already
 * belongs to a Bacenta (people.manage on their CCF, or on their stream's Sheep Seeking
 * side). A placed convert leaves the CCF at once; the stream's Sheep Seeking Admin decides.
 */
export const POST = withCcg<z.infer<typeof quarantineSchema>, { id: string }>(
  { permission: 'people.manage', schema: quarantineSchema },
  async ({ user, scope, body, params }) => success(await quarantineConvert(scope, params.id, body.reason, user.id))
)
