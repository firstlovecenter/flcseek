import { NextRequest } from 'next/server';
import { verifyToken, UserPayload } from '@/lib/auth';
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
 * Extract and verify the JWT token from request headers
 */
export function getAuthUser(request: NextRequest): UserPayload | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  return verifyToken(token);
}

/**
 * Require authentication - returns user or error response
 */
export function requireAuth(request: NextRequest) {
  const user = getAuthUser(request);
  
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
export function requireRole(request: NextRequest, allowedRoles: UserRole | UserRole[]) {
  const { user, error: authError } = requireAuth(request);
  
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
export function requireMinRole(request: NextRequest, minRole: UserRole) {
  const { user, error: authError } = requireAuth(request);
  
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
    year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
    month: searchParams.get('month') || undefined,
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
 * Get the effective group filter based on user role
 * Leaders can only see their own group
 * Admins can see their month across years
 * SuperAdmin/LeadPastor can see everything or filter by params
 */
export function getEffectiveGroupFilter(
  user: UserPayload,
  params: ReturnType<typeof getQueryParams>
): { groupId?: string; groupName?: string; year?: number } {
  const { role, group_id, group_name, group_year } = user;
  
  // Leaders: locked to their group
  if (role === ROLES.LEADER) {
    return {
      groupId: group_id,
      groupName: group_name,
      year: group_year,
    };
  }
  
  // Admins: can filter by year, but locked to their month
  if (role === ROLES.ADMIN) {
    return {
      groupName: group_name, // locked to their month
      year: params.year || group_year, // can override year
    };
  }
  
  // SuperAdmin/LeadPastor: can filter by anything
  return {
    groupId: params.groupId,
    year: params.year,
  };
}
