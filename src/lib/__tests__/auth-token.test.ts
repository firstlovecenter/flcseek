import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken, hashPassword, verifyPassword } from '@/lib/auth';
import type { UserPayload } from '@/lib/auth';

const payload: UserPayload = {
  id: '00000000-0000-0000-0000-000000000001',
  username: 'tester',
  role: 'leader',
  group_name: 'January',
  group_id: 'group-1',
  tv: 3,
};

describe('JWT roundtrip', () => {
  it('verifies a token it minted, preserving the token version claim', () => {
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(payload.id);
    expect(decoded!.role).toBe('leader');
    expect(decoded!.tv).toBe(3);
  });

  it('rejects a tampered token', () => {
    const token = generateToken(payload);
    const [h, p, s] = token.split('.');
    // Flip a character in the signature
    const tampered = `${h}.${p}.${s.slice(0, -2)}xx`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(verifyToken('not-a-jwt')).toBeNull();
    expect(verifyToken('')).toBeNull();
  });
});

describe('password hashing', () => {
  it('hashes and verifies asynchronously', async () => {
    const hash = await hashPassword('s3cret-password');
    expect(hash).not.toContain('s3cret-password');
    expect(await verifyPassword('s3cret-password', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('fails closed on a non-bcrypt hash (system user password)', async () => {
    // The system automation user stores random bytes, not a bcrypt hash —
    // login must be impossible.
    expect(await verifyPassword('anything', 'deadbeef'.repeat(12))).toBe(false);
  });
});
