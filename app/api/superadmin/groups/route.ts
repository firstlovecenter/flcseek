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

// GET - List all groups with optional year and archived filtering
export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    const result = await query(
      `SELECT 
        g.id,
        g.name,
        g.description,
        g.year,
        g.archived,
        g.leader_id,
        CASE 
          WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL THEN CONCAT(u.first_name, ' ', u.last_name)
          WHEN u.first_name IS NOT NULL THEN u.first_name
          ELSE COALESCE(u.username, u.email, 'No Leader')
        END as leader_name,
        g.created_at,
        g.updated_at,
        COUNT(rp.id) as member_count,
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
       LEFT JOIN new_converts rp ON rp.group_id = g.id
       ${whereClause}
       GROUP BY g.id, g.name, g.description, g.year, g.archived, g.leader_id, u.username, u.email, u.first_name, u.last_name, g.created_at, g.updated_at
       ORDER BY g.year DESC, month_order ASC, g.name ASC`,
      params
    );

    return NextResponse.json({ groups: result.rows });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new group
export async function POST(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, year, leader_id } = body;

    const groupYear = year || new Date().getFullYear();

    const result = await query(
      `INSERT INTO groups (name, description, year, archived, leader_id)
       VALUES ($1, $2, $3, false, $4)
       RETURNING id, name, description, year, archived, leader_id, created_at`,
      [name, description || null, groupYear, leader_id || null]
    );

    return NextResponse.json({ group: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating group:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Group name and year combination already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
