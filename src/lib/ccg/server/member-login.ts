import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { conflict, invalid, notFound } from '../errors'
import { logCcg, type Db } from './common'
import { emailConfigured, inviteEmail, resetEmail, sendEmail } from './email'

/**
 * Every CCG role is held by a member. A member gets their login the first
 * time they are given a role: it is created from their profile (their email
 * is the sign-in name) with no usable password, and they are emailed a
 * one-time link to choose their own. Nobody sets a password for someone else.
 */

export const INVITE_DAYS = 7
const hash = (token: string) => createHash('sha256').update(token).digest('hex')
export const invitePath = (token: string) => `/welcome/${token}`
export const RESET_MINUTES = 60
export const resetPath = (token: string) => `/reset-password/${token}`

/**
 * The member's login, created if they have none. If a login (e.g. a Seek
 * account) already uses their email, that login is linked instead.
 */
export async function userForMember(personId: string, actorId: string, db: Db = prisma): Promise<{ userId: string; created: boolean }> {
  const p = await db.ccgPerson.findFirst({ where: { id: personId, deletedAt: null } })
  if (!p) throw notFound('Member')
  if (p.kind !== 'member' || p.status !== 'active') throw invalid('Roles are given to active members only')
  if (p.userId) return { userId: p.userId, created: false }

  const email = p.email?.trim().toLowerCase()
  if (!email) {
    throw invalid(`Add ${p.fullName}'s email address to their profile first: their invitation is sent there`, { reason: 'email_required' })
  }

  const existing = await db.user.findFirst({
    where: { deletedAt: null, OR: [{ email: { equals: email, mode: 'insensitive' } }, { username: { equals: email, mode: 'insensitive' } }] },
    select: { id: true },
  })
  if (existing) {
    const other = await db.ccgPerson.findFirst({ where: { userId: existing.id, deletedAt: null, id: { not: p.id } } })
    if (other) throw conflict(`${email} is already the login of ${other.fullName}`)
    await db.ccgPerson.update({ where: { id: p.id }, data: { userId: existing.id, updatedAt: new Date() } })
    await logCcg({ userId: actorId, action: 'MEMBER_LOGIN_LINKED', entityType: 'ccg_person', entityId: p.id, newValues: { user_id: existing.id } }, db)
    return { userId: existing.id, created: false }
  }

  const u = await db.user.create({
    data: {
      username: email,
      email,
      // Unusable until they choose their own password from the invitation.
      password: await hashPassword(randomBytes(32).toString('base64url')),
      firstName: p.firstName,
      lastName: p.lastName,
      phoneNumber: p.phone,
      role: null, // CCG only, no Seek access
    },
  })
  await db.ccgPerson.update({ where: { id: p.id }, data: { userId: u.id, updatedAt: new Date() } })
  await logCcg({ userId: actorId, action: 'MEMBER_LOGIN_CREATED', entityType: 'ccg_person', entityId: p.id, newValues: { user_id: u.id } }, db)
  return { userId: u.id, created: true }
}

export interface InviteResult {
  /** The email went out. */
  sent: boolean
  sent_to: string
  /** Only when it could not be emailed: the link, for the admin to pass on. */
  link?: string
  reason?: string
}

/**
 * Email a member a one-time link to set their password. Earlier open links
 * for the same login stop working.
 */
