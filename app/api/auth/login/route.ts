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

    // Get user's group if they're a group leader
    let groupName = null;
    if (user.role === 'sheep_seeker') {
      const groupResult = await query(
        'SELECT name FROM groups WHERE leader_id = $1',
        [user.id]
      );
      if (groupResult.rows.length > 0) {
        groupName = groupResult.rows[0].name;
      }
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      group_name: groupName,
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
