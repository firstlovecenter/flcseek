'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { SynagoLogo } from '@/components/shell/SynagoLogo'
import { LogOut, RefreshCw, User, ChevronDown, LayoutGrid } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import type { GroupApiData } from '@/lib/types/api-responses'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import { TabBar } from '@/components/shell/TabBar'
import { IconRail } from '@/components/shell/IconRail'
import { MoreNavSheet } from '@/components/shell/MoreNavSheet'
import { availableApps } from '@/lib/app-routing'
import {
  buildCcgMoreNav,
  buildCcgPrimaryNav,
  isCcgMoreActive,
  isCcgPath,
  buildGroupMoreNav,
  buildGroupPrimaryNav,
  buildSuperAdminMoreNav,
  buildSuperAdminPrimaryNav,
  groupIdFromPath,
  isGroupMoreActive,
  isSuperAdminMoreActive,
} from '@/components/shell/mobileNav'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { user, logout, token } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const [groupInfo, setGroupInfo] = useState<{ name: string; year: number } | null>(null)

  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!user || !token) return
      if (!user.role || isCcgPath(pathname)) return
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

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const inCcg = isCcgPath(pathname)

  const getContextLabel = () => {
    if (inCcg) return ''
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

  // Self-registration forms are public and stand alone, even for a signed-in user.
  if (
    pathname === '/auth' ||
    pathname === '/forgot-password' ||
    ['/join/', '/welcome/', '/reset-password/'].some((p) => pathname.startsWith(p)) ||
    // City Church Group has its own shell (Synago-style sidebar), rendered by its layout.
    inCcg ||
    !user
  ) {
    return <>{children}</>
  }

  const isSuperAdmin = !inCcg && user.role === 'superadmin'
  const groupId = inCcg ? null : groupIdFromPath(pathname)
  const showGroupTabBar = !inCcg && !isSuperAdmin && !!groupId
  const showRail = inCcg || isSuperAdmin
  const hasBothApps = availableApps(user).length > 1

  let primaryItems = groupId ? buildGroupPrimaryNav(groupId, user) : []
  let moreItems = groupId ? buildGroupMoreNav(groupId, user) : []
  let moreActive = groupId ? isGroupMoreActive(pathname, groupId, user) : false
  if (inCcg) {
    primaryItems = buildCcgPrimaryNav()
    moreItems = buildCcgMoreNav(user)
    moreActive = isCcgMoreActive(pathname, user)
  } else if (isSuperAdmin) {
    primaryItems = buildSuperAdminPrimaryNav()
    moreItems = buildSuperAdminMoreNav()
    moreActive = isSuperAdminMoreActive(pathname)
  }

  const showMobileTabBar = showRail || showGroupTabBar
  const homeHref = inCcg ? '/ccg' : isSuperAdmin ? '/superadmin' : '/'
  const appName = inCcg ? 'City Church Group' : 'Seek'
  const roleLabel = inCcg ? 'City Church Group' : user.role

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {showRail && (
        <IconRail
          items={primaryItems}
          pathname={pathname}
          moreActive={moreActive}
          moreOpen={moreOpen}
          onMoreClick={() => setMoreOpen(true)}
          onLogout={handleLogout}
          homeHref={homeHref}
          homeLabel={`${appName} home`}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 safe-area-top">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href={homeHref} className="flex shrink-0 items-center gap-2">
              <SynagoLogo size={28} surface="auto" />
              <span className="hidden font-semibold tracking-tight sm:inline">
                {appName}
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
                      {roleLabel}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <User className="size-4" />
                  Profile
                </DropdownMenuItem>
                {hasBothApps && (
                  <DropdownMenuItem onClick={() => router.push('/apps')}>
                    <LayoutGrid className="size-4" />
                    Switch app
                  </DropdownMenuItem>
                )}
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

        <main
          className={cn(
            'flex-1 overflow-y-auto p-4 md:p-6',
            showMobileTabBar
              ? 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-6'
              : 'safe-area-bottom'
          )}
        >
          {children}
        </main>
      </div>

      {showMobileTabBar && (
        <TabBar
          items={primaryItems}
          pathname={pathname}
          moreActive={moreActive}
          moreOpen={moreOpen}
          onMoreClick={() => setMoreOpen(true)}
          showMore={moreItems.length > 0}
        />
      )}

      <MoreNavSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        items={moreItems}
        pathname={pathname}
        title="More"
        desktopBesideRail={showRail}
      />
    </div>
  )
}
