import { NextRequest } from 'next/server';
import {
  success,
  created,
  errors,
  requireAdmin,
  requireSuperAdmin,
  getQueryParams,
  validateUserData,
} from '@/lib/api';
import * as Users from '@/lib/db/queries/users';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/users
 * Get all users (admin only)
 * 
 * Query params:
 * - role: Filter by role(s), comma-separated
 * - search: Search by name, username, or phone
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = requireAdmin(request);
    if (error) return error;
    
    const params = getQueryParams(request);
    const roleParam = params.raw.get('role');
    
    const filters: Users.UserFilters = {
      role: roleParam ? roleParam.split(',') as any : undefined,
      search: params.search,
      limit: params.limit,
      offset: params.offset,
    };
    
    const users = await Users.findMany(filters);
    const total = await Users.count(filters);
    
    return success({ users }, {
      total,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (err) {
    console.error('[GET /api/v1/users]', err);
    return errors.internal();
  }
}

/**
 * POST /api/v1/users
 * Create a new user (superadmin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireSuperAdmin(request);
    if (error) return error;
    
    const body = await request.json();
    
    const validation = validateUserData(body, true);
    if (!validation.valid) {
      return errors.validation('Invalid input', validation.errors);
    }
    
    // Check if username exists
    const exists = await Users.usernameExists(body.username);
    if (exists) {
      return errors.validation('Username already exists');
    }
    
    const newUser = await Users.create({
      username: body.username,
      password: body.password,
      role: body.role,
      email: body.email,
      first_name: body.first_name,
      last_name: body.last_name,
      phone_number: body.phone_number,
      group_id: body.group_id,
      group_name: body.group_name,
    });
    
    return created({ user: newUser });
  } catch (err) {
    console.error('[POST /api/v1/users]', err);
    return errors.internal();
  }
}
