import { success } from '@/lib/api/response'
import { withCcg } from '@/lib/ccg/server/handler'
import { listQuarantines, type QuarantineStatus } from '@/lib/ccg/server/quarantine'

export const dynamic = 'force-dynamic'

const STATUSES: QuarantineStatus[] = ['open', 'confirmed', 'released', 'replaced']

/**
 * GET /api/ccg/quarantines?status=open|confirmed|released|replaced (comma-separated)&stream_id=&campus_id=&limit=&offset=
 * Quarantined converts in the streams the viewer decides for (seekers.manage: the stream's or
 * campus's Sheep Seeking Admin, or the central team). `open`: how many are waiting.
 */
export const GET = withCcg({ permission: 'seekers.manage' }, async ({ scope, query }) => {
  const asked = (query.get('status') ?? 'open').split(',').filter((s): s is QuarantineStatus => (STATUSES as string[]).includes(s))
  return success(
    await listQuarantines(scope, {
      status: asked.length ? asked : ['open'],
      streamId: query.get('stream_id'),
      campusId: query.get('campus_id'),
      limit: Math.min(Number(query.get('limit')) || 100, 200),
      offset: Math.max(Number(query.get('offset')) || 0, 0),
    })
  )
})
