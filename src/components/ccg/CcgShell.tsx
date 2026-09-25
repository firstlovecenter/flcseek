'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  Building2,
  CalendarCheck,
  ChevronDown,
  ClipboardCheck,
  HandHeart,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  LogOut,
  Moon,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Sprout,
  Sun,
  Users,
  type LucideIcon,
  HeartHandshake,
  GraduationCap,
  Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Permission } from '@/lib/ccg/permissions'
import { availableApps } from '@/lib/app-routing'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SynagoLogo } from '@/components/shell/SynagoLogo'
import { useTheme } from '@/components/shell/ThemeProvider'
import { useCcgMe } from './CcgMeProvider'
import { LEVEL_LABEL, useCcgFocus, type Portal } from './CcgFocusProvider'
import { FocusPicker, PortalSwitcher, groupHref } from './synago'

/**
 * The City Church Group shell, laid out like Synago's: a collapsible labelled
 * sidebar (primary items, the church-in-focus picker and a link to that
 * group, secondary items, account menu) on desktop; a drawer behind a
 * floating toggle on mobile.
 */

/** `portals`: where the item appears (Sheep Seeking, City Church Groups, or both). */
type NavItem = { href: string; label: string; icon: LucideIcon; accent?: string; perm?: Permission | Permission[]; exact?: boolean; portals: Portal[]; campusOnly?: boolean }

const BOTH: Portal[] = ['seeking', 'ccg']
const SEEKING: Portal[] = ['seeking']
const CCG: Portal[] = ['ccg']

const PRIMARY: NavItem[] = [
  { href: '/ccg', label: 'Home', icon: LayoutDashboard, exact: true, accent: 'text-primary', portals: BOTH },
  { href: '/ccg/converts', label: 'Converts', icon: Sprout, perm: 'people.view', accent: 'text-members', portals: BOTH },
  { href: '/ccg/members', label: 'Members', icon: Users, perm: 'people.view', accent: 'text-members', portals: CCG },
  { href: '/ccg/approvals', label: 'Approvals', icon: ClipboardCheck, perm: 'placements.view', accent: 'text-primary', portals: SEEKING },
  { href: '/ccg/attendance', label: 'Attendance', icon: CalendarCheck, perm: 'attendance.mark', accent: 'text-arrivals', portals: BOTH },
  { href: '/ccg/graduated', label: 'Graduated', icon: GraduationCap, perm: 'reports.view', accent: 'text-success', portals: SEEKING },
]
const SECONDARY: NavItem[] = [
  { href: '/ccg/choose', label: 'Choose stream', icon: Building2, accent: 'text-primary', portals: BOTH, campusOnly: true },
  { href: '/ccg/groups', label: 'Groups', icon: Network, accent: 'text-churches', portals: CCG },
  { href: '/ccg/seekers', label: 'Sheep Seekers', icon: HeartHandshake, perm: 'reports.view', accent: 'text-members', portals: SEEKING },
  { href: '/ccg/activities', label: 'CCG activities', icon: HandHeart, perm: ['activities.record', 'reports.view'], accent: 'text-campaigns', portals: CCG },
  { href: '/ccg/milestones', label: 'Milestones', icon: Trophy, perm: 'settings.manage', accent: 'text-success', portals: BOTH },
  { href: '/ccg/links', label: 'Registration links', icon: Link2, perm: ['links.manage', 'links.intake'], accent: 'text-members', portals: BOTH },
  { href: '/ccg/account', label: 'Account', icon: KeyRound, portals: BOTH },
]

const W_OPEN = 240
const W_CLOSED = 60
const T = { duration: 0.2, ease: 'easeInOut' } as const

