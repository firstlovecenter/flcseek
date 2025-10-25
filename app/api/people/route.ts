import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper function to check if a group is archived
async function isGroupArchived(groupId: string): Promise<boolean> {
  const result = await query(
    'SELECT archived FROM groups WHERE id = $1',
    [groupId]
  );
  return result.rows.length > 0 && result.rows[0].archived === true;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      first_name, 
      last_name, 
      phone_number, 
      date_of_birth, 
      gender, 
      residential_location, 
      school_residential_location, 
      occupation_type, 
      group_id, 
      group_name,
      // Keep backward compatibility with old field names
      full_name,
      home_location,
      work_location
    } = await request.json();

    // Support both new and old field structures
    const firstName = first_name || (full_name ? full_name.split(' ')[0] : '');
    const lastName = last_name || (full_name ? full_name.split(' ').slice(1).join(' ') : '');
    const residentialLoc = residential_location || home_location || '';

    if (!firstName || !lastName || !phone_number) {
      return NextResponse.json(
        { error: 'Missing required fields (first_name, last_name, phone_number)' },
        { status: 400 }
      );
    }

    // Validate date_of_birth format if provided
    if (date_of_birth && !/^\d{2}-\d{2}$/.test(date_of_birth)) {
      return NextResponse.json(
        { error: 'Invalid date_of_birth format. Must be DD-MM (e.g., 15-03)' },
        { status: 400 }
      );
    }

    // Validate gender if provided
    if (gender && gender !== 'Male' && gender !== 'Female') {
      return NextResponse.json(
        { error: 'Gender must be either "Male" or "Female"' },
        { status: 400 }
      );
    }

    // Validate occupation_type if provided
    if (occupation_type && occupation_type !== 'Worker' && occupation_type !== 'Student' && occupation_type !== 'Unemployed') {
      return NextResponse.json(
        { error: 'Occupation type must be "Worker", "Student", or "Unemployed"' },
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

    // Check if group is archived
    const archived = await isGroupArchived(finalGroupId);
    if (archived) {
      return NextResponse.json(
        { error: 'Cannot add people to an archived group' },
        { status: 403 }
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

    // Check if phone number already exists
    const existingPerson = await query(
      'SELECT id, first_name, last_name, full_name FROM new_converts WHERE phone_number = $1',
      [phone_number]
    );

    if (existingPerson.rows.length > 0) {
      const existingName = existingPerson.rows[0].first_name 
        ? `${existingPerson.rows[0].first_name} ${existingPerson.rows[0].last_name}` 
        : existingPerson.rows[0].full_name;
      return NextResponse.json(
        { error: `A person with phone number ${phone_number} is already registered (${existingName})` },
        { status: 409 }
      );
    }

    // Compute full_name for backward compatibility
    const fullName = `${firstName} ${lastName}`;

    const result = await query(
      `INSERT INTO new_converts (
        first_name, last_name, full_name, phone_number, date_of_birth, gender, 
        residential_location, school_residential_location, occupation_type,
        home_location, work_location, group_id, group_name, registered_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, (SELECT name FROM groups WHERE id = $12), $13)
       RETURNING *`,
      [
        firstName, 
        lastName, 
        fullName, 
        phone_number, 
        date_of_birth || null, 
        gender || null, 
        residentialLoc || null, 
        school_residential_location || null, 
        occupation_type || null,
        home_location || residentialLoc || null,  // backward compatibility
        work_location || null,
        finalGroupId, 
        userPayload.id
      ]
    );

    const person = result.rows[0];

    // Get all milestones from the database
    const milestonesResult = await query('SELECT stage_number, name FROM milestones ORDER BY stage_number');
    const milestones = milestonesResult.rows;

    // Insert progress records for each milestone
    // First milestone is automatically completed when someone registers
    for (const milestone of milestones) {
      const isFirstMilestone = milestone.stage_number === 1;
      await query(
        `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, date_completed, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          person.id, 
          milestone.stage_number, 
          milestone.name, 
          isFirstMilestone,  // First milestone is completed by default
          isFirstMilestone ? new Date().toISOString().split('T')[0] : null,  // Set completion date for first milestone
          userPayload.id
        ]
      );
    }

    return NextResponse.json({
      message: 'Person registered successfully',
      person,
    });
  } catch (error: any) {
    console.error('Error registering person:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505' && error.constraint === 'unique_phone_number') {
      return NextResponse.json(
        { error: 'This phone number is already registered' },
        { status: 409 }
      );
    }
    
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
    const yearParam = searchParams.get('year'); // year parameter

    let sqlQuery = `
      SELECT 
        rp.*,
        g.name as group_name_ref,
        g.year as group_year
      FROM new_converts rp
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
      const conditions: string[] = [];
      let paramIndex = 1;
      
      if (groupIdParam) {
        conditions.push(`rp.group_id = $${paramIndex}`);
        params.push(groupIdParam);
        paramIndex++;
      } else if (groupNameParam) {
        // Legacy support for group name filtering
        conditions.push(`rp.group_name = $${paramIndex}`);
        params.push(groupNameParam);
        paramIndex++;
      } else if (monthParam) {
        // Filter by month name and year
        conditions.push(`g.name = $${paramIndex}`);
        params.push(monthParam);
        paramIndex++;
        
        if (yearParam) {
          conditions.push(`g.year = $${paramIndex}`);
          params.push(parseInt(yearParam));
          paramIndex++;
        }
      }
      
      if (conditions.length > 0) {
        sqlQuery += ' WHERE ' + conditions.join(' AND ');
      }
    }

    sqlQuery += ' ORDER BY rp.full_name ASC';

    const result = await query(sqlQuery, params);

    return NextResponse.json(
      { people: result.rows },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
