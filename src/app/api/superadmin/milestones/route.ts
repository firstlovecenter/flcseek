import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string; username?: string };
    if (decoded.role !== 'superadmin') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// Helper to transform milestone to snake_case response
function transformMilestone(m: {
  id: string;
  stageNumber: number;
  stageName: string | null;
  shortName: string | null;
  description: string | null;
  isActive: boolean | null;
  isAutoCalculated?: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}) {
  return {
    id: m.id,
    stage_number: m.stageNumber,
    stage_name: m.stageName,
    short_name: m.shortName,
    description: m.description,
    is_active: m.isActive ?? true,
    is_auto_calculated: m.isAutoCalculated ?? false,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

// GET - List all milestones
export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const milestones = await prisma.milestone.findMany({
      orderBy: { stageNumber: 'asc' }
    });

    return NextResponse.json({ milestones: milestones.map(transformMilestone) });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new milestone
export async function POST(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { stage_number, stage_name, short_name, description } = body;

    if (!stage_number || !stage_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if stage_number already exists
    const existingStage = await prisma.milestone.findUnique({
      where: { stageNumber: stage_number }
    });

    if (existingStage) {
      return NextResponse.json({ error: 'Stage number already exists' }, { status: 400 });
    }

    const milestone = await prisma.milestone.create({
      data: {
        stageNumber: stage_number,
        stageName: stage_name,
        shortName: short_name,
        description: description,
      }
    });

    return NextResponse.json({ milestone: transformMilestone(milestone) }, { status: 201 });
  } catch (error) {
    console.error('Error creating milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a milestone
export async function PUT(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, stage_name, short_name, description } = body;

    if (!id || !stage_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        stageName: stage_name,
        shortName: short_name,
        description: description,
      }
    });

    return NextResponse.json({ milestone: transformMilestone(milestone) });
  } catch (error) {
    console.error('Error updating milestone:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a milestone
export async function DELETE(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing milestone ID' }, { status: 400 });
    }

    // Get milestone to find stage_number
    const milestone = await prisma.milestone.findUnique({
      where: { id }
    });

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Check if milestone is being used in progress_records
    const usageCount = await prisma.progressRecord.count({
      where: { stageNumber: milestone.stageNumber }
    });

    if (usageCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete milestone that is being used in progress records' 
      }, { status: 400 });
    }

    await prisma.milestone.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Milestone deleted successfully' });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Toggle milestone active status
export async function PATCH(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, is_active } = body;

    if (!id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const milestone = await prisma.milestone.update({
      where: { id },
      data: { isActive: is_active }
    });

    // If reactivating a milestone, backfill missing progress records for all converts
    if (is_active === true) {
      console.log(`Reactivating milestone ${milestone.stageNumber}, checking for missing progress records...`);
      
      // Get the total number of active milestones to check for completion
      const totalActiveMilestones = await prisma.milestone.count({
        where: { isActive: true }
      });
      
      // Find all converts who:
      // 1. Don't have a progress record for this milestone
      // 2. Are NOT in archived groups
      // 3. Have NOT completed all their milestones (haven't graduated)
      const convertsWithProgress = await prisma.newConvert.findMany({
        where: {
          OR: [
            { group: null },
            { group: { archived: false } }
          ]
        },
        include: {
          progressRecords: {
            select: {
              stageNumber: true,
              isCompleted: true,
            }
          }
        }
      });

      // Filter to find converts missing this milestone and not graduated
      const missingConverts = convertsWithProgress.filter(convert => {
        const hasThisMilestone = convert.progressRecords.some(
          pr => pr.stageNumber === milestone.stageNumber
        );
        const completedCount = convert.progressRecords.filter(pr => pr.isCompleted).length;
        return !hasThisMilestone && completedCount < totalActiveMilestones;
      });

      if (missingConverts.length > 0) {
        console.log(`Found ${missingConverts.length} active converts missing this milestone, backfilling...`);
        
        // Backfill progress records for all missing converts
        await prisma.progressRecord.createMany({
          data: missingConverts.map(convert => ({
            personId: convert.id,
            stageNumber: milestone.stageNumber,
            stageName: milestone.stageName || `Stage ${milestone.stageNumber}`,
            isCompleted: false,
            updatedById: user.id,
          }))
        });

        return NextResponse.json({ 
          milestone: transformMilestone(milestone),
          backfilled: missingConverts.length,
          message: `Milestone activated and ${missingConverts.length} progress record(s) backfilled`
        });
      }
    }

    return NextResponse.json({ milestone: transformMilestone(milestone) });
  } catch (error) {
    console.error('Error toggling milestone status:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
