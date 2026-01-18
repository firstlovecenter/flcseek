/**
 * Groups Database Queries - Prisma ORM
 * All database operations for the groups table
 */

import { prisma } from '@/lib/prisma';

// Type definitions
export interface Group {
  id: string;
  name: string;
  year?: number;
  leader_id?: string;
  leader_name?: string;
  leader_full_name?: string;
  description?: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface CreateGroupInput {
  name: string;
  year?: number;
  leader_id?: string;
  description?: string;
}

export interface GroupFilters {
  year?: number;
  archived?: boolean;
  leaderId?: string;
  search?: string;
  groupId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all groups with optional filters
 */
export async function findMany(filters: GroupFilters = {}): Promise<Group[]> {
  const where: Record<string, any> = {};

  if (filters.year !== undefined) {
    where.year = filters.year;
  }

  if (filters.archived !== undefined) {
    where.archived = filters.archived;
  }

  if (filters.groupId) {
    where.id = filters.groupId;
  }

  if (filters.leaderId) {
    where.leaderId = filters.leaderId;
  }

  if (filters.search) {
    where.name = {
      contains: filters.search,
      mode: 'insensitive',
    };
  }

  const groups = await prisma.group.findMany({
    where,
    include: {
      leader: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: {
          newConverts: true,
        },
      },
    },
    orderBy: { name: 'asc' },
    take: filters.limit,
    skip: filters.offset,
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    year: g.year,
    leader_id: g.leaderId || undefined,
    leader_name: g.leader?.username || undefined,
    leader_full_name: g.leader
      ? `${g.leader.firstName || ''} ${g.leader.lastName || ''}`.trim()
      : undefined,
    description: g.description || undefined,
    archived: g.archived ?? false,
    created_at: g.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: g.updatedAt?.toISOString() || new Date().toISOString(),
    member_count: g._count.newConverts,
  }));
}

/**
 * Get a single group by ID
 */
export async function findById(id: string): Promise<Group | null> {
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      leader: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: {
          newConverts: true,
        },
      },
    },
  });

  if (!group) return null;

  return {
    id: group.id,
    name: group.name,
    year: group.year,
    leader_id: group.leaderId || undefined,
    leader_name: group.leader?.username || undefined,
    leader_full_name: group.leader
      ? `${group.leader.firstName || ''} ${group.leader.lastName || ''}`.trim()
      : undefined,
    description: group.description || undefined,
    archived: group.archived ?? false,
    created_at: group.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: group.updatedAt?.toISOString() || new Date().toISOString(),
    member_count: group._count.newConverts,
  };
}

/**
 * Create a new group
 */
export async function create(input: CreateGroupInput): Promise<Group> {
  const year = input.year ?? new Date().getFullYear();

  const group = await prisma.group.create({
    data: {
      name: input.name,
      year,
      leaderId: input.leader_id || null,
      description: input.description || null,
      archived: false,
    },
  });

  return {
    id: group.id,
    name: group.name,
    year: group.year,
    leader_id: group.leaderId || undefined,
    description: group.description || undefined,
    archived: group.archived ?? false,
    created_at: group.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: group.updatedAt?.toISOString() || new Date().toISOString(),
    member_count: 0,
  };
}

/**
 * Update a group
 */
export async function update(
  id: string,
  updates: Partial<CreateGroupInput & { archived?: boolean }>
): Promise<Group | null> {
  const data: Record<string, any> = {};

  if (updates.name !== undefined) {
    data.name = updates.name;
  }
  if (updates.leader_id !== undefined) {
    data.leader = updates.leader_id
      ? { connect: { id: updates.leader_id } }
      : { disconnect: true };
  }
  if (updates.description !== undefined) {
    data.description = updates.description;
  }
  if (updates.archived !== undefined) {
    data.archived = updates.archived;
  }

  if (Object.keys(data).length === 0) {
    return findById(id);
  }

  try {
    const group = await prisma.group.update({
      where: { id },
      data,
      include: {
        leader: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            newConverts: true,
          },
        },
      },
    });

    return {
      id: group.id,
      name: group.name,
      year: group.year,
      leader_id: group.leaderId || undefined,
      leader_name: group.leader?.username || undefined,
      description: group.description || undefined,
      archived: group.archived ?? false,
      created_at: group.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: group.updatedAt?.toISOString() || new Date().toISOString(),
      member_count: group._count.newConverts,
    };
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return null;
    }
    throw error;
  }
}

/**
 * Delete a group
 */
export async function remove(id: string): Promise<boolean> {
  try {
    await prisma.group.delete({ where: { id } });
    return true;
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

/**
 * Count groups with filters
 */
export async function count(filters: GroupFilters = {}): Promise<number> {
  const where: Record<string, any> = {};

  if (filters.year !== undefined) {
    where.year = filters.year;
  }

  if (filters.archived !== undefined) {
    where.archived = filters.archived;
  }

  return prisma.group.count({ where });
}

/**
 * Get available years from groups
 */
export async function getAvailableYears(): Promise<number[]> {
  const groups = await prisma.group.findMany({
    select: { year: true },
    distinct: ['year'],
    orderBy: { year: 'desc' },
  });
  return groups.map((g) => g.year);
}

/**
 * Clone groups from one year to another
 */
export async function cloneFromPreviousYear(
  sourceYear: number,
  targetYear: number
): Promise<{ cloned: Group[]; errors: string[] }> {
  const cloned: Group[] = [];
  const errors: string[] = [];

  // Get all active groups from source year
  const sourceGroups = await prisma.group.findMany({
    where: {
      year: sourceYear,
      archived: false,
    },
    orderBy: { name: 'asc' },
  });

  for (const group of sourceGroups) {
    try {
      // Check if group already exists in target year
      const existing = await prisma.group.findFirst({
        where: {
          name: group.name,
          year: targetYear,
        },
      });

      if (existing) {
        errors.push(`Group "${group.name}" already exists in ${targetYear}`);
        continue;
      }

      // Clone the group
      const newGroup = await prisma.group.create({
        data: {
          name: group.name,
          year: targetYear,
          leaderId: group.leaderId,
          description: group.description,
          archived: false,
        },
      });

      cloned.push({
        id: newGroup.id,
        name: newGroup.name,
        year: newGroup.year,
        leader_id: newGroup.leaderId || undefined,
        description: newGroup.description || undefined,
        archived: newGroup.archived ?? false,
        created_at: newGroup.createdAt?.toISOString() || new Date().toISOString(),
        updated_at: newGroup.updatedAt?.toISOString() || new Date().toISOString(),
        member_count: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to clone group "${group.name}": ${message}`);
    }
  }

  return { cloned, errors };
}
