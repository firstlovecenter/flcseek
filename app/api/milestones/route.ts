import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Use NEON_DATABASE_URL (Netlify) or DATABASE_URL (local) with fallback for build time
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';
const sql = connectionString ? neon(connectionString) : null;

// Helper function to verify JWT token
async function verifyAuth(request: NextRequest) {
  if (!sql) return null;
  
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const users = await sql`
      SELECT id, email, role 
      FROM users 
      WHERE id = ${token}
    `;
    
    if (users.length === 0) {
      return null;
    }
    
    return users[0];
  } catch (error) {
    return null;
  }
}

// GET /api/milestones - Get all milestones
export async function GET(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const user = await verifyAuth(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all milestones ordered by stage number
    const milestones = await sql`
      SELECT 
        id,
        stage_number,
        stage_name,
        description,
        created_at,
        updated_at
      FROM progress_stages
      ORDER BY stage_number ASC
    `;

    return NextResponse.json({ milestones });
  } catch (error: any) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json(
      { error: 'Failed to fetch milestones' },
      { status: 500 }
    );
  }
}

// POST /api/milestones - Create a new milestone
export async function POST(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database connection not configured' },
        { status: 500 }
      );
    }

    const user = await verifyAuth(request);
    
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Super Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { stage_number, stage_name, description } = body;

    // Validation
    if (!stage_number || !stage_name) {
      return NextResponse.json(
        { error: 'stage_number and stage_name are required' },
        { status: 400 }
      );
    }

    // Check if stage number already exists
    const existing = await sql`
      SELECT id FROM progress_stages 
      WHERE stage_number = ${stage_number}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Stage number ${stage_number} already exists` },
        { status: 400 }
      );
    }

    // Create the milestone
    const result = await sql`
      INSERT INTO progress_stages (stage_number, stage_name, description)
      VALUES (${stage_number}, ${stage_name}, ${description || null})
      RETURNING *
    `;

    return NextResponse.json(
      { milestone: result[0], message: 'Milestone created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating milestone:', error);
    return NextResponse.json(
      { error: 'Failed to create milestone' },
      { status: 500 }
    );
  }
}
