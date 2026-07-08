import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const decoded = verifySuperAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Execute all queries in parallel
    const [
      totalUsers,
      activeUsers,
      totalGroups,
      activeGroupLeaders,
      totalConverts,
      convertsThisMonth,
      recentUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gt: thirtyDaysAgo } }
      }),
      prisma.group.count(),
      prisma.user.count({
        where: { role: { in: ['leader', 'admin', 'leadpastor'] } }
      }),
      prisma.newConvert.count({ where: { deletedAt: null } }),
      prisma.newConvert.count({
        where: { deletedAt: null, createdAt: { gt: thirtyDaysAgo } }
      }),
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        }
      })
    ]);

    const stats = {
      totalUsers,
      activeUsers,
      totalGroups,
      activeGroupLeaders,
      totalConverts,
      convertsThisMonth,
    };

    const recentActivity = recentUsers.map((u) => {
      const displayName = (u.firstName && u.lastName)
        ? `${u.firstName} ${u.lastName}`
        : (u.firstName || u.username);
      return {
        type: 'USER',
        description: `New user registered: ${displayName}`,
        user: displayName,
        timestamp: u.createdAt,
        id: u.id,
      };
    });

    return NextResponse.json(
      {
        stats,
        recentActivity,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
