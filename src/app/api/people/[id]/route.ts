import { NextRequest } from 'next/server';
import {
  success,
  errors,
  requireAuth,
  validateUUID,
  validatePersonData,
  assertPersonAccess,
  isGroupScopedRole,
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
    const { user, error } = await requireAuth(request);
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
    
    // Check access: org roles can view any person; leaders/admins locked to month name
    if (isGroupScopedRole(user!.role)) {
      if (!user!.group_id && !user!.group_name) {
        return errors.forbidden('You must be assigned to a group to view people');
      }
      const accessError = assertPersonAccess(user!, person);
      if (accessError) return accessError;
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
    const { user, error } = await requireAuth(request);
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
    
    // Logs for debugging
    if (process.env.NODE_ENV !== 'production') console.log(`[PATCH /api/v1/people/[id]] User role: ${user!.role}, Person group_id: ${existing.group_id}, User group_id: ${user!.group_id}`);
    
    // Only admin and superadmin can edit people
    if (user!.role !== ROLES.SUPERADMIN && user!.role !== ROLES.ADMIN) {
      return errors.forbidden('You do not have permission to edit people');
    }
    
    // Admin can only edit people in their group; superadmin can edit anyone
    if (user!.role === ROLES.ADMIN) {
      if (!user!.group_id && !user!.group_name) {
        return errors.forbidden('You must be assigned to a group to edit people');
      }
      const accessError = assertPersonAccess(user!, existing);
      if (accessError) return accessError;
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
 * Soft delete a person while preserving related records
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    // Leaders cannot delete converts.
    if (user!.role === ROLES.LEADER) {
      return errors.forbidden('Insufficient permissions to delete');
    }

    // Admins can delete only within their own group.
    // Higher roles (overseer/leadpastor/superadmin) can delete any group.
    const restrictedRoles: string[] = [ROLES.ADMIN];

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid person ID', idValidation.errors);
    }

    const existing = await People.findById(id);
    if (!existing) {
      return errors.notFound('Person');
    }

    if (restrictedRoles.includes(user!.role)) {
      if (!user!.group_id && !user!.group_name) {
        return errors.forbidden('You must be assigned to a group to delete people');
      }
      const accessError = assertPersonAccess(user!, existing);
      if (accessError) return accessError;
    }

    await People.remove(id);
    
    return success({ deleted: true, id });
  } catch (err) {
    console.error('[DELETE /api/v1/people/[id]]', err);
    return errors.internal();
  }
}
