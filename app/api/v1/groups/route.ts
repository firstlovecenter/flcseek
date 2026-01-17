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
 * - year: Filter by year
 * - active: Filter by active status (true/false)
 * - search: Search by name
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const params = getQueryParams(request);
    const activeParam = params.raw.get('active');
    
    const filters: Groups.GroupFilters = {
      year: params.year,
      isActive: activeParam === 'true' ? true : activeParam === 'false' ? false : undefined,
      search: params.search,
      limit: params.limit,
      offset: params.offset,
    };
    
    const groups = await Groups.findMany(filters);
    const total = await Groups.count(filters);
    const years = await Groups.getAvailableYears();
    
    return success({ 
      groups,
      years,
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
    
    // Check if group already exists for this name and year
    const existing = await Groups.findByNameAndYear(body.name, body.year);
    if (existing) {
      return errors.validation(`Group "${body.name}" already exists for ${body.year}`);
    }
    
    const group = await Groups.create({
      name: body.name,
      year: body.year,
      leader_id: body.leader_id,
      description: body.description,
    });
    
    return created({ group });
  } catch (err) {
    console.error('[POST /api/v1/groups]', err);
    return errors.internal();
  }
}
