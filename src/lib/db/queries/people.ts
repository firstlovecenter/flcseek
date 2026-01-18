/**
 * People (Converts) Database Queries - Prisma ORM
 * All database operations for the new_converts table
 */

import { prisma } from '@/lib/prisma';
import { ATTENDANCE_GOAL } from '@/lib/constants';

// Type definitions
export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  phone_number: string;
  gender?: string;
  address?: string;
  group_id?: string;
  group_name?: string;
  group_year?: number;
  registered_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PersonWithProgress extends Person {
  progress: Array<{
    stage_number: number;
    stage_name: string;
    is_completed: boolean;
    date_completed?: string;
  }>;
  completed_stages: number;
  attendance_count: number;
  progress_percentage?: number;
  attendance_percentage?: number;
}

export interface PersonWithStats extends Person {
  completed_stages: number;
  attendance_count: number;
  progress_percentage: number;
  attendance_percentage: number;
}

export interface CreatePersonInput {
  first_name: string;
  last_name: string;
  phone_number: string;
  gender?: string;
  address?: string;
  group_id?: string;
  group_name?: string;
  registered_by?: string;
}

export interface PersonFilters {
  groupId?: string;
  groupName?: string;
  month?: string;  // Filter by group name (month name like "January")
  year?: number;    // Filter by group year
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Helper to transform Prisma person to snake_case format
 */
function transformPerson(p: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string;
  gender: string | null;
  residentialLocation: string | null;
  groupId: string | null;
  groupName: string;
  registeredById: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  group?: { name: string; year: number } | null;
}): Person {
  const firstName = p.firstName || '';
  const lastName = p.lastName || '';
  return {
    id: p.id,
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    phone_number: p.phoneNumber,
    gender: p.gender || undefined,
    address: p.residentialLocation || undefined,
    group_id: p.groupId || undefined,
    group_name: p.group?.name || p.groupName || undefined,
    group_year: p.group?.year,
    registered_by: p.registeredById || undefined,
    created_at: p.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: p.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Get all people with optional filters
 */
export async function findMany(filters: PersonFilters = {}): Promise<Person[]> {
  const where: Record<string, any> = {};

  if (filters.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters.groupName) {
    where.group = { name: filters.groupName };
  }

  // Month filter is an alias for groupName (groups are named after months)
  if (filters.month) {
    where.group = { 
      ...((where.group as Record<string, any>) || {}),
      name: { equals: filters.month, mode: 'insensitive' } 
    };
  }

  // Year filter
  if (filters.year !== undefined) {
    where.group = {
      ...((where.group as Record<string, any>) || {}),
      year: filters.year,
    };
  }

  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { phoneNumber: { contains: filters.search } },
    ];
  }

  const people = await prisma.newConvert.findMany({
    where,
    include: {
      group: { select: { name: true, year: true } },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    take: filters.limit,
    skip: filters.offset,
  });

  return people.map(transformPerson);
}

/**
 * Get a single person by ID
 */
export async function findById(id: string): Promise<Person | null> {
  const person = await prisma.newConvert.findUnique({
    where: { id },
    include: {
      group: { select: { name: true, year: true } },
    },
  });

  return person ? transformPerson(person) : null;
}

/**
 * Get people with full progress data (optimized query)
 */
export async function findManyWithProgress(
  filters: PersonFilters = {},
  totalMilestones: number = 18
): Promise<PersonWithProgress[]> {
  const where: Record<string, any> = {};

  if (filters.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters.groupName) {
    where.group = { 
      ...((where.group as Record<string, any>) || {}),
      name: filters.groupName 
    };
  }

  if (filters.month) {
    where.group = { 
      ...((where.group as Record<string, any>) || {}),
      name: { equals: filters.month, mode: 'insensitive' } 
    };
  }

  if (filters.year !== undefined) {
    where.group = {
      ...((where.group as Record<string, any>) || {}),
      year: filters.year,
    };
  }

  const people = await prisma.newConvert.findMany({
    where,
    include: {
      group: { select: { name: true, year: true } },
      progressRecords: {
        orderBy: { stageNumber: 'asc' },
      },
      _count: {
        select: { attendanceRecords: true },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  return people.map((p) => {
    const completedStages = p.progressRecords.filter((pr) => pr.isCompleted).length;
    const attendanceCount = p._count.attendanceRecords;
    const firstName = p.firstName || '';
    const lastName = p.lastName || '';

    return {
      id: p.id,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      phone_number: p.phoneNumber,
      gender: p.gender || undefined,
      address: p.residentialLocation || undefined,
      group_id: p.groupId || undefined,
      group_name: p.group?.name || p.groupName || undefined,
      group_year: p.group?.year,
      registered_by: p.registeredById || undefined,
      created_at: p.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: p.updatedAt?.toISOString() || new Date().toISOString(),
      progress: p.progressRecords.map((pr) => ({
        stage_number: pr.stageNumber,
        stage_name: pr.stageName,
        is_completed: pr.isCompleted ?? false,
        date_completed: pr.dateCompleted?.toISOString(),
      })),
      completed_stages: completedStages,
      attendance_count: attendanceCount,
      progress_percentage: Math.round((completedStages / totalMilestones) * 100),
      attendance_percentage: Math.min(
        Math.round((attendanceCount / ATTENDANCE_GOAL) * 100),
        100
      ),
    };
  });
}

/**
 * Get people with stats (aggregated, lighter query)
 */
export async function findManyWithStats(
  filters: PersonFilters = {},
  totalMilestones: number = 18
): Promise<{ people: PersonWithStats[]; total: number }> {
  const where: Record<string, any> = {};

  if (filters.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters.groupName) {
    where.group = { 
      ...((where.group as Record<string, any>) || {}),
      name: filters.groupName 
    };
  }

  if (filters.year !== undefined) {
    where.group = {
      ...((where.group as Record<string, any>) || {}),
      year: filters.year,
    };
  }

  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { phoneNumber: { contains: filters.search } },
    ];
  }

  const [total, peopleData] = await Promise.all([
    prisma.newConvert.count({ where }),
    prisma.newConvert.findMany({
      where,
      include: {
        group: { select: { name: true, year: true } },
        progressRecords: {
          where: { isCompleted: true },
          select: { id: true },
        },
        _count: {
          select: { attendanceRecords: true },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: filters.limit || 100,
      skip: filters.offset || 0,
    }),
  ]);

  const people = peopleData.map((p) => {
    const completedStages = p.progressRecords.length;
    const attendanceCount = p._count.attendanceRecords;
    const firstName = p.firstName || '';
    const lastName = p.lastName || '';

    return {
      id: p.id,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      phone_number: p.phoneNumber,
      gender: p.gender || undefined,
      group_id: p.groupId || undefined,
      group_name: p.group?.name || p.groupName || undefined,
      group_year: p.group?.year,
      created_at: p.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: p.updatedAt?.toISOString() || new Date().toISOString(),
      completed_stages: completedStages,
      attendance_count: attendanceCount,
      progress_percentage: Math.round((completedStages / totalMilestones) * 100),
      attendance_percentage: Math.min(
        Math.round((attendanceCount / ATTENDANCE_GOAL) * 100),
        100
      ),
    };
  });

  return { people, total };
}

/**
 * Create a new person
 */
export async function create(input: CreatePersonInput): Promise<Person> {
  if (!input.group_name) {
    throw new Error('group_name is required');
  }
  if (!input.registered_by) {
    throw new Error('registered_by is required');
  }
  
  const person = await prisma.newConvert.create({
    data: {
      firstName: input.first_name,
      lastName: input.last_name,
      phoneNumber: input.phone_number,
      gender: input.gender || null,
      residentialLocation: input.address || null,
      groupId: input.group_id || null,
      groupName: input.group_name,
      registeredById: input.registered_by,
    },
    include: {
      group: { select: { name: true, year: true } },
    },
  });

  return transformPerson(person);
}

/**
 * Update a person
 */
export async function update(
  id: string,
  updates: Partial<CreatePersonInput>
): Promise<Person | null> {
  const data: Record<string, any> = {};

  if (updates.first_name !== undefined) {
    data.firstName = updates.first_name;
  }
  if (updates.last_name !== undefined) {
    data.lastName = updates.last_name;
  }
  if (updates.phone_number !== undefined) {
    data.phoneNumber = updates.phone_number;
  }
  if (updates.gender !== undefined) {
    data.gender = updates.gender;
  }
  if (updates.address !== undefined) {
    data.residentialLocation = updates.address;
  }
  if (updates.group_id !== undefined) {
    if (updates.group_id) {
      data.group = { connect: { id: updates.group_id } };
    } else {
      data.group = { disconnect: true };
    }
  }
  if (updates.group_name !== undefined) {
    data.groupName = updates.group_name;
  }

  if (Object.keys(data).length === 0) {
    return findById(id);
  }

  try {
    const person = await prisma.newConvert.update({
      where: { id },
      data,
      include: {
        group: { select: { name: true, year: true } },
      },
    });

    return transformPerson(person);
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return null;
    }
    throw error;
  }
}

/**
 * Delete a person
 */
export async function remove(id: string): Promise<boolean> {
  try {
    // Prisma will cascade delete related records due to onDelete: Cascade
    await prisma.newConvert.delete({ where: { id } });
    return true;
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

/**
 * Bulk create people
 */
export async function createMany(
  people: CreatePersonInput[],
  options: { skipDuplicates?: boolean } = {}
): Promise<{ created: Person[]; skipped: number }> {
  const created: Person[] = [];
  let skipped = 0;

  for (const input of people) {
    // Skip if required fields are missing
    if (!input.group_name || !input.registered_by) {
      skipped++;
      continue;
    }
    
    try {
      const person = await prisma.newConvert.create({
        data: {
          firstName: input.first_name,
          lastName: input.last_name,
          phoneNumber: input.phone_number,
          gender: input.gender || null,
          residentialLocation: input.address || null,
          groupId: input.group_id || null,
          groupName: input.group_name,
          registeredById: input.registered_by,
        },
        include: {
          group: { select: { name: true, year: true } },
        },
      });
      created.push(transformPerson(person));
    } catch (error) {
      if (
        (error as any)?.code === 'P2002' &&
        options.skipDuplicates
      ) {
        skipped++;
      } else if (options.skipDuplicates) {
        skipped++;
      } else {
        throw error;
      }
    }
  }

  return { created, skipped };
}

/**
 * Count people with filters
 */
export async function count(filters: PersonFilters = {}): Promise<number> {
  const where: Record<string, any> = {};

  if (filters.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters.groupName) {
    where.group = { 
      ...((where.group as Record<string, any>) || {}),
      name: filters.groupName 
    };
  }

  if (filters.year !== undefined) {
    where.group = {
      ...((where.group as Record<string, any>) || {}),
      year: filters.year,
    };
  }

  return prisma.newConvert.count({ where });
}
