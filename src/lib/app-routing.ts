/**
 * Which app a signed-in user lands in. The users table is shared by Seek
 * (`role`) and City Church Group (`ccg_access`, from role assignments):
 *  - both roles  → /apps launcher
 *  - CCG only    → /ccg
 *  - Seek only   → the existing Seek landing (superadmin dashboard, their
 *                  month group, or the group selector at '/')
 *  - neither     → /auth
 */
export interface RoutableUser {
  role?: string | null;
  ccg_access?: boolean | null;
  group_id?: string | null;
}

export type AppKey = 'seek' | 'ccg';

export function availableApps(user: RoutableUser | null | undefined): AppKey[] {
  if (!user) return [];
  const apps: AppKey[] = [];
  if (user.role) apps.push('seek');
  if (user.ccg_access) apps.push('ccg');
  return apps;
}

/** Seek's own landing path for a user who holds a Seek role. */
export function seekLandingPath(user: RoutableUser): string {
  if (user.role === 'superadmin') return '/superadmin';
  if ((user.role === 'admin' || user.role === 'leader') && user.group_id) {
    return `/${user.group_id}`;
  }
  return '/';
}

export function landingPathFor(user: RoutableUser | null | undefined): string {
  const apps = availableApps(user);
  if (apps.length === 0) return '/auth';
  if (apps.length > 1) return '/apps';
  return apps[0] === 'ccg' ? '/ccg' : seekLandingPath(user!);
}
