import { NextRequest } from 'next/server';
import { success, errors, requireAdmin } from '@/lib/api';
import * as Users from '@/lib/db/queries/users';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/users/leaders
 * Get all users who are leaders or admins (for assignment dropdowns)
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = requireAdmin(request);
    if (error) return error;
    
    const users = await Users.findLeaders();
    
    return success({ users });
  } catch (err) {
    console.error('[GET /api/v1/users/leaders]', err);
    return errors.internal();
  }
}
