import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

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
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValidPassword = verifyPassword(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Get user's group information
    let groupName = null;
    let groupYear = null;
    let groupId = user.group_id || null;

    // For admins and leaders who are assigned to a monthly group
    if ((user.role === 'admin' || user.role === 'leader') && !groupId) {
      const groupResult = await query(
        'SELECT id, name, year FROM groups WHERE sheep_seeker_id = $1',
        [user.id]
      );
      if (groupResult.rows.length > 0) {
        groupId = groupResult.rows[0].id;
        groupName = groupResult.rows[0].name;
        groupYear = groupResult.rows[0].year;
      }
    }

    // Get group name and year if we have group_id
    if (groupId && !groupName) {
      const groupResult = await query(
        'SELECT name, year FROM groups WHERE id = $1',
        [groupId]
      );
      if (groupResult.rows.length > 0) {
        groupName = groupResult.rows[0].name;
        groupYear = groupResult.rows[0].year;
      }
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email || undefined,
      role: user.role,
      group_name: groupName,
      group_year: groupYear,
      group_id: groupId,
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
