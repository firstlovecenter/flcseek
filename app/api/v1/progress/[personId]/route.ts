import { NextRequest } from 'next/server';
import {
  success,
  errors,
  requireAuth,
  validateUUID,
  validateInt,
} from '@/lib/api';
import * as Progress from '@/lib/db/queries/progress';
import * as People from '@/lib/db/queries/people';
import { ROLES } from '@/lib/constants';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/progress/[personId]
 * Get all progress records for a person
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { personId: string } }
) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const idValidation = validateUUID(params.personId, 'personId');
    if (!idValidation.valid) {
      return errors.validation('Invalid person ID', idValidation.errors);
    }
    
    // Check person exists and access
    const person = await People.findById(params.personId);
    if (!person) {
      return errors.notFound('Person');
    }
    
    // Leaders can only see their own group's people
    if (user!.role === ROLES.LEADER && person.group_id !== user!.group_id) {
      return errors.forbidden('You can only view progress for people in your group');
    }
    
    const progress = await Progress.findByPersonId(params.personId);
    const completionRate = await Progress.getPersonCompletionRate(params.personId);
    
    return success({
      progress,
      ...completionRate,
    });
  } catch (err) {
    console.error('[GET /api/v1/progress/[personId]]', err);
    return errors.internal();
  }
}

/**
 * PATCH /api/v1/progress/[personId]
 * Update a milestone status for a person
 * 
 * Body:
 * - stage_number: number
 * - is_completed: boolean
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { personId: string } }
) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const idValidation = validateUUID(params.personId, 'personId');
    if (!idValidation.valid) {
      return errors.validation('Invalid person ID', idValidation.errors);
    }
    
    const body = await request.json();
    
    // Validate input
    const stageValidation = validateInt(body.stage_number, 'stage_number', { required: true, min: 1, max: 100 });
    if (!stageValidation.valid) {
      return errors.validation('Invalid stage number', stageValidation.errors);
    }
    
    if (typeof body.is_completed !== 'boolean') {
      return errors.validation('is_completed must be a boolean');
    }
    
    // Prevent manual update of attendance milestone (milestone 18)
    if (body.stage_number === 18) {
      return errors.validation('Attendance milestone is auto-calculated from attendance records');
    }
    
    // Check person exists and access
    const person = await People.findById(params.personId);
    if (!person) {
      return errors.notFound('Person');
    }
    
    // Leaders can only update their own group's people
    if (user!.role === ROLES.LEADER && person.group_id !== user!.group_id) {
      return errors.forbidden('You can only update progress for people in your group');
    }
    
    const progressRecord = await Progress.upsert(
      params.personId,
      {
        stage_number: body.stage_number,
        is_completed: body.is_completed,
      },
      user!.id
    );
    
    return success({ progress: progressRecord });
  } catch (err) {
    console.error('[PATCH /api/v1/progress/[personId]]', err);
    return errors.internal();
  }
}
