import { NextRequest } from 'next/server';
import { verifyToken, TokenPayload, UserPayload } from '@/lib/auth';
import { resolveFreshUser } from '@/lib/auth-verify';
import { errors } from './response';
import { ROLES, UserRole } from '@/lib/constants';

/**
 * API Middleware Utilities
 * Common middleware functions for authentication and authorization
 */

export interface AuthenticatedRequest extends NextRequest {
  user: UserPayload;
}

/**
 * Extract and verify the JWT token from request headers.
 *
 * Signature check only — does NOT consult the database, so revoked tokens and
 * stale role/group claims pass. Route handlers must use getVerifiedAuthUser()
 * or the requireAuth/requireRole family instead.
 */
export function getAuthUser(request: NextRequest): TokenPayload | null {
  // Try httpOnly cookie first (safe from XSS)
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) {
    const user = verifyToken(cookieToken);
    if (user) return user;
  }

  // Fall back to Authorization header (backward compat / API clients)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyToken(token);
}

/**
 * Signature check + DB freshness check, app-agnostic. Returns the identity
 * rebuilt from current DB state (Seek role and/or CCG role), or null if the
 * token is invalid or revoked. Use for /api/auth/me and the CCG app.
 */
export async function getVerifiedIdentity(request: NextRequest): Promise<TokenPayload | null> {
  const decoded = getAuthUser(request);
  if (!decoded) return null;
  return resolveFreshUser(decoded);
}

/**
 * Seek authentication: a verified identity that holds a Seek role. Users who
 * only have CCG access get null here, so every Seek route rejects them.
 */
export async function getVerifiedAuthUser(request: NextRequest): Promise<UserPayload | null> {
  const identity = await getVerifiedIdentity(request);
  if (!identity?.role) return null;
  return identity as UserPayload;
}

/**
 * Require authentication - returns user or error response
 */
export async function requireAuth(request: NextRequest) {
  const user = await getVerifiedAuthUser(request);

  if (!user) {
    return { user: null, error: errors.unauthorized() };
  }

  return { user, error: null };
}

/**
 * Role hierarchy for permission checks
 * Higher roles include permissions of lower roles
 */
const RoleHierarchy: Record<UserRole, number> = {
  [ROLES.SUPERADMIN]: 100,
  [ROLES.LEADPASTOR]: 80,
  [ROLES.OVERSEER]: 70,
  [ROLES.ADMIN]: 60,
  [ROLES.LEADER]: 40,
};

/**
 * Check if user has minimum required role
 */
export function hasMinRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (RoleHierarchy[userRole] || 0) >= (RoleHierarchy[requiredRole] || 0);
}

/**
 * Require specific role(s) - returns user or error response
 */
export async function requireRole(request: NextRequest, allowedRoles: UserRole | UserRole[]) {
  const { user, error: authError } = await requireAuth(request);
  
  if (authError) {
    return { user: null, error: authError };
  }
  
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  if (!roles.includes(user!.role)) {
    return { 
      user: null, 
      error: errors.forbidden(`Required role: ${roles.join(' or ')}`) 
    };
  }
  
  return { user: user!, error: null };
}

/**
 * Require minimum role level - returns user or error response
 */
export async function requireMinRole(request: NextRequest, minRole: UserRole) {
  const { user, error: authError } = await requireAuth(request);
  
  if (authError) {
    return { user: null, error: authError };
  }
  
  if (!hasMinRole(user!.role, minRole)) {
    return { 
      user: null, 
      error: errors.forbidden(`Insufficient permissions. Required: ${minRole} or higher`) 
    };
  }
  
  return { user: user!, error: null };
}

/**
 * Admin-only check (superadmin or leadpastor)
 */
export function requireAdmin(request: NextRequest) {
  return requireRole(request, [ROLES.SUPERADMIN, ROLES.LEADPASTOR]);
}

/**
 * Superadmin-only check
 */
export function requireSuperAdmin(request: NextRequest) {
  return requireRole(request, ROLES.SUPERADMIN);
}

/**
 * Extract common query parameters
 */
