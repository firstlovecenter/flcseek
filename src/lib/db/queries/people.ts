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
  date_of_birth?: string;
  gender?: string;
  address?: string;
  residential_location?: string;
  school_residential_location?: string;
  occupation_type?: string;
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

/** Compact row for milestone grids — only completed stage numbers, not 18 full objects. */
export interface PersonGridRow {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number: string;
  gender?: string;
  created_at: string;
  group_id?: string;
  group_name?: string;
  group_year?: number;
  /** Stage numbers with is_completed=true (sparse; expand client-side). */
  completed_stages: number[];
  attendance_count: number;
  progress_percentage: number;
  attendance_percentage: number;
}

export interface CreatePersonInput {
  first_name: string;
  last_name: string;
  phone_number: string;
  gender?: string;
  date_of_birth?: string;
  residential_location?: string;
  school_residential_location?: string;
  occupation_type?: string;
  address?: string;  // Legacy field - mapped to residential_location
  group_id?: string;
  group_name?: string;
  registered_by?: string;
}

export interface PersonFilters {
  groupId?: string;
  groupName?: string;
  month?: string;  // Filter by group name (month name like "January")
  year?: number;    // Filter by group year (legacy: group.year relation only)
  /** Resolved from `year` in the API layer — matches groupId or groupName for that year. */
  yearGroupIds?: string[];
  yearGroupNames?: string[];
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
  dateOfBirth: string | null;
  gender: string | null;
  residentialLocation: string | null;
  schoolResidentialLocation: string | null;
  occupationType: string | null;
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
    date_of_birth: p.dateOfBirth || undefined,
    gender: p.gender || undefined,
    address: p.residentialLocation || undefined,
    residential_location: p.residentialLocation || undefined,
    school_residential_location: p.schoolResidentialLocation || undefined,
    occupation_type: p.occupationType || undefined,
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
  const where: Record<string, unknown> = { deletedAt: null };

  if (filters.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters.groupName) {
    where.group = { name: filters.groupName };
  }

  // Month filter is an alias for groupName (groups are named after months)
  if (filters.month) {
    where.group = {
      ...((where.group as Record<string, unknown>) || {}),
      name: { equals: filters.month, mode: 'insensitive' }
    };
  }

  // Year filter
  if (filters.year !== undefined) {
    where.group = {
      ...((where.group as Record<string, unknown>) || {}),
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
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      dateOfBirth: true,
      gender: true,
      residentialLocation: true,
      schoolResidentialLocation: true,
      occupationType: true,
      groupId: true,
      groupName: true,
      registeredById: true,
      createdAt: true,
      updatedAt: true,
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
  const person = await prisma.newConvert.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      dateOfBirth: true,
      gender: true,
      residentialLocation: true,
      schoolResidentialLocation: true,
      occupationType: true,
      groupId: true,
      groupName: true,
      registeredById: true,
      createdAt: true,
      updatedAt: true,
      group: { select: { name: true, year: true } },
    },
  });

  return person ? transformPerson(person) : null;
}

/** Shared where-clause builder for person list queries. */
function buildPersonWhere(filters: PersonFilters): Record<string, unknown> {
  const where: Record<string, unknown> = { deletedAt: null };

  if (filters.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters.groupName) {
    where.group = {
      ...((where.group as Record<string, unknown>) || {}),
      name: filters.groupName,
    };
  }

  if (filters.month) {
    where.group = {
      ...((where.group as Record<string, unknown>) || {}),
      name: { equals: filters.month, mode: 'insensitive' },
    };
  }

  if (filters.yearGroupIds?.length || filters.yearGroupNames?.length) {
    const yearScope: Record<string, unknown>[] = [];
    if (filters.yearGroupIds?.length) {
      yearScope.push({ groupId: { in: filters.yearGroupIds } });
    }
    if (filters.yearGroupNames?.length) {
      yearScope.push({
        groupName: { in: filters.yearGroupNames, mode: 'insensitive' },
      });
    }
    if (yearScope.length === 1) {
      Object.assign(where, yearScope[0]);
    } else if (yearScope.length > 1) {
      const existingOr = (where.OR as Record<string, unknown>[]) || [];
      where.OR = [...existingOr, ...yearScope];
    }
  } else if (filters.year !== undefined) {
    where.group = {
      ...((where.group as Record<string, unknown>) || {}),
      year: filters.year,
    };
  }

  if (filters.search) {
    const searchOr = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { phoneNumber: { contains: filters.search } },
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR as Record<string, unknown>[] }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  return where;
}

