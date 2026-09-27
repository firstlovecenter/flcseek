import { prisma } from '@/lib/prisma'
import { conflict } from '../errors'
import { createPerson } from './people'

/** Someone being given a role: an existing member, or a new person's details (no CCF needed). */
export type Appointee =
  | { person_id: string }
  | { first_name: string; middle_name?: string | null; last_name: string; phone: string; email: string }

/**
 * The person to appoint: an existing member, one with the same email (so they
 * keep one login), or someone new added as a member of the stream, or of
 * nothing below the church for a campus role.
 */
export async function personFor(streamId: string | null, body: Appointee, actorId: string) {
  if ('person_id' in body) return { personId: body.person_id, reused: false }
  const email = body.email.trim().toLowerCase()
  const existing = await prisma.ccgPerson.findFirst({
    where: { kind: 'member', deletedAt: null, email: { equals: email, mode: 'insensitive' } },
    select: { id: true, status: true },
  })
  if (existing) {
    if (existing.status !== 'active') throw conflict(`${email} belongs to a member who is not active yet`)
    return { personId: existing.id, reused: true }
  }
  const { person } = await createPerson({
    kind: 'member',
    core: { first_name: body.first_name, middle_name: body.middle_name ?? null, last_name: body.last_name, phone: body.phone, email, stream_id: streamId },
    answers: {},
    source: 'staff',
    actorId,
  })
  return { personId: person.id, reused: false }
}
