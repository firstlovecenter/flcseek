import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface UserPayload {
  id: string;
  username: string;
  email?: string;
  role: 'superadmin' | 'leadpastor' | 'admin' | 'leader';
  group_name?: string;
  group_year?: number;
  group_id?: string;
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
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}