const MAX_GRID_ROWS = 1000;

/**
 * Fast path for milestone grids: only loads completed stage numbers + attendance count.
 * Payload is ~10× smaller than include=progress (no stage_name/date per row).
 */
export async function findManyForGrid(
  filters: PersonFilters = {},
  totalMilestones: number = 18
): Promise<PersonGridRow[]> {
  const where = buildPersonWhere(filters);

  const people = await prisma.newConvert.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      gender: true,
      createdAt: true,
      groupId: true,
      groupName: true,
      group: { select: { name: true, year: true } },
      progressRecords: {
        where: { isCompleted: true },
        select: { stageNumber: true },
      },
      _count: { select: { attendanceRecords: true } },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    take: MAX_GRID_ROWS,
    skip: filters.offset ?? 0,
  });

  return people.map((p) => {
    const completedStages = p.progressRecords.map((pr) => pr.stageNumber);
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
      created_at: p.createdAt?.toISOString() || new Date().toISOString(),
      group_id: p.groupId || undefined,
      group_name: p.group?.name || p.groupName || undefined,
      group_year: p.group?.year,
      completed_stages: completedStages,
      attendance_count: attendanceCount,
      progress_percentage: Math.round((completedStages.length / totalMilestones) * 100),
      attendance_percentage: Math.min(
        Math.round((attendanceCount / ATTENDANCE_GOAL) * 100),
        100
      ),
    };
  });
}

/**
 * Get people with full progress data (optimized query)
 */
