import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAuditEvent, extractRequestInfo } from '@/lib/audit-log';

export async function POST(request: NextRequest) {
  try {
    // Check rate limit first
    const rateLimitResponse = await checkRateLimit(request, '/api/auth/login');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const identifier =
      typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const { ipAddress, userAgent } = extractRequestInfo(request.headers);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[LOGIN] Attempt for user: ${identifier}`);
    }

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Match by username or email (form allows either); ignore soft-deleted users
    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { username: { equals: identifier, mode: 'insensitive' } },
          { email: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            year: true,
          }
        }
      }
    });

    if (!user) {
      await logAuditEvent({
        action: 'LOGIN_FAILED',
        newValues: { username: identifier, reason: 'user_not_found' },
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
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

    // Get group information
    const groupName = user.group?.name || user.groupName || null;
    const groupYear = user.group?.year || null;
    const groupId = user.groupId || null;

    // Ensure role is valid
    const validRoles = ['superadmin', 'leadpastor', 'overseer', 'admin', 'leader'] as const;
    const role = validRoles.includes(user.role as typeof validRoles[number])
      ? (user.role as typeof validRoles[number])
      : 'leader'; // Default to 'leader' if role is missing or invalid

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email || undefined,
      role,
      group_name: groupName || undefined,
      group_year: groupYear || undefined,
      group_id: groupId || undefined,
      tv: user.tokenVersion,
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

    const response = NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        group_name: groupName,
        group_year: groupYear,
        group_id: groupId,
        phone_number: user.phoneNumber,
      },
    });

    // Set httpOnly cookie — not accessible to JS (guards against XSS token theft)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Login error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
