import { NextRequest } from 'next/server';
import { success, errors, requireAuth } from '@/lib/api';
import * as Milestones from '@/lib/db/queries/milestones';

// Cache milestones (they rarely change)
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

/**
 * GET /api/v1/milestones
 * Get all active milestones
 * 
 * Query params:
 * - include_inactive: If true, returns all milestones
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';
    
    const milestones = includeInactive 
      ? await Milestones.findAll()
      : await Milestones.findActive();
    
    return success(
      { milestones },
      undefined,
      { 'Cache-Control': 'public, max-age=3600' }
    );
  } catch (err) {
    console.error('[GET /api/v1/milestones]', err);
    return errors.internal();
  }
}
