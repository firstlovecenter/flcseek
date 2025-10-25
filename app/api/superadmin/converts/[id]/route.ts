import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'superadmin') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// GET - Get single convert by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT 
        id,
        first_name,
        last_name,
        full_name,
        phone_number,
        date_of_birth,
        gender,
        residential_location,
        school_residential_location,
        occupation_type,
        group_id,
        group_name,
        registered_by,
        created_at,
        updated_at
       FROM new_converts WHERE id = $1`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Convert not found' }, { status: 404 });
    }

    return NextResponse.json({ convert: result.rows[0] });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      console.error('Error fetching convert:', (error as any).message);
      return NextResponse.json({ error: (error as any).message }, { status: 500 });
    }
    console.error('Error fetching convert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update convert details
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      first_name,
      last_name,
      phone_number,
      date_of_birth,
      gender,
      residential_location,
      school_residential_location,
      occupation_type,
      group_name,
    } = body;

    const fullName = `${first_name} ${last_name}`.trim();

    const result = await query(
      `UPDATE new_converts 
       SET 
        first_name = $1,
        last_name = $2,
        full_name = $3,
        phone_number = $4,
        date_of_birth = $5,
        gender = $6,
        residential_location = $7,
        school_residential_location = $8,
        occupation_type = $9,
        group_name = $10,
        updated_at = NOW()
       WHERE id = $11
       RETURNING id, first_name, last_name, full_name, phone_number, date_of_birth, gender, 
                 residential_location, school_residential_location, occupation_type, group_name, updated_at`,
      [
        first_name,
        last_name,
        fullName,
        phone_number,
        date_of_birth || null,
        gender || null,
        residential_location || null,
        school_residential_location || null,
        occupation_type || null,
        group_name,
        params.id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Convert not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      convert: result.rows[0],
      message: 'Convert updated successfully',
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      console.error('Error updating convert:', (error as any).message);
      return NextResponse.json({ error: (error as any).message }, { status: 500 });
    }
    console.error('Error updating convert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
