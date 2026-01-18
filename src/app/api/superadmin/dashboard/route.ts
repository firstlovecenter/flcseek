import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };

    if (decoded.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      prisma.newConvert.count(),
      prisma.newConvert.count({
        where: { createdAt: { gt: thirtyDaysAgo } }
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

    const recentActivity = recentUsers.map(u => {
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
