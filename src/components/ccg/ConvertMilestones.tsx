'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Flag, Search, Sprout } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/base/EmptyState'
import { OrbBurst } from '@/components/base/Orbs'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from './CcgMeProvider'
import { useCcgFocus } from './CcgFocusProvider'
import { FollowUpSheet } from './FollowUpSheet'
import { ASSESSMENT, STAGE_STATE, type MilestoneDef, type ProgressRow, type Stage } from './progress-types'
import { Initials } from './synago'

/**
 * Converts against the CCG Manual's milestones for their assessment year,
 * laid out like Seek's group page: totals and overall progress, then the
 * converts × milestones grid (cards on phones). Hand-ticked milestones toggle
 * in the grid; attendance and checklist ones, and a convert's name, open
 * their follow-up panel.
 *
 * Scope: ?unit=type:id or ?ccf= / ?ccg= / ?council= / ?stream= (links from a
 * group's page), else the role in focus; `mine` = the converts assigned to
 * the signed-in Sheep Seeker. ?placement= opens that convert's panel.
 */

const PARAM: Record<string, string> = { ccf: 'ccf_id', ccg: 'ccg_id', council: 'council_id', stream: 'stream_id' }
const code = (n: number) => `M${String(n).padStart(2, '0')}`

/**
 * One milestone for one convert, as a switch (as in Seek): green when done,
 * red when not. Hand-ticked milestones toggle; attendance and checklist ones
 * complete themselves, so their switch is locked and a tap opens the
 * convert's follow-up panel.
 */
