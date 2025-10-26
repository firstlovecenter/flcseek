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

// GET - List all converts (new_converts)
export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT 
        rp.id,
        CONCAT(rp.first_name, ' ', rp.last_name) as full_name,
        rp.phone_number,
        rp.gender,
        rp.group_name,
        rp.created_at,
        u.username as registered_by_name,
        (SELECT COUNT(*) FROM progress_records pr WHERE pr.person_id = rp.id AND pr.is_completed = true) as completed_stages,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.person_id = rp.id) as total_attendance
       FROM new_converts rp
       LEFT JOIN users u ON rp.registered_by = u.id
       ORDER BY rp.first_name ASC, rp.last_name ASC`
    );

    return NextResponse.json({ converts: result.rows });
  } catch (error) {
    console.error('Error fetching converts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
