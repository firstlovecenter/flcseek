'use client'

import { Suspense, memo, use, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useThemeStyles } from '@/lib/theme-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { ConvertModal } from '@/components/ccg/ConvertModal'
import { ContextPill, LeadNavActions, WithMonth, useLeadProgress, useUnitName, type LeadUnitType } from '@/components/ccg/LeaderView'
import type { MilestoneDef, ProgressRow } from '@/components/ccg/progress-types'

/**
 * A stream or CCG's milestones for one month, as Seek's Lead Pastor saw a
 * group: totals, then the converts × milestones grid (✓ / ✗, read only;
 * cards on phones). A name opens the convert.
 */

const code = (n: number) => `[M${String(n).padStart(2, '0')}]`

export default function LeadMilestonesPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = use(params)
  if (type !== 'stream' && type !== 'ccg') return <ErrorScreen title="Unknown group" message="Choose a stream or a CCG." />
  return (
    <Suspense fallback={<LoadingScreen label="Loading dashboard…" />}>
      <WithMonth type={type} id={id}>
        {(month) => <Milestones type={type} id={id} month={month} />}
      </WithMonth>
    </Suspense>
  )
}

const ReadOnlyMilestoneCell = memo(function ReadOnlyMilestoneCell({ isCompleted, stageName }: { isCompleted: boolean; stageName: string }) {
  const themeStyles = useThemeStyles()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex min-h-6 items-center justify-center rounded text-[10px] font-bold text-white"
          style={{ backgroundColor: isCompleted ? themeStyles.success : themeStyles.error }}
        >
          {isCompleted ? '✓' : '✗'}
        </div>
      </TooltipTrigger>
      <TooltipContent>{stageName}</TooltipContent>
    </Tooltip>
  )
})