export async function findManyWithProgress(
  filters: PersonFilters = {},
  totalMilestones: number = 18
): Promise<PersonWithProgress[]> {
  const where = buildPersonWhere(filters);

  const people = await prisma.newConvert.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      gender: true,
      residentialLocation: true,
      groupId: true,
      groupName: true,
      registeredById: true,
      createdAt: true,
      updatedAt: true,
      group: { select: { name: true, year: true } },
      progressRecords: {
        orderBy: { stageNumber: 'asc' },
        select: {
          stageNumber: true,
          stageName: true,
          isCompleted: true,
          dateCompleted: true,
        },
      },
      _count: { select: { attendanceRecords: true } },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    take: MAX_GRID_ROWS,
    skip: filters.offset ?? 0,
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
  const where: Record<string, unknown> = { deletedAt: null };

  if (filters.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters.groupName) {
    where.group = {
      ...((where.group as Record<string, unknown>) || {}),
      name: filters.groupName
    };
  }

  if (filters.year !== undefined) {
    where.group = {
      ...((where.group as Record<string, unknown>) || {}),
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
 * Create progress records for a newly registered person, one per active milestone.
 * The first milestone (stage 1) is automatically completed on registration.
 */
async function initializeMilestoneProgress(
  personId: string,
  registeredBy: string
): Promise<void> {
  const activeMilestones = await prisma.milestone.findMany({
    where: { isActive: true },
    select: { stageNumber: true, stageName: true },
  });

  if (activeMilestones.length === 0) return;

  const now = new Date();
  await prisma.progressRecord.createMany({
    data: activeMilestones.map((m) => ({
      personId,
      stageNumber: m.stageNumber,
      stageName: m.stageName || `Stage ${m.stageNumber}`,
      isCompleted: m.stageNumber === 1,
      dateCompleted: m.stageNumber === 1 ? now : null,
      updatedById: registeredBy,
    })),
    skipDuplicates: true,
  });
}

/**
 * Create a new person
 * IMPORTANT: group_id should be provided to ensure the record appears in filtered queries
 */
export async function create(input: CreatePersonInput): Promise<Person> {
  if (!input.group_name) {
    throw new Error('group_name is required');
  }
  if (!input.registered_by) {
    throw new Error('registered_by is required');
  }
  if (!input.group_id) {
    console.warn('[create] Creating person without group_id - record may not appear in filtered views');
  }

  const person = await prisma.newConvert.create({
    data: {
      firstName: input.first_name,
      lastName: input.last_name,
      phoneNumber: input.phone_number,
      gender: input.gender || null,
      dateOfBirth: input.date_of_birth || null,
      residentialLocation: input.residential_location || input.address || null,
      schoolResidentialLocation: input.school_residential_location || null,
      occupationType: input.occupation_type || null,
      groupId: input.group_id || null,
      groupName: input.group_name,
      registeredById: input.registered_by,
    },
    include: {
      group: { select: { name: true, year: true } },
    },
  });

  await initializeMilestoneProgress(person.id, input.registered_by);

  return transformPerson(person);
}

/**
 * Update a person
 */
export async function update(
  id: string,
  updates: Partial<CreatePersonInput>
): Promise<Person | null> {
  const data: Record<string, unknown> = {};

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
    if ((error as { code?: string })?.code === 'P2025') {
      return null;
    }
    throw error;
  }
}

/**
 * Soft delete a person
 */
export async function remove(id: string): Promise<boolean> {
  try {
    const result = await prisma.newConvert.updateMany({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return result.count > 0;
  } catch (error) {
    throw error;
  }
}

/**
 * Bulk create people
 * IMPORTANT: group_id must be a valid UUID that exists in the groups table
 * Records with invalid/missing group_id will be skipped to prevent orphaned records
 */
export async function createMany(
  people: CreatePersonInput[],
  _options: { skipDuplicates?: boolean } = {}
): Promise<{ created: Person[]; skipped: number }> {
  const created: Person[] = [];
  let skipped = 0;

  // 1. Drop rows missing required linkage fields (same rules as before).
  const valid: CreatePersonInput[] = [];
  for (const input of people) {
    if (!input.group_name || !input.registered_by || !input.group_id) {
      skipped++;
      continue;
    }
    valid.push(input);
  }

  if (valid.length === 0) {
    return { created, skipped };
  }

  // 2. Detect duplicates in a single query. The phone uniqueness constraint is a
  // partial unique index (WHERE deleted_at IS NULL), so we match that semantics.
  const phones = Array.from(new Set(valid.map((v) => v.phone_number)));
  const existing = await prisma.newConvert.findMany({
    where: { phoneNumber: { in: phones }, deletedAt: null },
    select: { phoneNumber: true },
  });
  const existingPhones = new Set(existing.map((e) => e.phoneNumber));

  const seen = new Set<string>();
  const toCreate: CreatePersonInput[] = [];
  for (const input of valid) {
    if (existingPhones.has(input.phone_number) || seen.has(input.phone_number)) {
      skipped++;
      continue;
    }
    seen.add(input.phone_number);
    toCreate.push(input);
  }

  if (toCreate.length === 0) {
    return { created, skipped };
  }

  // 3. Single batched insert that returns the created rows.
  const rows = await prisma.newConvert.createManyAndReturn({
    data: toCreate.map((input) => ({
      firstName: input.first_name,
      lastName: input.last_name,
      phoneNumber: input.phone_number,
      gender: input.gender || null,
      dateOfBirth: input.date_of_birth || null,
      residentialLocation: input.residential_location || input.address || null,
      schoolResidentialLocation: input.school_residential_location || null,
      occupationType: input.occupation_type || null,
      groupId: input.group_id!,
      groupName: input.group_name!,
      registeredById: input.registered_by!,
    })),
    include: {
      group: { select: { name: true, year: true } },
    },
  });

  for (const row of rows) {
    created.push(transformPerson(row));
  }

  if (rows.length > 0) {
    const activeMilestones = await prisma.milestone.findMany({
      where: { isActive: true },
      select: { stageNumber: true, stageName: true },
    });

    if (activeMilestones.length > 0) {
      const now = new Date();
      await prisma.progressRecord.createMany({
        data: rows.flatMap((row) =>
          activeMilestones.map((m) => ({
            personId: row.id,
            stageNumber: m.stageNumber,
            stageName: m.stageName || `Stage ${m.stageNumber}`,
            isCompleted: m.stageNumber === 1,
            dateCompleted: m.stageNumber === 1 ? now : null,
            updatedById: row.registeredById!,
          }))
        ),
        skipDuplicates: true,
      });
    }
  }

  return { created, skipped };
}

/**
 * Count people with filters
 */
export async function count(filters: PersonFilters = {}): Promise<number> {
  const where: Record<string, unknown> = { deletedAt: null };

  if (filters.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters.groupName) {
    where.group = {
      ...((where.group as Record<string, unknown>) || {}),
      name: filters.groupName
    };
  }

  if (filters.year !== undefined) {
    where.group = {
      ...((where.group as Record<string, unknown>) || {}),
      year: filters.year,
    };
  }

  return prisma.newConvert.count({ where });
}
