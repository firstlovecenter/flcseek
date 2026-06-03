'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Home,
  Users,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { CURRENT_YEAR } from '@/lib/constants'
import { message } from '@/lib/toast'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { EmptyState } from '@/components/base/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Group {
  id: string
  name: string
  description?: string
  year: number
  archived: boolean
  leader_name?: string
  member_count?: number
}

interface GroupsByYear {
  [year: number]: Group[]
}

function GroupCard({
  group,
  selected,
  onSelect,
}: {
  group: Group
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/40',
        selected && 'border-primary ring-2 ring-primary/10'
      )}
      onClick={() => onSelect(group.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{group.name}</p>
              <p className="text-xs text-muted-foreground">{group.year}</p>
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-primary" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            {group.member_count ?? 0}{' '}
            {group.member_count === 1 ? 'member' : 'members'}
          </span>
          {group.leader_name && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {group.leader_name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{group.leader_name}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function PageHeader() {
  return (
    <div className="border-b bg-card px-6 py-4">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <Home className="size-6 text-foreground" />
        <div>
          <h1 className="text-lg font-semibold">Select A Group</h1>
          <p className="text-xs text-muted-foreground">
            Choose a group to view milestone tracking and attendance
          </p>
        </div>
      </div>
    </div>
  )
}

function YearAccordionSection({
  year,
  groups,
  currentYear,
  selectedGroupId,
  onSelectGroup,
  defaultOpen,
}: {
  year: number
  groups: Group[]
  currentYear: number
  selectedGroupId: string | null
  onSelectGroup: (id: string) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? year === currentYear)

  return (
    <div className="mb-4 overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          className={cn('size-5 transition-transform', !open && '-rotate-90')}
        />
        <Calendar className="size-5 text-primary" />
        <span className="text-lg font-semibold">{year}</span>
        <Badge variant={year === currentYear ? 'default' : 'secondary'}>
          {groups.length} {groups.length === 1 ? 'group' : 'groups'}
        </Badge>
        {year === currentYear && (
          <Badge variant="outline" className="border-success/40 text-success">
            Current Year
          </Badge>
        )}
      </button>
      {open && (
        <div className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              selected={selectedGroupId === group.id}
              onSelect={onSelectGroup}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function RootPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR)
  const [availableYears, setAvailableYears] = useState<number[]>([])

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth')
        return
      }
      if (user.role === 'superadmin') {
        router.push('/superadmin')
        return
      }
      if (user.group_id) {
        router.push(`/${user.group_id}`)
        return
      }
      fetchGroups()
    }
  }, [user, authLoading, router])

  const fetchGroups = async () => {
    try {
      setLoading(true)
      const response = await api.groups.list({ active: true })
      if (!response.success) throw new Error('Failed to fetch groups')

      let fetchedGroups: Group[] = (response.data?.groups as Group[]) || []

      if (
        (user?.role === 'admin' || user?.role === 'leader') &&
        user?.group_name
      ) {
        fetchedGroups = fetchedGroups.filter(
          (g) => g.name.toLowerCase() === user.group_name!.toLowerCase()
        )
      }

      fetchedGroups.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year
        return a.name.localeCompare(b.name)
      })

      setAllGroups(fetchedGroups)
      const years = Array.from(
        new Set<number>(fetchedGroups.map((g) => Number(g.year)))
      ).sort((a, b) => b - a)
      setAvailableYears(years)
      filterGroupsByYear(fetchedGroups, selectedYear)
    } catch (error: unknown) {
      console.error('Failed to fetch groups:', error)
      message.error('Failed to load groups')
    } finally {
      setLoading(false)
    }
  }

  const filterGroupsByYear = useCallback((groupsToFilter: Group[], year: number) => {
    setGroups(groupsToFilter.filter((g) => g.year === year))
  }, [])

  useEffect(() => {
    if (allGroups.length > 0) {
      filterGroupsByYear(allGroups, selectedYear)
    }
  }, [selectedYear, allGroups, filterGroupsByYear])

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId)
    setTimeout(() => router.push(`/${groupId}`), 300)
  }

  const monthOrder: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  }

  const groupsByYear: GroupsByYear = allGroups.reduce((acc: GroupsByYear, group) => {
    if (!acc[group.year]) acc[group.year] = []
    acc[group.year].push(group)
    return acc
  }, {} as GroupsByYear)

  Object.keys(groupsByYear).forEach((year) => {
    groupsByYear[parseInt(year, 10)].sort((a, b) => {
      const aOrder = monthOrder[a.name.toLowerCase()] || 999
      const bOrder = monthOrder[b.name.toLowerCase()] || 999
      return aOrder - bOrder
    })
  })

  const sortedYears = Object.keys(groupsByYear)
    .map(Number)
    .sort((a, b) => b - a)

  if (authLoading || loading) {
    return <LoadingScreen label="Loading groups…" />
  }

  if (!user) return null

  if (user.role === 'leadpastor' || user.role === 'overseer') {
    return (
      <div className="min-h-screen bg-muted/30">
        <PageHeader />
        <div className="px-2 py-8 sm:px-4">
          {sortedYears.length === 0 ? (
            <EmptyState title="No groups found" />
          ) : (
            sortedYears.map((year) => (
              <YearAccordionSection
                key={year}
                year={year}
                groups={groupsByYear[year]}
                currentYear={CURRENT_YEAR}
                selectedGroupId={selectedGroupId}
                onSelectGroup={handleSelectGroup}
                defaultOpen={year === CURRENT_YEAR}
              />
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <PageHeader />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">Select Your Group</h2>
          <p className="mt-2 text-muted-foreground">
            Choose which group and year you want to manage
          </p>
          {availableYears.length > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <span className="text-sm">Filter by Year:</span>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {groups.length === 0 ? (
          <EmptyState
            title={`No groups found for year ${selectedYear}`}
            description="Try selecting a different year"
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                selected={selectedGroupId === group.id}
                onSelect={handleSelectGroup}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
