/**
 * Client-side group access helpers — mirrors server resolveGroupScope /
 * canAccessGroup (month-name lock for leaders/admins).
 */

export type GroupAccessUser = {
  role?: string;
  group_id?: string;
  group_name?: string;
} | null;

export function isGroupScopedRole(role?: string): boolean {
  return role === 'leader' || role === 'admin';
}

/**
 * Restricted roles may open a group URL when it is their primary group_id
 * OR the same month name (multi-year). Org roles are unrestricted.
 */
export function canAccessGroupClient(
  user: GroupAccessUser,
  groupId: string,
  groupName?: string | null
): boolean {
  if (!user) return false;
  if (!isGroupScopedRole(user.role)) return true;
  if (user.group_id && user.group_id === groupId) return true;
  if (
    groupName &&
    user.group_name &&
    groupName.trim().toLowerCase() === user.group_name.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}
