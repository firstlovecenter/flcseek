'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Download, Search, SlidersHorizontal, UserPlus, Users } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from './CcgMeProvider'
import { useCcgFocus, useSeekingRole } from './CcgFocusProvider'
import { PersonFormDialog } from './PersonFormDialog'
import { PersonSheet } from './PersonSheet'
import { PERSON_STATUS, type PersonDTO } from './people-types'
import { Initials, StickyHeader } from './synago'

/**
 * The members page and the converts page (separate, as asked), in the admin
 * portal's members-grid style: sticky header with count, search, add,
 * download and filters; cards on desktop, rows on mobile.
 *
 * Scope: ?unit=ccf:<id> (from a unit's page), else the church in focus.
 */

type Kind = 'member' | 'convert'
const PAGE = 48
const STATUSES: Record<Kind, string[]> = {
  convert: ['new', 'proposed', 'needs_info', 'placed', 'integrated', 'inactive'],
  member: ['pending', 'active', 'inactive'],
}
const UNIT_PARAM: Record<string, string> = { ccf: 'ccf_id', ccg: 'ccg_id', council: 'council_id', stream: 'stream_id' }

function subtitle(p: PersonDTO): string {
  if (p.kind === 'member') return [p.ccf?.name, p.login ? 'Leader' : null].filter(Boolean).join(' · ') || '—'
  if (p.placement?.ccf) return p.placement.ccf.name
  if (p.proposal?.ccf) return `Proposed: ${p.proposal.ccf.name}`
  if (p.proposal) return 'On hold'
  return p.stream?.name ?? 'Not matched yet'
}

function StatusBadge({ status }: { status: string }) {
  const s = PERSON_STATUS[status] ?? { label: status, tone: 'secondary' as const }
  return (
    <Badge variant={s.tone} className="shrink-0">
      {s.label}
    </Badge>
  )
}

