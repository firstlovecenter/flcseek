'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Flag, Sprout } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from './CcgMeProvider'
import { useCcgFocus } from './CcgFocusProvider'
import { FollowUpSheet } from './FollowUpSheet'
import { ASSESSMENT, STAGE_STATE, type MilestoneDef, type ProgressRow, type Stage } from './progress-types'
import { Initials } from './synago'

/**
 * The converts page's default view: every placed convert against the CCG
 * Manual's milestones for their assessment year. Scope: ?unit=type:id or
 * ?ccf= / ?ccg= / ?council= / ?stream= (links from a unit's page), else the
 * church in focus. ?placement= opens that convert's follow-up panel.
 */

const PARAM: Record<string, string> = { ccf: 'ccf_id', ccg: 'ccg_id', council: 'council_id', stream: 'stream_id' }

function Cell({ stage, def }: { stage: Stage | undefined; def: MilestoneDef }) {
  if (!stage) return <span className="text-muted-foreground">—</span>
  const st = STAGE_STATE[stage.state]
  const label = `${def.name}: ${stage.state === 'done' ? 'done' : st.label.toLowerCase()}${stage.progress ? ` (${stage.progress.done} of ${stage.progress.total})` : ''}`
  return (
    <span
      title={label}
      aria-label={label}
      className={cn('inline-flex h-7 min-w-10 items-center justify-center rounded-md border px-1.5 text-xs font-medium tabular-nums', st.className)}
    >
      {stage.state === 'done' ? (
        <Check className="size-4" aria-hidden />
      ) : stage.progress ? (
        `${Math.min(stage.progress.done, stage.progress.total)}/${stage.progress.total}`
      ) : stage.state === 'overdue' ? (
        '!'
      ) : (
        ''
      )}
    </span>
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

export function ConvertMilestones() {
  const { has, loading: meLoading } = useCcgMe()
  const router = useRouter()
  const params = useSearchParams()
  const { query, waiting } = useConvertScope()
  const openId = params.get('placement')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [data, setData] = useState<{ milestones: MilestoneDef[]; rows: ProgressRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setData(null)
    const q = [query, overdueOnly ? 'overdue=1' : ''].filter(Boolean).join('&')
    const r = await ccgApi.get<{ milestones: MilestoneDef[]; rows: ProgressRow[] }>(`/progress${q ? `?${q}` : ''}`)
    if (!r.ok) return setError(r.error.message)
    setError(null)
    setData(r.data)
  }, [query, overdueOnly])

  useEffect(() => {
    if (has('placements.view') && !waiting) load()
  }, [load, has, waiting])

  const rows = useMemo(
    () =>
      [...(data?.rows ?? [])].sort(
        (a, b) => b.overdue - a.overdue || a.assessment.days_left - b.assessment.days_left || a.person.full_name.localeCompare(b.person.full_name)
      ),
    [data]
  )

  const open = (id: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (id) next.set('placement', id)
    else next.delete('placement')
    router.replace(`/ccg/converts${next.size ? `?${next}` : ''}`, { scroll: false })
  }

  if (!meLoading && !has('placements.view')) {
    return <EmptyState icon={Sprout} title="Milestones" description="You don’t have access to converts’ milestones." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load milestones" message={error} onRetry={load} />

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Each placed convert’s assessment year, from approval to one year on. Reaching every milestone makes them a member of their CCF.
        </p>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <Switch checked={overdueOnly} onCheckedChange={setOverdueOnly} />
          Overdue only
        </label>
      </div>

      {data === null ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title={overdueOnly ? 'Nothing overdue' : 'No converts in their assessment year'}
          description={overdueOnly ? 'Every placed convert is on track.' : 'Converts appear here once their placement is approved.'}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-muted px-4 py-2 font-medium">Convert</th>
                  {data.milestones.map((m) => (
                    <th key={m.id} className="px-1.5 py-2 text-center font-medium whitespace-nowrap" title={m.name}>
                      {m.short_name}
                    </th>
                  ))}
                  <th className="px-4 py-2 font-medium whitespace-nowrap">Year</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const stages = new Map(r.stages.map((s) => [s.stage_number, s]))
                  const a = ASSESSMENT[r.assessment.state]
                  return (
                    <tr key={r.placement_id} className="cursor-pointer hover:bg-accent/40" onClick={() => open(r.placement_id)}>
                      <td className="sticky left-0 z-10 bg-card px-4 py-2">
                        <button
                          type="button"
                          className="flex items-center gap-2.5 text-left focus-visible:underline focus-visible:outline-none"
                          onClick={(e) => {
                            e.stopPropagation()
                            open(r.placement_id)
                          }}
                        >
                          <Initials name={r.person.full_name} className="size-8 text-[11px]" />
                          <span>
                            <span className="flex items-center gap-1.5 font-medium whitespace-nowrap">
                              {r.person.full_name}
                              {r.latest_check_in?.follow_up_required && <Flag className="size-3.5 text-warning" aria-label="Needs follow-up" />}
                            </span>
                            <span className="block text-xs whitespace-nowrap text-muted-foreground">{r.ccf?.name}</span>
                          </span>
                        </button>
                      </td>
                      {data.milestones.map((m) => (
                        <td key={m.id} className="px-1.5 py-2 text-center">
                          <Cell stage={stages.get(m.stage_number)} def={m} />
                        </td>
                      ))}
                      <td className="px-4 py-2 whitespace-nowrap">
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
        </div>
      )}

      <FollowUpSheet placementId={openId} onClose={() => open(null)} onChanged={load} />
    </div>
  )
}
