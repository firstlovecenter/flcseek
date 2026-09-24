import { NextRequest, NextResponse } from 'next/server'
import type { ZodType, ZodTypeDef } from 'zod'
import type { TokenPayload } from '@/lib/auth'
import { errors } from '@/lib/api/response'
import { getVerifiedIdentity } from '@/lib/api/middleware'
import { checkRateLimit } from '@/lib/rate-limit'
import { CcgError, ccgErrorResponse, fromPrismaError } from '../errors'
import type { Permission } from '../permissions'
import type { CcgScope } from '../scope'
import { loadScope } from './scope-loader'

/**
 * Route wrappers for /api/ccg/*. Mirrors withApiHandler (src/lib/api/handler.ts)
 * but authorises on CCG role assignments: Seek-only users are rejected here,
 * CCG-only users are rejected by Seek.
 *
 * `permission` is a coarse gate (held somewhere); handlers then check the
 * specific unit with scope.canOnCcf / canOnCcg.
 */

type RouteContext<P> = { params: Promise<P> }

export interface CcgContext<B, P> {
  request: NextRequest
  user: TokenPayload
  scope: CcgScope
  body: B
  params: P
  query: URLSearchParams
}

export interface CcgHandlerOptions<B> {
  permission?: Permission
  /** Output type is what the handler sees; input may differ (defaults, transforms). */
  schema?: ZodType<B, ZodTypeDef, unknown>
}

async function parseBody<B>(request: NextRequest, schema?: ZodType<B, ZodTypeDef, unknown>) {
  if (!schema) return { body: undefined as B }
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { error: errors.validation('Request body must be valid JSON') }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: errors.validation('Validation failed', parsed.error.flatten()) }
  return { body: parsed.data }
}

function handleError(err: unknown, where: string): NextResponse {
  if (err instanceof CcgError) return ccgErrorResponse(err)
  const mapped = fromPrismaError(err)
  if (mapped) return ccgErrorResponse(mapped)
  console.error(`[${where}] Unhandled error:`, err)
  return errors.internal()
}

export function withCcg<B = undefined, P = Record<string, string>>(
  options: CcgHandlerOptions<B>,
  handler: (ctx: CcgContext<B, P>) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeCtx: RouteContext<P>): Promise<NextResponse> => {
    try {
      const user = await getVerifiedIdentity(request)
      if (!user) return errors.unauthorized()
      if (!user.ccg_access) return errors.forbidden('You do not have access to City Church Group')

      const scope = await loadScope(user.id)
      if (options.permission && !scope.anywhere.has(options.permission)) {
        return errors.forbidden('You do not have permission for this action')
      }

      const parsed = await parseBody(request, options.schema)
      if ('error' in parsed && parsed.error) return parsed.error

      const params = ((await routeCtx?.params) ?? {}) as P
      return await handler({
        request,
        user,
        scope,
        body: parsed.body as B,
        params,
        query: new URL(request.url).searchParams,
      })
    } catch (err) {
      return handleError(err, 'withCcg')
    }
  }
}

export interface PublicContext<B, P> {
  request: NextRequest
  body: B
  params: P
}

/** Unauthenticated CCG routes (self-service forms). Always rate-limited. */
export function withCcgPublic<B = undefined, P = Record<string, string>>(
  options: { rateLimitKey: string; schema?: ZodType<B, ZodTypeDef, unknown> },
  handler: (ctx: PublicContext<B, P>) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeCtx: RouteContext<P>): Promise<NextResponse> => {
    try {
      const limited = await checkRateLimit(request, options.rateLimitKey)
      if (limited) return limited
      const parsed = await parseBody(request, options.schema)
      if ('error' in parsed && parsed.error) return parsed.error
      const params = ((await routeCtx?.params) ?? {}) as P
      return await handler({ request, body: parsed.body as B, params })
    } catch (err) {
      return handleError(err, 'withCcgPublic')
    }
  }
}

/** Throw unless `ok`. */
export function ensure(ok: boolean, message?: string): asserts ok {
  if (!ok) throw new CcgError('forbidden', message ?? 'You do not have permission for this action')
}
