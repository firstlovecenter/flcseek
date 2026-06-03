'use client'

import { useRouter } from 'next/navigation'
import { useRegisterModal } from '@/contexts/RegisterModalContext'
import {
  BarChart3,
  FileSpreadsheet,
  Home,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
type ActiveTab = 'milestones' | 'attendance' | 'register' | 'bulk-register' | 'reports'

type NavUser = {
  role?: string
  group_id?: string
  groups_assigned?: unknown[]
} | null

export function GroupNavActions({
  groupId,
  user,
  active,
  className,
}: {
  groupId: string
  user: NavUser
  active: ActiveTab
  className?: string
}) {
  const router = useRouter()
  const { openRegister } = useRegisterModal()
  const isRegisterRestricted =
    user?.role === 'leader' ||
    user?.role === 'overseer' ||
    user?.role === 'leadpastor'
  const showHome =
    user?.role === 'leadpastor' ||
    user?.role === 'overseer' ||
    ((user?.role === 'admin' || user?.role === 'leader') &&
      (!user?.group_id ||
        ((user as { groups_assigned?: unknown[] })?.groups_assigned?.length ??
          0) > 1))
  const showReports =
    user?.role === 'superadmin' ||
    user?.role === 'leadpastor' ||
    user?.role === 'overseer'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {showHome && (
        <Button variant="outline" size="sm" onClick={() => router.push('/')}>
          <Home className="size-4" />
          Home
        </Button>
      )}
      <Button
        variant={active === 'milestones' ? 'default' : 'outline'}
        size="sm"
        onClick={() => router.push(`/${groupId}`)}
      >
        <BarChart3 className="size-4" />
        Milestones
      </Button>
      <Button
        variant={active === 'attendance' ? 'default' : 'outline'}
        size="sm"
        onClick={() => router.push(`/${groupId}/attendance`)}
      >
        <Users className="size-4" />
        Attendance
      </Button>
      {!isRegisterRestricted && (
        <Button
          variant={active === 'register' ? 'default' : 'outline'}
          size="sm"
          onClick={() => openRegister()}
        >
          <UserPlus className="size-4" />
          Register
        </Button>
      )}
      {!isRegisterRestricted && (
        <Button
          variant={active === 'bulk-register' ? 'default' : 'outline'}
          size="sm"
          onClick={() => router.push(`/${groupId}/people/bulk-register`)}
        >
          <FileSpreadsheet className="size-4" />
          Bulk Register
        </Button>
      )}
      {showReports && (
        <Button
          variant={active === 'reports' ? 'default' : 'outline'}
          size="sm"
          onClick={() => router.push(`/${groupId}/reports`)}
        >
          <BarChart3 className="size-4" />
          Reports
        </Button>
      )}
    </div>
  )
}
