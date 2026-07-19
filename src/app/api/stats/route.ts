import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  success,
  errors,
  requireAuth,
  getQueryParams,
  resolveGroupScope,
} from '@/lib/api';
import { prisma } from '@/lib/db';
import { ROLES } from '@/lib/constants';

// Disable caching
export const dynamic = 'force-dynamic';

/**
 * GET /api/stats
 * Dashboard statistics, scoped to the requesting user's role.
 *
 * Query params:
 * - group_id: Filter by a specific group (superadmin / leadpastor only)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const params = getQueryParams(request);
    const scope = resolveGroupScope(user!, params);

    // Build a NewConvert filter from the resolved scope. This is reused for
    // people / progress / attendance counts so every metric is scoped identically.
    const convertWhere: Prisma.NewConvertWhereInput = { deletedAt: null };
    if (scope.groupId) convertWhere.groupId = scope.groupId;
    if (scope.groupName) convertWhere.group = { name: scope.groupName };

    const activeGroupWhere: Prisma.GroupWhereInput = {
      deletedAt: null,
      NOT: { archived: true },
    };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalPeople,
      totalGroups,
      totalMilestones,
      totalCompleted,
      recentAttendance,
      convertsThisMonth,
      convertsThisWeek,
      distinctGroupIds,
    ] = await Promise.all([
      prisma.newConvert.count({ where: convertWhere }),
      prisma.group.count({ where: activeGroupWhere }),
      prisma.milestone.count({ where: { isActive: true } }),
      prisma.progressRecord.count({
        where: { isCompleted: true, person: convertWhere },
      }),
      prisma.attendanceRecord.count({
        where: {
          attendanceDate: { gte: thirtyDaysAgo },
          person: convertWhere,
        },
      }),
      prisma.newConvert.count({
        where: { ...convertWhere, createdAt: { gt: thirtyDaysAgo } },
      }),
      prisma.newConvert.count({
        where: { ...convertWhere, createdAt: { gt: sevenDaysAgo } },
      }),
      prisma.newConvert.findMany({
        where: { ...convertWhere, groupId: { not: null } },
        select: { groupId: true },
        distinct: ['groupId'],
      }),
    ]);

    const totalPossibleCompletions = totalPeople * (totalMilestones || 1);
    const completionRate =
      totalPossibleCompletions > 0
        ? Math.round((totalCompleted / totalPossibleCompletions) * 100)
        : 0;

    // Per-group breakdown for global admins. Computed from a single query and
    // aggregated in memory to avoid an N+1 over groups.
    let groupStats: Array<{
      group_id: string;
      group_name: string;
      member_count: number;
      completion_percentage: number;
    }> | null = null;

    if (user!.role === ROLES.SUPERADMIN || user!.role === ROLES.LEADPASTOR) {
      const converts = await prisma.newConvert.findMany({
        where: { deletedAt: null, groupId: { not: null } },
        select: {
          groupId: true,
          group: { select: { name: true, archived: true, deletedAt: true } },
          progressRecords: {
            where: { isCompleted: true },
            select: { id: true },
          },
        },
      });

      const perGroup = new Map<
        string,
        { name: string; members: number; completed: number }
      >();

      for (const c of converts) {
        if (!c.groupId || !c.group) continue;
        if (c.group.archived || c.group.deletedAt) continue;
        const entry = perGroup.get(c.groupId) || {
          name: c.group.name,
          members: 0,
          completed: 0,
        };
        entry.members += 1;
        entry.completed += c.progressRecords.length;
        perGroup.set(c.groupId, entry);
      }

      const milestonesPerMember = totalMilestones || 1;
      groupStats = Array.from(perGroup.entries())
        .map(([groupId, g]) => ({
          group_id: groupId,
          group_name: g.name,
          member_count: g.members,
          completion_percentage:
            g.members > 0
              ? Math.round((g.completed / (g.members * milestonesPerMember)) * 100)
              : 0,
        }))
        .sort((a, b) => a.group_name.localeCompare(b.group_name));
    }

    return success({
      summary: {
        totalPeople,
        totalGroups,
        totalMilestones,
        recentAttendance,
        completionRate,
      },
      // Convert-directory cards (replaces /api/superadmin/converts/stats)
      converts: {
        totalConverts: totalPeople,
        thisMonth: convertsThisMonth,
        thisWeek: convertsThisWeek,
        activeGroups: distinctGroupIds.length,
      },
      groupStats,
    });
  } catch (err) {
    console.error('[GET /api/stats]', err);
    return errors.internal();
  }
}
