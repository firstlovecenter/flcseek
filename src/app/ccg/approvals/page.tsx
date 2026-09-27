'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ClipboardCheck, Loader2, PauseCircle, RefreshCw, Shuffle, Sparkles, TriangleAlert } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { FACTOR_LABELS, type Factor } from '@/lib/ccg/engine/config'
import { message } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { CcgPageHeader } from '@/components/ccg/PageHeader'
import { ThinkingOrb } from '@/components/base/Orbs'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'

// ---------------------------------------------------------------------------
// Types (GET /api/ccg/placements)
// ---------------------------------------------------------------------------

interface UnitRef {
  id: string
  code: string
  name: string
  capacity: number
  ccg: { id: string; code: string; name: string }
}

interface Scored {
  ccf_id: string
  ccf_code: string
  ccf_name: string
  ccg_name: string
  overall: number
  factors: Array<{ factor: Factor; score: number | null; weight: number }>
  reasons: string[]
  cautions: string[]
  available_spaces: number
  capacity: number
  member_count: number
}

interface Placement {
  id: string
  status: 'proposed' | 'held'
  person: { id: string; full_name: string; age: number | null; phone: string | null; possible_duplicate: boolean }
  proposed_ccf: UnitRef | null
  proposed_score: number | null
  hold_reason: string | null
  /** Plain-English "why this CCF" (AI). */
  ai_summary?: string | null
  ai_summary_at?: string | null
  waiting_days: number | null
  match: { warnings: string[]; proposed: Scored | null; alternatives?: Scored[] } | null
}

interface CcfOption {
  id: string
  code: string
  name: string
  ccg: { name: string }
  status: string
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  const tone = value >= 70 ? 'text-success' : value >= 45 ? 'text-warning' : 'text-destructive'
  return <span className={cn('font-semibold tabular-nums', tone)}>{Math.round(value)}</span>
}

function FactorTable({ scored }: { scored: Scored }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
      {scored.factors.map((f) => (
        <div key={f.factor} className="flex items-center justify-between gap-2">
          <dt className="truncate text-muted-foreground">{FACTOR_LABELS[f.factor]}</dt>
          <dd className="tabular-nums">{f.score === null ? '—' : Math.round(f.score)}</dd>
        </div>
      ))}
    </dl>
  )
}

function Reasons({ scored }: { scored: Scored }) {
  return (
    <div className="space-y-1.5 text-sm">
      {scored.reasons.map((r) => (
        <p key={r} className="flex gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          {r}
        </p>
      ))}
      {scored.cautions.map((c) => (
        <p key={c} className="flex gap-2 text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          {c}
        </p>
      ))}
      {scored.reasons.length === 0 && scored.cautions.length === 0 && (
        <p className="text-muted-foreground">No standout reasons — a modest fit.</p>
      )}
    </div>
  )
}

type Decision = { kind: 'remap' | 'hold'; placement: Placement }