export function getQueryParams(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  return {
    // Pagination
    limit: Math.min(parseInt(searchParams.get('limit') || '100'), 500),
    offset: parseInt(searchParams.get('offset') || '0'),
    
    // Filters
    month: searchParams.get('month') || undefined,
    year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
    groupId: searchParams.get('group_id') || searchParams.get('groupId') || undefined,
    
    // Search
    search: searchParams.get('search') || searchParams.get('q') || undefined,
    
    // Sorting
    sortBy: searchParams.get('sort_by') || searchParams.get('sortBy') || undefined,
    sortOrder: (searchParams.get('sort_order') || searchParams.get('order') || 'asc') as 'asc' | 'desc',
    
    // Raw access to all params
    raw: searchParams,
  };
}

/**
 * Normalized group scope used to constrain queries by the requesting user's role.
 * - `groupName` constrains to a month name across all years (leaders/admins).
 * - `groupId` constrains to a single group instance (superadmin/leadpastor/overseer
 *   filtering via query param). When neither is set, unrestricted roles may see all data.
 * - `denied` is set when a scoped role has no group assignment (fail closed).
 */
export interface GroupScope {
  groupId?: string;
  groupName?: string;
  /** True when a leader/admin has no group_name — callers must return 403 / empty. */
  denied?: boolean;
}

/**
 * Resolve the canonical group scope for a user. This is the single source of truth
 * for role-based data scoping and MUST be applied identically by every list/stats
 * endpoint (people, attendance, stats, person detail) to avoid scope drift.
 *
 * - Leaders & Admins: locked to their month name across all years.
 *   Missing assignment → `{ denied: true }` (fail closed — never unrestricted).
 * - SuperAdmin / LeadPastor / Overseer: unrestricted, may filter by `group_id` param.
 */
export function resolveGroupScope(
  user: UserPayload,
  params: ReturnType<typeof getQueryParams>
): GroupScope {
  const { role, group_name } = user;

  if (role === ROLES.LEADER || role === ROLES.ADMIN) {
    const name = group_name?.trim();
    if (!name) {
      return { denied: true };
    }
    return { groupName: name };
  }

  return { groupId: params.groupId };
}

/**
 * Forbidden response when a scoped role has no group assignment; null when allowed.
 */
export function assertScopedAssignment(user: UserPayload) {
  if (isGroupScopedRole(user.role) && !user.group_name?.trim()) {
    return errors.forbidden(
      'You must be assigned to a group to access this data'
    );
  }
  return null;
}

/**
 * @deprecated Use {@link resolveGroupScope}. Kept as a thin alias for backwards
 * compatibility while routes are migrated.
 */
export function getEffectiveGroupFilter(
  user: UserPayload,
  params: ReturnType<typeof getQueryParams>
): GroupScope {
  return resolveGroupScope(user, params);
}

/** Leaders and group admins are locked to their month name across years. */
export function isGroupScopedRole(role: UserRole | string | undefined): boolean {
  return role === ROLES.LEADER || role === ROLES.ADMIN;
}

function namesMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Whether a scoped user may access a group (by month name) or unrestricted roles
 * may access any group.
 */
export function canAccessGroup(
  user: UserPayload,
  group: { id?: string | null; name?: string | null }
): boolean {
  if (!isGroupScopedRole(user.role)) return true;
  if (group.id && user.group_id && group.id === user.group_id) return true;
  return namesMatch(group.name, user.group_name);
}

/**
 * Whether a scoped user may access a person. Prefer group_name (month) so the
 * same month across years stays consistent with resolveGroupScope.
 */
export function canAccessPerson(
  user: UserPayload,
  person: { group_id?: string | null; group_name?: string | null }
): boolean {
  if (!isGroupScopedRole(user.role)) return true;
  if (namesMatch(person.group_name, user.group_name)) return true;
  if (person.group_id && user.group_id && person.group_id === user.group_id) {
    return true;
  }
  return false;
}

/** Forbidden response when person access fails; null when allowed. */
export function assertPersonAccess(
  user: UserPayload,
  person: { group_id?: string | null; group_name?: string | null },
  message = 'You can only access people in your group'
) {
  if (canAccessPerson(user, person)) return null;
  return errors.forbidden(message);
}

/** Forbidden response when group access fails; null when allowed. */
export function assertGroupAccess(
  user: UserPayload,
  group: { id?: string | null; name?: string | null },
  message = 'You can only access your own group'
) {
  if (canAccessGroup(user, group)) return null;
  return errors.forbidden(message);
}
