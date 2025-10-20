// User roles in hierarchical order
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  LEAD_PASTOR: 'lead_pastor',
  STREAM_LEADER: 'stream_leader',
  SHEEP_SEEKER: 'sheep_seeker',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// Role permissions
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: {
    canViewAll: true,
    canManageStreams: true,
    canManageUsers: true,
    canManageGroups: true,
    canGenerateReports: true,
    canManageMilestones: true,
  },
  [ROLES.LEAD_PASTOR]: {
    canViewAll: true,
    canManageStreams: false,
    canManageUsers: false,
    canManageGroups: false,
    canGenerateReports: true, // View-only reports
    canManageMilestones: false,
  },
  [ROLES.STREAM_LEADER]: {
    canViewAll: false, // Only their stream
    canManageStreams: false,
    canManageUsers: true, // Within their stream
    canManageGroups: true, // Within their stream
    canGenerateReports: true, // For their stream
    canManageMilestones: false,
  },
  [ROLES.SHEEP_SEEKER]: {
    canViewAll: false, // Only their group
    canManageStreams: false,
    canManageUsers: false,
    canManageGroups: false,
    canGenerateReports: false,
    canManageMilestones: false,
  },
};

export const PROGRESS_STAGES = [
  { number: 1, name: 'Registered as Church Member' },
  { number: 2, name: 'Visited (First Quarter)' },
  { number: 3, name: 'Visited (Second Quarter)' },
  { number: 4, name: 'Visited (Third Quarter)' },
  { number: 5, name: 'Completed New Believers School' },
  { number: 6, name: 'Baptized in Water' },
  { number: 7, name: 'Baptized in the Holy Ghost' },
  { number: 8, name: 'Completed Soul-Winning School' },
  { number: 9, name: 'Invited Friend to Church' },
  { number: 10, name: 'Joined Basonta or Creative Arts' },
  { number: 11, name: 'Introduced to Lead Pastor' },
  { number: 12, name: 'Introduced to First Love Mother' },
  { number: 13, name: 'Attended All-Night Prayer' },
  { number: 14, name: 'Attended Meeting God' },
  { number: 15, name: 'Attended Federal Event' },
  { number: 16, name: 'Completed Seeing & Hearing Education' },
  { number: 17, name: 'Interceded For (3+ Hours)' },
  { number: 18, name: 'Attended 12 Sunday Services' }
];

export const ATTENDANCE_GOAL = 12; // Updated from 26 to 12
export const TOTAL_PROGRESS_STAGES = 18;

// Group lifecycle in months
export const GROUP_LIFECYCLE_MONTHS = 6;
