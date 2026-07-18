import { ROLES } from '@/lib/constants';

/**
 * Only superadmins may backdate attendance to an earlier Sunday. Everyone
 * else may only record attendance for the most recent Sunday (today, if
 * today is a Sunday). Returns an error message, or null if the date is valid.
 *
 * `now` is injectable for tests; defaults to the current time.
 */
export function validateAttendanceDate(
  dateAttended: string,
  role: string,
  now: Date = new Date()
): string | null {
  const date = new Date(`${dateAttended}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date_attended value';
  }

  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) {
    return 'Cannot record attendance for a future date';
  }

  if (date.getUTCDay() !== 0) {
    return 'Attendance can only be recorded for a Sunday';
  }

  if (role !== ROLES.SUPERADMIN) {
    const mostRecentSunday = new Date(today);
    mostRecentSunday.setUTCDate(today.getUTCDate() - today.getUTCDay());
    if (date.getTime() !== mostRecentSunday.getTime()) {
      return 'You can only record attendance for the most recent Sunday';
    }
  }

  return null;
}
