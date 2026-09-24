import { prisma } from '@/lib/prisma'

/**
 * Whether a user may enter the City Church Group app at all: they are a Seek
 * superadmin (who always has full CCG access), or they hold at least one
 * current role assignment for an active role. What they may *do* is decided
 * per request by src/lib/ccg/scope.ts.
 *
 * Kept free of other CCG imports because the shared login path (auth-verify,
 * login route) calls it.
 */
export function todayDate(now: Date = new Date()): Date {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
}

/**
 * Prisma filter for assignments in force today. `ends_on` is exclusive: an
 * assignment ended today (ends_on = today) no longer applies.
 */
export function currentAssignmentWhere(today: Date = todayDate()) {
  return {
    role: { active: true },
    startsOn: { lte: today },
    OR: [{ endsOn: null }, { endsOn: { gt: today } }],
  }
}

/** Seek superadmins are CCG super-administrators, derived fresh from users.role. */
export const SEEK_SUPERADMIN = 'superadmin'
export const isSeekSuperadmin = (seekRole: string | null | undefined) => seekRole === SEEK_SUPERADMIN

export async function hasCcgAccess(userId: string, seekRole?: string | null): Promise<boolean> {
  if (isSeekSuperadmin(seekRole)) return true
  const found = await prisma.ccgRoleAssignment.findFirst({
    where: { userId, ...currentAssignmentWhere() },
    select: { id: true },
  })
  return !!found
}
