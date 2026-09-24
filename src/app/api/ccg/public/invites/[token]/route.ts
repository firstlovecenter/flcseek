import { success } from '@/lib/api/response'
import { acceptInviteSchema } from '@/lib/ccg/schemas'
import { withCcgPublic } from '@/lib/ccg/server/handler'
import { acceptInvite, describeInvite } from '@/lib/ccg/server/member-login'

export const dynamic = 'force-dynamic'
type P = { token: string }

/** GET /api/ccg/public/invites/[token] — no login. Who the invitation is for; 404 when used, expired or revoked. */
export const GET = withCcgPublic<undefined, P>({ rateLimitKey: '/api/ccg/public/view' }, async ({ params }) =>
  success(await describeInvite(params.token))
)

/** POST /api/ccg/public/invites/[token] — no login. Choose a password; the link then stops working. */
export const POST = withCcgPublic<{ password: string }, P>(
  { rateLimitKey: '/api/ccg/public/invite', schema: acceptInviteSchema },
  async ({ body, params }) => success(await acceptInvite(params.token, body.password))
)
