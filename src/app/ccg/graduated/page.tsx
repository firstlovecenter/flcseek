'use client'

import { useCallback, useEffect, useState } from 'react'
import { GraduationCap, Search } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { useCcgFocus, useSeekingRole } from '@/components/ccg/CcgFocusProvider'
import { Initials, StickyHeader } from '@/components/ccg/synago'

interface Graduate {
  placement_id: string
  person: { id: string; full_name: string }
  ccf: { id: string; name: string; ccg: string } | null
  seeker: { id: string; full_name: string } | null
  placed_on: string | null
  graduated_on: string | null
  days: number | null
}
interface Data {
  counts: { total: number; this_month: number; this_year: number }
  graduates: Graduate[]
}

const PAGE = 50
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

/**
 * Sheep Seeking's Graduated list: converts who completed their assessment
 * year and became members of their CCF. Kept for statistics and read-only:
 * as members they are followed up in City Church Groups. A Sheep Seeker sees
 * their own; an Overseer their stream's.
 */
export default function CcgGraduatedPage() {
  const { has, loading: meLoading } = useCcgMe()
  const { focus } = useCcgFocus()
  const role = useSeekingRole()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [data, setData] = useState<Data | null>(null)
  const [more, setMore] = useState<Graduate[]>([])
  const [error, setError] = useState<string | null>(null)

  const url = useCallback(
    (offset: number) => {
      const q = new URLSearchParams({ limit: String(PAGE), offset: String(offset) })
      if (role === 'seeker') q.set('seeker', 'me')
      else if (focus?.type === 'stream' && focus.id) q.set('stream_id', focus.id)
      if (query) q.set('search', query)
      return `/seekers/graduated?${q}`
    },
    [role, focus, query]
  )

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!has('reports.view') || !focus) return
    setData(null)
    setMore([])
    ccgApi.get<Data>(url(0)).then((r) => (r.ok ? (setError(null), setData(r.data)) : setError(r.error.message)))
  }, [has, focus, url])

  const loadMore = async () => {
    const r = await ccgApi.get<Data>(url((data?.graduates.length ?? 0) + more.length))
    if (r.ok) setMore((m) => [...m, ...r.data.graduates])
  }

  if (!meLoading && !has('reports.view')) {
    return <EmptyState icon={GraduationCap} title="Graduated" description="You don’t have access to this list." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load graduates" message={error} />

  const rows = [...(data?.graduates ?? []), ...more]
  const title = role === 'seeker' ? 'My' : focus?.type === 'stream' ? focus.name : null

  return (
    <div className="pb-10">
      <StickyHeader className="space-y-3">
        <div>
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-foreground">
            {title ? `${title} ` : ''}
            <span className="text-success">Graduated</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Completed their assessment year and became members of their CCF. For your records only.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search by name…"
            className="h-11 w-full rounded-lg border border-input bg-muted/40 pr-4 pl-9 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search graduates"
          />
        </div>
      </StickyHeader>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {(
          [
            ['This month', data?.counts.this_month],
            ['This year', data?.counts.this_year],
            ['All time', data?.counts.total],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            {value === undefined ? <Skeleton className="mt-1.5 h-7 w-12" /> : <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>}
          </div>
        ))}
      </div>

      {!data ? (
        <Skeleton className="mt-4 h-64 rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={query ? 'No one matches' : 'No graduates yet'}
          description={query ? 'Try another name.' : 'Converts appear here when they complete their assessment year.'}
          className="mt-12"
        />
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Member of
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Graduated
                  </th>
                  {role !== 'seeker' && (
                    <th scope="col" className="px-3 py-3 font-medium">
                      Sheep Seeker
                    </th>
                  )}
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    Days
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((g) => (
                  <tr key={g.placement_id}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-3">
                        <Initials name={g.person.full_name} className="size-8 text-[11px]" />
                        <span className="font-medium text-foreground">{g.person.full_name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {g.ccf ? (
                        <>
                          <span className="block text-foreground">{g.ccf.name}</span>
                          <span className="block text-xs text-muted-foreground">{g.ccf.ccg}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{fmt(g.graduated_on)}</td>
                    {role !== 'seeker' && <td className="px-3 py-2.5 text-muted-foreground">{g.seeker?.full_name ?? 'Not assigned'}</td>}
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{g.days ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length < data.counts.total && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={loadMore}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
