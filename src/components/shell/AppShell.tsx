'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { SynagoLogo } from '@/components/shell/SynagoLogo'
import {
  LogOut,
  Menu,
  RefreshCw,
  User,
  ChevronDown,
  LineChart,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import type { GroupApiData } from '@/lib/types/api-responses'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import {
  Sidebar,
  buildSuperAdminNav,
  MobileNavLink,
  type NavItem,
} from '@/components/shell/Sidebar'
import { Home, Users, UserPlus } from 'lucide-react'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { user, logout, token } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [groupInfo, setGroupInfo] = useState<{ name: string; year: number } | null>(null)

  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!user || !token) return
      if (user.role === 'superadmin') return

      if (user.role === 'leadpastor' || user.role === 'overseer') {
        const groupIdMatch = pathname.match(/^\/([a-f0-9-]{36})/)
        if (groupIdMatch) {
          try {
            const response = await api.groups.list({ active: true })
            if (response.success && response.data) {
              const groups: GroupApiData[] = response.data.groups || []
              const currentGroup = groups.find((g) => g.id === groupIdMatch[1])
              if (currentGroup) {
                setGroupInfo({ name: currentGroup.name, year: currentGroup.year })
                return
              }
            }
          } catch (error) {
            console.error('Failed to fetch group info:', error)
          }
        }
        setGroupInfo(null)
        return
      }

      if (user.group_name && user.group_year) {
        setGroupInfo({ name: user.group_name, year: user.group_year })
        return
      }

      try {
        const response = await api.groups.list()
        if (response.success && response.data) {
          const allGroups: GroupApiData[] = Array.isArray(response.data)
            ? response.data
            : (response.data as { groups?: GroupApiData[] })?.groups ?? []
          const userGroup = allGroups.find((g) => g.name === user.group_name)
          if (userGroup) {
            setGroupInfo({ name: userGroup.name, year: userGroup.year })
          }
        }
      } catch (error) {
        console.error('Failed to fetch group info:', error)
      }
    }

    fetchGroupInfo()
  }, [user, token, pathname])

  const getContextLabel = () => {
    if (user?.role === 'superadmin') return ''
    if (user?.role === 'leadpastor') {
      if (groupInfo) return `${groupInfo.name} ${groupInfo.year} · Lead Pastor`
      return 'Lead Pastor'
    }
    if (user?.role === 'overseer') {
      if (groupInfo) return `${groupInfo.name} ${groupInfo.year} · Overseer`
      return 'Overseer'
    }
    if (!groupInfo) return ''
    const roleText = user?.role === 'admin' ? 'Admin' : 'Tracker'
    return `${groupInfo.name} ${groupInfo.year} · ${roleText}`
  }

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.email ||
    'Account'

  const handleLogout = () => {
    logout()
    router.push('/auth')
  }

  const groupIdMatch = pathname.match(/^\/([a-f0-9-]{36})/)
  const groupIdFromPath = groupIdMatch?.[1]
  const canViewReports =
    user?.role === 'superadmin' ||
    user?.role === 'leadpastor' ||
    user?.role === 'overseer'

  const superAdminNav = buildSuperAdminNav()
  const mobileBottomNav: NavItem[] = [
    { href: '/superadmin', label: 'Home', icon: Home },
    { href: '/superadmin/users', label: 'Users', icon: Users },
    { href: '/superadmin/converts', label: 'Converts', icon: Users },
    { href: '/superadmin/groups', label: 'Groups', icon: UserPlus },
  ]

  if (canViewReports && groupIdFromPath) {
    mobileBottomNav.push({
      href: `/${groupIdFromPath}/reports`,
      label: 'Reports',
      icon: LineChart,
    })
  }

  const showSidebar = user?.role === 'superadmin'
  const navItems = showSidebar ? superAdminNav : []

  if (pathname === '/auth' || !user) {
    return <>{children}</>
  }

  const homeHref = user?.role === 'superadmin' ? '/superadmin' : '/'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {showSidebar && (
        <div className="hidden shrink-0 md:block">
          <Sidebar items={navItems} className="h-screen" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 safe-area-top">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {showSidebar && (
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <Sidebar
                    items={navItems}
                    className="h-full w-full border-0"
                  />
                </SheetContent>
              </Sheet>
            )}

            <Link href={homeHref} className="flex shrink-0 items-center gap-2">
              <SynagoLogo size={28} surface="auto" />
              <span className="hidden font-semibold tracking-tight sm:inline">
                Seek
              </span>
            </Link>

            {getContextLabel() && (
              <span className="hidden max-w-[280px] truncate rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground md:inline">
                {getContextLabel()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.reload()}
              aria-label="Refresh"
              className="hidden sm:inline-flex"
            >
              <RefreshCw className="size-4" />
            </Button>
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
                    {displayName}
                  </span>
                  <ChevronDown className="hidden size-3 opacity-50 sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {user?.role}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <User className="size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 safe-area-bottom">
          {children}
        </main>

        {user?.role === 'superadmin' && (
          <nav className="flex shrink-0 items-center justify-around border-t border-border bg-card px-2 py-2 md:hidden safe-area-bottom">
            {mobileBottomNav.map((item) => (
              <MobileNavLink
                key={item.href}
                item={item}
                active={
                  pathname === item.href ||
                  (item.href !== '/superadmin' &&
                    pathname.startsWith(item.href))
                }
              />
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
