import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyPassword, generateToken } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { logAuditEvent, extractRequestInfo } from '@/lib/audit-log';

export async function POST(request: NextRequest) {
  try {
    // Check rate limit first
    const rateLimitResponse = await checkRateLimit(request, '/api/auth/login');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { username, password } = body;
    const { ipAddress, userAgent } = extractRequestInfo(request.headers);

    // Remove sensitive console.log in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`[LOGIN] Attempt for user: ${username}`);
    }

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
      // Log failed login attempt
      await logAuditEvent({
        action: 'LOGIN_FAILED',
        newValues: { username, reason: 'user_not_found' },
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValidPassword = verifyPassword(password, user.password);

    if (!isValidPassword) {
      // Log failed login attempt
      await logAuditEvent({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        newValues: { reason: 'invalid_password' },
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

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
          groupYear = groupResult.rows[0].year; // Use actual year from database
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
          groupYear = groupResult.rows[0].year; // Use actual year from database
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

    // Log successful login
    await logAuditEvent({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      newValues: { role: user.role, group_name: groupName },
      ipAddress,
      userAgent,
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
    if (process.env.NODE_ENV === 'development') {
      console.error('Login error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
