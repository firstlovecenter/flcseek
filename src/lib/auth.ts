import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
  role: 'superadmin' | 'leadpastor' | 'admin' | 'leader';
  group_name?: string; // deprecated - use group_id
  group_year?: number; // Year of the group (e.g., 2025, 2026)
  group_id?: string;   // Assigned month group (Jan-Dec)
}

export function hashPassword(password: string): string {
  const hash = bcrypt.hashSync(password, 10);
  return hash;
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    const result = bcrypt.compareSync(password, hash);
    return result;
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
