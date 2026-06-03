import { NextRequest, NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import type { UserPayload } from '@/lib/auth';
import type { UserRole } from '@/lib/constants';
import { errors } from './response';
import { getAuthUser, hasMinRole } from './middleware';

/**
 * Centralized API route wrapper.
 *
 * Handles, in one place, the cross-cutting concerns that were previously
 * duplicated (and drifting) across every route handler:
 *  - authentication (cookie + Bearer, via getAuthUser)
 *  - role / minimum-role authorization
 *  - JSON body parsing + Zod validation
 *  - a single error contract ({ success: false, error: { code, message } })
 *
 * The wrapped handler receives a typed context and is expected to return a
 * NextResponse (use the `success` / `created` helpers for the success contract).
 */

export interface HandlerContext<Body, Params> {
  request: NextRequest;
  user: UserPayload;
  body: Body;
  params: Params;
}

export interface AuthRequirement {
  roles?: UserRole[];
  minRole?: UserRole;
}

export interface HandlerOptions<Body> {
  /** true = any authenticated user; object = role-constrained; omitted/false = public */
  auth?: boolean | AuthRequirement;
  /** Zod schema for the JSON body. When set, the parsed value is passed as ctx.body. */
  schema?: ZodType<Body>;
}

type RouteContext<Params> = { params?: Promise<Params> } | undefined;

export function withApiHandler<Body = undefined, Params = Record<string, string>>(
  options: HandlerOptions<Body>,
  handler: (ctx: HandlerContext<Body, Params>) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeCtx?: RouteContext<Params>): Promise<NextResponse> => {
    try {
      let user: UserPayload | null = null;

      if (options.auth) {
        user = getAuthUser(request);
        if (!user) return errors.unauthorized();

        if (typeof options.auth === 'object') {
          const { roles, minRole } = options.auth;
          const role = user.role as UserRole;
          if (roles && roles.length > 0 && !roles.includes(role)) {
            return errors.forbidden(`Required role: ${roles.join(' or ')}`);
          }
          if (minRole && !hasMinRole(role, minRole)) {
            return errors.forbidden(`Insufficient permissions. Required: ${minRole} or higher`);
          }
        }
      }

      let body = undefined as Body;
      if (options.schema) {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return errors.validation('Request body must be valid JSON');
        }
        const parsed = options.schema.safeParse(raw);
        if (!parsed.success) {
          return errors.validation('Validation failed', parsed.error.flatten());
        }
        body = parsed.data;
      }

      const params = (routeCtx?.params ? await routeCtx.params : ({} as Params)) as Params;

      return await handler({ request, user: user as UserPayload, body, params });
    } catch (err) {
      console.error('[withApiHandler] Unhandled error:', err);
      return errors.internal();
    }
  };
}
