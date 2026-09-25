'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ClipboardCheck, Loader2, PauseCircle, RefreshCw, Shuffle, Sparkles, TriangleAlert } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { CcgPageHeader } from '@/components/ccg/PageHeader'
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [ccfs, setCcfs] = useState<CcfOption[]>([])

  const canApprove = has('placements.approve')

  const load = useCallback(async () => {
    setItems(null)
    setSelected(new Set())
    const res = await ccgApi.get<{ placements: Placement[] }>(`/placements?status=${tab}&limit=100`)
    if (!res.ok) return setError(res.error.message)
    setError(null)
    setItems(res.data.placements)
    setTotal(Number(res.meta?.total ?? res.data.placements.length))
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

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
    const res = await ccgApi.post<{ approved: number; failed: number; results: Array<{ id: string; ok: boolean; error?: string }> }>(
      '/placements/bulk-approve',
      { placement_ids: [...selected] }
    )
    setBusy(null)
    if (!res.ok) return message.error(res.error.message)
    if (res.data.failed) message.warning(`${res.data.approved} approved, ${res.data.failed} could not be — see the remaining items.`)
    else message.success(`${res.data.approved} approved`)
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
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectable = useMemo(() => (tab === 'proposed' ? items ?? [] : []), [items, tab])
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id))

  if (!meLoading && !has('placements.view')) {
    return <EmptyState icon={ClipboardCheck} title="Approvals" description="You don’t have access to the approval queue." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load the queue" message={error} onRetry={load} />

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
        <div className="space-y-3">
          {total > items.length && (
            <p className="text-xs text-muted-foreground">
              Showing the oldest {items.length} of {total}.
            </p>
          )}
          {items.map((p) => {
            const scored = p.match?.proposed ?? null
            const open = expanded.has(p.id)
            return (
              <Card key={p.id} className="gap-0 p-4">
                <div className="flex gap-3">
                  {tab === 'proposed' && canApprove && (
                    <Checkbox
                      className="mt-1"
                      checked={selected.has(p.id)}
                      onCheckedChange={(v) => toggleSelected(p.id, !!v)}
                      aria-label={`Select ${p.person.full_name}`}
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 font-semibold">
                          {p.person.full_name}
                          {p.person.age !== null && <span className="text-sm font-normal text-muted-foreground">{p.person.age}</span>}
                          {p.person.possible_duplicate && <Badge variant="warning">Possible duplicate</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.person.phone ?? 'No phone'} · waiting {p.waiting_days ?? 0} day{p.waiting_days === 1 ? '' : 's'}
                        </p>
                      </div>
                      {p.proposed_ccf ? (
                        <div className="text-right">
                          <p className="text-sm">
                            <span className="text-muted-foreground">Proposed: </span>
                            <span className="font-medium">{p.proposed_ccf.name}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.proposed_ccf.ccg.name} · score <Score value={p.proposed_score} />
                          </p>
                        </div>
                      ) : (
                        <Badge variant="warning">No CCF proposed</Badge>
                      )}
                    </div>

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

                    {p.ai_summary && tab === 'proposed' && (
                      <p className="flex gap-2 rounded-md bg-primary/5 px-3 py-2 text-sm">
                        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <span>
                          {p.ai_summary}
                          <span className="sr-only"> (written by AI)</span>
                        </span>
                      </p>
                    )}
                    {scored && <Reasons scored={scored} />}

                    {(scored || (p.match?.alternatives?.length ?? 0) > 0) && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(p.id)}
                        aria-expanded={open}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
                        {open ? 'Hide' : 'Show'} scores and alternatives
                      </button>
                    )}
                    {open && (
                      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                        {scored && <FactorTable scored={scored} />}
                        {(p.match?.alternatives ?? []).map((a, i) => (
                          <div key={a.ccf_id} className="flex items-center justify-between gap-2 border-t pt-2 text-sm">
                            <span className="min-w-0 truncate">
                              #{i + 2} {a.ccf_name} <span className="text-xs text-muted-foreground">· {a.ccg_name}</span>
                            </span>
                            <Score value={a.overall} />
                          </div>
                        ))}
                      </div>
                    )}

                    {canApprove && (
                      <div className="flex flex-wrap gap-2">
                        {p.status === 'proposed' && p.proposed_ccf && (
                          <Button size="sm" onClick={() => approve(p)} disabled={busy !== null}>
                            {busy === p.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                            Approve
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setDecision({ kind: 'remap', placement: p })} disabled={busy !== null}>
                          <Shuffle className="size-4" />
                          Place elsewhere
                        </Button>
                        {p.status === 'proposed' && (
                          <Button size="sm" variant="ghost" onClick={() => setDecision({ kind: 'hold', placement: p })} disabled={busy !== null}>
                            <PauseCircle className="size-4" />
                            Hold
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

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
                      #{i + 2} {a.ccf_name} · {a.ccg_name} ({Math.round(a.overall)})
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
