import { NextRequest } from 'next/server';
import {
  success,
  created,
  errors,
  requireSuperAdmin,
  validateInt,
  validateString,
} from '@/lib/api';
import * as Milestones from '@/lib/db/queries/milestones';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/milestones
 * Get all milestones (including inactive) - admin only
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = requireSuperAdmin(request);
    if (error) return error;
    
    const milestones = await Milestones.findAll();
    
    return success({ milestones });
  } catch (err) {
    console.error('[GET /api/v1/admin/milestones]', err);
    return errors.internal();
  }
}

/**
 * POST /api/v1/admin/milestones
 * Create a new milestone
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = requireSuperAdmin(request);
    if (error) return error;
    
    const body = await request.json();
    
    // Validate
    const stageValidation = validateInt(body.stage_number, 'stage_number', { required: true, min: 1 });
    const nameValidation = validateString(body.stage_name, 'stage_name', { required: true, minLength: 1 });
    
    if (!stageValidation.valid || !nameValidation.valid) {
      return errors.validation('Invalid input', [
        ...stageValidation.errors,
        ...nameValidation.errors,
      ]);
    }
    
    // Check if stage_number exists
    const existing = await Milestones.findByStageNumber(body.stage_number);
    if (existing) {
      return errors.validation(`Milestone ${body.stage_number} already exists`);
    }
    
    const milestone = await Milestones.create({
      stage_number: body.stage_number,
      stage_name: body.stage_name,
      short_name: body.short_name,
      description: body.description,
      is_active: body.is_active !== false,
    });
    
    return created({ milestone });
  } catch (err) {
    console.error('[POST /api/v1/admin/milestones]', err);
    return errors.internal();
  }
}

/**
 * PATCH /api/v1/admin/milestones
 * Update a milestone (by id query param)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { error } = requireSuperAdmin(request);
    if (error) return error;
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return errors.validation('id query parameter is required');
    }
    
    const existing = await Milestones.findById(id);
    if (!existing) {
      return errors.notFound('Milestone');
    }
    
    const body = await request.json();
    const milestone = await Milestones.update(id, body);
    
    return success({ milestone });
  } catch (err) {
    console.error('[PATCH /api/v1/admin/milestones]', err);
    return errors.internal();
  }
}
