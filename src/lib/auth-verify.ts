/**
 * DB-backed token verification.
 *
 * JWTs are identity assertions only — authorization state (role, group
 * assignment, active/deleted status) is resolved fresh from the database on
 * every authenticated request. This closes the gap where a 7-day token kept
 * working after a user was deactivated, demoted, or reassigned.
 *
 * A token is rejected when:
 *  - the user row no longer exists or is soft-deleted
 *  - users.token_version does not match the version the token was minted with
 *    (bumped on password reset / deactivation / forced logout)
 */

import { prisma } from './prisma';
import type { UserPayload } from './auth';

interface FreshUserRow {
  id: string;
  username: string;
  email: string | null;
  role: string | null;
  groupId: string | null;
  groupName: string | null;
  tokenVersion: number;
  deletedAt: Date | null;
  group: { id: string; name: string; year: number } | null;
}

/**
 * Per-instance micro-cache. Serverless instances are short-lived and
 * single-tenant per request burst; a small TTL keeps the added DB cost to at
 * most one lookup per user per TTL window while bounding revocation delay.
 */
const CACHE_TTL_MS = 10_000;
const userCache = new Map<string, { row: FreshUserRow; ts: number }>();

async function fetchUserRow(userId: string): Promise<FreshUserRow | null> {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.row;
  }

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      groupId: true,
      groupName: true,
      tokenVersion: true,
      deletedAt: true,
      group: { select: { id: true, name: true, year: true } },
    },
  });

  if (!row) return null;
  userCache.set(userId, { row, ts: Date.now() });
  return row;
}

/** Test hook — clears the per-instance user cache. */
export function clearAuthVerifyCache(): void {
  userCache.clear();
}

const VALID_ROLES = ['superadmin', 'leadpastor', 'overseer', 'admin', 'leader'] as const;

/**
 * Validate a decoded token payload against the database and return a payload
 * rebuilt from *current* DB state (fresh role and group assignment).
 * Returns null if the token has been revoked or the user is gone.
 */
export async function resolveFreshUser(payload: UserPayload): Promise<UserPayload | null> {
  if (!payload?.id) return null;

  let row: FreshUserRow | null;
  try {
    row = await fetchUserRow(payload.id);
  } catch (error) {
    console.error('[auth-verify] Failed to load user for token check:', error);
    // Fail closed: an unverifiable token is an invalid token.
    return null;
  }

  if (!row || row.deletedAt) return null;

  // Tokens minted before token_version existed carry no `tv` — treat as 0.
  if ((payload.tv ?? 0) !== row.tokenVersion) return null;

  const role = VALID_ROLES.includes(row.role as (typeof VALID_ROLES)[number])
    ? (row.role as UserPayload['role'])
    : 'leader';

  return {
    id: row.id,
    username: row.username,
    email: row.email ?? undefined,
    role,
    group_id: row.groupId ?? undefined,
    group_name: row.group?.name ?? row.groupName ?? undefined,
    group_year: row.group?.year ?? undefined,
    tv: row.tokenVersion,
  };
}

/**
 * Increment a user's token version, instantly invalidating every JWT minted
 * before this call. Use on password reset, deactivation, or role change.
 */
export async function revokeUserTokens(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
  userCache.delete(userId);
}