function Cell({
  stage,
  def,
  onToggle,
  onOpen,
  canTick,
  busy,
}: {
  stage: Stage | undefined
  def: MilestoneDef
  onToggle: () => void
  onOpen: () => void
  canTick: boolean
  busy?: boolean
}) {
  if (!stage) return <span className="text-muted-foreground">—</span>
  const done = stage.state === 'done'
  const auto = def.kind !== 'manual'
  const detail = stage.progress ? ` (${Math.min(stage.progress.done, stage.progress.total)} of ${stage.progress.total})` : ''
  const label = `${def.name}: ${done ? 'done' : STAGE_STATE[stage.state].label.toLowerCase()}${detail}${auto ? ', completes itself' : ''}`
  const toggles = !auto && canTick
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex flex-col items-center gap-0.5"
          onClick={(e) => {
            e.stopPropagation()
            if (!toggles) onOpen()
          }}
        >
          <Switch
            checked={done}
            disabled={!toggles || busy}
            onCheckedChange={onToggle}
            aria-label={label}
            className={cn(
              'data-[state=checked]:bg-success data-[state=unchecked]:bg-destructive',
              !toggles && 'cursor-pointer disabled:opacity-100',
              busy && 'opacity-50'
            )}
          />
          {stage.progress && !done && (
            <span className="text-[10px] leading-none text-muted-foreground tabular-nums">
              {Math.min(stage.progress.done, stage.progress.total)}/{stage.progress.total}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Which unit the table covers, as an API query. */
export function useConvertScope() {
  const params = useSearchParams()
  const { focus, options } = useCcgFocus()
  const unit = params.get('unit')
  const direct = ['ccf', 'ccg', 'council', 'stream'].map((t) => [t, params.get(t)] as const).find(([, v]) => !!v)
  let type: string | null = null
  let id: string | null = null
  if (unit?.includes(':')) [type, id] = unit.split(':')
  else if (direct) [type, id] = [direct[0], direct[1]]
  else if (focus && focus.type !== 'global') [type, id] = [focus.type, focus.id]
  const query = type && id && PARAM[type] ? `${PARAM[type]}=${id}` : ''
  const waiting = !unit && !direct && options.length > 0 && !focus
  const name = params.get('name') ?? (!unit && !direct && focus?.type !== 'global' ? focus?.name : null) ?? null
  return { query, waiting, name }
}

/** `mine`: only the converts in the signed-in Sheep Seeker's groups, wherever they are placed. */
export function ConvertMilestones({ mine = false }: { mine?: boolean }) {
  const { has, loading: meLoading } = useCcgMe()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { query, waiting } = useConvertScope()
  const openId = params.get('placement')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [mobileShown, setMobileShown] = useState(30)
  const [busy, setBusy] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState(0)
  const [data, setData] = useState<{ milestones: MilestoneDef[]; rows: ProgressRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canTick = has('milestones.update')

  const load = useCallback(async () => {
    const q = [mine ? 'seeker=me' : query, overdueOnly ? 'overdue=1' : ''].filter(Boolean).join('&')
    const r = await ccgApi.get<{ milestones: MilestoneDef[]; rows: ProgressRow[] }>(`/progress${q ? `?${q}` : ''}`)
    if (!r.ok) return setError(r.error.message)
    setError(null)
    setData(r.data)
  }, [query, overdueOnly, mine])

  useEffect(() => {
    if (!has('placements.view') || (!mine && waiting)) return
    setData(null)
    load()
  }, [load, has, waiting, mine])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const digits = term.replace(/\D/g, '')
    return [...(data?.rows ?? [])]
      .filter((r) => !term || r.person.full_name.toLowerCase().includes(term) || (!!digits && !!r.person.phone?.includes(digits)))
      .sort((a, b) => b.overdue - a.overdue || a.assessment.days_left - b.assessment.days_left || a.person.full_name.localeCompare(b.person.full_name))
  }, [data, search])

  const milestoneCount = data?.milestones.length ?? 0
  const incomplete = rows.filter((r) => r.completed < milestoneCount).length
  const cells = rows.length * milestoneCount
  const done = rows.reduce((n, r) => n + r.completed, 0)
  const pct = cells ? Math.round((done / cells) * 100) : 0
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const shown = rows.slice((page - 1) * pageSize, page * pageSize)

  const open = (id: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (id) next.set('placement', id)
    else next.delete('placement')
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false })
  }

  /** Hand-ticked milestones toggle in place (as in Seek); the others open the follow-up panel. */
  const tap = async (r: ProgressRow, m: MilestoneDef, stage: Stage | undefined) => {
    if (m.kind !== 'manual' || !canTick || !stage) return open(r.placement_id)
    const key = `${r.placement_id}:${m.stage_number}`
    setBusy(key)
    const res = await ccgApi.put<{ graduated: boolean }>(`/placements/${r.placement_id}/progress`, {
      stage_number: m.stage_number,
      is_completed: stage.state !== 'done',
    })
    setBusy(null)
    if (!res.ok) return message.error(res.error.message)
    if (res.data.graduated) {
      setCelebrate((n) => n + 1)
      message.success(`${r.person.full_name} completed their assessment and is now a member of ${r.ccf?.name ?? 'their CCF'}`)
    }
    load()
  }

  if (!meLoading && !has('placements.view')) {
    return <EmptyState icon={Sprout} title="Milestones" description="You don’t have access to converts’ milestones." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load milestones" message={error} onRetry={load} />

  return (
    <TooltipProvider>
      <div className="space-y-4 py-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Search by name, phone…"
              className="pl-9"
              value={search}
              aria-label="Search converts"
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <Switch checked={overdueOnly} onCheckedChange={setOverdueOnly} />
            Overdue only
          </label>
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap gap-8">
              {(
                [
                  ['Total converts', rows.length],
                  ['Incomplete', incomplete],
                  ['Overall progress', `${pct}%`],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {data ? <p className="text-3xl font-bold tabular-nums">{value}</p> : <Skeleton className="mt-1 h-9 w-14" />}
                </div>
              ))}
            </div>
            <Progress value={pct} className="mt-4 h-2 [&>div]:bg-success" aria-label="Overall progress" />
          </CardContent>
        </Card>

        {data === null ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : rows.length === 0 ? (
          <EmptyState
            orb
            icon={Sprout}
            title={search ? 'No one matches' : overdueOnly ? 'Nothing overdue' : mine ? 'No converts in your groups yet' : 'No converts in their assessment year'}
            description={
              search
                ? 'Try another name or number.'
                : overdueOnly
                  ? 'Every convert is on track.'
                  : mine
                    ? 'Converts in the sheep seeking groups you look after appear here once they are placed in a CCF.'
                    : 'Converts appear here once their placement is approved.'
            }
          />
        ) : (
          <>
            {/* Phones: one card per convert */}
            <div className="space-y-3 md:hidden">
              {rows.slice(0, mobileShown).map((r) => {
                const stages = new Map(r.stages.map((s) => [s.stage_number, s]))
                return (
                  <Card key={r.placement_id} className="gap-0 p-4">
                    <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => open(r.placement_id)}>
                      <Initials name={r.person.full_name} className="size-9 text-xs" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate font-semibold">
                          {r.person.full_name}
                          {r.latest_check_in?.follow_up_required && <Flag className="size-3.5 text-warning" aria-label="Needs follow-up" />}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.ccf?.name} · {r.completed} of {milestoneCount}
                        </span>
                      </span>
                    </button>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {data.milestones.map((m) => (
                        <span key={m.id} className="flex flex-col items-center gap-0.5">
                          <Cell
                            stage={stages.get(m.stage_number)}
                            def={m}
                            busy={busy === `${r.placement_id}:${m.stage_number}`}
                            canTick={canTick}
                            onToggle={() => tap(r, m, stages.get(m.stage_number))}
                            onOpen={() => open(r.placement_id)}
                          />
                          <span className="text-[10px] text-muted-foreground">{code(m.stage_number)}</span>
                        </span>
                      ))}
                    </div>
                  </Card>
                )
              })}
              {rows.length > mobileShown && (
                <Button className="w-full" variant="outline" onClick={() => setMobileShown((n) => n + 30)}>
                  Show more ({rows.length - mobileShown} more)
                </Button>
              )}
            </div>

            {/* Larger screens: the grid */}
            <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="sticky left-0 z-20 w-[11rem] bg-card px-3 py-2 font-medium">Name</th>
                      {data.milestones.map((m) => (
                        <th key={m.id} className="w-14 px-1 py-2 text-center font-medium">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-center">
                                <div className="text-[10px] leading-tight font-bold whitespace-pre-line text-foreground">{m.short_name}</div>
                                <div className="text-[10px] text-muted-foreground">[{code(m.stage_number)}]</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{m.name}</TooltipContent>
                          </Tooltip>
                        </th>
                      ))}
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shown.map((r) => {
                      const stages = new Map(r.stages.map((s) => [s.stage_number, s]))
                      const a = ASSESSMENT[r.assessment.state]
                      return (
                        <tr key={r.placement_id} className="hover:bg-accent/30">
                          <td className="sticky left-0 z-10 w-[11rem] max-w-[11rem] bg-card px-3 py-2">
                            <button
                              type="button"
                              title={r.person.full_name}
                              className="block w-full text-left focus-visible:underline focus-visible:outline-none"
                              onClick={() => open(r.placement_id)}
                            >
                              <span className="flex items-center gap-1.5 truncate font-semibold text-foreground hover:underline">
                                {r.person.full_name}
                                {r.latest_check_in?.follow_up_required && <Flag className="size-3.5 shrink-0 text-warning" aria-label="Needs follow-up" />}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">{r.ccf?.name}</span>
                            </button>
                          </td>
                          {data.milestones.map((m) => (
                            <td key={m.id} className="p-1 text-center">
                              <Cell
                                stage={stages.get(m.stage_number)}
                                def={m}
                                busy={busy === `${r.placement_id}:${m.stage_number}`}
                                canTick={canTick}
                            onToggle={() => tap(r, m, stages.get(m.stage_number))}
                            onOpen={() => open(r.placement_id)}
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 whitespace-nowrap">
                            {r.assessment.state === 'in_progress' ? (
                              <span className="text-xs text-muted-foreground tabular-nums">{r.assessment.days_left} days left</span>
                            ) : (
                              <Badge variant={a.tone}>{a.label}</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
                <span>
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} of {rows.length} converts
                </span>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v))
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[80px]" aria-label="Converts per page">
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
                  <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="size-8" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        <FollowUpSheet placementId={openId} onClose={() => open(null)} onChanged={load} />
        <OrbBurst trigger={celebrate} />
      </div>
    </TooltipProvider>
  )
}
