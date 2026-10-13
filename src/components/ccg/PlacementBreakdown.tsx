'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Download, Trash2 } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CloseCcfDialog } from './CloseCcfDialog'
import { useCcgMe } from './CcgMeProvider'
import { DetailTile, SectionLabel } from './synago'

/**
 * Where the stream's converts have gone, for its Sheep Seeking Admin (and the
 * campus's): per council, CCG or CCF, with filters. Stream, council and CCG
 * narrow here; the Sheep Seeker and the period are asked of the server.
 */

type Ref = { id: string; name: string }
type Counts = { in_ccf: number; placed: number; awaiting: number; on_hold: number; became_members: number; dropped: number }
type Row = Counts & { ccf: Ref & { status: string }; ccg: Ref; council: Ref | null; stream: Ref }
interface Breakdown {
  rows: Row[]
  total: Counts
  not_placed: { new: number; needs_info: number; proposed: number } | null
}
type Level = 'council' | 'ccg' | 'ccf'
type Period = 'all' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom'

const COLUMNS: Array<{ key: keyof Counts; label: string; hint: string; inPeriod?: boolean }> = [
  { key: 'in_ccf', label: 'In CCF now', hint: 'Placed and in their assessment year today' },
  { key: 'placed', label: 'Placed', hint: 'Placement approved in the period', inPeriod: true },
  { key: 'awaiting', label: 'Awaiting approval', hint: 'Proposed for this CCF, waiting for approval today' },
  { key: 'on_hold', label: 'On hold', hint: 'Proposed for this CCF and put on hold' },
  { key: 'became_members', label: 'Became members', hint: 'Completed their assessment in the period', inPeriod: true },
  { key: 'dropped', label: 'Dropped', hint: 'Placement ended without completing, in the period', inPeriod: true },
]
const LEVEL_LABEL: Record<Level, string> = { council: 'Councils', ccg: 'CCGs', ccf: 'CCFs' }
const PERIOD_LABEL: Record<Period, string> = {
  all: 'All time',
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  this_year: 'This year',
  custom: 'Choose dates',
}
const ALL = 'all'
const NO_COUNCIL = 'none'

const ymd = (d: Date) => d.toISOString().slice(0, 10)
function periodDates(p: Period, custom: { from: string; to: string }): { from: string | null; to: string | null } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const mo = now.getUTCMonth()
  const day = (yy: number, mm: number, dd: number) => ymd(new Date(Date.UTC(yy, mm, dd)))
  switch (p) {
    case 'this_month':
      return { from: day(y, mo, 1), to: ymd(now) }
    case 'last_month':
      return { from: day(y, mo - 1, 1), to: day(y, mo, 0) }
    case 'last_3_months':
      return { from: day(y, mo - 2, 1), to: ymd(now) }
    case 'this_year':
      return { from: day(y, 0, 1), to: ymd(now) }
    case 'custom':
      return { from: custom.from || null, to: custom.to || null }
    default:
      return { from: null, to: null }
  }
}

const add = (t: Counts, r: Counts) => {
  for (const c of COLUMNS) t[c.key] += r[c.key]
  return t
}
const zero = (): Counts => ({ in_ccf: 0, placed: 0, awaiting: 0, on_hold: 0, became_members: 0, dropped: 0 })

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-full [&>span]:truncate" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

