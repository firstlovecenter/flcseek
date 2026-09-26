import { prisma } from '@/lib/prisma'
import { currentAssignmentWhere } from '../access'
import { invalid, notFound } from '../errors'
import type { CcgScope } from '../scope'
import { ensure } from './handler'
import { endAssignment } from './roles'
import { CAMPUS_LEADS, STREAM_LEADS, type SeekingLead } from './seekers'

export const asLead = (v: string): SeekingLead => {
  if (v !== 'admin' && v !== 'overseer') throw invalid('lead must be admin or overseer')
  return v
}

/**
 * Who appoints Sheep Seeking leads: a stream's Admin and Overseer by the central
 * team or the stream's Campus Sheep Seeking Admin; a campus's by the central team.
 */
export async function ensureCanAppointStreamLead(scope: CcgScope, streamId: string) {
  const stream = await prisma.ccgStream.findFirst({ where: { id: streamId, deletedAt: null }, select: { campusId: true } })
  if (!stream) throw notFound('Stream')
  ensure(
    scope.can('roles.manage') || (!!stream.campusId && scope.canOnSeekingCampus('seekers.manage', stream.campusId)),
    'Only the central team or the campus’s Sheep Seeking Admin appoints a stream’s Sheep Seeking Admin and Overseer'
  )
}

export function ensureCanAppointCampusLead(scope: CcgScope) {
  ensure(scope.can('roles.manage'), 'Only the central team appoints a campus’s Sheep Seeking Admin and Overseer')
}

/** Stand the current holder down (no-op when there is none). */
export async function standDownLead(where: { streamId: string } | { campusId: string }, lead: SeekingLead, actorId: string) {
  const roleKey = 'streamId' in where ? STREAM_LEADS[lead] : CAMPUS_LEADS[lead]
  const current = await prisma.ccgRoleAssignment.findMany({ where: { roleKey, ...where, ...currentAssignmentWhere() }, select: { id: true } })
  for (const a of current) await endAssignment(a.id, actorId)
}
