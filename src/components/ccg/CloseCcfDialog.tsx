'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { CONVERTS_PER_MEMBER, convertLimitFor } from '@/lib/ccg/engine/profile'
import { message } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Field, SearchSelect } from './form-utils'

/**
 * Close a CCF down: see everyone who moves, send them all to one CCF or each
 * to their own, and choose what its coordinators become. Members are not
 * notified; receiving coordinators are texted about the converts. The
 * room in each receiving CCF is checked as you choose, and again on saving.
 */

interface Destination {
  id: string
  name: string
  ccg: { id: string; name: string }
  stream: { id: string; name: string }
  same_ccg: boolean
  members: number
  converts: number
  convert_limit: number
}
interface Preview {
  ccf: { id: string; name: string; ccg: { id: string; name: string }; stream: { id: string; name: string } }
  members: Array<{ person_id: string; name: string; status: string; is_coordinator: boolean }>
  converts: Array<{ person_id: string; placement_id: string; name: string; placed_on: string | null }>
  waiting_for_approval: number
  on_hold: number
  pending_move_requests: number
  destinations: Destination[]
}
interface Closed {
  to: Array<{ id: string; name: string; members: number; converts: number }>
  members: number
  converts: number
  rematched: number
  coordinators: Array<{ name: string; ccf: string }>
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const SAME = '' // "with everyone else"

export function CloseCcfDialog({ ccfId, ccfName, onClose, onDone }: { ccfId: string; ccfName: string; onClose: () => void; onDone: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toId, setToId] = useState<string | null>(null)
  const [moves, setMoves] = useState<Record<string, string>>({})
  const [split, setSplit] = useState(false)
  const [coordinators, setCoordinators] = useState<'member' | 'coordinator'>('member')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ccgApi.get<Preview>(`/ccfs/${ccfId}/close`).then((r) => (r.ok ? setPreview(r.data) : setError(r.error.message)))
  }, [ccfId])

  const people = useMemo(
    () => [
      ...(preview?.members ?? []).map((m) => ({ id: m.person_id, name: m.name, kind: 'member' as const, active: m.status === 'active', note: m.is_coordinator ? 'Coordinator' : m.status !== 'active' ? m.status : null })),
      ...(preview?.converts ?? []).map((c) => ({ id: c.person_id, name: c.name, kind: 'convert' as const, active: true, note: null })),
    ],
    [preview]
  )
  const empty = people.length === 0
  const dest = (id: string) => (split && moves[id]) || toId
  const unplanned = people.filter((p) => !dest(p.id))

  // Same CCG first: the natural home for a closing CCF's people.
  const options = useMemo(
    () =>
      (preview?.destinations ?? []).map((d) => ({
        value: d.id,
        label: d.name,
        hint: `${d.ccg.name}${d.same_ccg ? ' (same CCG)' : ''} · ${d.stream.name} · ${d.converts}/${d.convert_limit} converts`,
      })),
    [preview]
  )

  // Room in each CCF people are going to, as chosen.
  const room = useMemo(() => {
    const used = new Map<string, { d: Destination; members: number; converts: number }>()
    for (const p of people) {
      const id = dest(p.id)
      const d = id ? preview?.destinations.find((x) => x.id === id) : undefined
      if (!d) continue
      const r = used.get(d.id) ?? { d, members: 0, converts: 0 }
      if (p.kind === 'member') r.members += p.active ? 1 : 0
      else r.converts++
      used.set(d.id, r)
    }
    return [...used.values()].map((r) => {
      const limit = convertLimitFor(r.d.members + r.members)
      return { ...r, limit, after: r.d.converts + r.converts, full: r.d.converts + r.converts > limit }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, preview, toId, moves, split])
  const overfull = room.some((r) => r.full)
  const hasCoordinator = !!preview?.members.some((m) => m.is_coordinator)

  const submit = async () => {
    setSaving(true)
    const body = {
      to_ccf_id: empty ? null : toId,
      moves: split ? Object.fromEntries(Object.entries(moves).filter(([, v]) => v)) : undefined,
      coordinators,
    }
    const r = await ccgApi.post<Closed>(`/ccfs/${ccfId}/close`, body)
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    const where = r.data.to.map((t) => `${t.name} (${[t.members && plural(t.members, 'member'), t.converts && plural(t.converts, 'convert')].filter(Boolean).join(', ')})`)
    message.success(empty ? `${ccfName} closed down` : `${ccfName} closed down. Moved to ${where.join('; ')}.`)
    if (r.data.coordinators.length) message.success(r.data.coordinators.map((c) => `${c.name} now also coordinates ${c.ccf}`).join('. '))
    onClose()
    onDone()
  }

  const canSubmit = !!preview && !saving && (empty || (unplanned.length === 0 && !overfull))

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Close down {ccfName}?</DialogTitle>
          <DialogDescription>
            {empty
              ? 'Nobody is in it. It is closed, and its roles and form links end.'
              : 'Everyone in it moves to the CCF you choose for them. Converts keep their milestones and assessment year. Its roles and form links end.'}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !preview ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="space-y-5">
            {/* What else happens */}
            {(preview.waiting_for_approval > 0 || preview.on_hold > 0 || preview.pending_move_requests > 0) && (
              <ul className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                {preview.waiting_for_approval + preview.on_hold > 0 && (
                  <li>
                    {plural(preview.waiting_for_approval + preview.on_hold, 'convert')} waiting for approval or on hold for {ccfName} will be matched to another CCF.
                  </li>
                )}
                {preview.pending_move_requests > 0 && (
                  <li>
                    {plural(preview.pending_move_requests, 'move request')}: those into {ccfName} are cancelled; those out of it go to the person’s new coordinator.
                  </li>
                )}
              </ul>
            )}

            {!empty && (
              <>
                <Field label={split ? 'Everyone else goes to' : 'Move everyone to'} htmlFor="close-to" hint="Members count first, so each CCF’s convert limit grows with the members it receives.">
                  <SearchSelect id="close-to" value={toId} onChange={setToId} options={options} placeholder="Choose a CCF" />
                </Field>

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={split} onCheckedChange={(v) => setSplit(!!v)} />
                  Send some people to other CCFs
                </label>

                {/* Everyone who moves */}
                <div className="rounded-xl border border-border">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    <span>
                      {plural(preview.members.length, 'member')} · {plural(preview.converts.length, 'convert')}
                    </span>
                    {split && <span>Goes to</span>}
                  </div>
                  <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                    {people.map((p) => (
                      <li key={p.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <span className="truncate text-sm font-medium text-foreground">{p.name}</span>{' '}
                          <Badge variant={p.kind === 'convert' ? 'secondary' : 'outline'} className="ml-1 text-[10px]">
                            {p.kind === 'convert' ? 'Convert' : 'Member'}
                          </Badge>
                          {p.note && <span className="ml-2 text-xs text-muted-foreground capitalize">{p.note}</span>}
                        </div>
                        {split ? (
                          <div className="sm:w-64">
                            <SearchSelect
                              value={moves[p.id] ?? SAME}
                              onChange={(v) => setMoves((m) => ({ ...m, [p.id]: v ?? SAME }))}
                              options={options}
                              noneLabel="With everyone else"
                              placeholder="With everyone else"
                            />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Room where they are going */}
                {room.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Room for converts</p>
                    {room.map((r) => (
                      <div key={r.d.id} className={cn('flex items-center justify-between rounded-lg border px-3 py-2 text-sm', r.full ? 'border-destructive/40 bg-destructive/5' : 'border-border')}>
                        <span className="min-w-0 truncate">
                          {r.d.name} <span className="text-muted-foreground">gets {[r.members && plural(r.members, 'member'), r.converts && plural(r.converts, 'convert')].filter(Boolean).join(' and ') || 'nobody active'}</span>
                        </span>
                        <span className={cn('shrink-0 tabular-nums', r.full ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                          {r.after}/{r.limit}
                        </span>
                      </div>
                    ))}
                    {overfull && (
                      <p className="flex items-center gap-1.5 text-sm text-destructive">
                        <AlertTriangle className="size-4" /> A CCF can take at most {CONVERTS_PER_MEMBER} converts per member. Send some converts elsewhere.
                      </p>
                    )}
                  </div>
                )}

                {hasCoordinator && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Its coordinator{preview.members.filter((m) => m.is_coordinator).length > 1 ? 's' : ''}</legend>
                    {(
                      [
                        ['member', 'Become members of the CCF they move to'],
                        ['coordinator', 'Also become coordinators of the CCF they move to (alongside its coordinator)'],
                      ] as const
                    ).map(([v, label]) => (
                      <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="radio" name="coordinators" className="size-4 accent-primary" checked={coordinators === v} onChange={() => setCoordinators(v)} />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                )}

              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={!canSubmit}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Close down
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
