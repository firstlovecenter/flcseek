'use client'

import {
  useEffect,
  useState,
  useCallback,
  memo,
  useMemo,
  Suspense,
} from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
} from 'lucide-react'
import { SynagoLoader } from '@/components/shell/SynagoLoader'
import type { Key } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useThemeStyles } from '@/lib/theme-utils'
import { api } from '@/lib/api'
import { useGroupYears } from '@/hooks/use-group-years'
import { canAccessGroupClient } from '@/lib/group-access'
import { expandCompletedStages } from '@/lib/progress-utils'
import { formatMilestonesForDisplay } from '@/lib/milestone-display'
import type { MilestoneData } from '@/lib/types/api-responses'
import { getErrorMessage } from '@/lib/utils/errors'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { EmptyState } from '@/components/base/EmptyState'
import { GroupNavActions } from '@/components/group/GroupNavActions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface PersonWithProgress {
  id: string
  full_name: string
  group_name: string
  group_year?: number
  phone_number: string
  progress: Array<{ stage_number: number; is_completed: boolean }>
}

type Milestone = {
  number: number
  name: string
  shortName: string
  description?: string
  isAutoCalculated: boolean
}

const milestoneSwitchClassName =
  'data-[state=checked]:bg-success data-[state=unchecked]:bg-destructive'

const MilestoneCell = memo(function MilestoneCell({
  isCompleted,
  isUpdating,
  onToggle,
  stageName,
  isAuto = false,
}: {
  isCompleted: boolean
  isUpdating: boolean
  onToggle: () => void
  stageName: string
  isAuto?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex min-h-6 items-center justify-center p-1">
          <Switch
            checked={isCompleted}
            disabled={isAuto}
            onCheckedChange={onToggle}
            className={cn(
              milestoneSwitchClassName,
              isUpdating && 'opacity-50'
            )}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {isAuto ? `${stageName} (Auto-calculated)` : stageName}
      </TooltipContent>
    </Tooltip>
  )
})

const ReadOnlyMilestoneCell = memo(function ReadOnlyMilestoneCell({
  isCompleted,
  stageName,
}: {
  isCompleted: boolean
  stageName: string
}) {
  const themeStyles = useThemeStyles()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex min-h-6 items-center justify-center rounded text-[10px] font-bold text-white"
          style={{
            backgroundColor: isCompleted
              ? themeStyles.success
              : themeStyles.error,
          }}
        >
          {isCompleted ? '✓' : '✗'}
        </div>
      </TooltipTrigger>
      <TooltipContent>{stageName}</TooltipContent>
    </Tooltip>
  )
})