function Actions({
  p,
  busy,
  onApprove,
  onDecide,
}: {
  p: Placement
  busy: string | null
  onApprove: (p: Placement) => void
  onDecide: (d: Decision) => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {p.status === 'proposed' && p.proposed_ccf && (
        <Button size="sm" onClick={() => onApprove(p)} disabled={busy !== null}>
          {busy === p.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Approve
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => onDecide({ kind: 'remap', placement: p })} disabled={busy !== null}>
        <Shuffle className="size-4" />
        Place elsewhere
      </Button>
      {p.status === 'proposed' && (
        <Button size="sm" variant="ghost" onClick={() => onDecide({ kind: 'hold', placement: p })} disabled={busy !== null}>
          <PauseCircle className="size-4" />
          Hold
        </Button>
      )}
    </div>
  )
}

/** Everything about one proposal: the AI note, why the engine chose it, the scores and the other options. */
function Detail({ p, aiOn }: { p: Placement; aiOn: boolean }) {
  const scored = p.match?.proposed ?? null
  const alternatives = p.match?.alternatives ?? []
  return (
    <div className="space-y-4">
      {p.proposed_ccf ? (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Option 1 · proposed</p>
          <p className="font-semibold">{p.proposed_ccf.name}</p>
          <p className="text-xs text-muted-foreground">
            {p.proposed_ccf.ccg.name} · score <Score value={p.proposed_score} />
          </p>
        </div>
      ) : (
        <Badge variant="warning">No CCF proposed</Badge>
      )}

      {p.hold_reason && (
        <p className="flex gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm">
          <PauseCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          {p.hold_reason}
        </p>
      )}
      {p.match?.warnings.map((w) => (
        <p key={w} className="flex gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          {w}
        </p>
      ))}

      {p.status === 'proposed' &&
        (p.ai_summary ? (
          <p className="flex gap-2 rounded-md bg-primary/5 px-3 py-2 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              {p.ai_summary}
              <span className="sr-only"> (written by AI)</span>
            </span>
          </p>
        ) : (
          aiOn &&
          !p.ai_summary_at && (
            <p className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-sm text-muted-foreground" role="status">
              <ThinkingOrb />
              Writing a summary…
            </p>
          )
        ))}

      {scored && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Why this CCF</h3>
          <Reasons scored={scored} />
        </section>
      )}
      {scored && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Scores</h3>
          <FactorTable scored={scored} />
        </section>
      )}
      {alternatives.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Other options</h3>
          {alternatives.map((a, i) => (
            <div key={a.ccf_id} className="flex items-center justify-between gap-2 border-t py-2 text-sm first:border-t-0">
              <span className="min-w-0 truncate">
                <span className="font-medium">Option {i + 2}:</span> {a.ccf_name} <span className="text-xs text-muted-foreground">· {a.ccg_name}</span>
              </span>
              <Score value={a.overall} />
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CcgApprovalsPage() {
  const { has, loading: meLoading } = useCcgMe()
  const [tab, setTab] = useState<'proposed' | 'held'>('proposed')
  const [items, setItems] = useState<Placement[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [ccfs, setCcfs] = useState<CcfOption[]>([])
  const [aiOn, setAiOn] = useState(false)

  const canApprove = has('placements.approve')

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setItems(null)
        setSelected(new Set())
      }
      // The API returns up to 200 at a time: fetch page after page so the whole queue is listed.
      const all: Placement[] = []
      let ai = false
      let count = 0
      for (let offset = 0; ; offset += 200) {
        const res = await ccgApi.get<{ placements: Placement[]; ai?: boolean }>(`/placements?status=${tab}&limit=200&offset=${offset}`)
        if (!res.ok) return quiet ? undefined : setError(res.error.message)
        all.push(...res.data.placements)
        ai = !!res.data.ai
        count = Number(res.meta?.total ?? all.length)
        if (res.data.placements.length === 0 || all.length >= count) break
      }
      setError(null)
      setAiOn(ai)
      setItems(all)
      setTotal(count)
    },
    [tab]
  )

  useEffect(() => {
    load()
  }, [load])

  // Summaries are written after the proposal is made: check back a few times while any are on their way.
  const writing = aiOn && tab === 'proposed' && !!items?.some((p) => !p.ai_summary_at)
  const [polls, setPolls] = useState(0)
  useEffect(() => setPolls(0), [tab])
  useEffect(() => {
    if (!writing || polls >= 6) return
    const t = setTimeout(() => {
      setPolls((n) => n + 1)
      load(true)
    }, 5000)
    return () => clearTimeout(t)
  }, [writing, polls, load])

  useEffect(() => {
    ccgApi.get<{ ccfs: CcfOption[] }>('/ccfs').then((r) => r.ok && setCcfs(r.data.ccfs.filter((f) => f.status === 'active')))
  }, [])

  const approve = async (p: Placement) => {
    setBusy(p.id)
    const res = await ccgApi.post(`/placements/${p.id}/approve`)
    setBusy(null)
    if (!res.ok) {
      message.error(res.error.details?.reason === 'ccf_full' ? `${p.proposed_ccf?.name} is now full. Rescore to get a new proposal.` : res.error.message)
      return
    }
    message.success(`${p.person.full_name} placed in ${p.proposed_ccf?.name}`)
    load()
  }

  const approveSelected = async () => {
    setBusy('bulk')
    // The API takes up to 200 per request.
    const ids = [...selected]
    let approved = 0
    let failed = 0
    for (let i = 0; i < ids.length; i += 200) {
      const res = await ccgApi.post<{ approved: number; failed: number }>('/placements/bulk-approve', { placement_ids: ids.slice(i, i + 200) })
      if (!res.ok) {
        setBusy(null)
        message.error(res.error.message)
        return load()
      }
      approved += res.data.approved
      failed += res.data.failed
    }
    setBusy(null)
    if (failed) message.warning(`${approved} approved, ${failed} could not be — see the remaining items.`)
    else message.success(`${approved} approved`)
    load()
  }

  const rescoreAll = async () => {
    setBusy('rescore')
    const res = await ccgApi.post<{ rescored: number; proposed: number; held: number }>('/placements/rescore')
    setBusy(null)
    if (!res.ok) return message.error(res.error.message)
    message.success(`Re-matched ${res.data.rescored}: ${res.data.proposed} proposed, ${res.data.held} with no eligible CCF`)
    load()
  }

  const toggleSelected = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const open = items?.find((p) => p.id === openId) ?? null

  const selectable = useMemo(() => (tab === 'proposed' ? items ?? [] : []), [items, tab])
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id))

  if (!meLoading && !has('placements.view')) {
    return <EmptyState icon={ClipboardCheck} title="Approvals" description="You don’t have access to the approval queue." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load the queue" message={error} onRetry={() => load()} />

  return (
    <div className="space-y-6">
      <CcgPageHeader
        title="Approvals"
        description="Every new convert is matched to a CCF as soon as they register. Approve the proposal, place them elsewhere, or hold them."
        actions={
          has('placements.approve') && (
            <Button variant="outline" onClick={rescoreAll} disabled={busy !== null}>
              {busy === 'rescore' ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Re-match waiting converts
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'proposed' | 'held')}>
          <TabsList>
            <TabsTrigger value="proposed">Proposed</TabsTrigger>
            <TabsTrigger value="held">On hold</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === 'proposed' && canApprove && selectable.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => setSelected(v ? new Set(selectable.map((p) => p.id)) : new Set())}
                aria-label="Select all"
              />
              Select all
            </label>
            <Button onClick={approveSelected} disabled={selected.size === 0 || busy !== null}>
              {busy === 'bulk' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Approve {selected.size || ''} selected
            </Button>
          </div>
        )}
      </div>

      {items === null ? (
        <div className="space-y-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={tab === 'proposed' ? 'Nothing waiting for approval' : 'Nobody on hold'}
          description={
            tab === 'proposed'
              ? 'New converts appear here with their proposed CCF as soon as they register.'
              : 'Converts put on hold, or with no CCF that fits, appear here.'
          }
        />
      ) : (
        <Card className="gap-0 divide-y divide-border overflow-hidden p-0">
          <p className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            {total} {tab === 'proposed' ? 'waiting for approval' : 'on hold'}, oldest first. Click a name for the details.
          </p>
          {items.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 px-4 py-2.5 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {tab === 'proposed' && canApprove && (
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={(v) => toggleSelected(p.id, !!v)}
                    aria-label={`Select ${p.person.full_name}`}
                  />
                )}
                <button type="button" onClick={() => setOpenId(p.id)} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium text-foreground hover:underline">{p.person.full_name}</span>
                    {p.person.age !== null && <span className="text-xs text-muted-foreground">{p.person.age}</span>}
                    {p.person.possible_duplicate && <Badge variant="warning">Possible duplicate</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.proposed_ccf ? (
                      <>
                        {p.proposed_ccf.name} · {p.proposed_ccf.ccg.name} · score <Score value={p.proposed_score} />
                      </>
                    ) : (
                      p.hold_reason ?? 'No CCF proposed'
                    )}
                    {' · '}
                    {p.waiting_days ?? 0} day{p.waiting_days === 1 ? '' : 's'}
                  </span>
                </button>
              </div>
              {canApprove && <Actions p={p} busy={busy} onApprove={approve} onDecide={setDecision} />}
            </div>
          ))}
        </Card>
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  {open.person.full_name}
                  {open.person.age !== null && <span className="text-sm font-normal text-muted-foreground">{open.person.age}</span>}
                  {open.person.possible_duplicate && <Badge variant="warning">Possible duplicate</Badge>}
                </SheetTitle>
                <SheetDescription>
                  {open.person.phone ?? 'No phone'} · waiting {open.waiting_days ?? 0} day{open.waiting_days === 1 ? '' : 's'}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                <Detail p={open} aiOn={aiOn} />
                {canApprove && (
                  <Actions
                    p={open}
                    busy={busy}
                    onApprove={async (p) => {
                      await approve(p)
                      setOpenId(null)
                    }}
                    onDecide={(d) => {
                      setOpenId(null)
                      setDecision(d)
                    }}
                  />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <DecisionDialog decision={decision} ccfs={ccfs} onClose={() => setDecision(null)} onDone={load} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Remap / hold dialog
// ---------------------------------------------------------------------------

function DecisionDialog({
  decision,
  ccfs,
  onClose,
  onDone,
}: {
  decision: Decision | null
  ccfs: CcfOption[]
  onClose: () => void
  onDone: () => void
}) {
  const [ccfId, setCcfId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!decision) return
    setReason('')
    setCcfId(decision.placement.match?.alternatives?.[0]?.ccf_id ?? '')
  }, [decision])

  if (!decision) return null
  const p = decision.placement
  const isRemap = decision.kind === 'remap'
  const alternatives = p.match?.alternatives ?? []
  const others = ccfs.filter((f) => f.id !== p.proposed_ccf?.id && !alternatives.some((a) => a.ccf_id === f.id))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = isRemap
      ? await ccgApi.post(`/placements/${p.id}/remap`, { ccf_id: ccfId, reason: reason.trim() })
      : await ccgApi.post(`/placements/${p.id}/hold`, { reason: reason.trim() })
    setSaving(false)
    if (!res.ok) return message.error(res.error.message)
    message.success(isRemap ? `${p.person.full_name} placed` : `${p.person.full_name} put on hold`)
    onClose()
    onDone()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isRemap ? `Place ${p.person.full_name} elsewhere` : `Hold ${p.person.full_name}`}</DialogTitle>
            <DialogDescription>
              {isRemap
                ? 'Choose a different CCF. The reason is kept with the placement so the choice can be reviewed later.'
                : 'They stay out of the queue until they are placed or re-matched.'}
            </DialogDescription>
          </DialogHeader>

          {isRemap && (
            <div className="space-y-1.5">
              <Label htmlFor="remap-ccf">CCF</Label>
              <Select value={ccfId} onValueChange={setCcfId}>
                <SelectTrigger id="remap-ccf" className="w-full">
                  <SelectValue placeholder="Choose a CCF" />
                </SelectTrigger>
                <SelectContent>
                  {alternatives.map((a, i) => (
                    <SelectItem key={a.ccf_id} value={a.ccf_id}>
                      Option {i + 2}: {a.ccf_name} · {a.ccg_name} ({Math.round(a.overall)})
                    </SelectItem>
                  ))}
                  {others.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} · {f.ccg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="decision-reason">{isRemap ? 'Why this CCF?' : 'What is needed?'}</Label>
            <Textarea
              id="decision-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isRemap ? 'e.g. Her sister is in this CCF' : 'e.g. Confirm which area she lives in'}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !reason.trim() || (isRemap && !ccfId)}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isRemap ? 'Place' : 'Hold'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
