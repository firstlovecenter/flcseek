import { NextRequest } from 'next/server';
import {
  success,
  created,
  errors,
  requireAuth,
  requireAdmin,
  getQueryParams,
  validateGroupData,
} from '@/lib/api';
import * as Groups from '@/lib/db/queries/groups';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/groups
 * Get all groups with optional filters
 * 
 * Query params:
 * - active: Filter by active status (true/false)
 * - archived: Filter by archived status (true/false)
 * - search: Search by name
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const params = getQueryParams(request);
    const activeParam = params.raw.get('active');
    const archivedParam = params.raw.get('archived') ?? params.raw.get('archive');
    
    let archivedFilter: boolean | undefined = undefined;
    if (archivedParam === 'true') archivedFilter = true;
    if (archivedParam === 'false') archivedFilter = false;
    if (activeParam === 'true') archivedFilter = false;
    if (activeParam === 'false') archivedFilter = true;

    const filters: Groups.GroupFilters = {
      archived: archivedFilter,
      year: params.year,
      search: params.search,
      limit: params.limit,
      offset: params.offset,
    };
    
    const groups = await Groups.findMany(filters);
    const total = await Groups.count(filters);
    
    return success({ 
      groups,
    }, {
      total,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (err) {
    console.error('[GET /api/v1/groups]', err);
    return errors.internal();
  }
}

/**
 * POST /api/v1/groups
 * Create a new group (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireAdmin(request);
    if (error) return error;
    
    const body = await request.json();
    
    const validation = validateGroupData(body);
    if (!validation.valid) {
      return errors.validation('Invalid input', validation.errors);
    }
    
    const group = await Groups.create({
      name: body.name,
      leader_id: body.leader_id,
      description: body.description,
    });
    
    return created({ group });
  } catch (err) {
    console.error('[POST /api/v1/groups]', err);
    return errors.internal();
  }
}
