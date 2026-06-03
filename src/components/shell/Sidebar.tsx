'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SynagoLogo } from '@/components/shell/SynagoLogo'
import {
  Home,
  Users,
  UserPlus,
  ListOrdered,
  LineChart,
  Database,
  ScrollText,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export function buildSuperAdminNav(): NavItem[] {
  return [
    { href: '/superadmin', label: 'Dashboard', icon: Home },
    { href: '/superadmin/users', label: 'Users', icon: Users },
    { href: '/superadmin/groups', label: 'Groups', icon: UserPlus },
    { href: '/superadmin/milestones', label: 'Milestones', icon: ListOrdered },
    { href: '/superadmin/converts', label: 'New converts', icon: Users },
    { href: '/superadmin/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/superadmin/activity-logs', label: 'Activity logs', icon: ScrollText },
    { href: '/superadmin/database', label: 'Database', icon: Database },
  ]
}

export function Sidebar({
  items,
  className,
}: {
  items: NavItem[]
  className?: string
}) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <SynagoLogo size={28} surface="dark" />
        <span className="font-semibold tracking-tight">Seek</span>
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/superadmin' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}

export function MobileNavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
        active ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <Icon className="size-5" />
      <span className="max-w-[4rem] truncate">{item.label.split(' ')[0]}</span>
    </Link>
  )
}

export { LineChart }
