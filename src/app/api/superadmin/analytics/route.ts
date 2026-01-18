import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };
    if (decoded.role !== 'superadmin') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get total active milestones count
    const totalActiveMilestones = await prisma.milestone.count({
      where: { isActive: true }
    });

    // Execute all queries in parallel
    const [
      usersByRole,
      groups,
      groupLeadersCount,
      totalConverts,
      convertsThisMonth,
      convertsWithProgress,
      topSeekers
    ] = await Promise.all([
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      }),
      prisma.group.findMany({
        include: {
          _count: { select: { newConverts: true } }
        }
      }),
      prisma.user.count({
        where: {
          groupId: { not: null },
          role: { in: ['leader', 'admin', 'leadpastor'] }
        }
      }),
      prisma.newConvert.count(),
      prisma.newConvert.count({
        where: { createdAt: { gt: thirtyDaysAgo } }
      }),
      prisma.newConvert.findMany({
        include: {
          progressRecords: {
            where: { isCompleted: true },
            select: { id: true }
          },
          group: { select: { name: true, year: true } }
        }
      }),
      prisma.user.findMany({
        where: { role: { in: ['leader', 'admin', 'leadpastor'] } },
        include: {
          _count: { select: { registeredConverts: true } }
        },
        orderBy: { registeredConverts: { _count: 'desc' } },
        take: 5
      })
    ]);

    // Calculate user stats
    const roleMap = usersByRole.reduce((acc, r) => {
      if (r.role) {
        acc[r.role] = r._count.role;
      }
      return acc;
    }, {} as Record<string, number>);

    const userStats = {
      total: Object.values(roleMap).reduce((a, b) => a + b, 0),
      superAdmins: roleMap['superadmin'] || 0,
      leaders: roleMap['leader'] || 0,
      admins: roleMap['admin'] || 0,
      leadPastors: roleMap['leadpastor'] || 0,
      growthRate: 0,
    };

    // Calculate group stats
    const totalGroups = groups.length;
    const avgMembersPerGroup = totalGroups > 0
      ? groups.reduce((sum, g) => sum + g._count.newConverts, 0) / totalGroups
      : 0;

    const groupStats = {
      total: totalGroups,
      withLeaders: groupLeadersCount,
      avgMembersPerGroup,
    };

    // Calculate convert stats with average completion
    const completionRates = convertsWithProgress.map(c => {
      if (totalActiveMilestones === 0) return 0;
      return (c.progressRecords.length / totalActiveMilestones) * 100;
    });
    const avgProgressCompletion = completionRates.length > 0
      ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
      : 0;

    const convertStats = {
      total: totalConverts,
      thisMonth: convertsThisMonth,
      avgProgressCompletion,
    };

    // Calculate top groups
    const groupProgress = new Map<string, { name: string; year: number | null; members: number; totalProgress: number }>();
    for (const c of convertsWithProgress) {
      if (!c.groupId) continue;
      const groupKey = c.groupId;
      const existing = groupProgress.get(groupKey) || {
        name: c.group?.name || '',
        year: c.group?.year || null,
        members: 0,
        totalProgress: 0
      };
      existing.members++;
      if (totalActiveMilestones > 0) {
        existing.totalProgress += (c.progressRecords.length / totalActiveMilestones) * 100;
      }
      groupProgress.set(groupKey, existing);
    }

    const topGroups = Array.from(groupProgress.values())
      .filter(g => g.members > 0)
      .map(g => ({
        name: g.name,
        year: g.year,
        members: g.members,
        avgProgress: g.members > 0 ? g.totalProgress / g.members : 0,
      }))
      .sort((a, b) => b.members - a.members || b.avgProgress - a.avgProgress)
      .slice(0, 5);

    // Format top seekers
    const formattedTopSeekers = topSeekers
      .filter(s => s._count.registeredConverts > 0)
      .map(s => ({
        name: (s.firstName && s.lastName) 
          ? `${s.firstName} ${s.lastName}`.trim()
          : s.username,
        converts: s._count.registeredConverts,
      }));

    return NextResponse.json(
      {
        userStats,
        groupStats,
        convertStats,
        topGroups,
        topSeekers: formattedTopSeekers,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
