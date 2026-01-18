// User roles in hierarchical order
export const ROLES = {
  SUPERADMIN: 'superadmin',
  LEADPASTOR: 'leadpastor',
  ADMIN: 'admin',
  LEADER: 'leader',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// Note: Milestones have been moved to the database (milestones table)
// Fetch milestones dynamically using /api/milestones endpoint
// This ensures milestones can be managed by superadmin without code changes

export const ATTENDANCE_GOAL = 20;

// Year-related constants
export const CURRENT_YEAR = new Date().getFullYear();
export const MIN_YEAR = 2025; // Minimum year for group filtering
export const MAX_YEAR = CURRENT_YEAR + 1; // Allow creating groups for next year

// Group filters
export const GROUP_FILTERS = {
  ALL: 'all',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;

export type GroupFilter = typeof GROUP_FILTERS[keyof typeof GROUP_FILTERS];

// Note: Total milestone count is now dynamic based on database records
// Calculate it as: milestones.length from the API response