export function PlacementBreakdown({
  streamId,
  campusId,
}: {
  /** The stream in focus; none for a campus or church-wide. */
  streamId?: string | null
  /** The campus in focus (or drilled into). */
  campusId?: string | null
}) {
  const [period, setPeriod] = useState<Period>('all')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [seeker, setSeeker] = useState(ALL)
  const [stream, setStream] = useState(ALL)
  const [council, setCouncil] = useState(ALL)
  const [ccg, setCcg] = useState(ALL)
  const [level, setLevel] = useState<Level>('ccg')
  const [data, setData] = useState<Breakdown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seekers, setSeekers] = useState<Array<{ person_id: string; name: string; streams: Ref[] }>>([])
  const [closing, setClosing] = useState<Ref | null>(null)
  const [reload, setReload] = useState(0)
  const { me, hasGlobal } = useCcgMe()
  // The central team, the stream's Sheep Seeking Admin, or its campus's, close its CCFs.
  const canClose = (streamOf: string) =>
    hasGlobal('structure.manage') ||
    !!me?.roles.some(
      (r) => (r.role.key === 'seeking_admin' && r.unit?.id === streamOf) || (r.role.key === 'campus_seeking_admin' && r.unit?.streams?.some((x) => x.id === streamOf))
    )

  const { from, to } = periodDates(period, custom)
  useEffect(() => {
    setData(null)
    setError(null)
    const q = new URLSearchParams()
    if (streamId) q.set('stream_id', streamId)
    else if (campusId) q.set('campus_id', campusId)
    if (seeker !== ALL) q.set('seeker', seeker)
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    ccgApi.get<Breakdown>(`/seekers/placements?${q}`).then((r) => (r.ok ? setData(r.data) : setError(r.error.message)))
  }, [streamId, campusId, seeker, from, to, reload])

  useEffect(() => {
    ccgApi.get<{ seekers: Array<{ person_id: string; name: string; streams: Ref[] }> }>(`/seekers/options${streamId ? `?stream_id=${streamId}` : ''}`).then((r) => {
      if (r.ok) setSeekers(r.data.seekers)
    })
  }, [streamId])

  // Choices come from the rows in scope; each narrows the next.
  const streams = useMemo(() => [...new Map((data?.rows ?? []).map((r) => [r.stream.id, r.stream])).values()].sort((a, b) => a.name.localeCompare(b.name)), [data])
  const inStream = useMemo(() => (data?.rows ?? []).filter((r) => stream === ALL || r.stream.id === stream), [data, stream])
  const councils = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of inStream) m.set(r.council?.id ?? NO_COUNCIL, r.council?.name ?? 'Not in a council')
    return [...m.entries()].sort(([a, x], [b, y]) => (a === NO_COUNCIL ? 1 : b === NO_COUNCIL ? -1 : x.localeCompare(y)))
  }, [inStream])
  const inCouncil = useMemo(() => inStream.filter((r) => council === ALL || (r.council?.id ?? NO_COUNCIL) === council), [inStream, council])
  const ccgs = useMemo(() => [...new Map(inCouncil.map((r) => [r.ccg.id, r.ccg])).values()].sort((a, b) => a.name.localeCompare(b.name)), [inCouncil])
  const rows = useMemo(() => inCouncil.filter((r) => ccg === ALL || r.ccg.id === ccg), [inCouncil, ccg])

  // A narrower filter can't stay set once a wider one no longer contains it.
  useEffect(() => {
    if (council !== ALL && !councils.some(([id]) => id === council)) setCouncil(ALL)
  }, [councils, council])
  useEffect(() => {
    if (ccg !== ALL && !ccgs.some((g) => g.id === ccg)) setCcg(ALL)
  }, [ccgs, ccg])

  const grouped = useMemo(() => {
    const m = new Map<string, { id: string; name: string; sub: string; unit: string | null; stream: string; counts: Counts; ccfs: number }>()
    for (const r of rows) {
      const key = level === 'council' ? r.council?.id ?? NO_COUNCIL : level === 'ccg' ? r.ccg.id : r.ccf.id
      const name = level === 'council' ? r.council?.name ?? 'Not in a council' : level === 'ccg' ? r.ccg.name : r.ccf.name
      const sub = level === 'council' ? r.stream.name : level === 'ccg' ? [r.council?.name, r.stream.name].filter(Boolean).join(' · ') : r.ccg.name
      const unit = level === 'council' ? (r.council ? `council:${r.council.id}` : null) : level === 'ccg' ? `ccg:${r.ccg.id}` : `ccf:${r.ccf.id}`
      const g = m.get(key) ?? { id: key, name, sub, unit, stream: r.stream.id, counts: zero(), ccfs: 0 }
      add(g.counts, r)
      g.ccfs++
      m.set(key, g)
    }
    return [...m.values()].sort((a, b) => b.counts.in_ccf - a.counts.in_ccf || a.name.localeCompare(b.name))
  }, [rows, level])
  const total = useMemo(() => rows.reduce((t, r) => add(t, r), zero()), [rows])

  // A row's name goes one level down; a CCF's opens its converts.
  const drill = (g: (typeof grouped)[number]) => {
    if (level === 'council') {
      setCouncil(g.id)
      setLevel('ccg')
    } else if (level === 'ccg') {
      setCcg(g.id)
      setLevel('ccf')
    }
  }
  const convertsHref = (unit: string | null, name: string, status?: string) =>
    unit ? `/ccg/converts?view=all&unit=${unit}&name=${encodeURIComponent(name)}${status ? `&status=${status}` : ''}` : null

  const download = () => {
    const head = [LEVEL_LABEL[level].replace(/s$/, ''), ...COLUMNS.map((c) => c.label)]
    const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
    const lines = [head, ...grouped.map((g) => [g.name, ...COLUMNS.map((c) => g.counts[c.key])]), ['Total', ...COLUMNS.map((c) => total[c.key])]]
    const blob = new Blob([lines.map((l) => l.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `converts-by-${level}${from ? `-${from}` : ''}${to ? `-to-${to}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const narrowed = council !== ALL || ccg !== ALL || stream !== ALL
  const periodNote = period === 'all' ? '' : from || to ? ` (${from ?? '…'} to ${to ?? 'today'})` : ''

  return (
    <section className="space-y-4">
      <SectionLabel
        action={
          data && grouped.length > 0 ? (
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={download}>
              <Download className="size-4" /> CSV
            </Button>
          ) : null
        }
      >
        Converts by {level === 'council' ? 'council' : level === 'ccg' ? 'CCG' : 'CCF'}
      </SectionLabel>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-3 lg:grid-cols-6">
        {!streamId && streams.length > 1 && (
          <FilterSelect label="Stream" value={stream} onChange={setStream} options={[{ value: ALL, label: 'All streams' }, ...streams.map((s) => ({ value: s.id, label: s.name }))]} />
        )}
        <FilterSelect
          label="Council"
          value={council}
          onChange={setCouncil}
          options={[{ value: ALL, label: 'All councils' }, ...councils.map(([id, name]) => ({ value: id, label: name }))]}
        />
        <FilterSelect label="CCG" value={ccg} onChange={setCcg} options={[{ value: ALL, label: 'All CCGs' }, ...ccgs.map((g) => ({ value: g.id, label: g.name }))]} />
        <FilterSelect
          label="Sheep Seeker"
          value={seeker}
          onChange={setSeeker}
          options={[
            { value: ALL, label: 'Everyone’s converts' },
            ...seekers.filter((s) => !streamId || s.streams.some((x) => x.id === streamId)).map((s) => ({ value: s.person_id, label: s.name })),
          ]}
        />
        <FilterSelect label="Period" value={period} onChange={(v) => setPeriod(v as Period)} options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
        <FilterSelect label="Show" value={level} onChange={(v) => setLevel(v as Level)} options={(Object.keys(LEVEL_LABEL) as Level[]).map((l) => ({ value: l, label: LEVEL_LABEL[l] }))} />
        {period === 'custom' && (
          <div className="col-span-2 grid grid-cols-2 gap-3 sm:col-span-3 lg:col-span-6 lg:max-w-md">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">From</span>
              <Input type="date" className="h-10" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">To</span>
              <Input type="date" className="h-10" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </label>
          </div>
        )}
        {(narrowed || seeker !== ALL || period !== 'all') && (
          <div className="col-span-2 flex items-end sm:col-span-3 lg:col-span-6">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setStream(ALL)
                setCouncil(ALL)
                setCcg(ALL)
                setSeeker(ALL)
                setPeriod('all')
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <DetailTile loading={!data} heading="In CCFs now" value={total.in_ccf} />
            <DetailTile loading={!data} heading={`Placed${periodNote}`} value={total.placed} tone={total.placed > 0 ? 'success' : undefined} />
            <DetailTile
              loading={!data}
              heading="Awaiting approval"
              value={narrowed || !data?.not_placed ? total.awaiting : data.not_placed.proposed}
              href="/ccg/approvals"
            />
            {!narrowed && data?.not_placed ? (
              <DetailTile
                heading="Not matched to a CCF yet"
                value={data.not_placed.new + data.not_placed.needs_info}
                tone={data.not_placed.new + data.not_placed.needs_info > 0 ? 'warning' : undefined}
                href="/ccg/converts?view=all&status=needs_info"
              />
            ) : (
              <DetailTile loading={!data} heading="On hold" value={total.on_hold} tone={total.on_hold > 0 ? 'warning' : undefined} />
            )}
          </div>

          {!data ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : grouped.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No CCFs match these filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-3 font-medium">
                      {LEVEL_LABEL[level].replace(/s$/, '')}
                    </th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} scope="col" title={c.hint} className="px-3 py-3 text-right font-medium">
                        {c.label}
                        {c.inPeriod && period !== 'all' ? '*' : ''}
                      </th>
                    ))}
                    {level === 'ccf' && (
                      <th scope="col" className="w-10 px-2 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {grouped.map((g) => {
                    const placedHref = convertsHref(g.unit, g.name, 'placed')
                    return (
                      <tr key={g.id} className="hover:bg-accent/40">
                        <td className="px-4 py-2.5">
                          {level === 'ccf' ? (
                            <Link href={convertsHref(g.unit, g.name) ?? '#'} className="block min-w-0">
                              <span className="block truncate font-medium text-foreground">{g.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{g.sub}</span>
                            </Link>
                          ) : (
                            <button type="button" onClick={() => drill(g)} className="flex min-w-0 items-center gap-1 text-left" title={`Show its ${level === 'council' ? 'CCGs' : 'CCFs'}`}>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-foreground">{g.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {g.sub ? `${g.sub} · ` : ''}
                                  {g.ccfs} CCF{g.ccfs === 1 ? '' : 's'}
                                </span>
                              </span>
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                            </button>
                          )}
                        </td>
                        {COLUMNS.map((c) => {
                          const n = g.counts[c.key]
                          const cell = <span className={cn('tabular-nums', n === 0 && 'text-muted-foreground')}>{n}</span>
                          return (
                            <td key={c.key} className="px-3 py-2.5 text-right">
                              {c.key === 'in_ccf' && n > 0 && placedHref ? (
                                <Link href={placedHref} className="font-medium text-primary hover:underline">
                                  {cell}
                                </Link>
                              ) : (
                                cell
                              )}
                            </td>
                          )
                        })}
                        {level === 'ccf' && (
                          <td className="px-2 py-2.5 text-right">
                            {canClose(g.stream) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setClosing({ id: g.id, name: g.name })}
                                aria-label={`Close down ${g.name}`}
                                title="Close down"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td className="px-4 py-3">Total</td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="px-3 py-3 text-right tabular-nums">
                        {total[c.key]}
                      </td>
                    ))}
                    {level === 'ccf' && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {period !== 'all' && <p className="text-xs text-muted-foreground">* In the period chosen. The other columns are as of today.</p>}
        </>
      )}
      {closing && <CloseCcfDialog ccfId={closing.id} ccfName={closing.name} onClose={() => setClosing(null)} onDone={() => setReload((n) => n + 1)} />}
    </section>
  )
}
