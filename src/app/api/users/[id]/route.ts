import { NextRequest } from 'next/server';
import {
  success,
  errors,
  requireAuth,
  requireSuperAdmin,
  validateUUID,
  validateUserData,
} from '@/lib/api';
import * as Users from '@/lib/db/queries/users';
import { ROLES } from '@/lib/constants';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/users/[id]
 * Get a single user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: currentUser, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid user ID', idValidation.errors);
    }
    
    // Users can only view their own profile unless admin
    if (currentUser!.id !== id && 
        currentUser!.role !== ROLES.SUPERADMIN && 
        currentUser!.role !== ROLES.LEADPASTOR) {
      return errors.forbidden('You can only view your own profile');
    }
    
    const user = await Users.findById(id);
    if (!user) {
      return errors.notFound('User');
    }
    
    // Get user's groups
    const groups = await Users.getUserGroups(id);
    
    return success({ 
      user: {
        ...user,
        groups,
      },
    });
  } catch (err) {
    console.error('[GET /api/v1/users/[id]]', err);
    return errors.internal();
  }
}

/**
 * PATCH /api/v1/users/[id]
 * Update a user
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: currentUser, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid user ID', idValidation.errors);
    }
    
    const existing = await Users.findById(id);
    if (!existing) {
      return errors.notFound('User');
    }
    
    // Only superadmin can edit other users
    // Users can edit their own profile (limited fields)
    const isSelf = currentUser!.id === id;
    const isSuperAdmin = currentUser!.role === ROLES.SUPERADMIN;
    
    if (!isSelf && !isSuperAdmin) {
      return errors.forbidden('You can only edit your own profile');
    }
    
    const body = await request.json();
    
    // Non-admins can only update limited fields
    if (!isSuperAdmin) {
      const allowedFields = ['first_name', 'last_name', 'email', 'phone_number', 'password'];
      for (const key of Object.keys(body)) {
        if (!allowedFields.includes(key)) {
          return errors.validation(`You cannot update the ${key} field`);
        }
      }
    }
    
    // Don't allow changing role of system users
    if (body.role && ['skaduteye', 'sysadmin'].includes(existing.username)) {
      return errors.forbidden('Cannot change role of system users');
    }
    
    const validation = validateUserData({ ...existing, ...body }, false);
    if (!validation.valid) {
      return errors.validation('Invalid input', validation.errors);
    }
    
    const user = await Users.update(id, body);
    
    return success({ user });
  } catch (err) {
    console.error('[PATCH /api/v1/users/[id]]', err);
    return errors.internal();
  }
}

/**
 * DELETE /api/v1/users/[id]
 * Delete a user (superadmin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = requireSuperAdmin(request);
    if (error) return error;

    const { id } = await params;
    const idValidation = validateUUID(id);
    if (!idValidation.valid) {
      return errors.validation('Invalid user ID', idValidation.errors);
    }
    
    const existing = await Users.findById(id);
    if (!existing) {
      return errors.notFound('User');
    }
    
    try {
      await Users.remove(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('system user')) {
        return errors.forbidden('Cannot delete system users');
      }
      throw err;
    }
    
    return success({ deleted: true, id });
  } catch (err) {
    console.error('[DELETE /api/v1/users/[id]]', err);
    return errors.internal();
  }
}
