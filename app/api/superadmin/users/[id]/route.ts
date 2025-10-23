import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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

// PUT - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { username, role, phone_number, group_name, first_name, last_name, email, password } = body;
    const { id } = params;

    let updateQuery: string;
    let updateParams: any[];

    if (password) {
      // If password is being updated
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery = `
        UPDATE users 
        SET username = $1, role = $2, phone_number = $3, group_name = $4, first_name = $5, last_name = $6, email = $7, password = $8, updated_at = NOW()
        WHERE id = $9
        RETURNING id, username, role, phone_number, group_name, first_name, last_name, email, updated_at
      `;
      updateParams = [username, role, phone_number, group_name || null, first_name || null, last_name || null, email || null, hashedPassword, id];
    } else {
      // Update without password
      updateQuery = `
        UPDATE users 
        SET username = $1, role = $2, phone_number = $3, group_name = $4, first_name = $5, last_name = $6, email = $7, updated_at = NOW()
        WHERE id = $8
        RETURNING id, username, role, phone_number, group_name, first_name, last_name, email, updated_at
      `;
      updateParams = [username, role, phone_number, group_name || null, first_name || null, last_name || null, email || null, id];
    }

    const result = await query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating user:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;
    const result = await query(`DELETE FROM users WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
