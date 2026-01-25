import { NextRequest } from 'next/server';
import {
  success,
  errors,
  requireAuth,
  validatePersonData,
} from '@/lib/api';
import * as People from '@/lib/db/queries/people';
import { prisma } from '@/lib/prisma';
import { logAuditEvent, extractRequestInfo } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/people/bulk
 * Bulk create people from Excel or manual entry
 * 
 * Body:
 * - people: Array of person objects
 * - skipDuplicates: boolean (default true)
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const body = await request.json();
    
    if (!Array.isArray(body.people) || body.people.length === 0) {
      return errors.validation('people array is required and must not be empty');
    }
    
    if (body.people.length > 500) {
      return errors.validation('Maximum 500 people can be imported at once');
    }
    
    // Determine the target group_id - use from first person or fallback to user's group
    const targetGroupId = body.people[0]?.group_id || user!.group_id;
    
    // Validate that the target group exists
    if (!targetGroupId) {
      return errors.validation('group_id is required. Either provide it in the request or ensure your user account has a group assigned.');
    }
    
    // Verify the group exists in the database
    const targetGroup = await prisma.group.findUnique({
      where: { id: targetGroupId },
      select: { id: true, name: true, year: true },
    });
    
    if (!targetGroup) {
      return errors.validation(`Invalid group_id: ${targetGroupId}. The specified group does not exist.`);
    }
    
    // Validate all records
    const validationErrors: string[] = [];
    const validPeople: People.CreatePersonInput[] = [];
    
    for (let i = 0; i < body.people.length; i++) {
      const person = body.people[i];
      const validation = validatePersonData(person);
      
      if (!validation.valid) {
        validationErrors.push(`Row ${i + 1}: ${validation.errors.join(', ')}`);
      } else {
        // Always use the validated target group to ensure consistency
        validPeople.push({
          first_name: person.first_name,
          last_name: person.last_name,
          phone_number: person.phone_number,
          gender: person.gender,
          date_of_birth: person.date_of_birth,
          residential_location: person.residential_location,
          school_residential_location: person.school_residential_location,
          occupation_type: person.occupation_type,
          address: person.address,  // Legacy field support
          group_id: targetGroup.id,        // Use verified group ID
          group_name: targetGroup.name,     // Use verified group name
          registered_by: user!.id,
        });
      }
    }
    
    if (validationErrors.length > 0 && validPeople.length === 0) {
      return errors.validation('All records failed validation', validationErrors);
    }
    
    const { created, skipped } = await People.createMany(
      validPeople, 
      { skipDuplicates: body.skipDuplicates !== false }
    );
    
    // Audit log bulk registration
    const reqInfo = extractRequestInfo(request.headers);
    await logAuditEvent({
      userId: user!.id,
      action: 'BULK_REGISTER',
      entityType: 'new_convert',
      newValues: { 
        created_count: created.length, 
        skipped_count: skipped, 
        validation_errors: validationErrors.length,
        group_id: targetGroup.id,
        group_name: targetGroup.name 
      },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });
    
    logger.info(`[BULK_REGISTER] User ${user!.username} bulk registered ${created.length} converts to ${targetGroup.name}, ${skipped} skipped, ${validationErrors.length} validation errors`);
    
    return success({
      inserted: created.length, // Frontend expects 'inserted'
      created: created.length,  // Keep for backwards compatibility
      skipped,
      validationErrors: validationErrors.length,
      details: {
        people: created,
        errors: validationErrors.slice(0, 10), // Limit error details
      },
    });
  } catch (err: any) {
    logger.error('[POST /api/v1/people/bulk] Bulk registration failed:', err);
    
    // Provide specific error context
    if (err.message?.includes('foreign key') || err.code === '23503') {
      return errors.internal(`Database constraint error: Invalid group reference. Please verify the group exists.`);
    }
    
    return errors.internal(`Failed to complete bulk registration. Please check your data and try again.`);
  }
}
