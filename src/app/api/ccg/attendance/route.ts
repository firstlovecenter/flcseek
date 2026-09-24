import type { z } from 'zod'
import { success } from '@/lib/api/response'
import { invalid } from '@/lib/ccg/errors'
import { ATTENDANCE_EVENTS, type AttendanceEvent } from '@/lib/ccg/progress'
import { attendanceSchema, isoDate } from '@/lib/ccg/schemas'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { attendanceRegister, saveAttendance } from '@/lib/ccg/server/progress'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/attendance?ccf_id=&event_type=&date=YYYY-MM-DD
 * The register for one CCF: its placed converts, whether each was present,
 * and their running total for that event type.
 */
export const GET = withCcg({ permission: 'attendance.mark' }, async ({ scope, query }) => {
  const ccfId = query.get('ccf_id')
  const eventType = query.get('event_type')
  const date = query.get('date')
  if (!ccfId) throw invalid('ccf_id is required')
  if (!eventType || !(ATTENDANCE_EVENTS as readonly string[]).includes(eventType)) {
    throw invalid(`event_type must be one of ${ATTENDANCE_EVENTS.join(', ')}`)
  }
  if (!date || !isoDate.safeParse(date).success) throw invalid('date must be YYYY-MM-DD')
  ensure(scope.canOnCcf('attendance.mark', ccfId))
  return success({ register: await attendanceRegister(ccfId, eventType as AttendanceEvent, date) })
})

/**
 * PUT /api/ccg/attendance — save a register. Present people are recorded,
 * absent ones removed for that day; attendance milestones update themselves.
 */
export const PUT = withCcg<z.infer<typeof attendanceSchema>>(
  { permission: 'attendance.mark', schema: attendanceSchema },
  async ({ user, scope, body }) => {
    ensure(scope.canOnCcf('attendance.mark', body.ccf_id))
    const result = await saveAttendance(body, user.id)
    return success({ ...result, register: await attendanceRegister(body.ccf_id, body.event_type, body.event_date) })
  }
)