const PersonProgressCard = memo(function PersonProgressCard({ row, milestones, onOpen }: { row: ProgressRow; milestones: MilestoneDef[]; onOpen: () => void }) {
  const themeStyles = useThemeStyles()
  const [expanded, setExpanded] = useState(false)
  const done = (n: number) => row.stages.find((s) => s.stage_number === n)?.state === 'done'
  const sorted = [...milestones].sort((a, b) => a.stage_number - b.stage_number)
  const completed = sorted.filter((m) => done(m.stage_number)).length
  const total = sorted.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const upcoming = sorted.filter((m) => !done(m.stage_number))
  const visible = expanded ? sorted : upcoming.slice(0, 3)

  return (
    <Card className="mb-3">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-3">
          <div
            className="relative flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-success/40 text-xs font-bold"
            style={{ background: `conic-gradient(hsl(var(--success)) ${pct}%, hsl(var(--muted)) 0)` }}
          >
            <span className="rounded-full bg-card px-1">{pct}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <button type="button" className="truncate text-left text-sm font-semibold text-foreground hover:underline" onClick={onOpen}>
              {row.person.full_name}
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
              style={{ background: themeStyles.successBg, borderColor: themeStyles.successBorder, color: themeStyles.success }}
            >
              All milestones complete
            </div>
          ) : (
            visible.map((m) => {
              const isDone = done(m.stage_number)
              return (
                <div
                  key={m.stage_number}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-1.5"
                  style={{ background: isDone ? themeStyles.successBg : themeStyles.errorBg, borderColor: isDone ? themeStyles.successBorder : themeStyles.errorBorder }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      M{m.stage_number.toString().padStart(2, '0')}
                    </Badge>
                    <span className="truncate text-sm">{m.name}</span>
                  </span>
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: isDone ? themeStyles.success : themeStyles.error }}
                  >
                    {isDone ? '✓' : '✗'}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {total > 0 && (
          <Button variant="link" className="mt-1 w-full" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show fewer' : `Show all ${total} milestones`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
})

function Milestones({ type, id, month }: { type: LeadUnitType; id: string; month: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const name = useUnitName(type, id)
  const { data, error, reload } = useLeadProgress(type, id, month)
  const [searchText, setSearchText] = useState('')
  const [mobileVisible, setMobileVisible] = useState(30)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const openId = params.get('placement')

  const open = (placementId: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (placementId) next.set('placement', placementId)
    else next.delete('placement')
    router.replace(`${pathname}?${next}`, { scroll: false })
  }

  const milestones = useMemo(() => [...(data?.milestones ?? [])].sort((a, b) => a.stage_number - b.stage_number), [data])
  const filtered = useMemo(() => {
    const term = searchText.toLowerCase()
    const list = !term
      ? data?.rows ?? []
      : (data?.rows ?? []).filter((p) => p.person.full_name.toLowerCase().includes(term) || p.person.phone?.toLowerCase().includes(term))
    return [...list].sort((a, b) => a.person.full_name.localeCompare(b.person.full_name))
  }, [data, searchText])
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  if (error) return <ErrorScreen title="Could not load milestones" message={error} onRetry={reload} />
  if (!data) return <LoadingScreen label="Loading dashboard…" />

  const done = (r: ProgressRow, n: number) => r.stages.find((s) => s.stage_number === n)?.state === 'done'
  const totalPeople = filtered.length
  const completedOf = (r: ProgressRow) => milestones.filter((m) => done(r, m.stage_number)).length
  const incomplete = filtered.filter((p) => completedOf(p) < milestones.length).length
  const totalCells = totalPeople * milestones.length
  const completedCells = filtered.reduce((sum, p) => sum + completedOf(p), 0)
  const pct = totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0

  return (
    <TooltipProvider>
      <div className="py-0">
        <div className="mb-3 pr-12 md:pr-0">
          <ContextPill name={name} type={type} month={month} />
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
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
          <LeadNavActions type={type} id={id} month={month} active="milestones" />
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
            <Progress value={pct} className="mt-4 h-2 [&>div]:bg-success" />
          </CardContent>
        </Card>

        {/* Phones: one card per convert */}
        <div className="md:hidden">
          {filtered.length === 0 ? (
            <EmptyState title="No people found" />
          ) : (
            <>
              {filtered.slice(0, mobileVisible).map((r) => (
                <PersonProgressCard key={r.placement_id} row={r} milestones={milestones} onOpen={() => open(r.placement_id)} />
              ))}
              {filtered.length > mobileVisible && (
                <Button className="w-full" variant="outline" onClick={() => setMobileVisible((v) => v + 30)}>
                  Show more ({filtered.length - mobileVisible} more)
                </Button>
              )}
            </>
          )}
        </div>

        {/* Larger screens: the grid */}
        <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-20 w-[9.5rem] max-w-[9.5rem] bg-card px-2">Name</TableHead>
                {milestones.map((m) => (
                  <TableHead key={m.stage_number} className="w-[56px] text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-center">
                          <div className="text-[9px] leading-tight font-bold whitespace-pre-line">{m.short_name}</div>
                          <div className="text-[10px] text-muted-foreground">{code(m.stage_number)}</div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{m.name}</TooltipContent>
                    </Tooltip>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((r) => (
                <TableRow key={r.placement_id}>
                  <TableCell className="sticky left-0 z-10 w-[9.5rem] max-w-[9.5rem] bg-card px-2 py-2">
                    <button
                      type="button"
                      title={r.person.full_name}
                      className="block w-full truncate text-left text-sm font-semibold text-foreground hover:underline"
                      onClick={() => open(r.placement_id)}
                    >
                      {r.person.full_name}
                    </button>
                  </TableCell>
                  {milestones.map((m) => (
                    <TableCell key={m.stage_number} className="p-1 text-center">
                      <ReadOnlyMilestoneCell isCompleted={done(r, m.stage_number)} stageName={m.name} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} people
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
    </TooltipProvider>
  )
}
