import { NextRequest } from 'next/server';
import {
  success,
  errors,
  requireAuth,
  requireAdmin,
  validateUUID,
} from '@/lib/api';
import * as Groups from '@/lib/db/queries/groups';
import { ROLES } from '@/lib/constants';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/groups/[id]
 * Get a single group with member count
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
      return errors.validation('Invalid group ID', idValidation.errors);
    }
    
    const group = await Groups.findById(id);
    if (!group) {
      return errors.notFound('Group');
    }
    
    return success({ group });
  } catch (err) {
    console.error('[GET /api/v1/groups/[id]]', err);
    return errors.internal();
  }
}

/**
 * PATCH /api/v1/groups/[id]
 * Update a group (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = requireAdmin(request);
    if (error) return error;

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid group ID', idValidation.errors);
    }
    
    const existing = await Groups.findById(id);
    if (!existing) {
      return errors.notFound('Group');
    }
    
    const body = await request.json();

    const group = await Groups.update(id, body);
    
    return success({ group });
  } catch (err) {
    console.error('[PATCH /api/v1/groups/[id]]', err);
    return errors.internal();
  }
}

/**
 * DELETE /api/v1/groups/[id]
 * Delete a group (superadmin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    if (user!.role !== ROLES.SUPERADMIN) {
      return errors.forbidden('Only superadmin can delete groups');
    }

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid group ID', idValidation.errors);
    }
    
    const existing = await Groups.findById(id);
    if (!existing) {
      return errors.notFound('Group');
    }
    
    // Check if group has members
    if (existing.member_count && existing.member_count > 0) {
      return errors.validation(
        `Cannot delete group with ${existing.member_count} members. Reassign or remove members first.`
      );
    }
    
    await Groups.remove(id);
    
    return success({ deleted: true, id });
  } catch (err) {
    console.error('[DELETE /api/v1/groups/[id]]', err);
    return errors.internal();
  }
}
