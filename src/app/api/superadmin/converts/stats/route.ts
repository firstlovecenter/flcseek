import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/auth';

// GET - Get converts stats
export async function GET(request: NextRequest) {
  const user = verifySuperAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const whereClause = groupId ? { groupId } : {};

    const [totalConverts, thisMonth, thisWeek, allConverts] = await Promise.all([
      prisma.newConvert.count({ where: whereClause }),
      prisma.newConvert.count({
        where: { ...whereClause, createdAt: { gt: thirtyDaysAgo } },
      }),
      prisma.newConvert.count({
        where: { ...whereClause, createdAt: { gt: sevenDaysAgo } },
      }),
      prisma.newConvert.findMany({
        where: whereClause,
        select: { groupId: true },
        distinct: ['groupId'],
      }),
    ]);

    const stats = {
      totalConverts,
      thisMonth,
      thisWeek,
      activeGroups: allConverts.filter((c) => c.groupId).length,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching convert stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
