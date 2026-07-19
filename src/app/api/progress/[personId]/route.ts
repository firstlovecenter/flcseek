import { NextRequest } from 'next/server';
import {
  success,
  errors,
  requireAuth,
  validateUUID,
  validateInt,
  assertPersonAccess,
} from '@/lib/api';
import * as Progress from '@/lib/db/queries/progress';
import * as People from '@/lib/db/queries/people';
import { logAuditEvent, extractRequestInfo } from '@/lib/audit-log';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/progress/[personId]
 * Get all progress records for a person
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const { personId } = await params;
    const idValidation = validateUUID(personId, 'personId');
    if (!idValidation.valid) {
      return errors.validation('Invalid person ID', idValidation.errors);
    }
    
    // Check person exists and access
    const person = await People.findById(personId);
    if (!person) {
      return errors.notFound('Person');
    }
    
    const accessError = assertPersonAccess(
      user!,
      person,
      'You can only view progress for people in your group'
    );
    if (accessError) return accessError;
    
    const progress = await Progress.findByPersonId(personId);
    const completionRate = await Progress.getPersonCompletionRate(personId);
    
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
  { params }: { params: Promise<{ personId: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const { personId } = await params;
    const idValidation = validateUUID(personId, 'personId');
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
      const reqInfo = extractRequestInfo(request.headers);
      await logAuditEvent({
        userId: user!.id,
        action: 'UPDATE_PROGRESS',
        entityType: 'progress_record',
        entityId: personId,
        oldValues: { attempted_stage: 18 },
        newValues: { is_completed: body.is_completed },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
      return errors.validation('Milestone 18 depends on Attendance. Please mark attendance for the required number of Sundays to complete this milestone automatically.');
    }
    
    // Check person exists and access
    const person = await People.findById(personId);
    if (!person) {
      return errors.notFound('Person');
    }
    
    const accessError = assertPersonAccess(
      user!,
      person,
      'You can only update progress for people in your group'
    );
    if (accessError) return accessError;
    
    const progressRecord = await Progress.upsert(
      personId,
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
