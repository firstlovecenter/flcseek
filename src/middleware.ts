import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Next.js middleware runs in the Edge Runtime where Node.js-only packages
 * (jsonwebtoken, bcryptjs) are unavailable. Signature verification here uses
 * `jose` (Edge-compatible), so forged or expired tokens are rejected before a
 * route handler function is ever invoked.
 *
 * Database-backed checks (token revocation, fresh role/group state) still
 * happen per-route via requireAuth()/getVerifiedAuthUser() in the Node.js
 * runtime — the Edge Runtime has no database access.
 */

const encoder = new TextEncoder();

function getSecretKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Mirror the dev fallback in src/lib/auth.ts so local tokens verify.
    if (process.env.NODE_ENV !== 'production') {
      return encoder.encode('development-secret-change-in-production');
    }
    return null;
  }
  return encoder.encode(secret);
}

export async function middleware(request: NextRequest) {
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

  // Extract token: httpOnly cookie first, then Authorization Bearer header.
  const cookieToken = request.cookies.get('auth_token')?.value;
  const authHeader = request.headers.get('Authorization') ?? '';
  const bearerToken =
    authHeader.startsWith('Bearer ') && authHeader.length > 8
      ? authHeader.substring(7)
      : null;
  const token = cookieToken || bearerToken;

  if (!token || token === 'null') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the signature at the edge. If the secret is unavailable in this
  // runtime, fall through — requireAuth() in the route handler still verifies.
  const secretKey = getSecretKey();
  if (secretKey) {
    try {
      await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
