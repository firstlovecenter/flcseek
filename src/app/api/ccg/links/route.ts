import type { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { created, success } from '@/lib/api/response'
import { prisma } from '@/lib/prisma'
import { forbidden, notFound } from '@/lib/ccg/errors'
import { linkSchema } from '@/lib/ccg/schemas'
import { inFilter } from '@/lib/ccg/scope'
import { ensure, withCcg } from '@/lib/ccg/server/handler'
import { createLink, linkInclude, serializeLink } from '@/lib/ccg/server/links'
import { canOnPerson, personInclude } from '@/lib/ccg/server/people'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ccg/links?kind=&ccf_id=&stream_id=&include_inactive=1 — links the viewer manages:
 * member links for CCFs in scope (links.manage), intake links for their streams
 * or church-wide (links.intake), and person links (global people.manage).
 */
export const GET = withCcg({}, async ({ scope, query }) => {
  if (!scope.anywhere.has('links.manage') && !scope.anywhere.has('links.intake')) throw forbidden()
  const kind = query.get('kind')
  const ccfId = query.get('ccf_id')
  const streamId = query.get('stream_id')

  const memberCcfs = scope.ccfIds('links.manage')
  const intakeStreams = scope.streamIds('links.intake')
  const visible: Prisma.CcgFormLinkWhereInput[] = []
  if (memberCcfs === 'all' || memberCcfs.length) visible.push({ kind: 'member_ccf', ...(memberCcfs === 'all' ? {} : { ccfId: inFilter(memberCcfs) }) })
  if (intakeStreams === 'all') visible.push({ kind: 'convert_intake' })
  else if (intakeStreams.length) visible.push({ kind: 'convert_intake', streamId: { in: intakeStreams } })
  if (scope.can('people.manage')) visible.push({ kind: 'person_update' })
  if (visible.length === 0) return success({ links: [] })

  const where: Prisma.CcgFormLinkWhereInput = {
    ...(kind ? { kind } : {}),
    ...(ccfId ? { ccfId } : {}),
    ...(streamId ? { streamId } : {}),
    ...(query.get('include_inactive') === '1' ? {} : { revokedAt: null }),
    OR: visible,
  }
  const links = await prisma.ccgFormLink.findMany({ where, include: linkInclude, orderBy: { createdAt: 'desc' }, take: 200 })
  return success({ links: links.map(serializeLink) })
})

/**
 * POST /api/ccg/links — create a self-service link. The raw token is returned
 * once in this response (`token`, `path`) and never again.
 *  member_ccf:     links.manage on the CCF
 *  convert_intake: links.intake, globally or on `stream_id` (converts are registered into that stream)
 *  person_update:  people.manage on the person
 */
export const POST = withCcg<z.infer<typeof linkSchema>>({ schema: linkSchema }, async ({ user, scope, body }) => {
  if (body.kind === 'member_ccf') ensure(scope.canOnCcf('links.manage', body.ccf_id))
  else if (body.kind === 'convert_intake') {
    // Church-wide intake needs global rights; a stream's Sheep Seekers make links for their stream.
    ensure(scope.can('links.intake') || (!!body.stream_id && scope.canOnStream('links.intake', body.stream_id)))
  }
  else {
    const p = body.person_id ? await prisma.ccgPerson.findFirst({ where: { id: body.person_id, deletedAt: null }, include: personInclude }) : null
    if (!p) throw notFound('Person')
    ensure(canOnPerson(scope, 'people.manage', p))
  }
  const expiresAt = body.expires_at
    ? new Date(body.expires_at)
    : body.expires_in_days
      ? new Date(Date.now() + body.expires_in_days * 86_400_000)
      : null
  const result = await createLink({
    kind: body.kind,
    ccfId: body.ccf_id,
    streamId: body.stream_id,
    personId: body.person_id,
    label: body.label,
    expiresAt,
    maxUses: body.max_uses,
    actorId: user.id,
  })
  return created(result)
})
