import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedAuthUser } from '@/lib/api/middleware';

export async function POST(request: NextRequest) {
  try {
    const userPayload = await getVerifiedAuthUser(request);

    if (!userPayload || userPayload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized - Superadmin only' }, { status: 401 });
    }

    const milestones = await prisma.milestone.findMany({
      where: { isActive: true },
      orderBy: { stageNumber: 'asc' },
    });

    if (milestones.length === 0) {
      return NextResponse.json({ error: 'No active milestones found in database' }, { status: 400 });
    }

    // Active converts only — skip soft-deleted and archived groups
    const people = await prisma.newConvert.findMany({
      where: {
        deletedAt: null,
        OR: [{ group: null }, { group: { archived: false } }],
      },
      select: { id: true, createdAt: true },
    });

    let initialized = 0;
    let skipped = 0;
    let stage1Fixed = 0;

    for (const person of people) {
      const existing = await prisma.progressRecord.findMany({
        where: { personId: person.id },
        select: { stageNumber: true, isCompleted: true },
      });
      const byStage = new Map(existing.map((r) => [r.stageNumber, r]));

      let touched = false;

      for (const milestone of milestones) {
        const current = byStage.get(milestone.stageNumber);
        if (!current) {
          try {
            await prisma.progressRecord.create({
              data: {
                personId: person.id,
                stageNumber: milestone.stageNumber,
                stageName: milestone.stageName || `Stage ${milestone.stageNumber}`,
                isCompleted: milestone.stageNumber === 1,
                dateCompleted:
                  milestone.stageNumber === 1
                    ? person.createdAt ?? new Date()
                    : null,
                updatedById: userPayload.id,
              },
            });
            touched = true;
            if (milestone.stageNumber === 1) stage1Fixed++;
          } catch {
            // Ignore duplicate races
          }
        } else if (
          milestone.stageNumber === 1 &&
          current.isCompleted !== true
        ) {
          await prisma.progressRecord.update({
            where: {
              personId_stageNumber: {
                personId: person.id,
                stageNumber: 1,
              },
            },
            data: {
              isCompleted: true,
              dateCompleted: person.createdAt ?? new Date(),
              updatedById: userPayload.id,
            },
          });
          touched = true;
          stage1Fixed++;
        }
      }

      if (touched) initialized++;
      else skipped++;
    }

    return NextResponse.json({
      message: 'Progress initialization complete',
      totalPeople: people.length,
      initialized,
      skipped,
      stage1Fixed,
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
