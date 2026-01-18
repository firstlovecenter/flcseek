import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { role?: string; username?: string };
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
    // Build where clause based on user permissions
    let whereClause: Prisma.UserWhereInput = {};
    
    if (user.username === 'skaduteye') {
      // skaduteye sees everyone
      whereClause = {};
    } else if (user.username === 'sysadmin') {
      // sysadmin sees everyone except skaduteye
      whereClause = { username: { not: 'skaduteye' } };
    } else {
      // regular superadmins don't see skaduteye or sysadmin
      whereClause = { username: { notIn: ['skaduteye', 'sysadmin'] } };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        role: true,
        groupName: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ]
    });

    // Transform to snake_case for API compatibility
    const formattedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      phone_number: null,
      group_name: u.groupName,
      first_name: u.firstName,
      last_name: u.lastName,
      email: u.email,
      created_at: u.createdAt,
      updated_at: u.updatedAt,
    }));

    return NextResponse.json({ users: formattedUsers });
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

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role,
        groupName: group_name || null,
        firstName: first_name || null,
        lastName: last_name || null,
        email: email || null,
      },
      select: {
        id: true,
        username: true,
        role: true,
        groupName: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      }
    });

    return NextResponse.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        phone_number: phone_number,
        group_name: newUser.groupName,
        first_name: newUser.firstName,
        last_name: newUser.lastName,
        email: newUser.email,
        created_at: newUser.createdAt,
      }
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating user:', error);
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
