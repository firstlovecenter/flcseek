import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { hashPassword, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

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

    const hashedPassword = hashPassword(password);

    // Check if email already exists
    const emailCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Use email as username for backward compatibility
    const result = await query(
      `INSERT INTO users (username, password, first_name, last_name, email, phone_number, role, group_name) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, email, first_name, last_name, phone_number, role, group_name, created_at`,
      [email, hashedPassword, first_name, last_name, email, phone_number, userRole, group_name || null]
    );

    const data = result.rows[0];

    // If user is a leader with group assignment, update the group's leader_id
    if (userRole === 'leader' && group_name) {
      try {
        await query(
          `UPDATE groups SET leader_id = $1, updated_at = NOW() WHERE name = $2`,
          [data.id, group_name]
        );
      } catch (error) {
        console.error('Failed to update group leader:', error);
        // Don't fail the registration if this fails
      }
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: data.id,
        username: data.username,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        role: data.role,
        group_name: data.group_name,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }
    
    // Column doesn't exist error
    if (error.code === '42703') {
      return NextResponse.json(
        { error: 'Database migration required. Please run migrations first at /run-migrations.html' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