const PersonProgressCard = memo(function PersonProgressCard({
  person,
  milestones,
  isReadOnly,
  updating,
  onToggle,
  onOpenPerson,
  selectable,
  selected,
  onSelectChange,
}: {
  person: PersonWithProgress
  milestones: Milestone[]
  isReadOnly: boolean
  updating: string | null
  onToggle: (
    personId: string,
    stageNumber: number,
    currentStatus: boolean
  ) => void
  onOpenPerson: (id: string) => void
  selectable: boolean
  selected: boolean
  onSelectChange: (id: string, checked: boolean) => void
}) {
  const themeStyles = useThemeStyles()
  const [expanded, setExpanded] = useState(false)

  const statusOf = (stageNumber: number) =>
    person.progress.find((p) => p.stage_number === stageNumber)?.is_completed ||
    false

  const sorted = [...milestones].sort((a, b) => a.number - b.number)
  const completed = sorted.filter((m) => statusOf(m.number)).length
  const total = sorted.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const upcoming = sorted.filter((m) => !statusOf(m.number))
  const visible = expanded ? sorted : upcoming.slice(0, 3)

  return (
    <Card className="mb-3">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-3">
          {selectable && (
            <Checkbox
              checked={selected}
              onCheckedChange={(c) => onSelectChange(person.id, !!c)}
            />
          )}
          <div
            className="relative flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-success/40 text-xs font-bold"
            style={{
              background: `conic-gradient(hsl(var(--success)) ${pct}%, hsl(var(--muted)) 0)`,
            }}
          >
            <span className="rounded-full bg-card px-1">{pct}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="truncate text-left text-sm font-semibold text-foreground hover:underline"
              onClick={() => onOpenPerson(person.id)}
            >
              {person.full_name}
            </button>
            <p className="text-xs text-muted-foreground">
              {completed} of {total} milestones complete
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {upcoming.length === 0 && !expanded ? (
            <div
              className="flex min-h-11 items-center justify-center rounded-lg border text-sm font-semibold"
              style={{
                background: themeStyles.successBg,
                borderColor: themeStyles.successBorder,
                color: themeStyles.success,
              }}
            >
              All milestones complete
            </div>
          ) : (
            visible.map((m) => {
              const done = statusOf(m.number)
              const isUpdating = updating === `${person.id}-${m.number}`
              const editable = !isReadOnly && !m.isAutoCalculated
              const row = (
                <div
                  onClick={
                    editable
                      ? () => onToggle(person.id, m.number, done)
                      : undefined
                  }
                  className={cn(
                    'flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-1.5',
                    editable && 'cursor-pointer',
                    m.isAutoCalculated && 'opacity-70'
                  )}
                  style={{
                    background: done
                      ? themeStyles.successBg
                      : themeStyles.errorBg,
                    borderColor: done
                      ? themeStyles.successBorder
                      : themeStyles.errorBorder,
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      M{m.number.toString().padStart(2, '0')}
                    </Badge>
                    <span className="truncate text-sm">{m.name}</span>
                  </span>
                  {isUpdating ? (
                    <SynagoLoader size={20} inline />
                  ) : (
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{
                        background: done
                          ? themeStyles.success
                          : themeStyles.error,
                      }}
                    >
                      {done ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              )
              return (
                <div key={m.number}>
                  {m.isAutoCalculated ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{row}</TooltipTrigger>
                      <TooltipContent>{m.name} (auto-calculated)</TooltipContent>
                    </Tooltip>
                  ) : (
                    row
                  )}
                </div>
              )
            })
          )}
        </div>

        {total > 0 && (
          <Button
            variant="link"
            className="mt-1 w-full"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show fewer' : `Show all ${total} milestones`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
})

export default function SheepSeekerDashboard() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading dashboard…" />}>
      <SheepSeekerDashboardContent />
    </Suspense>
  )
}

function SheepSeekerDashboardContent() {
  const { user, token, loading: authLoading } = useAuth()
  const { confirm, ConfirmDialog } = useConfirm()
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string

  const [people, setPeople] = useState<PersonWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const { groupName, defaultYear, loading: yearsLoading, error: yearsError } = useGroupYears(
    groupId,
    !!(user && token)
  )
  const [isMobile, setIsMobile] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Key[]>([])
  const [deleting, setDeleting] = useState(false)
  const [mobileVisible, setMobileVisible] = useState(30)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (defaultYear != null) {
      setSelectedYear((prev) => prev ?? defaultYear)
    }
  }, [defaultYear])

  useEffect(() => {
    if (yearsError) {
      message.error(
        `Failed to load group information: ${yearsError}. Redirecting to home...`
      )
      router.push('/')
    }
  }, [yearsError, router])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
      return
    }
    if (authLoading || !user) return

    const orgRoles = ['superadmin', 'leadpastor', 'overseer']
    if (orgRoles.includes(user.role || '')) return

    // Wait for month name when primary group_id differs (multi-year access)
    if (user.group_id === groupId) return
    if (yearsLoading) return

    if (!canAccessGroupClient(user, groupId, groupName)) {
      message.error('Unauthorized access to this group')
      router.push('/')
    }
  }, [user, authLoading, router, groupId, groupName, yearsLoading])

  const loadBundle = useCallback(
    async (year: number) => {
      try {
        setLoading(true)
        const response = await api.groups.bundle(groupId, { year })
        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to load dashboard')
        }
        const milestoneData =
          (response.data?.milestones as MilestoneData[]) || []
        const formatted = formatMilestonesForDisplay(milestoneData)
        setMilestones(formatted)
        const stageNumbers = formatted.map((m) => m.number)
        const rows =
          (response.data?.people as Array<{
            id: string
            full_name: string
            group_name?: string
            group_year?: number
            phone_number: string
            completed_stages: number[]
          }>) || []
        setPeople(
          rows.map((p) => ({
            id: p.id,
            full_name: p.full_name,
            group_name: p.group_name ?? '',
            group_year: p.group_year,
            phone_number: p.phone_number,
            progress: expandCompletedStages(p.completed_stages, stageNumbers),
          }))
        )
      } catch (error: unknown) {
        message.error(getErrorMessage(error) || 'Failed to load people')
      } finally {
        setLoading(false)
      }
    },
    [groupId]
  )

  useEffect(() => {
    if (user && token && selectedYear && groupId) {
      loadBundle(selectedYear)
    }
  }, [user, token, selectedYear, groupId, loadBundle])

  useEffect(() => {
    const onRegistered = () => {
      if (user && token && selectedYear && groupId) {
        loadBundle(selectedYear)
      }
    }
    window.addEventListener('flcseek:convert-registered', onRegistered)
    return () =>
      window.removeEventListener('flcseek:convert-registered', onRegistered)
  }, [user, token, selectedYear, groupId, loadBundle])

  const toggleMilestone = useCallback(
    async (
      personId: string,
      stageNumber: number,
      currentStatus: boolean
    ) => {
      const milestone = milestones.find((m) => m.number === stageNumber)
      if (milestone?.isAutoCalculated) {
        message.warning(
          `${milestone.name} is auto-calculated and cannot be toggled manually`
        )
        return
      }
      setUpdating(`${personId}-${stageNumber}`)
      try {
        const response = await api.progress.update(personId, {
          stage_number: stageNumber,
          is_completed: !currentStatus,
        })
        if (!response.success) throw new Error('Failed to update milestone')
        setPeople((prev) =>
          prev.map((person) => {
            if (person.id !== personId) return person
            const stageExists = person.progress.some(
              (p) => p.stage_number === stageNumber
            )
            if (stageExists) {
              return {
                ...person,
                progress: person.progress.map((p) =>
                  p.stage_number === stageNumber
                    ? { ...p, is_completed: !currentStatus }
                    : p
                ),
              }
            }
            return {
              ...person,
              progress: [
                ...person.progress,
                { stage_number: stageNumber, is_completed: !currentStatus },
              ],
            }
          })
        )
        message.success('Milestone updated!')
      } catch (error: unknown) {
        message.error(getErrorMessage(error) || 'Failed to update milestone')
      } finally {
        setUpdating(null)
      }
    },
    [milestones]
  )

  const getMilestoneStatus = useCallback(
    (person: PersonWithProgress, stageNumber: number) => {
      return (
        person.progress.find((p) => p.stage_number === stageNumber)
          ?.is_completed || false
      )
    },
    []
  )

  const isReadOnly =
    user?.role === 'leader' ||
    user?.role === 'overseer' ||
    user?.role === 'leadpastor'
  const canDeleteConverts =
    user?.role === 'admin' ||
    user?.role === 'overseer' ||
    user?.role === 'leadpastor' ||
    user?.role === 'superadmin'

  const filteredPeople = useMemo(() => {
    const list = !searchText
      ? people
      : people.filter((p) => {
          const term = searchText.toLowerCase()
          return (
            p.full_name?.toLowerCase().includes(term) ||
            p.phone_number?.toLowerCase().includes(term)
          )
        })
    return [...list].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [people, searchText])

  const paginatedPeople = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredPeople.slice(start, start + pageSize)
  }, [filteredPeople, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredPeople.length / pageSize))

  const handleBulkDelete = useCallback(async () => {
    if (!selectedIds.length) {
      message.warning('Select at least one convert to delete')
      return
    }
    const ok = await confirm({
      title: 'Delete selected converts?',
      description: `This will soft delete ${selectedIds.length} selected convert(s). Their records will be preserved but hidden from active views.`,
      confirmLabel: 'Delete Selected',
      destructive: true,
    })
    if (!ok) return
    try {
      setDeleting(true)
      const response = await api.post('/bulk-actions', {
        action: 'delete',
        convertIds: selectedIds,
        groupId,
      })
      if (!response.success) {
        throw new Error(
          response.error?.message || 'Failed to delete selected converts'
        )
      }
      const result = response.data as { successCount?: number }
      message.success(`Deleted ${result?.successCount ?? 0} convert(s)`)
      setSelectedIds([])
      if (selectedYear) loadBundle(selectedYear)
    } catch (error: unknown) {
      message.error(
        getErrorMessage(error) || 'Failed to delete selected converts'
      )
    } finally {
      setDeleting(false)
    }
  }, [selectedIds, groupId, selectedYear, loadBundle, confirm])

  const totalPeople = filteredPeople.length
  const incomplete = filteredPeople.filter(
    (p) => p.progress.filter((pr) => pr.is_completed).length < milestones.length
  ).length
  const totalCells = totalPeople * milestones.length
  const completedCells = filteredPeople.reduce(
    (sum, p) => sum + p.progress.filter((pr) => pr.is_completed).length,
    0
  )
  const pct = totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? paginatedPeople.map((p) => p.id) : [])
  }

  if (authLoading || loading) {
    return <LoadingScreen label="Loading dashboard…" />
  }
  if (!user) return null

  return (
    <TooltipProvider>
      {ConfirmDialog}
      <div className="px-4 py-4 md:px-6">
        <div className="sticky-controls-bar mb-4 flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-full sm:w-[250px]">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone..."
              className="pl-9"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <GroupNavActions groupId={groupId} user={user} active="milestones" />
          {canDeleteConverts && selectedIds.length > 0 && (
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleBulkDelete}
            >
              <Trash2 className="size-4" />
              Delete Selected ({selectedIds.length})
            </Button>
          )}
        </div>

        <Card className="mb-4">
          <CardContent className="p-5">
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-xs text-muted-foreground">Total converts</p>
                <p className="text-3xl font-bold tabular-nums">{totalPeople}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Incomplete</p>
                <p className="text-3xl font-bold tabular-nums">{incomplete}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overall progress</p>
                <p className="text-3xl font-bold tabular-nums">{pct}%</p>
              </div>
            </div>
            <Progress
              value={pct}
              className="mt-4 h-2 [&>div]:bg-success"
            />
          </CardContent>
        </Card>

        {isMobile ? (
          <div>
            {filteredPeople.length === 0 ? (
              <EmptyState title="No people found" />
            ) : (
              <>
                {filteredPeople.slice(0, mobileVisible).map((person) => (
                  <PersonProgressCard
                    key={person.id}
                    person={person}
                    milestones={milestones}
                    isReadOnly={isReadOnly}
                    updating={updating}
                    onToggle={toggleMilestone}
                    onOpenPerson={(id) =>
                      router.push(`/${groupId}/person/${id}`)
                    }
                    selectable={canDeleteConverts}
                    selected={selectedIds.includes(person.id)}
                    onSelectChange={(id, checked) =>
                      setSelectedIds((prev) =>
                        checked
                          ? [...prev, id]
                          : prev.filter((k) => k !== id)
                      )
                    }
                  />
                ))}
                {filteredPeople.length > mobileVisible && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setMobileVisible((v) => v + 30)}
                  >
                    Show more ({filteredPeople.length - mobileVisible} more)
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {canDeleteConverts && (
                    <TableHead className="sticky left-0 z-20 w-10 bg-card px-1">
                      <Checkbox
                        checked={
                          paginatedPeople.length > 0 &&
                          paginatedPeople.every((p) =>
                            selectedIds.includes(p.id)
                          )
                        }
                        onCheckedChange={(c) => toggleSelectAll(!!c)}
                      />
                    </TableHead>
                  )}
                  <TableHead
                    className={cn(
                      'sticky z-20 w-[9.5rem] max-w-[9.5rem] bg-card px-2',
                      canDeleteConverts ? 'left-10' : 'left-0'
                    )}
                  >
                    Name
                  </TableHead>
                  {milestones.map((m) => (
                    <TableHead key={m.number} className="w-[56px] text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-center">
                            <div className="whitespace-pre-line text-[9px] font-bold leading-tight">
                              {m.shortName}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              [M{m.number.toString().padStart(2, '0')}]
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{m.name}</TooltipContent>
                      </Tooltip>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPeople.map((record) => (
                  <TableRow key={record.id}>
                    {canDeleteConverts && (
                      <TableCell className="sticky left-0 z-10 w-10 bg-card px-1">
                        <Checkbox
                          checked={selectedIds.includes(record.id)}
                          onCheckedChange={(c) =>
                            setSelectedIds((prev) =>
                              c
                                ? [...prev, record.id]
                                : prev.filter((k) => k !== record.id)
                            )
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell
                      className={cn(
                        'sticky z-10 w-[9.5rem] max-w-[9.5rem] bg-card px-2 py-2',
                        canDeleteConverts ? 'left-10' : 'left-0'
                      )}
                    >
                      <button
                        type="button"
                        title={record.full_name}
                        className="block w-full truncate text-left text-sm font-semibold text-foreground hover:underline"
                        onClick={() =>
                          router.push(`/${groupId}/person/${record.id}`)
                        }
                      >
                        {record.full_name}
                      </button>
                    </TableCell>
                    {milestones.map((milestone) => (
                      <TableCell key={milestone.number} className="p-1 text-center">
                        {isReadOnly ? (
                          <ReadOnlyMilestoneCell
                            isCompleted={getMilestoneStatus(
                              record,
                              milestone.number
                            )}
                            stageName={milestone.name}
                          />
                        ) : (
                          <MilestoneCell
                            isCompleted={getMilestoneStatus(
                              record,
                              milestone.number
                            )}
                            isUpdating={
                              updating === `${record.id}-${milestone.number}`
                            }
                            onToggle={() =>
                              toggleMilestone(
                                record.id,
                                milestone.number,
                                getMilestoneStatus(record, milestone.number)
                              )
                            }
                            stageName={milestone.name}
                            isAuto={milestone.isAutoCalculated}
                          />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
              <span>
                {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filteredPeople.length)} of{' '}
                {filteredPeople.length} people
              </span>
              <div className="flex items-center gap-2">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['20', '50', '100'].map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span>
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </TooltipProvider>
  )
}
