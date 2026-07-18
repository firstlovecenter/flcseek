import { describe, it, expect } from 'vitest';
import { validateAttendanceDate } from '@/lib/utils/attendance-validation';

// Fixed reference times (UTC). 2026-07-12 was a Sunday; 2026-07-15 a Wednesday.
const WEDNESDAY = new Date('2026-07-15T10:00:00Z');
const SUNDAY = new Date('2026-07-12T10:00:00Z');

describe('validateAttendanceDate', () => {
  it('rejects malformed dates', () => {
    expect(validateAttendanceDate('not-a-date', 'leader', WEDNESDAY)).toBe(
      'Invalid date_attended value'
    );
  });

  it('rejects future dates for everyone, including superadmin', () => {
    expect(validateAttendanceDate('2026-07-19', 'superadmin', WEDNESDAY)).toBe(
      'Cannot record attendance for a future date'
    );
  });

  it('rejects non-Sunday dates', () => {
    expect(validateAttendanceDate('2026-07-14', 'superadmin', WEDNESDAY)).toBe(
      'Attendance can only be recorded for a Sunday'
    );
  });

  it('accepts the most recent Sunday for a leader', () => {
    expect(validateAttendanceDate('2026-07-12', 'leader', WEDNESDAY)).toBeNull();
  });

  it('accepts today when today is a Sunday', () => {
    expect(validateAttendanceDate('2026-07-12', 'leader', SUNDAY)).toBeNull();
  });

  it('rejects an older Sunday for non-superadmins', () => {
    expect(validateAttendanceDate('2026-07-05', 'leader', WEDNESDAY)).toBe(
      'You can only record attendance for the most recent Sunday'
    );
    expect(validateAttendanceDate('2026-07-05', 'admin', WEDNESDAY)).not.toBeNull();
  });

  it('allows superadmin to backdate to any past Sunday', () => {
    expect(validateAttendanceDate('2026-07-05', 'superadmin', WEDNESDAY)).toBeNull();
    expect(validateAttendanceDate('2025-12-28', 'superadmin', WEDNESDAY)).toBeNull();
  });
});
