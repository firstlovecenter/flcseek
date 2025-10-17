import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hashPassword, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Only Super Admin can create users.' },
        { status: 403 }
      );
    }

    const { username, password, role, department_name, phone_number } =
      await request.json();

    if (!username || !password || !role || !phone_number) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (role === 'sheep_seeker' && !department_name) {
      return NextResponse.json(
        { error: 'Department name is required for Sheep Seekers' },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password);

    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password: hashedPassword,
        role,
        department_name,
        phone_number,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: data.id,
        username: data.username,
        role: data.role,
        department_name: data.department_name,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
