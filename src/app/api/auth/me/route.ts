import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthUser } from '@/lib/api/middleware';

/**
 * GET /api/auth/me
 * Returns the current authenticated user from either the httpOnly cookie or Bearer header.
 * Used by the AuthContext on app load to rehydrate user state from the cookie.
 *
 * DB-verified: a revoked token (deactivated user, bumped token_version) is
 * rejected here, which signs the client out on its next session validation.
 */
export async function GET(request: NextRequest) {
  const user = await getVerifiedAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  return NextResponse.json({ user });
}
