import { success } from '@/lib/api/response'
import { forgotPasswordSchema } from '@/lib/ccg/schemas'
import { withCcgPublic } from '@/lib/ccg/server/handler'
import { requestPasswordReset } from '@/lib/ccg/server/member-login'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ccg/public/password/forgot — no login. `{ email }` (or username).
 * Emails a one-time reset link, valid for an hour, when a login matches. The
 * answer is always the same, so it cannot be used to find out who has an account.
 */
export const POST = withCcgPublic<{ email: string }>(
  { rateLimitKey: '/api/ccg/public/forgot', schema: forgotPasswordSchema },
  async ({ request, body }) => {
    try {
      await requestPasswordReset(body.email, new URL(request.url).origin)
    } catch (err) {
      console.error('[ccg] password reset request failed:', err)
    }
    return success({ ok: true })
  }
)
