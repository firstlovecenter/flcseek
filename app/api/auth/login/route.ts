import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    console.log(`[LOGIN] Attempt for user: ${username}`);

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const result = await query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      console.log(`[LOGIN] User not found: ${username}`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log(`[LOGIN] User found: ${user.username} (${user.role})`);

    const isValidPassword = verifyPassword(password, user.password);

    if (!isValidPassword) {
      console.log(`[LOGIN] Invalid password for: ${username}`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log(`[LOGIN] Password verified for: ${username}`);

    // Get user's group information
    let groupName = null;
    let groupYear = null;
    let groupId = user.group_id || null;

    // For admins and leaders who are assigned to a monthly group
    if ((user.role === 'admin' || user.role === 'leader') && !groupId) {
      const groupResult = await query(
        'SELECT id, name FROM groups WHERE sheep_seeker_id = $1',
        [user.id]
      );
      if (groupResult.rows.length > 0) {
        groupId = groupResult.rows[0].id;
        groupName = groupResult.rows[0].name;
        groupYear = 2025; // Default year
      }
    }

    // Get group name and year if we have group_id
    if (groupId && !groupName) {
      const groupResult = await query(
        'SELECT name FROM groups WHERE id = $1',
        [groupId]
      );
      if (groupResult.rows.length > 0) {
        groupName = groupResult.rows[0].name;
        groupYear = 2025; // Default year
      }
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email || undefined,
      role: user.role,
      group_name: groupName || undefined,
      group_year: groupYear || undefined,
      group_id: groupId || undefined,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        group_name: groupName,
        group_year: groupYear,
        group_id: groupId,
        phone_number: user.phone_number,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
