import { success } from '@/lib/api/response'
import { getClientIdentifier } from '@/lib/rate-limit'
import { publicSubmissionSchema, type PublicSubmission } from '@/lib/ccg/schemas'
import { withCcgPublic } from '@/lib/ccg/server/handler'
import { getPublicForm, submitPublicForm } from '@/lib/ccg/server/links'

export const dynamic = 'force-dynamic'
type P = { token: string }

/**
 * GET /api/ccg/public/forms/[token] — no login. The form to show: core fields,
 * and the questions for this link's audience (plus current answers for
 * a person_update link). An invalid, expired, used-up or revoked link → 404.
 */
export const GET = withCcgPublic<undefined, P>({ rateLimitKey: '/api/ccg/public/view' }, async ({ params }) =>
  success(await getPublicForm(params.token))
)

/**
 * POST /api/ccg/public/forms/[token] — no login. Submit the form. Idempotent on
 * client_submission_id (a UUID the client generates once per form fill).
 * Returns only a short reference — never matching results.
 */
export const POST = withCcgPublic<PublicSubmission, P>(
  { rateLimitKey: '/api/ccg/public/submit', schema: publicSubmissionSchema },
  async ({ request, body, params }) =>
    success(
      await submitPublicForm(params.token, body, {
        ip: getClientIdentifier(request),
        userAgent: request.headers.get('user-agent'),
      })
    )
)
