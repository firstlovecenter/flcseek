import { NextRequest } from 'next/server';
import {
  success,
  errors,
  requireAuth,
  validateUUID,
  getQueryParams,
  resolveGroupScope,
} from '@/lib/api';
import * as Milestones from '@/lib/db/queries/milestones';
import * as People from '@/lib/db/queries/people';

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

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid group ID', idValidation.errors);
    }

    const queryParams = getQueryParams(request);
    const scope = resolveGroupScope(user!, {
      ...queryParams,
      groupId: queryParams.groupId || id,
    });

    const filters: People.PersonFilters = {
      groupId: scope.groupId ?? id,
      groupName: scope.groupName,
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
