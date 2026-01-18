/**
 * Progress Records Database Queries - Prisma ORM
 * All database operations for the progress_records table
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Type definitions
export interface ProgressRecord {
  id: string;
  person_id: string;
  stage_number: number;
  stage_name: string;
  is_completed: boolean;
  date_completed?: string;
  updated_by?: string;
}

export interface UpdateProgressInput {
  stage_number: number;
  is_completed: boolean;
}

/**
 * Helper to transform Prisma progress record to snake_case format
 */
function transformProgressRecord(p: {
  id: string;
  personId: string;
  stageNumber: number;
  stageName: string;
  isCompleted: boolean | null;
  dateCompleted: Date | null;
  updatedById: string;
}): ProgressRecord {
  return {
    id: p.id,
    person_id: p.personId,
    stage_number: p.stageNumber,
    stage_name: p.stageName,
    is_completed: p.isCompleted ?? false,
    date_completed: p.dateCompleted?.toISOString(),
    updated_by: p.updatedById || undefined,
  };
}

/**
 * Get all progress records for a person
 */
export async function findByPersonId(personId: string): Promise<ProgressRecord[]> {
  const records = await prisma.progressRecord.findMany({
    where: { personId },
    orderBy: { stageNumber: 'asc' },
  });

  return records.map(transformProgressRecord);
}

/**
 * Get a specific progress record
 */
export async function findOne(personId: string, stageNumber: number): Promise<ProgressRecord | null> {
  const record = await prisma.progressRecord.findUnique({
    where: {
      personId_stageNumber: { personId, stageNumber },
    },
  });

  return record ? transformProgressRecord(record) : null;
}

/**
 * Update or create a progress record (upsert)
 */
export async function upsert(
  personId: string,
  input: UpdateProgressInput,
  updatedBy: string
): Promise<ProgressRecord> {
  // Get the milestone name
  const milestone = await prisma.milestone.findUnique({
    where: { stageNumber: input.stage_number },
  });
  const stageName = milestone?.stageName || `Stage ${input.stage_number}`;

  const record = await prisma.progressRecord.upsert({
    where: {
      personId_stageNumber: { personId, stageNumber: input.stage_number },
    },
    create: {
      personId,
      stageNumber: input.stage_number,
      stageName,
      isCompleted: input.is_completed,
      dateCompleted: input.is_completed ? new Date() : null,
      updatedById: updatedBy,
    },
    update: {
      isCompleted: input.is_completed,
      dateCompleted: input.is_completed ? new Date() : null,
      updatedById: updatedBy,
    },
  });

  return transformProgressRecord(record);
}

/**
 * Toggle a milestone status
 */
export async function toggle(
  personId: string,
  stageNumber: number,
  updatedBy: string
): Promise<ProgressRecord> {
  const existing = await findOne(personId, stageNumber);
  const newStatus = !existing?.is_completed;

  return upsert(
    personId,
    {
      stage_number: stageNumber,
      is_completed: newStatus,
    },
    updatedBy
  );
}

/**
 * Bulk update progress for a person
 */
export async function bulkUpdate(
  personId: string,
  updates: UpdateProgressInput[],
  updatedBy: string
): Promise<ProgressRecord[]> {
  const results: ProgressRecord[] = [];

  // Get all milestones for stage names
  const milestones = await prisma.milestone.findMany({
    where: {
      stageNumber: { in: updates.map((u) => u.stage_number) },
    },
  });
  const milestoneMap = new Map(milestones.map((m) => [m.stageNumber, m.stageName]));

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      const stageName = milestoneMap.get(update.stage_number) || `Stage ${update.stage_number}`;

      const record = await tx.progressRecord.upsert({
        where: {
          personId_stageNumber: { personId, stageNumber: update.stage_number },
        },
        create: {
          personId,
          stageNumber: update.stage_number,
          stageName,
          isCompleted: update.is_completed,
          dateCompleted: update.is_completed ? new Date() : null,
          updatedById: updatedBy,
        },
        update: {
          isCompleted: update.is_completed,
          dateCompleted: update.is_completed ? new Date() : null,
          updatedById: updatedBy,
        },
      });

      results.push(transformProgressRecord(record));
    }
  });

  return results;
}

/**
 * Initialize progress for a new person (create records for all milestones)
 */
export async function initializeForPerson(
  personId: string,
  milestones: { stage_number: number; stage_name: string }[],
  updatedBy: string
): Promise<ProgressRecord[]> {
  const results: ProgressRecord[] = [];

  await prisma.$transaction(async (tx) => {
    for (const milestone of milestones) {
      try {
        const record = await tx.progressRecord.create({
          data: {
            personId,
            stageNumber: milestone.stage_number,
            stageName: milestone.stage_name,
            isCompleted: false,
            updatedById: updatedBy,
          },
        });
        results.push(transformProgressRecord(record));
      } catch (error) {
        // Ignore duplicate key errors (P2002)
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
  });

  return results;
}

/**
 * Get completion stats for a group
 */
export async function getGroupStats(groupId: string): Promise<{
  total_people: number;
  milestone_stats: { stage_number: number; completed_count: number; percentage: number }[];
}> {
  // Get total people in group
  const totalPeople = await prisma.newConvert.count({
    where: { groupId },
  });

  // Get milestone completion counts
  const stats = await prisma.progressRecord.groupBy({
    by: ['stageNumber'],
    where: {
      person: { groupId },
    },
    _count: {
      _all: true,
    },
  });

  // Get completed counts separately
  const completedStats = await prisma.progressRecord.groupBy({
    by: ['stageNumber'],
    where: {
      person: { groupId },
      isCompleted: true,
    },
    _count: {
      _all: true,
    },
  });

  const completedMap = new Map(
    completedStats.map((s) => [s.stageNumber, s._count._all])
  );

  return {
    total_people: totalPeople,
    milestone_stats: stats.map((s) => {
      const completedCount = completedMap.get(s.stageNumber) || 0;
      return {
        stage_number: s.stageNumber,
        completed_count: completedCount,
        percentage:
          totalPeople > 0 ? Math.round((completedCount / totalPeople) * 100) : 0,
      };
    }),
  };
}

/**
 * Get overall completion rate for a person
 */
export async function getPersonCompletionRate(personId: string): Promise<{
  completed: number;
  total: number;
  percentage: number;
}> {
  const [total, completed] = await Promise.all([
    prisma.progressRecord.count({
      where: { personId },
    }),
    prisma.progressRecord.count({
      where: { personId, isCompleted: true },
    }),
  ]);

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
