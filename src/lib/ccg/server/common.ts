import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveCcgConfig, type CcgConfig } from '../engine'

export type Tx = Prisma.TransactionClient
export type Db = typeof prisma | Tx

/**
 * Interactive transaction with limits suited to Neon: a suspended compute can
 * take several seconds to wake, which exceeds Prisma's 2s default wait.
 */
export const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const

export function ccgTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, TX_OPTIONS)
}

export function dateOnly(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null
}

export function parseDateOnly(s: string | null | undefined): Date | null {
  return s ? new Date(`${s}T00:00:00Z`) : null
}

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

/** AI text sometimes carries "—" as literal text; show the character. */
export const unescapeUnicode = (s: string) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
export const num = (d: Prisma.Decimal | number | null | undefined) => (d === null || d === undefined ? null : Number(d))

export function userDisplayName(u: { firstName?: string | null; lastName?: string | null; username: string }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username
}

export async function userRefs(ids: Array<string | null | undefined>, db: Db = prisma) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))]
  if (unique.length === 0) return new Map<string, { id: string; name: string }>()
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, username: true, firstName: true, lastName: true },
  })
  return new Map(users.map((u) => [u.id, { id: u.id, name: userDisplayName(u) }]))
}

export const PHONE_INVALID = 'Enter a valid phone number, e.g. 024 123 4567'

/**
 * Normalise a phone number for storage and duplicate checks, so one number is
 * always stored the same way however it was typed. Ghana numbers become
 * 233XXXXXXXXX from any of: 024 123 4567, 24 123 4567, +233 24 123 4567,
 * +233 (0)24 123 4567, 00233 24 123 4567. Other countries' numbers (written
 * with their code) keep their digits. Null when empty or not a possible
 * number (see phoneProblem).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  let d = (raw ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 13 && d.startsWith('2330')) d = `233${d.slice(4)}`
  else if (d.length === 10 && d.startsWith('0')) d = `233${d.slice(1)}`
  else if (d.length === 9 && /^[235]/.test(d)) d = `233${d}`
  // Ghana: 233 + 9 digits, mobile (2x, 5x) or landline (3x).
  if (d.startsWith('233')) return /^233[235]\d{8}$/.test(d) ? d : null
  // A local number of the wrong length (e.g. a digit missing).
  if (d.startsWith('0')) return null
  return d.length >= 8 && d.length <= 15 ? d : null
}

export const PHONE_NOT_GHANA = 'Enter a Ghana phone number, e.g. 024 123 4567'

export const isGhanaPhone = (normalized: string | null) => !!normalized && normalized.startsWith('233')

/**
 * Why a typed phone number can't be stored for a member or convert, or null
 * when it is fine or left empty. Only Ghana numbers are taken (user, 2026-10-05).
 */
export function phoneProblem(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const phone = normalizePhone(raw)
  if (!phone) return PHONE_INVALID
  return isGhanaPhone(phone) ? null : PHONE_NOT_GHANA
}

export const zoneLabel = (z: { code: string; name: string } | null | undefined) => (z ? `Zone ${z.code} – ${z.name}` : null)

export async function getCcgConfig(db: Db = prisma): Promise<CcgConfig> {
  const row = await db.ccgSettings.findUnique({ where: { id: 1 } })
  return resolveCcgConfig(row?.config ?? {})
}

export async function logCcg(
  entry: {
    userId?: string | null
    action: string
    entityType?: string
    entityId?: string | null
    oldValues?: unknown
    newValues?: unknown
  },
  db: Db = prisma
) {
  try {
    await db.ccgActivityLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        oldValues: (entry.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
        newValues: (entry.newValues ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (err) {
    // Outside a transaction an audit failure must not break the action.
    // Inside one, rethrow: the transaction is already aborted.
    if (db !== prisma) throw err
    console.error('[ccg] activity log write failed:', err)
  }
}
