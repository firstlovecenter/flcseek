import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { seekerHome } from '@/lib/ccg/server/seekers'

export const dynamic = 'force-dynamic'

/** GET /api/ccg/seekers/me — the signed-in Sheep Seeker's converts (null when they are not one). */
export const GET = withCcg({}, async ({ user }) => success({ home: await seekerHome(user.id) }))
