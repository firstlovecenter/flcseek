import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js middleware runs in the Edge Runtime where Node.js-only packages
 * (jsonwebtoken, bcryptjs) are unavailable. Full JWT verification is handled
 * per-route via requireAuth() in the Node.js route handler runtime.
 *
 * This middleware handles only what is safe in Edge Runtime:
 * - Early 401 for requests with no token at all (fast rejection)
 * - CORS / security header passthrough
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Public routes — no token required
  const PUBLIC_PREFIXES = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/reset-password',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/health',
    '/api/_next',
  ];
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Fast rejection: if neither a cookie nor a Bearer token is present,
  // there is no point forwarding the request to a route handler.
  // Signature verification happens inside requireAuth() in each route handler.
  const hasCookie = !!request.cookies.get('auth_token')?.value;
  const authHeader = request.headers.get('Authorization') ?? '';
  const hasBearer = authHeader.startsWith('Bearer ') && authHeader.length > 8;

  if (!hasCookie && !hasBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
