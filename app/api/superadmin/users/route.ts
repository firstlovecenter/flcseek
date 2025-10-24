import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ROOT_USER } from '@/lib/constants';

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

// GET - List all users
export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT 
         id, 
         username, 
         role, 
         phone_number, 
         group_name,
         first_name, 
         last_name, 
         email,
         created_at, 
         updated_at
       FROM users
       ORDER BY 
         COALESCE(NULLIF(first_name, ''), username) ASC,
         COALESCE(NULLIF(last_name, ''), '') ASC`
    );

    // Filter out root user from results
    const filteredUsers = result.rows.filter(user => user.id !== ROOT_USER.ID);

    return NextResponse.json({ users: filteredUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { username, password, role, phone_number, group_name, first_name, last_name, email } = body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (username, password, role, phone_number, group_name, first_name, last_name, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, role, phone_number, group_name, first_name, last_name, email, created_at`,
      [username, hashedPassword, role, phone_number, group_name || null, first_name || null, last_name || null, email || null]
    );

    return NextResponse.json({ user: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.code === '23505') {
      // Unique violation
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
