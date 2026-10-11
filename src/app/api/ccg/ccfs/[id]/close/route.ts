import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { closeCcfSchema } from '@/lib/ccg/schemas'
import { closeCcf, closurePreview } from '@/lib/ccg/server/ccf-closure'
import { withCcg } from '@/lib/ccg/server/handler'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/ccfs/[id]/close — what closing it would move: its members and placed converts,
 * those waiting for it, pending move requests, and the CCFs the viewer may send people to (with room).
 * The central team, or the Sheep Seeking Admin of its stream or campus.
 */
export const GET = withCcg<undefined, { id: string }>({}, async ({ scope, params }) => success(await closurePreview(scope, params.id)))

/**
 * POST /api/ccg/ccfs/[id]/close { to_ccf_id?, moves?: { person_id: ccf_id }, coordinators?: 'member'|'coordinator' }
 * — close it down, moving each member and placed convert to the CCF chosen for them (or `to_ccf_id`).
 * Converts keep their milestones and assessment year; those waiting or on hold for it are matched
 * again. CONFLICT (details.reason = "convert_limit") when a receiving CCF can't take its converts;
 * then nothing moves.
 */
export const POST = withCcg<z.infer<typeof closeCcfSchema>, { id: string }>({ schema: closeCcfSchema }, async ({ request, user, scope, body, params }) =>
  success({ id: params.id, ...(await closeCcf(scope, params.id, body, user.id, new URL(request.url).origin)) })
)