function useNav() {
  const { me, has } = useCcgMe()
  const { portal } = useCcgFocus()
  const leadsCampus = !!me?.roles.some((r) => r.unit?.type === 'campus')
  const pathname = usePathname()
  const visible = (i: NavItem) => (!i.campusOnly || leadsCampus) && i.portals.includes(portal ?? 'ccg') && (!i.perm || (Array.isArray(i.perm) ? i.perm.some((p) => has(p)) : has(i.perm)))
  const active = (i: NavItem) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`))
  return { primary: PRIMARY.filter(visible), secondary: SECONDARY.filter(visible), active }
}

function Label({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.12 }}
          className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden whitespace-nowrap"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function Item({ item, open, active, onNavigate, mobile }: { item: NavItem; open: boolean; active: boolean; onNavigate?: () => void; mobile?: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={item.label}
      title={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center rounded-lg px-2.5 text-sm font-medium transition-colors',
        mobile ? 'min-h-11 gap-2.5' : 'h-10 gap-3',
        active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
      )}
    >
      <Icon className={cn(mobile ? 'size-4' : 'size-5', 'shrink-0', active && item.accent)} />
      {mobile ? item.label : <Label open={open}>{item.label}</Label>}
    </Link>
  )
}

/** The group in focus, as a nav item (Synago's ChurchScopeNavItem). */
function FocusItem({ open, onNavigate, mobile }: { open: boolean; onNavigate?: () => void; mobile?: boolean }) {
  const { focus, portal } = useCcgFocus()
  const pathname = usePathname()
  // Group pages are City Church Groups; Sheep Seeking has its own pages.
  if (!focus?.id || focus.type === 'global' || portal === 'seeking') return null
  const href = groupHref(focus.type, focus.id)
  const label = (
    <>
      <span className="truncate font-medium">{focus.name}</span>
      <span className="shrink-0 rounded bg-sidebar-accent px-1 py-px text-[10px] text-sidebar-foreground/55">{LEVEL_LABEL[focus.type]}</span>
    </>
  )
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={`Open ${focus.name} ${LEVEL_LABEL[focus.type]}`}
      title={`${focus.name} ${LEVEL_LABEL[focus.type]}`}
      className={cn(
        'flex w-full items-center rounded-lg px-2.5 text-sm font-medium transition-colors',
        mobile ? 'min-h-11 gap-2.5' : 'h-10 gap-3',
        pathname.startsWith(href)
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
      )}
    >
      <Building2 className={cn(mobile ? 'size-4' : 'size-5', 'shrink-0 text-churches')} />
      {mobile ? <span className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">{label}</span> : <Label open={open}>{label}</Label>}
    </Link>
  )
}

function AccountMenu({ open, mobile }: { open: boolean; mobile?: boolean }) {
  const { me } = useCcgMe()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const name = me?.user.name ?? 'Account'
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const bothApps = availableApps(user).length > 1
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn('flex w-full items-center gap-2 overflow-hidden rounded-md text-left hover:bg-sidebar-accent/70', mobile ? 'px-1 py-1.5' : 'mb-1 px-1.5 py-1')}
          aria-label="Open account menu"
        >
          <Avatar className={cn('shrink-0 border border-sidebar-border/60', mobile ? 'size-8' : 'size-7')}>
            <AvatarFallback className="bg-sidebar-accent text-[11px] font-semibold text-sidebar-foreground">{initials}</AvatarFallback>
          </Avatar>
          {mobile ? (
            <div className="min-w-0">
              <p className="text-xs text-sidebar-foreground/60">Signed in as</p>
              <p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p>
            </div>
          ) : (
            <Label open={open}>
              <span className="truncate text-sm font-medium text-sidebar-foreground">{name}</span>
            </Label>
          )}
          {(open || mobile) && <ChevronDown className="ml-auto size-4 shrink-0 text-sidebar-foreground/60" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={toggleTheme}>
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/ccg/account')}>
          <KeyRound className="size-4" />
          Change password
        </DropdownMenuItem>
        {bothApps && (
          <DropdownMenuItem onSelect={() => router.push('/apps')}>
            <LayoutGrid className="size-4" />
            Switch app
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={async () => {
            await logout()
            router.push('/auth')
          }}
        >
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Brand({ open }: { open: boolean }) {
  const { portal } = useCcgFocus()
  return (
    <>
      <div className="relative flex size-7 shrink-0 items-center justify-center rounded-lg">
        {/* The portal's colour, glowing behind the logo; it shifts when the portal changes. */}
        <motion.span
          aria-hidden
          className="absolute -inset-2 rounded-full blur-md"
          animate={{ background: `radial-gradient(circle, hsl(var(--${portal === 'seeking' ? 'members' : 'churches'}) / 0.55), transparent 70%)` }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        />
        <span className="relative overflow-hidden rounded-lg">
          <SynagoLogo size={28} />
        </span>
      </div>
      <Label open={open}>
        <span className="flex flex-col">
          <span className="text-sm leading-tight font-semibold text-sidebar-foreground">{portal === 'seeking' ? 'Sheep Seeking' : 'City Church Group'}</span>
          <span className="text-xs text-sidebar-foreground/60">First Love Church</span>
        </span>
      </Label>
    </>
  )
}

function DesktopSidebar() {
  const [open, setOpen] = useState(true)
  const { primary, secondary, active } = useNav()
  return (
    <motion.div className="relative hidden h-full shrink-0 md:block" animate={{ width: (open ? W_OPEN : W_CLOSED) + 28 }} transition={T}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="absolute top-2 right-0 z-30 size-11 rounded-full border border-sidebar-border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
      >
        {open ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
      </Button>
      <motion.nav
        aria-label="City Church Group"
        className="absolute inset-y-0 left-0 flex flex-col overflow-y-hidden border-r border-sidebar-border bg-sidebar"
        animate={{ width: open ? W_OPEN : W_CLOSED }}
        transition={T}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border px-3.5">
          <Brand open={open} />
        </div>
        <div className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2 py-3">
          {primary.map((i) => (
            <Item key={i.href} item={i} open={open} active={active(i)} />
          ))}
          <div className="my-2 h-px bg-sidebar-border" />
          {open && <PortalSwitcher variant="sidebar" className="mb-2" />}
          {open && <FocusPicker variant="sidebar" className="mb-1" />}
          <FocusItem open={open} />
          {secondary.map((i) => (
            <Item key={i.href} item={i} open={open} active={active(i)} />
          ))}
        </div>
        <div className="shrink-0 border-t border-sidebar-border px-2 py-3">
          <AccountMenu open={open} />
        </div>
      </motion.nav>
    </motion.div>
  )
}

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { primary, secondary, active } = useNav()
  const { portal } = useCcgFocus()
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="ccg-sidebar flex w-72 flex-col border-r border-sidebar-border bg-sidebar p-0">
        <SheetHeader className="flex h-14 flex-row items-center gap-3 space-y-0 border-b border-sidebar-border px-4">
          <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <SynagoLogo size={28} />
          </div>
          <SheetTitle className="text-sm leading-tight font-semibold text-sidebar-foreground">
            {portal === 'seeking' ? 'Sheep Seeking' : 'City Church Group'}
            <span className="block text-xs font-normal text-sidebar-foreground/60">First Love Church</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-1 flex-col gap-px overflow-y-auto px-2 py-2 pb-24">
          {primary.map((i) => (
            <Item key={i.href} item={i} open active={active(i)} onNavigate={onClose} mobile />
          ))}
          <div className="my-1.5 h-px bg-sidebar-border" />
          <PortalSwitcher variant="sidebar" className="mb-2" />
          <FocusPicker variant="sidebar" className="mb-1" />
          <FocusItem open onNavigate={onClose} mobile />
          {secondary.map((i) => (
            <Item key={i.href} item={i} open active={active(i)} onNavigate={onClose} mobile />
          ))}
        </nav>
        <div className="absolute right-0 bottom-0 left-0 border-t border-sidebar-border px-4 py-3">
          <AccountMenu open mobile />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function CcgShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className="ccg-sidebar flex h-dvh overflow-hidden bg-background">
      <DesktopSidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="absolute top-3 right-3 z-20 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex size-11 items-center justify-center rounded-full border border-sidebar-border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          >
            {mobileOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </button>
        </div>
        <main id="ccg-main" className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] md:px-6 md:pt-6">
          {children}
        </main>
      </div>
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </div>
  )
}
