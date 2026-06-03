import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/api/middleware';
import * as Users from '@/lib/db/queries/users';
import type { UserRole } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const userPayload = getAuthUser(request);

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized. Only Super Admin can create users.' },
        { status: 403 }
      );
    }

    const { password, first_name, last_name, email, phone_number, role, group_name } =
      await request.json();

    // Required fields
    if (!password || !first_name || !last_name || !phone_number || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: password, first_name, last_name, email, phone_number' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate role if provided
    const userRole = role || null;
    if (userRole && !['superadmin', 'leader'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be superadmin or leader' },
        { status: 400 }
      );
    }

    // If role is leader, group_name is required
    if (userRole === 'leader' && !group_name) {
      return NextResponse.json(
        { error: 'Group assignment required for leader role' },
        { status: 400 }
      );
    }

    // Check if email already exists (email is used as username)
    const existingUser = await prisma.user.findUnique({
      where: { username: email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Centralized creation (hashes password + maps fields) via the query module
    const newUser = await Users.create({
      username: email, // Use email as username
      password,
      email,
      role: (userRole || 'leader') as UserRole,
      first_name,
      last_name,
      group_name: group_name || undefined,
    });

    // If user is a leader with group assignment, update the group's leader_id
    if (userRole === 'leader' && group_name) {
      try {
        await prisma.group.updateMany({
          where: { name: group_name },
          data: { leaderId: newUser.id }
        });
      } catch (error) {
        console.error('Failed to update group leader:', error);
        // Don't fail the registration if this fails
      }
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        role: newUser.role,
        group_name: newUser.group_name,
      },
    });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    
    const err = error as { code?: string; message?: string };
    
    if (err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: `Internal server error: ${err.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
