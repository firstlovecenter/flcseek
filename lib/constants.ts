// User roles in hierarchical order
export const ROLES = {
  SUPERADMIN: 'superadmin',      // Full access - just you
  LEADPASTOR: 'leadpastor',      // View only access to all
  ADMIN: 'admin',                 // Edit access for assigned month
  LEADER: 'leader',               // View only access for assigned month
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// Role permissions
export const ROLE_PERMISSIONS = {
  [ROLES.SUPERADMIN]: {
    canViewAll: true,
    canEdit: true,
    canManageUsers: true,
    canManageGroups: true,
    canGenerateReports: true,
    canManageMilestones: true,
  },
  [ROLES.LEADPASTOR]: {
    canViewAll: true,
    canEdit: false,              // View only
    canManageUsers: false,
    canManageGroups: false,
    canGenerateReports: true,
    canManageMilestones: false,
  },
  [ROLES.ADMIN]: {
    canViewAll: false,            // Only their assigned month
    canEdit: true,                // Can edit within their month
    canManageUsers: false,
    canManageGroups: false,
    canGenerateReports: true,     // For their month
    canManageMilestones: false,
  },
  [ROLES.LEADER]: {
    canViewAll: false,            // Only their assigned month
    canEdit: false,               // View only
    canManageUsers: false,
    canManageGroups: false,
    canGenerateReports: false,
    canManageMilestones: false,
  },
};

export const PROGRESS_STAGES = [
  { number: 1, name: 'Registered as Church Member', shortName: 'Registered' },
  { number: 2, name: 'Visited (First Quarter)', shortName: 'First\nVisit' },
  { number: 3, name: 'Visited (Second Quarter)', shortName: 'Second\nVisit' },
  { number: 4, name: 'Visited (Third Quarter)', shortName: 'Third\nVisit' },
  { number: 5, name: 'Completed New Believers School', shortName: 'NB\nSchool' },
  { number: 6, name: 'Baptized in Water', shortName: 'Water\nBaptism' },
  { number: 7, name: 'Baptized in the Holy Ghost', shortName: 'HG\nBaptism' },
  { number: 8, name: 'Completed Soul-Winning School', shortName: 'SW\nSchool' },
  { number: 9, name: 'Invited Friend to Church', shortName: 'Friend\nInvited' },
  { number: 10, name: 'Joined Basonta or Creative Arts', shortName: 'Joined\nBasonta' },
  { number: 11, name: 'Introduced to Lead Pastor', shortName: 'LP\nIntro' },
  { number: 12, name: 'Introduced to First Love Mother', shortName: 'Mother\nIntro' },
  { number: 13, name: 'Attended All-Night Prayer', shortName: 'All\nNight' },
  { number: 14, name: 'Attended Meeting God', shortName: 'Meeting\nGod' },
  { number: 15, name: 'Attended Federal Event', shortName: 'Federal\nEvent' },
  { number: 16, name: 'Completed Seeing & Hearing Education', shortName: 'Seeing &\nHearing' },
  { number: 17, name: 'Interceded For (3+ Hours)', shortName: 'Interceded\n3+Hrs' },
  { number: 18, name: 'Attended 20 Sunday Services', shortName: 'Attendance' }
];

export const ATTENDANCE_GOAL = 20; // 20 Sunday services
export const TOTAL_PROGRESS_STAGES = 18;

// Group lifecycle in months
export const GROUP_LIFECYCLE_MONTHS = 12; // Changed from 6 to 12 months (1 year cycle)
