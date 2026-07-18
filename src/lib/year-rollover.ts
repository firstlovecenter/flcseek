/**
 * Yearly group rollover service.
 *
 * Clones all active groups from the previous year into the current year:
 * same name, description, and leader; converts are NOT migrated (new-year
 * groups start empty). Groups whose name already exists in the current year
 * are skipped, so the operation is idempotent and safe to re-run.
 *
 * Used by the superadmin UI endpoint and the Jan-1 Netlify scheduled function.
 */

import { prisma } from './prisma'
import { logger } from './logger'
import { logAuditEvent } from './audit-log'

export interface RolloverResult {
  clonedCount: number
  skippedCount: number
  groups: Array<{ id: string; name: string; year: number }>
}

export async function cloneGroupsToCurrentYear(actingUserId: string): Promise<RolloverResult> {
  const currentYear = new Date().getFullYear()
  const previousYear = currentYear - 1

  const previousYearGroups = await prisma.group.findMany({
    where: { year: previousYear, archived: false },
    orderBy: { name: 'asc' },
  })

  if (previousYearGroups.length === 0) {
    return { clonedCount: 0, skippedCount: 0, groups: [] }
  }

  // Single query for all current-year group names (avoids one findFirst per group).
  const existingCurrent = await prisma.group.findMany({
    where: { year: currentYear },
    select: { name: true },
  })
  const existingNames = new Set(existingCurrent.map((g) => g.name))

  const clonedGroups: RolloverResult['groups'] = []
  let skippedCount = 0

  for (const group of previousYearGroups) {
    try {
      if (existingNames.has(group.name)) {
        skippedCount++
        continue
      }

      const newGroup = await prisma.group.create({
        data: {
          name: group.name,
          description: group.description,
          year: currentYear,
          leaderId: group.leaderId,
          archived: false,
        },
      })

      clonedGroups.push({ id: newGroup.id, name: newGroup.name, year: newGroup.year })

      await logAuditEvent({
        userId: actingUserId,
        action: 'CLONE_GROUP',
        entityType: 'group',
        entityId: newGroup.id,
        newValues: {
          sourceYear: previousYear,
          targetYear: currentYear,
          groupName: group.name,
          leaderId: group.leaderId,
        },
      })
    } catch (error) {
      logger.error(`Error cloning group ${group.name}:`, error)
      // Continue with next group instead of failing entirely
    }
  }

  logger.info(
    `Year rollover ${previousYear}→${currentYear}: cloned ${clonedGroups.length}, skipped ${skippedCount}`
  )

  return { clonedCount: clonedGroups.length, skippedCount, groups: clonedGroups }
}
