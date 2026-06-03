import { z } from 'zod';
import { ROLES } from '@/lib/constants';

/**
 * Server-side request schemas, shared as the single source of truth for API
 * input validation. Field names use the snake_case API contract.
 */

const phoneRegex = /^[0-9+\-\s()]+$/;

export const personCreateSchema = z.object({
  first_name: z.string().trim().min(1, 'first_name is required').max(100),
  last_name: z.string().trim().min(1, 'last_name is required').max(100),
  phone_number: z
    .string()
    .trim()
    .min(1, 'phone_number is required')
    .regex(phoneRegex, 'Invalid phone number'),
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
  residential_location: z.string().optional(),
  school_residential_location: z.string().optional(),
  occupation_type: z.string().optional(),
  address: z.string().optional(),
  group_id: z.string().uuid().optional(),
  group_name: z.string().optional(),
});

export type PersonCreateInput = z.infer<typeof personCreateSchema>;

const VALID_ROLES = [
  ROLES.SUPERADMIN,
  ROLES.LEADPASTOR,
  ROLES.OVERSEER,
  ROLES.ADMIN,
  ROLES.LEADER,
] as const;

export const userCreateSchema = z
  .object({
    username: z.string().trim().min(3).max(50).optional(),
    email: z.string().trim().email('Invalid email format').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(VALID_ROLES),
    first_name: z.string().trim().min(1, 'first_name is required'),
    last_name: z.string().trim().min(1, 'last_name is required'),
    phone_number: z.string().trim().optional(),
    group_name: z.string().optional(),
    group_id: z.string().uuid().optional(),
  })
  .refine((data) => !!data.username || !!data.email, {
    message: 'Either username or email is required',
    path: ['username'],
  })
  .refine((data) => data.role !== ROLES.LEADER || !!data.group_name || !!data.group_id, {
    message: 'Group assignment is required for the leader role',
    path: ['group_name'],
  });

export type UserCreateInput = z.infer<typeof userCreateSchema>;
