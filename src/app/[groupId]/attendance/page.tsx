'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import {
  Calendar,
  CheckSquare,
  Plus,
} from 'lucide-react'
import { SynagoLoader } from '@/components/shell/SynagoLoader'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { ATTENDANCE_GOAL } from '@/lib/constants'
import AppBreadcrumb from '@/components/AppBreadcrumb'
import dayjs from 'dayjs'
import { api } from '@/lib/api'
import type { GroupApiData, PersonApiData } from '@/lib/types/api-responses'
import { message } from '@/lib/toast'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { GroupNavActions } from '@/components/group/GroupNavActions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface PersonAttendance {
  id: string
  full_name: string
  group_name: string
  phone_number: string
  attendanceCount: number
  percentage: number
}

function AttendancePageContent() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string

  const [people, setPeople] = useState<PersonAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const getMostRecentSunday = () => {
    const today = dayjs()
    return today.day() === 0 ? today : today.subtract(today.day(), 'day')
  }

  const [selectedDate, setSelectedDate] = useState(getMostRecentSunday())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkMarking, setBulkMarking] = useState(false)

  const isLeader = user?.role === 'leader'
  const isSuperAdmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'admin'
  const canSelectPastDates = isSuperAdmin || isAdmin
  const isReadOnly =
    user?.role === 'leader' ||
    user?.role === 'overseer' ||
    user?.role === 'leadpastor'

  useEffect(() => {
    const fetchAvailableYears = async () => {
      if (!user || !token || !groupId) return
      try {
        const response = await api.groups.list({ active: true })
        if (response.success && response.data) {
          const groups: GroupApiData[] = response.data.groups || []
          const selectedGroup = groups.find((g) => g.id === groupId)
          if (!selectedGroup) throw new Error('Group not found')
          const monthName = selectedGroup.name
          const matchingGroups = groups.filter(
            (g) => g.name.toLowerCase() === monthName.toLowerCase()
          )
          const years = Array.from(
            new Set(matchingGroups.map((g) => g.year))
          ) as number[]
          years.sort((a, b) => b - a)
          setAvailableYears(years)
          if (selectedGroup.year) setSelectedYear(selectedGroup.year)
          else if (years.length > 0) setSelectedYear(years[0])
        }
      } catch {
        message.error(
          'Failed to load group information. Please refresh the page or contact support.'
        )
        router.push(`/${groupId}`)
      }
    }
    fetchAvailableYears()
  }, [user, token, groupId, router])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
      return
    }
    if (
      !authLoading &&
      user &&
      user.role !== 'superadmin' &&
      user.role !== 'leadpastor' &&
      user.role !== 'overseer' &&
      user.group_id !== groupId
    ) {
      message.error('Unauthorized access to this group')
      router.push('/')
      return
    }
    if (user && token && selectedYear) fetchPeople()
  }, [user, token, authLoading, router, groupId, selectedYear])

  const fetchPeople = async () => {
    try {
      setLoading(true)
      const response = await api.people.list({
        group_id: groupId,
        year: selectedYear || undefined,
        include: 'stats',
      })
      if (!response.success) throw new Error('Failed to fetch people')
      const peopleWithAttendance = (
        (response.data as { people?: PersonApiData[] })?.people || []
      ).map((person) => ({
        id: person.id,
        full_name: person.full_name ?? '',
        group_name: person.group_name ?? '',
        phone_number: person.phone_number,
        attendanceCount: person.attendance_count || 0,
        percentage: Math.min(
          Math.round(
            ((person.attendance_count || 0) / ATTENDANCE_GOAL) * 100
          ),
          100
        ),
      }))
      setPeople(peopleWithAttendance)
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : 'Failed to load people'
      )
    } finally {
      setLoading(false)
    }
  }

  const markAttendance = async (personId: string) => {
    if (isReadOnly) {
      message.warning('You do not have permission to mark attendance')
      return
    }
    try {
      const response = await api.attendance.mark(personId, {
        date_attended: selectedDate.format('YYYY-MM-DD'),
      })
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to mark attendance')
      }
      message.success('Attendance marked successfully!')
      fetchPeople()
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to mark attendance'
      if (errorMsg.includes('duplicate') || errorMsg.includes('already')) {
        message.warning('Attendance already marked for this date')
      } else if (errorMsg.includes('not found')) {
        message.error('Person not found. They may have been removed.')
      } else {
        message.error(errorMsg)
      }
    }
  }

  const bulkMarkAttendance = async () => {
    if (isReadOnly) {
      message.warning('You do not have permission to mark attendance')
      return
    }
    if (selectedIds.length === 0) {
      message.warning('Please select at least one person')
      return
    }
    try {
      setBulkMarking(true)
      const records = selectedIds.map((personId) => ({
        person_id: personId,
        date_attended: selectedDate.format('YYYY-MM-DD'),
      }))
      const response = await api.attendance.bulkCreate(records)
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to mark attendance')
      }
      const created = response.data?.created || 0
      const errors = response.data?.errors || []
      if (errors.length > 0) {
        message.warning(
          `Marked ${created} attendance(s). ${errors.length} already marked for this date.`
        )
      } else {
        message.success(
          `Successfully marked attendance for ${created} person(s)!`
        )
      }
      setSelectedIds([])
      fetchPeople()
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : 'Failed to mark attendance'
      )
    } finally {
      setBulkMarking(false)
    }
  }

  const dateInputValue = selectedDate.format('YYYY-MM-DD')

  const handleDateChange = (value: string) => {
    if (!value) return
    const date = dayjs(value)
    if (!date.isValid()) return
    setSelectedDate(date)
  }

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((k) => k !== id)
    )
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? people.map((p) => p.id) : [])
  }

  const attendanceStats = useMemo(() => {
    const total = people.length
    const onTrack = people.filter((p) => p.percentage >= 50).length
    const behindGoal = total - onTrack
    const avgProgress =
      total > 0
        ? Math.round(
            people.reduce((sum, p) => sum + p.percentage, 0) / total
          )
        : 0
    return { total, onTrack, behindGoal, avgProgress }
  }, [people])

  const isAttendanceGreen = (percentage: number) => percentage >= 50

  if (authLoading || loading) {
    return <LoadingScreen label="Loading attendance…" />
  }

  return (
    <>
      <AppBreadcrumb />
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isLeader
                ? 'Attendance Tracking'
                : 'Update Attendance Tracking'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLeader
                ? `View attendance records for all new converts (Goal: ${ATTENDANCE_GOAL} Sundays)`
                : `Mark attendance for church services (Goal: ${ATTENDANCE_GOAL} Sundays)`}
            </p>
          </div>
          <GroupNavActions groupId={groupId} user={user} active="attendance" />
        </div>

        {availableYears.length > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm">
              <Calendar className="size-4" />
              Year:
            </span>
            <Select
              value={selectedYear != null ? String(selectedYear) : undefined}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
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

        {!isLeader && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">Select Date:</span>
            <Input
              type="date"
              className="w-[200px]"
              value={dateInputValue}
              onChange={(e) => handleDateChange(e.target.value)}
            />
            {canSelectPastDates && (
              <span className="text-xs text-muted-foreground">
                (Can select any past Sunday)
              </span>
            )}
          </div>
        )}

        <Card className="mb-4">
          <CardContent className="p-5">
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-xs text-muted-foreground">Total converts</p>
                <p className="text-3xl font-bold tabular-nums">
                  {attendanceStats.total}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">On track (50%+)</p>
                <p className="text-3xl font-bold tabular-nums text-success">
                  {attendanceStats.onTrack}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Below 50%</p>
                <p className="text-3xl font-bold tabular-nums text-destructive">
                  {attendanceStats.behindGoal}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Average progress
                </p>
                <p className="text-3xl font-bold tabular-nums">
                  {attendanceStats.avgProgress}%
                </p>
              </div>
            </div>
            <Progress
              value={attendanceStats.avgProgress}
              className="mt-4 h-2 [&>div]:bg-success"
            />
          </CardContent>
        </Card>

        {!isReadOnly && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={selectedIds.length === 0}
              onClick={bulkMarkAttendance}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {bulkMarking ? (
                <SynagoLoader size={16} inline />
              ) : (
                <CheckSquare className="size-4" />
              )}
              Mark Selected ({selectedIds.length})
            </Button>
            {selectedIds.length > 0 && (
              <Button variant="outline" onClick={() => setSelectedIds([])}>
                Clear Selection
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              Select converts and click Mark Selected to bulk mark attendance
            </span>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {!isReadOnly && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        people.length > 0 &&
                        selectedIds.length === people.length
                      }
                      onCheckedChange={(c) => toggleSelectAll(!!c)}
                    />
                  </TableHead>
                )}
                <TableHead>Name</TableHead>
                {!isReadOnly && <TableHead>Actions</TableHead>}
                <TableHead>Attendance Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((record) => (
                <TableRow key={record.id}>
                  {!isReadOnly && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(record.id)}
                        onCheckedChange={(c) =>
                          toggleSelect(record.id, !!c)
                        }
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <button
                      type="button"
                      className="text-left text-sm font-semibold text-foreground hover:underline"
                      onClick={() =>
                        router.push(`/${groupId}/person/${record.id}`)
                      }
                    >
                      {record.full_name}
                    </button>
                    {isLeader && (
                      <div className="text-xs text-muted-foreground">
                        <a href={`tel:${record.phone_number}`}>
                          {record.phone_number}
                        </a>
                      </div>
                    )}
                  </TableCell>
                  {!isReadOnly && (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-success/50 text-success hover:bg-success/10"
                        onClick={() => markAttendance(record.id)}
                      >
                        <Plus className="size-4" />
                        Mark Present
                      </Button>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex min-w-[200px] items-center gap-3">
                      <Progress
                        value={record.percentage}
                        className={cn(
                          'h-2 flex-1',
                          isAttendanceGreen(record.percentage)
                            ? '[&>div]:bg-success'
                            : '[&>div]:bg-destructive'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs font-medium tabular-nums',
                          isAttendanceGreen(record.percentage)
                            ? 'text-success'
                            : 'text-destructive'
                        )}
                      >
                        {record.attendanceCount}/{ATTENDANCE_GOAL}
                      </span>
                      <Badge
                        variant={
                          isAttendanceGreen(record.percentage)
                            ? 'success'
                            : 'destructive'
                        }
                      >
                        {record.percentage}%
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground">
          Total {people.length} new converts
        </p>
      </div>
    </>
  )
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AttendancePageContent />
    </Suspense>
  )
}
