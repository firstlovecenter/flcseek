import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// GET /api/groups - List all groups with optional year and archived filtering
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPayload = verifyToken(token);
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year'); // 'all' or specific year
    const filter = searchParams.get('filter') || 'active'; // 'all', 'active', 'archived'

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Year filtering
    if (year && year !== 'all') {
      conditions.push(`g.year = $${paramIndex}`);
      params.push(parseInt(year));
      paramIndex++;
    }

    // Archive status filtering
    if (filter === 'active') {
      conditions.push(`g.archived = false`);
    } else if (filter === 'archived') {
      conditions.push(`g.archived = true`);
    }
    // If filter === 'all', don't add archived condition

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        g.id,
        g.name,
        g.description,
        g.year,
        g.archived,
        g.created_at,
        g.updated_at,
        CASE 
          WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL THEN CONCAT(u.first_name, ' ', u.last_name)
          WHEN u.first_name IS NOT NULL THEN u.first_name
          ELSE COALESCE(u.username, u.email)
        END as leader_name,
        u.id as leader_id,
        (SELECT COUNT(*) FROM new_converts WHERE group_id = g.id) as member_count,
        CASE LOWER(g.name)
          WHEN 'january' THEN 1
          WHEN 'february' THEN 2
          WHEN 'march' THEN 3
          WHEN 'april' THEN 4
          WHEN 'may' THEN 5
          WHEN 'june' THEN 6
          WHEN 'july' THEN 7
          WHEN 'august' THEN 8
          WHEN 'september' THEN 9
          WHEN 'october' THEN 10
          WHEN 'november' THEN 11
          WHEN 'december' THEN 12
          ELSE 999
        END as month_order
      FROM groups g
      LEFT JOIN users u ON g.leader_id = u.id
      ${whereClause}
      ORDER BY g.year DESC, month_order ASC, g.name ASC
    `;

    const result = await query(sql, params);

    return NextResponse.json({ groups: result.rows });
  } catch (error: any) {
    console.error('Error fetching groups:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/groups - Create a new group
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPayload = verifyToken(token);
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only superadmin can create groups
    if (userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, year } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    const groupYear = year || new Date().getFullYear();

    // Check if group name + year combination already exists
    const existing = await query(
      'SELECT id FROM groups WHERE name = $1 AND year = $2',
      [name.trim(), groupYear]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: `Group ${name} already exists for year ${groupYear}` },
        { status: 409 }
      );
    }

    const result = await query(
      `INSERT INTO groups (name, description, year, archived)
       VALUES ($1, $2, $3, false)
       RETURNING *`,
      [name.trim(), description || null, groupYear]
    );

    return NextResponse.json({
      message: 'Group created successfully',
      group: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error creating group:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Group name and year combination already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
