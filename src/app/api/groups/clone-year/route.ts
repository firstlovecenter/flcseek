import { NextRequest } from 'next/server';
import { success, errors, requireSuperAdmin } from '@/lib/api';
import * as Groups from '@/lib/db/queries/groups';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/groups/clone-year
 * Clone all groups from the previous year to the current/target year
 * 
 * Body:
 * - targetYear: Year to clone into (optional, defaults to current year)
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireSuperAdmin(request);
    if (error) return error;
    
    const body = await request.json();
    const currentYear = new Date().getFullYear();
    const targetYear = body.targetYear || currentYear;
    const sourceYear = targetYear - 1;
    
    const { cloned, errors: cloneErrors } = await Groups.cloneFromPreviousYear(
      sourceYear,
      targetYear
    );
    
    return success({
      cloned: cloned.length,
      sourceYear,
      targetYear,
      groups: cloned,
      errors: cloneErrors,
    });
  } catch (err) {
    console.error('[POST /api/v1/groups/clone-year]', err);
    return errors.internal();
  }
}
