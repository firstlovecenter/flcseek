import { NextRequest } from 'next/server';
import {
  success,
  created,
  errors,
  requireAuth,
  getQueryParams,
  resolveGroupScope,
  withApiHandler,
} from '@/lib/api';
import { personCreateSchema } from '@/lib/schemas/api';
import * as People from '@/lib/db/queries/people';
import * as Milestones from '@/lib/db/queries/milestones';
import * as Groups from '@/lib/db/queries/groups';
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
    const { user, error } = await requireAuth(request);
    if (error) return error;
    
    const params = getQueryParams(request);
    const effectiveFilters = resolveGroupScope(user!, params);
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

    if (params.year !== undefined) {
      const yearGroups = await Groups.findMany({ year: params.year, limit: 500 });
      filters.yearGroupIds = yearGroups.map((g) => g.id);
      filters.yearGroupNames = [...new Set(yearGroups.map((g) => g.name))];
      delete filters.year;
      if (!filters.yearGroupIds.length && !filters.yearGroupNames.length) {
        filters.yearGroupIds = ['00000000-0000-0000-0000-000000000000'];
      }
    }
    
    if (process.env.NODE_ENV !== 'production') console.log('[API /v1/people] Request:', {
      userRole: user?.role,
      userGroupId: user?.group_id,
      paramsGroupId: params.groupId,
      paramsYear: params.year,
      effectiveFilters,
      finalFilters: filters,
    });
    
    // Determine which query to use based on includes
    const activeMilestonesPromise = Milestones.findActive();

    if (include.includes('grid')) {
      const [milestones, people] = await Promise.all([
        activeMilestonesPromise,
        activeMilestonesPromise.then((m) =>
          People.findManyForGrid(filters, m.length || 18)
        ),
      ]);

      return success(
        { people, milestones, totalMilestones: milestones.length },
        { total: people.length, limit: params.limit, offset: params.offset }
      );
    }

    if (include.includes('progress')) {
      const [milestones, people] = await Promise.all([
        activeMilestonesPromise,
        activeMilestonesPromise.then((m) =>
          People.findManyWithProgress(filters, m.length || 18)
        ),
      ]);

      return success(
        { people, totalMilestones: milestones.length },
        { total: people.length, limit: params.limit, offset: params.offset }
      );
    }

    if (include.includes('stats')) {
      // Directory views (superadmin converts) may need more than the default 500 cap.
      const statsLimit = Math.min(
        parseInt(params.raw.get('limit') || String(params.limit), 10) || 1000,
        2000
      );
      filters.limit = statsLimit;

      const [milestones, { people, total }] = await Promise.all([
        activeMilestonesPromise,
        activeMilestonesPromise.then((m) =>
          People.findManyWithStats(filters, m.length || 18)
        ),
      ]);

      return success(
        { people, totalMilestones: milestones.length },
        {
          total,
          limit: statsLimit,
          offset: params.offset,
          hasMore: params.offset + statsLimit < total,
        }
      );
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
 * Create a new person.
 *
 * Uses the centralized handler wrapper: authentication and Zod body validation
 * are applied before this function runs; the standard error contract is emitted
 * automatically for auth/validation/uncaught failures.
 */
const handleCreatePerson = withApiHandler(
  { auth: true, schema: personCreateSchema },
  async ({ request, user, body }) => {
    try {
      // Determine target group_id
      const targetGroupId = body.group_id || user.group_id;

      if (!targetGroupId) {
        return errors.validation(
          'group_id is required. Either provide it in the request or ensure your user account has a group assigned.'
        );
      }

      const input: People.CreatePersonInput = {
        first_name: body.first_name,
        last_name: body.last_name,
        phone_number: body.phone_number,
        gender: body.gender,
        date_of_birth: body.date_of_birth,
        residential_location: body.residential_location,
        school_residential_location: body.school_residential_location,
        occupation_type: body.occupation_type,
        address: body.address, // Legacy field support
        group_id: targetGroupId,
        group_name: body.group_name || user.group_name,
        registered_by: user.id,
      };

      const person = await People.create(input);

      const reqInfo = extractRequestInfo(request.headers);
      await logAuditEvent({
        userId: user.id,
        action: 'CREATE_CONVERT',
        entityType: 'new_convert',
        entityId: person.id,
        newValues: {
          full_name: person.full_name,
          group_id: person.group_id,
          phone_number: person.phone_number,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      logger.info(
        `[CREATE_CONVERT] User ${user.username} registered ${person.full_name} (${person.phone_number}) in group ${person.group_name}`
      );

      return created({ person });
    } catch (err: unknown) {
      logger.error('[POST /api/v1/people] Error:', err);
      const e = err as { message?: string; code?: string };

      if (e.message?.includes('duplicate') || e.code === '23505') {
        return errors.validation(
          `This phone number is already registered. Each person must have a unique phone number.`
        );
      }

      if (e.message?.includes('foreign key') || e.code === '23503') {
        return errors.validation(
          `Invalid group_id. The specified group does not exist in the database.`
        );
      }

      return errors.internal('Failed to register person. Please check your data and try again.');
    }
  }
);

export async function POST(request: NextRequest) {
  return handleCreatePerson(request);
}
