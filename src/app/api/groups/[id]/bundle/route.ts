import { NextRequest } from 'next/server';
import {
  success,
  errors,
  requireAuth,
  validateUUID,
  getQueryParams,
  assertGroupAccess,
  assertScopedAssignment,
} from '@/lib/api';
import * as Milestones from '@/lib/db/queries/milestones';
import * as People from '@/lib/db/queries/people';
import * as Groups from '@/lib/db/queries/groups';

export const dynamic = 'force-dynamic';

/**
 * GET /api/groups/[id]/bundle?year=
 * One round-trip payload for the group milestone grid: active milestones + compact people rows.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const assignmentError = assertScopedAssignment(user!);
    if (assignmentError) return assignmentError;

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid group ID', idValidation.errors);
    }

    const group = await Groups.findById(id);
    if (!group) {
      return errors.notFound('Group');
    }

    const scopeError = assertGroupAccess(user!, {
      id: group.id,
      name: group.name,
    });
    if (scopeError) return scopeError;

    const queryParams = getQueryParams(request);

    const filters: People.PersonFilters = {
      groupId: id,
      year: queryParams.year,
    };

    const milestonesPromise = Milestones.findActive();
    const [milestones, people] = await Promise.all([
      milestonesPromise,
      milestonesPromise.then((m) =>
        People.findManyForGrid(filters, m.length || 18)
      ),
    ]);

    return success({
      milestones,
      people,
      totalMilestones: milestones.length,
    });
  } catch (err) {
    console.error('[GET /api/groups/[id]/bundle]', err);
    return errors.internal();
  }
}
