import { NextRequest } from 'next/server';
import {
  success,
  created,
  errors,
  requireAuth,
  getQueryParams,
  getEffectiveGroupFilter,
} from '@/lib/api';
import * as Attendance from '@/lib/db/queries/attendance';
import * as People from '@/lib/db/queries/people';
import { ROLES } from '@/lib/constants';
import { logAuditEvent, extractRequestInfo } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/attendance
 * Get attendance records with optional filters
 * 
 * Query params:
 * - person_id: Filter by person
 * - group_id: Filter by group
 * - start_date: Filter from date
 * - end_date: Filter to date
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const params = getQueryParams(request);
    const effectiveFilters = getEffectiveGroupFilter(user!, params);
    
    const filters: Attendance.AttendanceFilters = {
      personId: params.raw.get('person_id') || undefined,
      groupId: effectiveFilters.groupId,
      startDate: params.raw.get('start_date') || undefined,
      endDate: params.raw.get('end_date') || undefined,
      limit: params.limit,
      offset: params.offset,
    };
    
    const records = await Attendance.findMany(filters);
    
    return success({ 
      attendance: records,
    }, {
      total: records.length,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (err) {
    console.error('[GET /api/v1/attendance]', err);
    return errors.internal();
  }
}

/**
 * POST /api/v1/attendance
 * Record attendance for one or more people
 * 
 * Body:
 * - person_id: string (for single record)
 * - date_attended: string (ISO date)
 * - service_type?: string
 * - notes?: string
 * 
 * OR for bulk:
 * - records: Array<{ person_id, date_attended, service_type?, notes? }>
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    
    const body = await request.json();
    
    // Handle bulk records
    if (Array.isArray(body.records)) {
      if (body.records.length === 0) {
        return errors.validation('records array is empty');
      }
      
      // Validate each record
      for (const record of body.records) {
        if (!record.person_id || !record.date_attended) {
          return errors.validation('Each record must have person_id and date_attended');
        }
      }
      
      // Add recorded_by to each record
      const records = body.records.map((r: any) => ({
        ...r,
        recorded_by: user!.id,
      }));
      
      const { created: createdRecords, errors: recordErrors } = await Attendance.createMany(records);
      
      // Audit log bulk attendance
      const reqInfo = extractRequestInfo(request.headers);
      await logAuditEvent({
        userId: user!.id,
        action: 'MARK_ATTENDANCE',
        entityType: 'attendance_record',
        newValues: { 
          bulk: true, 
          created_count: createdRecords.length, 
          errors_count: recordErrors.length,
          date: body.records[0]?.date_attended 
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
      
      logger.info(`[BULK_ATTENDANCE] User ${user!.username} marked attendance for ${createdRecords.length} converts, ${recordErrors.length} errors`);
      
      return success({
        created: createdRecords.length,
        errors: recordErrors,
        records: createdRecords,
      });
    }
    
    // Handle single record
    if (!body.person_id || !body.date_attended) {
      return errors.validation('person_id and date_attended are required');
    }
    
    // Verify person exists and user has access
    const person = await People.findById(body.person_id);
    if (!person) {
      return errors.validation(`No convert found with ID: ${body.person_id}`);
    }
    
    if (user!.role === ROLES.LEADER && person.group_id !== user!.group_id) {
      return errors.forbidden(`You can only record attendance for people in your group. This person (${person.full_name}) belongs to a different group.`);
    }
    
    const record = await Attendance.create({
      person_id: body.person_id,
      date_attended: body.date_attended,
      recorded_by: user!.id,
    });
    
    // Audit log attendance marking
    const reqInfo = extractRequestInfo(request.headers);
    await logAuditEvent({
      userId: user!.id,
      action: 'MARK_ATTENDANCE',
      entityType: 'attendance_record',
      entityId: record.id,
      newValues: { person_id: body.person_id, person_name: person.full_name, date_attended: body.date_attended },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });
    
    logger.info(`[MARK_ATTENDANCE] User ${user!.username} marked attendance for ${person.full_name} on ${body.date_attended}`);
    
    return created({ attendance: record });
  } catch (err: any) {
    logger.error('[POST /api/v1/attendance] Attendance marking failed:', err);
    
    // Handle duplicate attendance
    if (err.message?.includes('duplicate') || err.code === '23505') {
      return errors.validation(`Attendance already marked for this person on this date.`);
    }
    
    // Handle invalid person reference
    if (err.message?.includes('foreign key') || err.code === '23503') {
      return errors.validation(`Invalid person_id. The specified person does not exist.`);
    }
    
    return errors.internal('Failed to mark attendance. Please try again.');
  }
}
