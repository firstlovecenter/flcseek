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

// Note: Total milestone count is now dynamic based on database records
// Calculate it as: milestones.length from the API response

