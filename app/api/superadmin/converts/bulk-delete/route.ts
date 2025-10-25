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
    // Only allow skaduteye superadmin
    if (decoded.role !== 'superadmin' || decoded.username !== 'skaduteye') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// DELETE - Bulk delete new converts and all related data
export async function DELETE(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized - Only skaduteye can perform bulk delete' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { person_ids } = body as { person_ids: string[] };

    if (!person_ids || !Array.isArray(person_ids) || person_ids.length === 0) {
      return NextResponse.json(
        { error: 'No person IDs provided' },
        { status: 400 }
      );
    }

    // Delete in correct order to respect foreign keys
    // 1. Delete attendance records
    await query(
      `DELETE FROM attendance_records WHERE person_id = ANY($1)`,
      [person_ids]
    );

    // 2. Delete progress records
    await query(
      `DELETE FROM progress_records WHERE person_id = ANY($1)`,
      [person_ids]
    );

    // 3. Delete the converts themselves
    const deleteResult = await query(
      `DELETE FROM new_converts WHERE id = ANY($1) RETURNING id, full_name`,
      [person_ids]
    );

    return NextResponse.json({
      success: true,
      deleted_count: deleteResult.rows.length,
      deleted_records: deleteResult.rows,
      message: `Successfully deleted ${deleteResult.rows.length} convert(s) and all related data`
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      console.error('Error deleting converts:', (error as any).message);
      return NextResponse.json({ error: (error as any).message }, { status: 500 });
    } else {
      console.error('Error deleting converts:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
}
