'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, RotateCcw, Shuffle, ShieldAlert } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { CcgPageHeader } from '@/components/ccg/PageHeader'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { focusFilter, useCcgFocus } from '@/components/ccg/CcgFocusProvider'
import { UnitDrill } from '@/components/ccg/synago'

type Status = 'open' | 'confirmed' | 'released' | 'replaced'
type Decision = 'confirm' | 'release' | 'replace'
type Ref = { id: string; name: string }

interface Case {
  id: string
  status: Status
  person: { id: string; full_name: string; phone: string | null; ref_code: string | null }
  ccf: { id: string; name: string; ccg: Ref } | null
  stream: Ref | null
  reason: string
  flagged_by: Ref | null
  flagged_at: string | null
  decided_by: Ref | null
  decided_at: string | null
  decision_note: string | null
}

const TABS: Record<'open' | 'bacenta' | 'closed', { label: string; status: Status[] }> = {
  open: { label: 'In quarantine', status: ['open'] },
  bacenta: { label: 'In a Bacenta', status: ['confirmed'] },
  closed: { label: 'Released or re-placed', status: ['released', 'replaced'] },
}

const DECISION: Record<Decision, { title: string; verb: string; about: (c: Case) => string }> = {
  confirm: {
    title: 'They belong to a Bacenta',
    verb: 'Confirm',
    about: (c) =>
      `${c.person.full_name} leaves CCF placement for good${c.ccf ? ` (they were in ${c.ccf.name})` : ''} and is kept, read only, under “In a Bacenta” for statistics.`,
  },
  release: {
    title: 'Release them',
    verb: 'Release',
    about: (c) =>
      c.ccf
        ? `${c.person.full_name} goes back to ${c.ccf.name} with their progress, if it still has room for another convert.`
        : `${c.person.full_name} was not placed yet: they are matched again and the proposal goes to Approvals.`,
  },
  replace: {
    title: 'Place them elsewhere',
    verb: 'Re-match',
    about: (c) => `${c.person.full_name} is matched afresh, as a new convert is. The proposal goes to Approvals, where it can be placed in another CCF.`,
  },
}

const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

/**
 * Converts who already belong to a Bacenta, quarantined by their CCF's leaders or
 * the Sheep Seeking team. The stream's (or campus's) Sheep Seeking Admin decides:
 * confirm, release back, or place elsewhere.
 */
export default function CcgQuarantinePage() {
  const { has, loading: meLoading } = useCcgMe()
  const { focus, ready } = useCcgFocus()
  const unit = focus?.type === 'stream' || focus?.type === 'campus' ? focusFilter(focus) : ''
  const [tab, setTab] = useState<keyof typeof TABS>('open')
  const [cases, setCases] = useState<Case[] | null>(null)
  const [open, setOpen] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [deciding, setDeciding] = useState<{ c: Case; decision: Decision } | null>(null)

  const load = useCallback(async () => {
    if (!ready) return
    setCases(null)
    const r = await ccgApi.get<{ quarantines: Case[]; open: number }>(`/quarantines?status=${TABS[tab].status.join(',')}${unit ? `&${unit}` : ''}`)
    if (!r.ok) return setError(r.error.message)
    setError(null)
    setCases(r.data.quarantines)
    setOpen(r.data.open)
  }, [tab, unit, ready])

  useEffect(() => {
    if (has('seekers.manage')) load()
  }, [load, has])

  if (!meLoading && !has('seekers.manage')) {
    return <EmptyState icon={ShieldAlert} title="Quarantine" description="This is for Sheep Seeking Admins." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load quarantine" message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      <CcgPageHeader
        title="Quarantine"
        description="Converts who already belong to a Bacenta, set aside by their CCF’s leaders or the Sheep Seeking team. They have left their CCF. Confirm, release them back, or place them elsewhere."
      />
      <UnitDrill />

      <Tabs value={tab} onValueChange={(v) => setTab(v as keyof typeof TABS)}>
        <TabsList>
          {(Object.keys(TABS) as Array<keyof typeof TABS>).map((k) => (
            <TabsTrigger key={k} value={k}>
              {TABS[k].label}
              {k === 'open' && open > 0 && <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-[11px] text-white tabular-nums">{open}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!cases ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={tab === 'open' ? 'No one in quarantine' : 'Nothing here yet'}
          description={
            tab === 'open'
              ? 'A CCF Coordinator (or the leaders and admins above, or the Sheep Seeking team) quarantines a convert who already belongs to a Bacenta from their profile.'
              : undefined
          }
          className="mt-8"
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cases.map((c) => (
            <li key={c.id}>
              <Card className="h-full gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{c.person.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[c.person.phone, c.stream?.name].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {c.status !== 'open' && (
                    <Badge variant={c.status === 'confirmed' ? 'secondary' : 'outline'}>
                      {c.status === 'confirmed' ? 'In a Bacenta' : c.status === 'released' ? 'Released' : 'Re-placed'}
                    </Badge>
                  )}
                </div>
                <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">“{c.reason}”</p>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Left</dt>
                    <dd className="font-medium text-foreground">{c.ccf ? `${c.ccf.name} · ${c.ccf.ccg.name}` : 'Not placed yet'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Quarantined</dt>
                    <dd className="font-medium text-foreground">
                      {fmt(c.flagged_at)}
                      {c.flagged_by && ` by ${c.flagged_by.name}`}
                    </dd>
                  </div>
                  {c.status !== 'open' && (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Decided</dt>
                      <dd className="font-medium text-foreground">
                        {fmt(c.decided_at)}
                        {c.decided_by && ` by ${c.decided_by.name}`}
                        {c.decision_note && <span className="font-normal text-muted-foreground"> · {c.decision_note}</span>}
                      </dd>
                    </div>
                  )}
                </dl>
                {c.status === 'open' && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => setDeciding({ c, decision: 'confirm' })}>
                      <Check className="size-4" /> In a Bacenta
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeciding({ c, decision: 'release' })}>
                      <RotateCcw className="size-4" /> Release
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeciding({ c, decision: 'replace' })}>
                      <Shuffle className="size-4" /> Place elsewhere
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <DecideDialog
        deciding={deciding}
        onClose={() => setDeciding(null)}
        onDone={() => {
          setDeciding(null)
          load()
        }}
      />
    </div>
  )
}

function DecideDialog({ deciding, onClose, onDone }: { deciding: { c: Case; decision: Decision } | null; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => setNote(''), [deciding])
  const d = deciding ? DECISION[deciding.decision] : null

  const submit = async () => {
    if (!deciding) return
    setSaving(true)
    const r = await ccgApi.post<{ proposal: { status: string } | null }>(`/quarantines/${deciding.c.id}/decide`, { decision: deciding.decision, note })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    const who = deciding.c.person.full_name
    message.success(
      deciding.decision === 'confirm'
        ? `${who} is recorded as in a Bacenta`
        : r.data.proposal
          ? `${who} is matched again: ${r.data.proposal.status === 'proposed' ? 'see Approvals' : 'on hold for now'}`
          : `${who} is back in ${deciding.c.ccf?.name ?? 'their CCF'}`
    )
    onDone()
  }

  return (
    <Dialog open={!!deciding} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{d?.title}</DialogTitle>
          <DialogDescription>{deciding && d?.about(deciding.c)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="qd-note">Note (optional)</Label>
          <Textarea id="qd-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {d?.verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
