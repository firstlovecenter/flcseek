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
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const idValidation = validateUUID(params.id);
    if (!idValidation.valid) {
      return errors.validation('Invalid group ID', idValidation.errors);
    }
    
    const group = await Groups.findById(params.id);
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
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = requireAdmin(request);
    if (error) return error;
    
    const idValidation = validateUUID(params.id);
    if (!idValidation.valid) {
      return errors.validation('Invalid group ID', idValidation.errors);
    }
    
    const existing = await Groups.findById(params.id);
    if (!existing) {
      return errors.notFound('Group');
    }
    
    const body = await request.json();
    
    // Check for name conflicts if name is being changed
    if (body.name && body.name !== existing.name) {
      const year = body.year || existing.year;
      const conflict = await Groups.findByNameAndYear(body.name, year);
      if (conflict && conflict.id !== params.id) {
        return errors.validation(`Group "${body.name}" already exists for ${year}`);
      }
    }
    
    const group = await Groups.update(params.id, body);
    
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
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    if (user!.role !== ROLES.SUPERADMIN) {
      return errors.forbidden('Only superadmin can delete groups');
    }
    
    const idValidation = validateUUID(params.id);
    if (!idValidation.valid) {
      return errors.validation('Invalid group ID', idValidation.errors);
    }
    
    const existing = await Groups.findById(params.id);
    if (!existing) {
      return errors.notFound('Group');
    }
    
    // Check if group has members
    if (existing.member_count && existing.member_count > 0) {
      return errors.validation(
        `Cannot delete group with ${existing.member_count} members. Reassign or remove members first.`
      );
    }
    
    await Groups.remove(params.id);
    
    return success({ deleted: true, id: params.id });
  } catch (err) {
    console.error('[DELETE /api/v1/groups/[id]]', err);
    return errors.internal();
  }
}
