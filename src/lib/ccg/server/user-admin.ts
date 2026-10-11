import { prisma } from '@/lib/prisma'
import { conflict, notFound } from '../errors'
import { logCcg, normalizePhone } from './common'
import { updatePerson } from './people'

/**
 * The CCG owner edits someone's login: their name, email and phone. A login
 * that belongs to a member changes the member's profile too (with the same
 * checks as any member edit), so the two never disagree. A sign-in name that
 * is their email follows the new email.
 */
export async function updateLogin(
  userId: string,
  patch: { first_name?: string; last_name?: string; email?: string; phone?: string },
  actorId: string
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, username: true, email: true, firstName: true, lastName: true, phoneNumber: true, role: true },
  })
  if (!user) throw notFound('User')
  const member = await prisma.ccgPerson.findFirst({ where: { userId, kind: 'member', deletedAt: null }, select: { id: true } })

  const email = patch.email?.toLowerCase()
  const emailChanged = email !== undefined && email !== (user.email ?? '').toLowerCase()
  // Their sign-in name follows their email when it was their email (every CCG-made login).
  const followsEmail = !!user.email && user.username.toLowerCase() === user.email.toLowerCase()
  if (emailChanged) {
    const taken = await prisma.user.findFirst({
      where: { id: { not: userId }, deletedAt: null, OR: [{ email: { equals: email, mode: 'insensitive' } }, { username: { equals: email, mode: 'insensitive' } }] },
      select: { id: true },
    })
    if (taken) throw conflict(`${email} is already another login’s email or sign-in name`, { fieldErrors: { email: ['Already used by another login'] } })
  }

  // The member's profile first: it checks the phone and email as any member edit does.
  if (member) {
    await updatePerson(
      member.id,
      {
        ...(patch.first_name !== undefined ? { first_name: patch.first_name } : {}),
        ...(patch.last_name !== undefined ? { last_name: patch.last_name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      },
      { actorId, source: 'staff' }
    )
  }

  const data = {
    ...(patch.first_name !== undefined ? { firstName: patch.first_name } : {}),
    ...(patch.last_name !== undefined ? { lastName: patch.last_name } : {}),
    ...(email !== undefined ? { email, ...(emailChanged && (followsEmail || !user.role) ? { username: email } : {}) } : {}),
    ...(patch.phone !== undefined ? { phoneNumber: normalizePhone(patch.phone) ?? (patch.phone || null) } : {}),
  }
  const updated = await prisma.user.update({ where: { id: userId }, data, select: { id: true, username: true, email: true } })
  await logCcg({
    userId: actorId,
    action: 'USER_UPDATED',
    entityType: 'user',
    entityId: userId,
    oldValues: { first_name: user.firstName, last_name: user.lastName, email: user.email, username: user.username, phone: user.phoneNumber },
    newValues: { ...patch, username: updated.username },
  })
  return { id: updated.id, username: updated.username, email: updated.email, signs_in_with_changed: updated.username !== user.username }
}
