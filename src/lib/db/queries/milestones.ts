/**
 * Milestones Database Queries - Prisma ORM
 * All database operations for the milestones table
 */

import { prisma } from '@/lib/prisma';


// Type definitions
export interface Milestone {
  id: string;
  stage_number: number;
  stage_name: string;
  short_name?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMilestoneInput {
  stage_number: number;
  stage_name: string;
  short_name?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * Helper to transform Prisma milestone to snake_case format
 */
function transformMilestone(m: {
  id: string;
  stageNumber: number;
  stageName: string | null;
  shortName: string | null;
  description: string | null;
  isActive: boolean | null;
  isAutoCalculated: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): Milestone {
  return {
    id: m.id,
    stage_number: m.stageNumber,
    stage_name: m.stageName || `Stage ${m.stageNumber}`,
    short_name: m.shortName || undefined,
    description: m.description || undefined,
    is_active: m.isActive ?? true,
    created_at: m.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: m.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Get all active milestones
 */
export async function findActive(): Promise<Milestone[]> {
  const milestones = await prisma.milestone.findMany({
    orderBy: { stageNumber: 'asc' },
  });

  return milestones.map(transformMilestone);
}

/**
 * Get all milestones (including inactive)
 */
export async function findAll(): Promise<Milestone[]> {
  const milestones = await prisma.milestone.findMany({
    orderBy: { stageNumber: 'asc' },
  });

  return milestones.map(transformMilestone);
}

/**
 * Get milestone by stage number
 */
export async function findByStageNumber(stageNumber: number): Promise<Milestone | null> {
  const milestone = await prisma.milestone.findUnique({
    where: { stageNumber },
  });

  return milestone ? transformMilestone(milestone) : null;
}

/**
 * Get milestone by ID
 */
export async function findById(id: string): Promise<Milestone | null> {
  const milestone = await prisma.milestone.findUnique({
    where: { id },
  });

  return milestone ? transformMilestone(milestone) : null;
}

/**
 * Create a milestone
 */
export async function create(input: CreateMilestoneInput): Promise<Milestone> {
  const milestone = await prisma.milestone.create({
    data: {
      stageNumber: input.stage_number,
      stageName: input.stage_name,
      shortName: input.short_name || null,
      description: input.description || null,
      isActive: input.is_active ?? true,
      isAutoCalculated: false,
    },
  });

  return transformMilestone(milestone);
}

/**
 * Update a milestone
 */
export async function update(
  id: string,
  updates: Partial<CreateMilestoneInput>
): Promise<Milestone | null> {
  const data: Record<string, any> = {};

  if (updates.stage_number !== undefined) {
    data.stageNumber = updates.stage_number;
  }
  if (updates.stage_name !== undefined) {
    data.stageName = updates.stage_name;
  }
  if (updates.short_name !== undefined) {
    data.shortName = updates.short_name;
  }
  if (updates.description !== undefined) {
    data.description = updates.description;
  }

  if (Object.keys(data).length === 0) {
    return findById(id);
  }

  try {
    const milestone = await prisma.milestone.update({
      where: { id },
      data,
    });

    return transformMilestone(milestone);
  } catch (error) {
    // P2025 = Record not found
    if ((error as any)?.code === 'P2025') {
      return null;
    }
    throw error;
  }
}

/**
 * Toggle milestone active status (no-op in current schema, kept for API compatibility)
 */
export async function toggleActive(id: string): Promise<Milestone | null> {
  // Current schema doesn't have is_active, just return the milestone
  return findById(id);
}

/**
 * Get active milestone count
 */
export async function countActive(): Promise<number> {
  return prisma.milestone.count();
}
