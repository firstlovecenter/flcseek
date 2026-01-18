/**
 * Users Database Queries - Prisma ORM
 * All database operations for the users table
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { hashPassword } from '@/lib/auth';
import { UserRole } from '@/lib/constants';

// Type definitions
export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  group_id?: string;
  group_name?: string;
  created_at: string;
  updated_at: string;
}

export interface UserWithPassword extends User {
  password: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  group_id?: string;
  group_name?: string;
}

export interface UserFilters {
  role?: UserRole | UserRole[];
  groupId?: string;
  search?: string;
  excludeSystemUsers?: boolean;
  limit?: number;
  offset?: number;
}

const SYSTEM_USERNAMES = ['skaduteye', 'sysadmin'];

/**
 * Helper to transform Prisma user to snake_case format
 */
function transformUser(u: {
  id: string;
  username: string;
  email: string | null;
  role: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber?: string | null;
  groupId: string | null;
  groupName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): User {
  return {
    id: u.id,
    username: u.username,
    email: u.email || undefined,
    role: (u.role as UserRole) || 'leader',
    first_name: u.firstName || undefined,
    last_name: u.lastName || undefined,
    phone_number: u.phoneNumber || undefined,
    group_id: u.groupId || undefined,
    group_name: u.groupName || undefined,
    created_at: u.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: u.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Get all users with optional filters
 */
export async function findMany(filters: UserFilters = {}): Promise<User[]> {
  const where: Prisma.UserWhereInput = {};

  if (filters.role) {
    const roles = Array.isArray(filters.role) ? filters.role : [filters.role];
    where.role = { in: roles };
  }

  if (filters.groupId) {
    where.groupId = filters.groupId;
  }

  if (filters.excludeSystemUsers !== false) {
    where.username = { notIn: SYSTEM_USERNAMES };
  }

  if (filters.search) {
    where.OR = [
      { username: { contains: filters.search, mode: 'insensitive' } },
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      groupId: true,
      groupName: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { firstName: 'asc' },
      { username: 'asc' },
    ],
    take: filters.limit,
    skip: filters.offset,
  });

  return users.map(transformUser);
}

/**
 * Get a single user by ID
 */
export async function findById(id: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      groupId: true,
      groupName: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user ? transformUser(user) : null;
}

/**
 * Get a user by username (for authentication)
 */
export async function findByUsername(username: string): Promise<UserWithPassword | null> {
  const user = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: 'insensitive' },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    password: user.password,
    email: user.email || undefined,
    role: (user.role as UserRole) || 'leader',
    first_name: user.firstName || undefined,
    last_name: user.lastName || undefined,
    group_id: user.groupId || undefined,
    group_name: user.groupName || undefined,
    created_at: user.createdAt?.toISOString() || new Date().toISOString(),
    updated_at: user.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Get users by role (e.g., all leaders, all sheep-seekers)
 */
export async function findByRole(role: UserRole | UserRole[]): Promise<User[]> {
  return findMany({ role });
}

/**
 * Get leaders for assignment dropdown
 */
export async function findLeaders(): Promise<User[]> {
  return findMany({ role: ['leader', 'admin'] });
}

/**
 * Create a new user
 */
export async function create(input: CreateUserInput): Promise<User> {
  const hashedPassword = hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      username: input.username,
      password: hashedPassword,
      email: input.email || null,
      role: input.role,
      firstName: input.first_name || null,
      lastName: input.last_name || null,
      groupId: input.group_id || null,
      groupName: input.group_name || null,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      groupId: true,
      groupName: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return transformUser(user);
}

/**
 * Update a user
 */
export async function update(
  id: string,
  updates: Partial<Omit<CreateUserInput, 'username'> & { password?: string }>
): Promise<User | null> {
  const data: Prisma.UserUpdateInput = {};

  if (updates.password !== undefined) {
    data.password = hashPassword(updates.password);
  }
  if (updates.email !== undefined) {
    data.email = updates.email;
  }
  if (updates.role !== undefined) {
    data.role = updates.role;
  }
  if (updates.first_name !== undefined) {
    data.firstName = updates.first_name;
  }
  if (updates.last_name !== undefined) {
    data.lastName = updates.last_name;
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
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        groupId: true,
        groupName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return transformUser(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Delete a user
 */
export async function remove(id: string): Promise<boolean> {
  // Check if it's a system user
  const user = await findById(id);
  if (user && SYSTEM_USERNAMES.includes(user.username)) {
    throw new Error('Cannot delete system user');
  }

  try {
    await prisma.user.delete({ where: { id } });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Check if username exists
 */
export async function usernameExists(username: string, excludeId?: string): Promise<boolean> {
  const where: Prisma.UserWhereInput = {
    username: { equals: username, mode: 'insensitive' },
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  const count = await prisma.user.count({ where });
  return count > 0;
}

/**
 * Get user's assigned groups
 */
export async function getUserGroups(userId: string): Promise<{ group_id: string; group_name: string }[]> {
  const groups = await prisma.group.findMany({
    where: { leaderId: userId },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  return groups.map((g) => ({
    group_id: g.id,
    group_name: g.name,
  }));
}

/**
 * Assign user to group
 */
export async function assignToGroup(userId: string, groupId: string): Promise<void> {
  await prisma.$transaction([
    // Update user's primary group
    prisma.user.update({
      where: { id: userId },
      data: { groupId },
    }),
    // Also set user as group leader
    prisma.group.update({
      where: { id: groupId },
      data: { leaderId: userId },
    }),
  ]);
}

/**
 * Count users with filters
 */
export async function count(filters: UserFilters = {}): Promise<number> {
  const where: Prisma.UserWhereInput = {};

  if (filters.role) {
    const roles = Array.isArray(filters.role) ? filters.role : [filters.role];
    where.role = { in: roles };
  }

  if (filters.excludeSystemUsers !== false) {
    where.username = { notIn: SYSTEM_USERNAMES };
  }

  return prisma.user.count({ where });
}