export async function sendInvite(opts: {
  personId: string
  role: string
  unit: string | null
  origin: string
  actorId: string
}): Promise<InviteResult> {
  const p = await prisma.ccgPerson.findFirst({ where: { id: opts.personId, deletedAt: null }, include: { user: true } })
  if (!p?.user) throw invalid('This member has no login yet')
  const to = (p.email ?? p.user.email ?? '').trim().toLowerCase()
  if (!to) throw invalid(`Add ${p.fullName}'s email address to their profile first`, { reason: 'email_required' })

  const token = randomBytes(32).toString('base64url')
  await prisma.$transaction([
    prisma.ccgInvite.updateMany({ where: { userId: p.user.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.ccgInvite.create({
      data: {
        userId: p.user.id,
        personId: p.id,
        tokenHash: hash(token),
        purpose: 'invite',
        sentTo: to,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
        createdBy: opts.actorId,
      },
    }),
  ])
  const link = `${opts.origin}${invitePath(token)}`
  const mail = inviteEmail({ name: p.fullName, role: opts.role, unit: opts.unit, link, expiresDays: INVITE_DAYS, signInName: p.user.username })
  const result = await sendEmail({ to, ...mail })
  await logCcg({ userId: opts.actorId, action: 'MEMBER_INVITED', entityType: 'ccg_person', entityId: p.id, newValues: { sent: result.sent, to } })
  if (!result.sent && !emailConfigured() && process.env.NODE_ENV !== 'production') console.info(`[ccg] invite for ${to}: ${link}`)
  return result.sent ? { sent: true, sent_to: to } : { sent: false, sent_to: to, link, reason: result.reason }
}

// ---------------------------------------------------------------------------
// Public side: the member opens the link and chooses a password
// ---------------------------------------------------------------------------

async function openInvite(token: string) {
  const inv = await prisma.ccgInvite.findUnique({ where: { tokenHash: hash(token) }, include: { user: true, person: true } })
  const ok = inv && !inv.usedAt && !inv.revokedAt && inv.expiresAt > new Date() && !inv.user.deletedAt
  if (!ok) throw notFound('Invitation')
  return inv!
}

export async function describeInvite(token: string) {
  const inv = await openInvite(token)
  return {
    purpose: inv.purpose as 'invite' | 'reset',
    name: inv.person?.firstName ?? inv.user.firstName ?? inv.user.username,
    sign_in_name: inv.user.username,
  }
}

export async function acceptInvite(token: string, password: string) {
  const inv = await openInvite(token)
  const hashed = await hashPassword(password)
  // Claim the invite atomically so a link cannot be used twice.
  const claimed = await prisma.ccgInvite.updateMany({ where: { id: inv.id, usedAt: null, revokedAt: null }, data: { usedAt: new Date() } })
  if (claimed.count === 0) throw notFound('Invitation')
  await prisma.user.update({
    where: { id: inv.userId },
    // Bumping the token version signs out any session made with an old password.
    data: { password: hashed, tokenVersion: { increment: 1 } },
  })
  await logCcg({
    userId: inv.userId,
    action: inv.purpose === 'reset' ? 'PASSWORD_RESET' : 'INVITE_ACCEPTED',
    entityType: 'user',
    entityId: inv.userId,
  })
  return { sign_in_name: inv.user.username }
}

/**
 * "Forgot password": email a one-time reset link to the login that uses this
 * email (or username). Says nothing about whether one exists: the caller
 * always answers the same way, so the form cannot be used to find accounts.
 */
export async function requestPasswordReset(identifier: string, origin: string): Promise<{ link?: string }> {
  const id = identifier.trim().toLowerCase()
  if (!id) return {}
  let user = await prisma.user.findFirst({
    where: { deletedAt: null, OR: [{ email: { equals: id, mode: 'insensitive' } }, { username: { equals: id, mode: 'insensitive' } }] },
  })
  let to = user?.email?.toLowerCase() ?? null
  if (!user) {
    // A member's profile email, when their login uses another address.
    const byProfile = await prisma.ccgPerson.findFirst({ where: { email: id, deletedAt: null, userId: { not: null } }, include: { user: true } })
    if (byProfile?.user && !byProfile.user.deletedAt) {
      user = byProfile.user
      to = id
    }
  }
  if (!user) return {}
  const person = await prisma.ccgPerson.findFirst({ where: { userId: user.id, deletedAt: null } })
  to = to ?? person?.email ?? null
  if (!to) return {} // no address to send to: an admin can send a password link from their page

  const token = randomBytes(32).toString('base64url')
  await prisma.$transaction([
    prisma.ccgInvite.updateMany({ where: { userId: user.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.ccgInvite.create({
      data: {
        userId: user.id,
        personId: person?.id ?? null,
        tokenHash: hash(token),
        purpose: 'reset',
        sentTo: to,
        expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000),
      },
    }),
  ])
  const link = `${origin}${resetPath(token)}`
  const name = person?.firstName ?? user.firstName ?? user.username
  const result = await sendEmail({ to, ...resetEmail({ name, link, expiresMinutes: RESET_MINUTES, signInName: user.username }) })
  await logCcg({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', entityType: 'user', entityId: user.id, newValues: { sent: result.sent } })
  if (!result.sent && !emailConfigured() && process.env.NODE_ENV !== 'production') console.info(`[ccg] password reset for ${to}: ${link}`)
  // For tests and local development only: the public route never returns this.
  return result.sent ? {} : { link }
}

/** A signed-in user changes their own password. Every session is signed out. */
export async function changePassword(userId: string, current: string, next: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) throw notFound('User')
  if (!(await verifyPassword(current, user.password))) {
    throw invalid('Your current password is not right', { fieldErrors: { current_password: ['Your current password is not right'] } })
  }
  if (current === next) throw invalid('Choose a password different from your current one')
  await prisma.user.update({ where: { id: userId }, data: { password: await hashPassword(next), tokenVersion: { increment: 1 } } })
  await logCcg({ userId, action: 'PASSWORD_CHANGED', entityType: 'user', entityId: userId })
}
