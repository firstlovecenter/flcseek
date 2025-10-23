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

// GET - List all groups
export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT 
        g.id,
        g.name,
        g.description,
        g.leader_id,
        u.username as leader_name,
        g.created_at,
        g.updated_at,
        COUNT(rp.id) as member_count
       FROM groups g
       LEFT JOIN users u ON g.leader_id = u.id
       LEFT JOIN registered_people rp ON rp.group_name = g.name
       GROUP BY g.id, g.name, g.description, g.leader_id, u.username, g.created_at, g.updated_at
       ORDER BY g.created_at DESC`
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
    const { name, description, leader_id } = body;

    const result = await query(
      `INSERT INTO groups (name, description, leader_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, leader_id, created_at`,
      [name, description || null, leader_id || null]
    );

    return NextResponse.json({ group: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating group:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Group name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
