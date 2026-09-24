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

/**
 * Normalise a phone number for storage and duplicate checks. Ghana local
 * numbers (0XXXXXXXXX) become international (233XXXXXXXXX); anything else is
 * reduced to its digits.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10 && digits.startsWith('0')) return `233${digits.slice(1)}`
  return digits
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
