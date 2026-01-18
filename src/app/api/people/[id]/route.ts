import { NextRequest } from 'next/server';
import {
  success,
  errors,
  requireAuth,
  validateUUID,
  validatePersonData,
} from '@/lib/api';
import * as People from '@/lib/db/queries/people';
import * as Progress from '@/lib/db/queries/progress';
import * as Attendance from '@/lib/db/queries/attendance';
import { ROLES } from '@/lib/constants';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/people/[id]
 * Get a single person with all their data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid person ID', idValidation.errors);
    }
    
    const person = await People.findById(id);
    if (!person) {
      return errors.notFound('Person');
    }
    
    // Check access: leaders can only see people in their group
    if (user!.role === ROLES.LEADER) {
      if (person.group_id !== user!.group_id) {
        return errors.forbidden('You can only view people in your group');
      }
    }
    
    // Get additional data
    const progress = await Progress.findByPersonId(id);
    const attendance = await Attendance.findByPersonId(id);
    
    return success({
      person: {
        ...person,
        progress,
        attendance,
        attendance_count: attendance.length,
      },
    });
  } catch (err) {
    console.error('[GET /api/v1/people/[id]]', err);
    return errors.internal();
  }
}

/**
 * PATCH /api/v1/people/[id]
 * Update a person
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid person ID', idValidation.errors);
    }
    
    // Check person exists and access
    const existing = await People.findById(id);
    if (!existing) {
      return errors.notFound('Person');
    }
    
    // Leaders can only edit people in their group
    if (user!.role === ROLES.LEADER) {
      if (existing.group_id !== user!.group_id) {
        return errors.forbidden('You can only edit people in your group');
      }
    }
    
    const body = await request.json();
    
    // Validate update fields
    const validation = validatePersonData({ ...existing, ...body });
    if (!validation.valid) {
      return errors.validation('Invalid input', validation.errors);
    }
    
    const person = await People.update(id, body);
    
    return success({ person });
  } catch (err) {
    console.error('[PATCH /api/v1/people/[id]]', err);
    return errors.internal();
  }
}

/**
 * DELETE /api/v1/people/[id]
 * Delete a person and their related records
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    // Only admin and above can delete
    if (user!.role === ROLES.LEADER) {
      return errors.forbidden('Insufficient permissions to delete');
    }

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid person ID', idValidation.errors);
    }
    
    const existing = await People.findById(id);
    if (!existing) {
      return errors.notFound('Person');
    }
    
    await People.remove(id);
    
    return success({ deleted: true, id });
  } catch (err) {
    console.error('[DELETE /api/v1/people/[id]]', err);
    return errors.internal();
  }
}
