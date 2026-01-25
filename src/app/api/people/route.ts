import { NextRequest } from 'next/server';
import {
  success,
  created,
  errors,
  requireAuth,
  requireAdmin,
  getQueryParams,
  getEffectiveGroupFilter,
  validatePersonData,
} from '@/lib/api';
import * as People from '@/lib/db/queries/people';
import * as Milestones from '@/lib/db/queries/milestones';
import { logAuditEvent, extractRequestInfo } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/people
 * Get all people with optional filters
 * 
 * Query params:
 * - group_id: Filter by group ID
 * - year: Filter by group year
 * - search: Search by name or phone
 * - limit: Max results (default 100)
 * - offset: Pagination offset
 * - include: Comma-separated list of includes (progress, stats)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const params = getQueryParams(request);
    const effectiveFilters = getEffectiveGroupFilter(user!, params);
    const include = params.raw.get('include')?.split(',') || [];
    const month = params.raw.get('month') || undefined;
    
    const filters: People.PersonFilters = {
      ...effectiveFilters,
      year: params.year,
      search: params.search,
      limit: params.limit,
      offset: params.offset,
      month,
    };
    
    console.log('[API /v1/people] Request:', {
      userRole: user?.role,
      userGroupId: user?.group_id,
      paramsGroupId: params.groupId,
      paramsYear: params.year,
      effectiveFilters,
      finalFilters: filters,
    });
    
    // Determine which query to use based on includes
    if (include.includes('progress')) {
      // Get people with full progress data
      const totalMilestones = await Milestones.countActive();
      const people = await People.findManyWithProgress(filters, totalMilestones);
      
      console.log('[API /v1/people] Progress results:', {
        filterGroupId: filters.groupId,
        returnedCount: people.length,
        firstPersonGroupId: people[0]?.group_id,
      });
      
      return success({ 
        people,
        totalMilestones,
      }, {
        total: people.length,
        limit: params.limit,
        offset: params.offset,
      });
    }
    
    if (include.includes('stats')) {
      // Get people with stats (lighter query)
      const totalMilestones = await Milestones.countActive();
      const { people, total } = await People.findManyWithStats(filters, totalMilestones);
      
      return success({ 
        people,
        totalMilestones,
      }, {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + params.limit < total,
      });
    }
    
    // Default: simple list
    const people = await People.findMany(filters);
    const total = await People.count(filters);
    
    return success({ people }, {
      total,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (err) {
    console.error('[GET /api/v1/people]', err);
    return errors.internal();
  }
}

/**
 * POST /api/v1/people
 * Create a new person
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const body = await request.json();
    
    // Validate input
    const validation = validatePersonData(body);
    if (!validation.valid) {
      return errors.validation('Invalid input', validation.errors);
    }
    
    // Determine target group_id
    const targetGroupId = body.group_id || user!.group_id;
    
    if (!targetGroupId) {
      return errors.validation('group_id is required. Either provide it in the request or ensure your user account has a group assigned.');
    }
    
    // Set group info from user if not provided
    const input: People.CreatePersonInput = {
      first_name: body.first_name,
      last_name: body.last_name,
      phone_number: body.phone_number,
      gender: body.gender,
      date_of_birth: body.date_of_birth,
      residential_location: body.residential_location,
      school_residential_location: body.school_residential_location,
      occupation_type: body.occupation_type,
      address: body.address,  // Legacy field support
      group_id: targetGroupId,
      group_name: body.group_name || user!.group_name,
      registered_by: user!.id,
    };
    
    const person = await People.create(input);
    
    // Audit log person creation
    const reqInfo = extractRequestInfo(request.headers);
    await logAuditEvent({
      userId: user!.id,
      action: 'CREATE_CONVERT',
      entityType: 'new_convert',
      entityId: person.id,
      newValues: { full_name: person.full_name, group_id: person.group_id, phone_number: person.phone_number },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });
    
    logger.info(`[CREATE_CONVERT] User ${user!.username} registered ${person.full_name} (${person.phone_number}) in group ${person.group_name}`);
    
    return created({ person });
  } catch (err: any) {
    logger.error('[POST /api/v1/people] Error:', err);
    
    // Handle duplicate phone number
    if (err.message?.includes('duplicate') || err.code === '23505') {
      return errors.validation(`This phone number is already registered. Each person must have a unique phone number.`);
    }
    
    // Handle invalid group reference
    if (err.message?.includes('foreign key') || err.code === '23503') {
      return errors.validation(`Invalid group_id. The specified group does not exist in the database.`);
    }
    
    return errors.internal('Failed to register person. Please check your data and try again.');
  }
}
