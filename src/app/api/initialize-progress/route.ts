import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const userPayload = token ? verifyToken(token) : null;

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized - Superadmin only' }, { status: 401 });
    }

    // Get all active milestones from the database
    const milestones = await prisma.milestone.findMany({
      orderBy: { stageNumber: 'asc' },
    });

    if (milestones.length === 0) {
      return NextResponse.json({ error: 'No milestones found in database' }, { status: 400 });
    }

    // Get all registered people
    const people = await prisma.newConvert.findMany({
      select: { id: true },
    });

    let initialized = 0;
    let skipped = 0;

    for (const person of people) {
      // Check if this person already has progress records
      const existingCount = await prisma.progressRecord.count({
        where: { personId: person.id },
      });

      if (existingCount === 0 || existingCount < milestones.length) {
        // Initialize or fill in missing milestones for this person
        for (const milestone of milestones) {
          try {
            await prisma.progressRecord.upsert({
              where: {
                personId_stageNumber: {
                  personId: person.id,
                  stageNumber: milestone.stageNumber,
                },
              },
              create: {
                personId: person.id,
                stageNumber: milestone.stageNumber,
                stageName: milestone.stageName || `Stage ${milestone.stageNumber}`,
                isCompleted: false,
                updatedById: userPayload.id,
              },
              update: {}, // No update needed if exists
            });
          } catch {
            // Ignore errors for individual records
          }
        }
        initialized++;
      } else {
        // Person already has all progress records
        skipped++;
      }
    }

    return NextResponse.json({
      message: 'Progress initialization complete',
      totalPeople: people.length,
      initialized,
      skipped,
    });
  } catch (error) {
    console.error('Error initializing progress:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}
