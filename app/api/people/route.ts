import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';
import { PROGRESS_STAGES } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { full_name, phone_number, gender, home_location, work_location, group_id, group_name } =
      await request.json();

    if (!full_name || !phone_number) {
      return NextResponse.json(
        { error: 'Missing required fields (full_name, phone_number)' },
        { status: 400 }
      );
    }

    // group_id is preferred, but fallback to group_name for backwards compatibility
    let finalGroupId = group_id;
    
    if (!finalGroupId && group_name) {
      // Look up group_id from group_name
      const groupResult = await query(
        'SELECT id FROM groups WHERE name = $1',
        [group_name]
      );
      
      if (groupResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invalid group specified' },
          { status: 400 }
        );
      }
      
      finalGroupId = groupResult.rows[0].id;
    }

    if (!finalGroupId) {
      return NextResponse.json(
        { error: 'Either group_id or group_name must be provided' },
        { status: 400 }
      );
    }

    // Verify leader can only register in their assigned group
    if (userPayload.role === 'leader') {
      if (userPayload.group_id && userPayload.group_id !== finalGroupId) {
        return NextResponse.json(
          { error: 'You can only register people in your assigned group' },
          { status: 403 }
        );
      }
    }

    const result = await query(
      `INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, group_id, group_name, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT name FROM groups WHERE id = $6), $7)
       RETURNING *`,
      [full_name, phone_number, gender, home_location, work_location, finalGroupId, userPayload.id]
    );

    const person = result.rows[0];

    const progressRecords = PROGRESS_STAGES.map((stage) => ({
      person_id: person.id,
      stage_number: stage.number,
      stage_name: stage.name,
      is_completed: false,
      updated_by: userPayload.id,
    }));

    // Insert progress records
    for (const record of progressRecords) {
      await query(
        `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, updated_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [record.person_id, record.stage_number, record.stage_name, record.is_completed, record.updated_by]
      );
    }

    return NextResponse.json({
      message: 'Person registered successfully',
      person,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupIdParam = searchParams.get('group_id');
    const groupNameParam = searchParams.get('group'); // legacy parameter
    const monthParam = searchParams.get('month'); // month name parameter

    let sqlQuery = `
      SELECT 
        rp.*,
        g.name as group_name_ref
      FROM registered_people rp
      LEFT JOIN groups g ON rp.group_id = g.id
    `;
    let params: any[] = [];

    if (userPayload.role === 'leader') {
      // Leaders can only see people in their assigned group
      if (userPayload.group_id) {
        sqlQuery += ' WHERE rp.group_id = $1';
        params.push(userPayload.group_id);
      } else if (userPayload.group_name) {
        // Fallback for legacy users without group_id
        sqlQuery += ' WHERE rp.group_name = $1';
        params.push(userPayload.group_name);
      } else {
        // No group assigned, return empty
        return NextResponse.json({ people: [] });
      }
    } else if (userPayload.role === 'admin') {
      // Admins can see all people in their month's group
      if (userPayload.group_id) {
        sqlQuery += ' WHERE rp.group_id = $1';
        params.push(userPayload.group_id);
      } else {
        return NextResponse.json({ people: [] });
      }
    } else {
      // Super admin and lead pastor can filter by group
      if (groupIdParam) {
        sqlQuery += ' WHERE rp.group_id = $1';
        params.push(groupIdParam);
      } else if (groupNameParam) {
        // Legacy support for group name filtering
        sqlQuery += ' WHERE rp.group_name = $1';
        params.push(groupNameParam);
      } else if (monthParam) {
        // Filter by month name
        sqlQuery += ' WHERE rp.group_name = $1';
        params.push(monthParam);
      }
    }

    sqlQuery += ' ORDER BY rp.created_at DESC';

    const result = await query(sqlQuery, params);

    return NextResponse.json({ people: result.rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
