import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/auth/me
 * Returns the current authenticated user from either the httpOnly cookie or Bearer header.
 * Used by the AuthContext on app load to rehydrate user state from the cookie.
 */
export async function GET(request: NextRequest) {
  const cookieToken = request.cookies.get('auth_token')?.value;
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const token = cookieToken || bearerToken;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const user = verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  return NextResponse.json({ user });
}
