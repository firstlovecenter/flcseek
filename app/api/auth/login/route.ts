import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
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

    // Get user's group and stream information
    let groupName = null;
    let groupId = user.group_id || null;
    let streamId = user.stream_id || null;

    // For sheep_seekers who are group leaders, get their group info
    if (user.role === 'sheep_seeker' && !groupId) {
      const groupResult = await query(
        'SELECT id, name FROM groups WHERE sheep_seeker_id = $1',
        [user.id]
      );
      if (groupResult.rows.length > 0) {
        groupId = groupResult.rows[0].id;
        groupName = groupResult.rows[0].name;
      }
    }

    // Get group name if we have group_id
    if (groupId && !groupName) {
      const groupResult = await query(
        'SELECT name, stream_id FROM groups WHERE id = $1',
        [groupId]
      );
      if (groupResult.rows.length > 0) {
        groupName = groupResult.rows[0].name;
        streamId = streamId || groupResult.rows[0].stream_id;
      }
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      group_name: groupName,
      group_id: groupId,
      stream_id: streamId,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        group_name: groupName,
        group_id: groupId,
        stream_id: streamId,
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
