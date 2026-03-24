import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

/**
 * Routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/reset-password',
  '/api/auth/logout',
  '/api/auth/me',
];

/**
 * Central auth middleware — protects all /api/* routes.
 * Reads JWT from httpOnly cookie first, then falls back to Authorization header.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static/metadata endpoints
  if (pathname.startsWith('/api/_next') || pathname === '/api/health') {
    return NextResponse.next();
  }

  // Try cookie first (httpOnly, safe from XSS)
  const cookieToken = request.cookies.get('auth_token')?.value;

  // Fall back to Authorization header (for API clients / backward compat)
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const token = cookieToken || bearerToken;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Forward user info to the route handler via a custom header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-verified-user-id', user.id);
  requestHeaders.set('x-verified-user-role', user.role);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/api/:path*'],
};
