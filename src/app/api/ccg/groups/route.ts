import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { topGroups } from '@/lib/ccg/server/unit-overview'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/groups — the streams the viewer can see, with leader and counts. */
export const GET = withCcg({}, async ({ scope }) => success(await topGroups(scope)))
