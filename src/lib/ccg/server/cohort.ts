import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { invalid } from '../errors'
import { inFilter, type CcgScope } from '../scope'
import { ccfIdsIn, type UnitType } from './unit-overview'

/**
 * Converts by month, as Seek grouped them ("January 2026"): the month and year
 * they were registered (created_at), nothing else — not their conversion date
 * or any group. Months are yyyy-mm, in UTC.
 */

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

/** The month query parameter, checked; null when absent. */
export function parseMonth(v: string | null): string | null {
  if (!v) return null
  if (!MONTH_RE.test(v)) throw invalid('month must be YYYY-MM')
  return v
}

function range(month: string) {
  const [y, m] = month.split('-').map(Number)
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) }
}

/** The converts registered in one month. */
export function personInMonth(month: string): Prisma.CcgPersonWhereInput {
  return { createdAt: range(month) }
}

const monthOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/**
 * The months with converts in their assessment year in a unit (or everything
 * the viewer reports on), newest first, with how many.
 */
export async function convertMonths(scope: CcgScope, unit: { type: UnitType; id: string } | null) {
  const inScope = scope.ccfIds('reports.view')
  const unitIds = unit ? await ccfIdsIn(unit.type, unit.id) : null
  const ccfIds = unitIds ? (inScope === 'all' ? unitIds : unitIds.filter((id) => inScope.includes(id))) : inScope
  const within = inFilter(ccfIds)
  const rows = await prisma.ccgPlacement.findMany({
    where: { status: 'active', person: { deletedAt: null }, ...(within ? { finalCcfId: within } : {}) },
    select: { person: { select: { createdAt: true } } },
  })
  const counts = new Map<string, number>()
  for (const r of rows) {
    const d = r.person.createdAt
    if (!d) continue
    const k = monthOf(d)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return {
    months: [...counts.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, converts]) => ({ month, converts })),
  }
}
