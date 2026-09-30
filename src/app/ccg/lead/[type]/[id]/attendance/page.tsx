'use client'

import { Suspense, use, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { ConvertModal } from '@/components/ccg/ConvertModal'
import { ContextPill, LeadNavActions, WithMonth, sundayAttendance, useLeadProgress, useUnitName, type LeadUnitType } from '@/components/ccg/LeaderView'

/** Seek's Attendance page as a Lead Pastor saw it: Sunday attendance against the goal, read only. */
export default function LeadAttendancePage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = use(params)
  if (type !== 'stream' && type !== 'ccg') return <ErrorScreen title="Unknown group" message="Choose a stream or a CCG." />
  return (
    <Suspense fallback={<LoadingScreen label="Loading attendance…" />}>
      <WithMonth type={type} id={id}>
        {(month) => <Attendance type={type} id={id} month={month} />}
      </WithMonth>
    </Suspense>
  )
}

function Attendance({ type, id, month }: { type: LeadUnitType; id: string; month: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const name = useUnitName(type, id)
  const { data, error, reload } = useLeadProgress(type, id, month)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const openId = params.get('placement')

  const open = (placementId: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (placementId) next.set('placement', placementId)
    else next.delete('placement')
    router.replace(`${pathname}?${next}`, { scroll: false })
  }

  const people = useMemo(
    () =>
      (data?.rows ?? [])
        .map((r) => ({ id: r.placement_id, full_name: r.person.full_name, ...sundayAttendance(r, data!.milestones) }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [data]
  )
  const goal = people[0]?.goal ?? data?.milestones.find((m) => m.attendance_event === 'sunday_service')?.attendance_target ?? 0
  const paginated = useMemo(() => people.slice((page - 1) * pageSize, page * pageSize), [people, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(people.length / pageSize))

  const stats = useMemo(() => {
    const total = people.length
    const onTrack = people.filter((p) => p.percentage >= 50).length
    const avgProgress = total > 0 ? Math.round(people.reduce((sum, p) => sum + p.percentage, 0) / total) : 0
    return { total, onTrack, behindGoal: total - onTrack, avgProgress }
  }, [people])

  if (error) return <ErrorScreen title="Could not load attendance" message={error} onRetry={reload} />
  if (!data) return <LoadingScreen label="Loading attendance…" />

  const green = (percentage: number) => percentage >= 50

  return (
    <div className="space-y-6">
      <div className="pr-12 md:pr-0">
        <ContextPill name={name} type={type} month={month} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance Tracking</h1>
          <p className="mt-1 text-sm text-muted-foreground">View attendance records for all new converts (Goal: {goal} Sundays)</p>
        </div>
        <LeadNavActions type={type} id={id} month={month} active="attendance" />
      </div>

      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Total converts</p>
              <p className="text-3xl font-bold tabular-nums">{stats.total}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">On track (50%+)</p>
              <p className="text-3xl font-bold tabular-nums text-success">{stats.onTrack}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Below 50%</p>
              <p className="text-3xl font-bold tabular-nums text-destructive">{stats.behindGoal}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Average progress</p>
              <p className="text-3xl font-bold tabular-nums">{stats.avgProgress}%</p>
            </div>
          </div>
          <Progress value={stats.avgProgress} className="mt-4 h-2 [&>div]:bg-success" />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Attendance Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <button type="button" className="text-left text-sm font-semibold text-foreground hover:underline" onClick={() => open(record.id)}>
                    {record.full_name}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex min-w-[200px] items-center gap-3">
                    <Progress
                      value={record.percentage}
                      className={cn('h-2 flex-1', green(record.percentage) ? '[&>div]:bg-success' : '[&>div]:bg-destructive')}
                    />
                    <span className={cn('text-xs font-medium tabular-nums', green(record.percentage) ? 'text-success' : 'text-destructive')}>
                      {record.count}/{record.goal}
                    </span>
                    <Badge variant={green(record.percentage) ? 'success' : 'destructive'}>{record.percentage}%</Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            {people.length === 0
              ? '0 of 0 new converts'
              : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, people.length)} of ${people.length} new converts`}
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
            <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon" className="size-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <ConvertModal placementId={openId} onClose={() => open(null)} onChanged={reload} />
    </div>
  )
}
