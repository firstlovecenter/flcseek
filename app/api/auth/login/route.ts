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

    // Database authentication
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
    let groupName = user.group_name || null;
    let groupYear = null;
    let groupId = user.group_id || null;

    // Get group name and year if we have group_id
    if (groupId) {
      try {
        const groupResult = await query(
          'SELECT name, year FROM groups WHERE id = $1',
          [groupId]
        );
        if (groupResult.rows.length > 0) {
          groupName = groupResult.rows[0].name;
          groupYear = groupResult.rows[0].year || 2025;
        }
      } catch (error) {
        console.error('[LOGIN] Error fetching group details:', error);
        // Continue login even if group fetch fails
      }
    } else if (groupName && !groupId) {
      // Fallback: if we have group_name but no group_id, try to get year from group_name
      try {
        const groupResult = await query(
          'SELECT id, year FROM groups WHERE name = $1',
          [groupName]
        );
        if (groupResult.rows.length > 0) {
          groupId = groupResult.rows[0].id;
          groupYear = groupResult.rows[0].year || 2025;
        }
      } catch (error) {
        console.error('[LOGIN] Error fetching group by name:', error);
        // Continue login even if group fetch fails
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