function csv(rows: PersonDTO[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['First name', 'Middle name', 'Last name', 'Phone', 'Email', 'Gender', 'Date of birth', 'Status', 'CCF', 'Stream', 'Registered']
  const lines = rows.map((p) =>
    [
      p.first_name,
      p.middle_name,
      p.last_name,
      p.phone,
      p.email,
      p.gender,
      p.date_of_birth,
      PERSON_STATUS[p.status]?.label ?? p.status,
      p.kind === 'member' ? p.ccf?.name : p.placement?.ccf?.name ?? p.proposal?.ccf?.name,
      p.stream?.name,
      p.created_at?.slice(0, 10),
    ]
      .map(esc)
      .join(',')
  )
  return [head.map(esc).join(','), ...lines].join('\n')
}

export function PeopleDirectory({ kind, tabs }: { kind: Kind; /** e.g. the converts page's view switch */ tabs?: React.ReactNode }) {
  const { me, has, loading: meLoading } = useCcgMe()
  const { focus, options } = useCcgFocus()
  const params = useSearchParams()
  const router = useRouter()

  const unitParam = params.get('unit')
  const [unitType, unitId] = unitParam?.split(':') ?? []
  const scopeQuery = useMemo(() => {
    if (unitType && unitId && UNIT_PARAM[unitType]) return `${UNIT_PARAM[unitType]}=${unitId}`
    if (focus && focus.type !== 'global' && focus.id) return `${UNIT_PARAM[focus.type]}=${focus.id}`
    return ''
  }, [unitType, unitId, focus])
  const scopeName = unitType ? params.get('name') : focus && focus.type !== 'global' ? focus.name : null

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string | null>(params.get('status'))
  // Sheep Seekers: only the converts they brought (?seeker=me).
  const isSeeker = kind === 'convert' && !!me?.roles.some((r) => r.role.key === 'sheep_seeker')
  // With the Sheep Seeker role in focus, start from the converts assigned to them.
  const seekingRole = useSeekingRole()
  const [mine, setMine] = useState(params.get('seeker') === 'me' || (seekingRole === 'seeker' && !params.get('unit') && !params.get('seeker')))
  // One seeker's converts (from the Sheep Seekers report).
  const seekerId = params.get('seeker') !== 'me' ? params.get('seeker') : null
  const [gender, setGender] = useState<string | null>(null)
  const [rows, setRows] = useState<PersonDTO[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // "?person=" (a leader link on a group's page) opens that profile.
  const [openId, setOpenId] = useState<string | null>(params.get('person'))
  const [form, setForm] = useState<{ kind: Kind; personId?: string } | null>(null)
  const [downloading, setDownloading] = useState(false)

  // "?new=1" (quick actions) opens the form straight away.
  useEffect(() => {
    if (params.get('new') === '1' && has('people.manage')) {
      setForm({ kind })
      const next = new URLSearchParams(params.toString())
      next.delete('new')
      router.replace(`/ccg/${kind === 'member' ? 'members' : 'converts'}${next.size ? `?${next}` : ''}`, { scroll: false })
    }
  }, [params, has, kind, router])

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const url = useCallback(
    (offset: number, limit = PAGE) => {
      const q = new URLSearchParams({ kind, limit: String(limit), offset: String(offset) })
      if (status) q.set('status', status)
      if (gender) q.set('gender', gender)
      if (query) q.set('search', query)
      if (kind === 'convert' && (mine || seekerId)) q.set('seeker', mine ? 'me' : seekerId!)
      return `/people?${q}${scopeQuery ? `&${scopeQuery}` : ''}`
    },
    [kind, status, gender, query, scopeQuery, mine, seekerId]
  )

  const load = useCallback(async () => {
    setRows(null)
    const r = await ccgApi.get<{ people: PersonDTO[] }>(url(0))
    if (!r.ok) return setError(r.error.message)
    setError(null)
    setRows(r.data.people)
    setTotal(Number(r.meta?.total ?? r.data.people.length))
  }, [url])

  useEffect(() => {
    if (!has('people.view') || (options.length > 0 && !focus && !unitParam)) return
    load()
  }, [load, has, options.length, focus, unitParam])

  const loadMore = async () => {
    if (!rows) return
    setMore(true)
    const r = await ccgApi.get<{ people: PersonDTO[] }>(url(rows.length))
    setMore(false)
    if (r.ok) setRows([...rows, ...r.data.people])
  }

  const download = async () => {
    setDownloading(true)
    const all: PersonDTO[] = []
    for (let offset = 0; offset < 10_000; offset += 200) {
      const r = await ccgApi.get<{ people: PersonDTO[] }>(url(offset, 200))
      if (!r.ok) break
      all.push(...r.data.people)
      if (r.data.people.length < 200) break
    }
    setDownloading(false)
    const blob = new Blob([csv(all)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(scopeName ?? 'ccg').replace(/\W+/g, '-').toLowerCase()}-${kind === 'member' ? 'members' : 'converts'}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const noun = kind === 'member' ? 'Members' : 'Converts'
  const filtering = !!query || !!status || !!gender
  const filtersActive = !!status || !!gender

  if (!meLoading && !has('people.view')) {
    return <EmptyState icon={Users} title={noun} description={`You don’t have access to ${noun.toLowerCase()}.`} className="mt-12" />
  }
  if (error) return <ErrorScreen title={`Couldn’t load ${noun.toLowerCase()}`} message={error} onRetry={load} />

  return (
    <div className="pb-8">
      <StickyHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-foreground">
            {scopeName ? `${scopeName} ` : ''}
            <span className="text-members">{noun}</span>
          </h1>
          {rows && (
            <span className="ml-2 shrink-0 text-sm tabular-nums">
              <span className="font-semibold text-members">{filtering ? rows.length : total}</span>
              <span className="text-muted-foreground"> {filtering ? 'matches' : noun.toLowerCase()}</span>
            </span>
          )}
        </div>
        {tabs}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder={`Search ${noun.toLowerCase()} by name, phone or ref…`}
            className="h-11 w-full rounded-lg border border-input bg-muted/40 pr-4 pl-9 text-sm transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={`Search ${noun.toLowerCase()}`}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          {has('people.manage') ? (
            <Button variant="outline" className="h-11 gap-1.5" onClick={() => setForm({ kind })}>
              <UserPlus className="size-4" />
              {kind === 'member' ? 'Add member' : 'Register convert'}
            </Button>
          ) : (
            <span />
          )}
          <div className="ml-auto flex items-center gap-1">
            {isSeeker && (
              <Button variant={mine ? 'secondary' : 'ghost'} className="h-11" aria-pressed={mine} onClick={() => setMine((m) => !m)}>
                My converts
              </Button>
            )}
            <Button variant="ghost" className="h-11 gap-1.5" onClick={download} disabled={downloading || !rows?.length} aria-label={`Download ${noun.toLowerCase()} list`}>
              <Download className="size-4" />
              <span className="hidden sm:inline">{downloading ? 'Preparing…' : 'Download'}</span>
            </Button>
            <Button variant="ghost" className={cn('h-11 gap-1.5', filtersActive && 'text-members')} onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="size-4" />
              Filters
              {filtersActive && <span className="inline-block size-1.5 rounded-full bg-members" />}
            </Button>
          </div>
        </div>
      </StickyHeader>

      {rows === null ? (
        <>
          <div className="md:hidden">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border px-1 py-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden grid-cols-2 gap-3 py-4 md:grid lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="min-h-44 rounded-xl" />
            ))}
          </div>
        </>
      ) : rows.length === 0 ? (
        <p className="px-4 py-20 text-center text-sm text-muted-foreground">
          {filtering
            ? `No ${noun.toLowerCase()} match.`
            : kind === 'member'
              ? 'No members yet. Add them, or share a CCF’s member link.'
              : 'No converts yet. Register one, or share an intake link or QR code.'}
        </p>
      ) : (
        <>
          {/* Mobile: rows */}
          <ul className="-mx-4 md:hidden">
            {rows.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
                >
                  <Initials name={p.full_name} className="size-10 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{p.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{subtitle(p)}</p>
                  </div>
                  {p.status !== 'active' && <StatusBadge status={p.status} />}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          {/* Desktop: cards */}
          <div className="hidden grid-cols-2 gap-3 py-4 md:grid lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpenId(p.id)}
                className="group flex min-h-44 flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-members/40 hover:shadow-md active:translate-y-0"
              >
                <Initials name={p.full_name} className="size-16 text-base" />
                <div className="w-full min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.full_name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle(p)}</p>
                </div>
                {p.status !== 'active' && <StatusBadge status={p.status} />}
              </button>
            ))}
          </div>
          {rows.length < total && !filtering && (
            <div className="py-3 text-center">
              <Button variant="ghost" size="sm" onClick={loadMore} disabled={more}>
                {more ? 'Loading…' : `Show more (${total - rows.length} left)`}
              </Button>
            </div>
          )}
        </>
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Filter {noun.toLowerCase()}</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-8">
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUSES[kind].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={status === s}
                    onClick={() => setStatus(status === s ? null : s)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors',
                      status === s ? 'border-members bg-members/10 text-members' : 'border-border hover:bg-accent'
                    )}
                  >
                    {PERSON_STATUS[s]?.label ?? s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <div className="flex flex-wrap gap-2">
                {['Male', 'Female'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={gender === g}
                    onClick={() => setGender(gender === g ? null : g)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors',
                      gender === g ? 'border-members bg-members/10 text-members' : 'border-border hover:bg-accent'
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStatus(null)
                  setGender(null)
                }}
              >
                Clear
              </Button>
              <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <PersonSheet personId={openId} onClose={() => setOpenId(null)} onEdit={(p) => setForm({ kind: p.kind, personId: p.id })} onChanged={load} />
      <PersonFormDialog
        mode={form}
        onClose={() => setForm(null)}
        onSaved={(id) => {
          load()
          setTimeout(() => setOpenId(id), 0)
        }}
      />
    </div>
  )
}
