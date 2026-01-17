import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'superadmin') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// GET - Get converts stats
export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');

    let whereClause = '';
    let queryParams: any[] = [];

    if (yearParam) {
      whereClause = `WHERE g.year = $1`;
      queryParams = [parseInt(yearParam)];
    }

    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_converts,
        COUNT(CASE WHEN nc.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as this_month,
        COUNT(CASE WHEN nc.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as this_week,
        COUNT(DISTINCT nc.group_name) as active_groups
       FROM new_converts nc
       LEFT JOIN groups g ON nc.group_id = g.id
       ${whereClause}`,
      queryParams
    );

    const stats = {
      totalConverts: parseInt(statsResult.rows[0]?.total_converts || '0'),
      thisMonth: parseInt(statsResult.rows[0]?.this_month || '0'),
      thisWeek: parseInt(statsResult.rows[0]?.this_week || '0'),
      activeGroups: parseInt(statsResult.rows[0]?.active_groups || '0'),
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching convert stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
