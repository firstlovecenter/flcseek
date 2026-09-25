'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, HeartHandshake } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { useCcgFocus } from '@/components/ccg/CcgFocusProvider'
import { Initials, StickyHeader } from '@/components/ccg/synago'
import { StreamSeekers, type SeekerHolder } from '@/components/ccg/StreamSeekers'

interface Counts {
  registered: number
  placed: number
  became_members: number
  dropped: number
  in_assessment: number
}
interface Report {
  period: 'week' | 'month'
  offset: number
  range: { label: string }
  seekers: Array<Counts & { person_id: string; name: string; streams: Array<{ id: string; name: string }> }>
  unassigned: Counts
  total: Counts
}

const COLUMNS: Array<{ key: keyof Counts; label: string; hint: string }> = [
  { key: 'registered', label: 'Registered', hint: 'Converts they brought, registered in this period' },
  { key: 'placed', label: 'Placed', hint: 'Placed in a CCF in this period' },
  { key: 'became_members', label: 'Became members', hint: 'Completed their assessment in this period' },
  { key: 'dropped', label: 'Dropped', hint: 'Placement ended without completing, in this period' },
  { key: 'in_assessment', label: 'In assessment now', hint: 'In their assessment year today' },
]

/**
 * Sheep Seekers report: per seeker, for a week or a month, how many converts
 * they brought, how many were placed, became members or dropped.
 */
function SeekerReport() {
  const params = useSearchParams()
  const router = useRouter()
  const { has, loading: meLoading } = useCcgMe()
  const { focus } = useCcgFocus()
  const stream = params.get('stream') ?? (focus?.type === 'stream' ? focus.id : null)
  const period = params.get('period') === 'month' ? 'month' : 'week'
  const offset = Math.max(Number(params.get('offset')) || 0, 0)
  const [data, setData] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The stream's sheep seeking team: its Overseer and Sheep Seekers (appointed here).
  const [team, setTeam] = useState<{ overseer: SeekerHolder | null; seekers: SeekerHolder[] } | null>(null)
  const loadTeam = useCallback(() => {
    if (!stream) return setTeam(null)
    ccgApi.get<{ overseer: SeekerHolder | null; seekers: SeekerHolder[] }>(`/streams/${stream}/seekers`).then((r) => setTeam(r.ok ? r.data : null))
  }, [stream])
  useEffect(() => {
    loadTeam()
  }, [loadTeam])

  useEffect(() => {
    if (!has('reports.view')) return
    setData(null)
    setError(null)
    const q = new URLSearchParams({ period, offset: String(offset) })
    if (stream) q.set('stream_id', stream)
    ccgApi.get<Report>(`/seekers?${q}`).then((r) => (r.ok ? setData(r.data) : setError(r.error.message)))
  }, [has, stream, period, offset])

  const go = (next: { period?: string; offset?: number }) => {
    const q = new URLSearchParams(params.toString())
    if (next.period) {
      q.set('period', next.period)
      q.delete('offset')
    }
    if (next.offset !== undefined) {
      if (next.offset) q.set('offset', String(next.offset))
      else q.delete('offset')
    }
    router.replace(`/ccg/seekers?${q}`, { scroll: false })
  }

  if (!meLoading && !has('reports.view')) {
    return <EmptyState icon={HeartHandshake} title="Sheep Seekers" description="You don’t have access to reports." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load the report" message={error} />

  const streamName =
    data?.seekers.flatMap((s) => s.streams).find((s) => s.id === stream)?.name ?? (focus?.type === 'stream' && focus.id === stream ? focus.name : undefined)

  return (
    <div className="pb-10">
      <StickyHeader className="space-y-3">
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-foreground">
          {streamName ? `${streamName} ` : ''}
          <span className="text-members">Sheep Seekers</span>
        </h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border p-1" role="group" aria-label="Period">
            {(['week', 'month'] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => go({ period: p })}
                className={cn(
                  'min-h-10 rounded-md px-4 text-sm font-medium transition-colors',
                  period === p ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                By {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="size-10" onClick={() => go({ offset: offset + 1 })} aria-label={`Previous ${period}`}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium tabular-nums">{data?.range.label ?? ' '}</span>
            <Button
              variant="outline"
              size="icon"
              className="size-10"
              onClick={() => go({ offset: offset - 1 })}
              disabled={offset === 0}
              aria-label={`Next ${period}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </StickyHeader>

      {stream && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <StreamSeekers
            streamId={stream}
            streamName={streamName ?? 'this stream'}
            overseer={team ? team.overseer : undefined}
            seekers={team ? team.seekers : null}
            onChanged={loadTeam}
            reportLink={false}
          />
        </div>
      )}

      <h2 className="mt-6 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Their converts</h2>

      {!data ? (
        <Skeleton className="mt-4 h-72 rounded-xl" />
      ) : data.seekers.length === 0 && data.total.registered === 0 && data.total.in_assessment === 0 ? (
        <EmptyState
          orb
          icon={HeartHandshake}
          title="No Sheep Seekers yet"
          description="Appoint them from a stream’s page. Their converts appear here as they register them."
          className="mt-12"
        />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">
                  Sheep Seeker
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" title={c.hint} className="px-3 py-3 text-right font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.seekers.map((s) => (
                <tr key={s.person_id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/ccg/converts?view=all&seeker=${s.person_id}`} className="flex items-center gap-3">
                      <Initials name={s.name} className="size-8 text-[11px]" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{s.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{s.streams.map((x) => x.name).join(', ')}</span>
                      </span>
                    </Link>
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={cn('px-3 py-2.5 text-right tabular-nums', s[c.key] === 0 && 'text-muted-foreground')}>
                      {s[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
              {Object.values(data.unassigned).some((n) => n > 0) && (
                <tr className="text-muted-foreground">
                  <td className="px-4 py-2.5 italic">No Sheep Seeker recorded</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-2.5 text-right tabular-nums">
                      {data.unassigned[c.key]}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-4 py-3">Total</td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-3 py-3 text-right tabular-nums">
                    {data.total[c.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default function CcgSeekersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <SeekerReport />
    </Suspense>
  )
}
