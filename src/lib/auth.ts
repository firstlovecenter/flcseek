import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { type NextRequest } from 'next/server';

// Security: Throw error if JWT_SECRET is not configured
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Only throw in runtime, not during build
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'development') {
    console.error('CRITICAL: JWT_SECRET environment variable is not set!');
  }
}

// Fallback only for build time, runtime will use actual secret
const getJwtSecret = (): string => {
  if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be configured in production');
    }
    // Development fallback
    return 'development-secret-change-in-production';
  }
  return JWT_SECRET;
};

export interface UserPayload {
  id: string;
  userId?: string; // Backward compatibility
  username: string;
  email?: string;  // Optional, for backwards compatibility
  role: 'superadmin' | 'leadpastor' | 'overseer' | 'admin' | 'leader';
  group_name?: string; // deprecated - use group_id
  group_year?: number; // Year of the group (e.g., 2025, 2026)
  group_id?: string;   // Assigned month group (Jan-Dec)
  /**
   * Token version at mint time. Compared against users.token_version on every
   * authenticated request; a mismatch means the token has been revoked.
   * Tokens minted before this field existed are treated as version 0.
   */
  tv?: number;
}

/**
 * Async bcrypt hashing — does not block the event loop.
 */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Async bcrypt comparison — does not block the event loop.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

export function generateToken(user: UserPayload): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as UserPayload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify a superadmin JWT from an incoming NextRequest.
 * Checks the httpOnly cookie first, then falls back to the Authorization
 * Bearer header — matching the behaviour of getAuthUser() in the API middleware.
 *
 * Verifies the signature AND checks the database: the user must still exist,
 * not be soft-deleted, hold the superadmin role *now*, and the token must not
 * have been revoked (token_version match).
 * Returns the fresh UserPayload on success, null on any failure.
 */
export async function verifySuperAdmin(request: NextRequest): Promise<UserPayload | null> {
  // Lazy import avoids pulling Prisma into any context that only needs
  // token utilities (e.g. edge-safe code paths importing types).
  const { resolveFreshUser } = await import('./auth-verify');

  let decoded: UserPayload | null = null;

  // Prefer the httpOnly cookie (XSS-safe)
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) {
    decoded = verifyToken(cookieToken);
  }

  // Fall back to Authorization Bearer header (API clients / backward-compat)
  if (!decoded) {
    const authHeader =
      request.headers.get('authorization') ||
      request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const bearerToken = authHeader.substring(7);
    // Guard against the literal string "null" sent when state is uninitialised
    if (!bearerToken || bearerToken === 'null') return null;
    decoded = verifyToken(bearerToken);
  }

  if (!decoded) return null;

  const fresh = await resolveFreshUser(decoded);
  if (!fresh || fresh.role !== 'superadmin') return null;
  return fresh;
}
