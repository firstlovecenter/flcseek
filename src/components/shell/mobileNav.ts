import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Database,
  FileSpreadsheet,
  Home,
  LineChart,
  ListOrdered,
  ScrollText,
  UserPlus,
  Users,
} from 'lucide-react'

export type ShellNavItem = {
  id: string
  label: string
  href?: string
  icon: LucideIcon
  accent?: boolean
  matches?: (pathname: string) => boolean
}

export type NavUser = {
  role?: string
  group_id?: string
  groups_assigned?: unknown[]
} | null

const UUID_RE = /^\/([a-f0-9-]{36})/

export function groupIdFromPath(pathname: string): string | null {
  return pathname.match(UUID_RE)?.[1] ?? null
}

export function isNavItemActive(item: ShellNavItem, pathname: string): boolean {
  if (item.matches) return item.matches(pathname)
  if (!item.href) return false
  if (pathname === item.href) return true
  if (item.href === '/superadmin') return false
  return pathname.startsWith(item.href)
}

export function buildSuperAdminPrimaryNav(): ShellNavItem[] {
  return [
    {
      id: 'home',
      label: 'Home',
      href: '/superadmin',
      icon: Home,
      matches: (p) => p === '/superadmin',
    },
    { id: 'users', label: 'Users', href: '/superadmin/users', icon: Users },
    {
      id: 'converts',
      label: 'Converts',
      href: '/superadmin/converts',
      icon: Users,
    },
    {
      id: 'groups',
      label: 'Groups',
      href: '/superadmin/groups',
      icon: UserPlus,
    },
  ]
}

export function buildSuperAdminMoreNav(): ShellNavItem[] {
  return [
    {
      id: 'milestones',
      label: 'Milestones',
      href: '/superadmin/milestones',
      icon: ListOrdered,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      href: '/superadmin/analytics',
      icon: BarChart3,
    },
    {
      id: 'activity-logs',
      label: 'Activity logs',
      href: '/superadmin/activity-logs',
      icon: ScrollText,
    },
    {
      id: 'database',
      label: 'Database',
      href: '/superadmin/database',
      icon: Database,
    },
  ]
}

export function isSuperAdminMoreActive(pathname: string): boolean {
  return buildSuperAdminMoreNav().some((item) => isNavItemActive(item, pathname))
}

export function showGroupHome(user: NavUser): boolean {
  return (
    user?.role === 'leadpastor' ||
    user?.role === 'overseer' ||
    ((user?.role === 'admin' || user?.role === 'leader') &&
      (!user?.group_id || (user.groups_assigned?.length ?? 0) > 1))
  )
}

export function showGroupReports(user: NavUser): boolean {
  return (
    user?.role === 'superadmin' ||
    user?.role === 'leadpastor' ||
    user?.role === 'overseer'
  )
}

export function isRegisterRestricted(user: NavUser): boolean {
  return (
    user?.role === 'leader' ||
    user?.role === 'overseer' ||
    user?.role === 'leadpastor'
  )
}

export function buildGroupPrimaryNav(
  groupId: string,
  user: NavUser
): ShellNavItem[] {
  const items: ShellNavItem[] = [
    {
      id: 'milestones',
      label: 'Milestones',
      href: `/${groupId}`,
      icon: BarChart3,
      matches: (p) =>
        p === `/${groupId}` ||
        p.startsWith(`/${groupId}/person/`),
    },
    {
      id: 'attendance',
      label: 'Attendance',
      href: `/${groupId}/attendance`,
      icon: Users,
    },
  ]

  if (!isRegisterRestricted(user)) {
    items.push({
      id: 'register',
      label: 'Register',
      icon: UserPlus,
      accent: true,
    })
  }

  if (showGroupReports(user)) {
    items.push({
      id: 'reports',
      label: 'Reports',
      href: `/${groupId}/reports`,
      icon: LineChart,
    })
  }

  return items
}

export function buildGroupMoreNav(
  groupId: string,
  user: NavUser
): ShellNavItem[] {
  const items: ShellNavItem[] = []

  if (showGroupHome(user)) {
    items.push({ id: 'home', label: 'Home', href: '/', icon: Home })
  }

  if (!isRegisterRestricted(user)) {
    items.push({
      id: 'bulk-register',
      label: 'Bulk Register',
      href: `/${groupId}/people/bulk-register`,
      icon: FileSpreadsheet,
    })
  }

  return items
}

export function isGroupMoreActive(
  pathname: string,
  groupId: string,
  user: NavUser
): boolean {
  return buildGroupMoreNav(groupId, user).some((item) =>
    isNavItemActive(item, pathname)
  )
}

export const OPEN_REGISTER_EVENT = 'flcseek:open-register'

export function requestOpenRegister() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_REGISTER_EVENT))
  }
}
