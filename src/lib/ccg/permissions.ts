/**
 * CCG permissions. Roles (ccg_roles rows) are named bundles of these; routes
 * check a permission against the user's scope, never a role name — so a new
 * role is just a new row.
 */
export const PERMISSIONS = {
  'structure.manage': 'Create, edit and remove councils, CCGs and CCFs',
  'units.edit': 'Edit CCFs (details, meeting time, capacity) in scope',
  'people.view': 'See members and converts in scope',
  'people.manage': 'Add and edit members and converts, and their answers, in scope',
  'members.confirm': 'Confirm self-registered members in scope',
  'links.manage': 'Create and revoke member registration links for CCFs in scope',
  'links.intake': 'Create and revoke church-wide convert intake links',
  'placements.view': 'See placements and proposals in scope',
  'placements.approve': 'Approve, remap and hold proposed placements',
  'milestones.update': 'Record milestone progress for placed converts in scope',
  'attendance.mark': 'Mark Sunday and fellowship attendance for placed converts in scope',
  'activities.record': 'Log CCG activities (intercession, fellowship over food) for CCGs in scope',
  'checkins.record': 'Record check-ins for placed converts in scope',
  'reports.view': 'See dashboards and reports for units in scope',
  'settings.manage': 'Matching settings, question bank, zones and milestones',
  'roles.manage': 'Create roles and assign them to users',
} as const

export type Permission = keyof typeof PERMISSIONS
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[]

export function isPermission(v: unknown): v is Permission {
  return typeof v === 'string' && v in PERMISSIONS
}

export const SCOPE_LEVELS = ['global', 'stream', 'council', 'ccg', 'ccf'] as const
export type ScopeLevel = (typeof SCOPE_LEVELS)[number]
