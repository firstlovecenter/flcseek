'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Check, Loader2, X } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useCcgMe } from './CcgMeProvider'
import { Field } from './form-utils'

interface MoveRequest {
  id: string
  kind: 'member' | 'convert'
  source: 'staff' | 'self'
  person: { id: string; full_name: string; phone: string | null }
  from_ccf: { id: string; name: string } | null
  to_ccf: { id: string; name: string }
  created_at: string | null
  can_decide: boolean
}

/**
 * Open move requests: someone already in one CCF registered into another.
 * The coordinator of their current CCF approves (they move, keeping
 * everything) or declines (they stay). Others in scope see them as waiting.
 */
export function MoveRequests({ kind, onChanged }: { kind: 'member' | 'convert'; onChanged?: () => void }) {
  const { has } = useCcgMe()
  const allowed = has('members.confirm')
  const [rows, setRows] = useState<MoveRequest[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [declining, setDeclining] = useState<MoveRequest | null>(null)

  const load = useCallback(async () => {
    if (!allowed) return
    const r = await ccgApi.get<{ requests: MoveRequest[] }>('/moves')
    if (r.ok) setRows(r.data.requests.filter((m) => m.kind === kind))
  }, [allowed, kind])

  useEffect(() => {
    load()
  }, [load])

  if (!allowed || rows.length === 0) return null

  const approve = async (m: MoveRequest) => {
    setBusy(m.id)
    const r = await ccgApi.post(`/moves/${m.id}/approve`)
    setBusy(null)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${m.person.full_name} moved to ${m.to_ccf.name}`)
    load()
    onChanged?.()
  }

  return (
    <Card className="mt-4 border-warning/40">
      <CardContent className="space-y-3 pt-4">
        <div>
          <h2 className="font-semibold">Move requests</h2>
          <p className="text-sm text-muted-foreground">
            These {kind === 'member' ? 'members' : 'converts'} registered into another CCF. The coordinator of their current CCF decides.
          </p>
        </div>
        <ul className="divide-y">
          {rows.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-medium">{m.person.full_name}</p>
                <p className="flex flex-wrap items-center gap-1 text-muted-foreground">
                  {m.from_ccf?.name ?? 'No CCF'} <ArrowRight className="size-3.5" aria-hidden /> {m.to_ccf.name}
                  {m.source === 'self' ? ' · registered themselves' : ''}
                </p>
              </div>
              {m.can_decide ? (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => approve(m)} disabled={busy === m.id}>
                    {busy === m.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeclining(m)} disabled={busy === m.id}>
                    <X className="size-4" />
                    Decline
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Waiting for {m.from_ccf?.name ?? 'their CCF'}’s coordinator</span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      {declining && (
        <DeclineDialog
          request={declining}
          onClose={() => setDeclining(null)}
          onDone={() => {
            load()
            onChanged?.()
          }}
        />
      )}
    </Card>
  )
}

function DeclineDialog({ request, onClose, onDone }: { request: MoveRequest; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const r = await ccgApi.post(`/moves/${request.id}/decline`, { reason: reason.trim() || null })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${request.person.full_name} stays in ${request.from_ccf?.name ?? 'their CCF'}`)
    onClose()
    onDone()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Decline {request.person.full_name}’s move?</DialogTitle>
            <DialogDescription>
              They stay in {request.from_ccf?.name ?? 'their current CCF'} and are not added to {request.to_ccf.name}.
            </DialogDescription>
          </DialogHeader>
          <Field label="Why? (optional)" htmlFor="decline-reason">
            <Textarea id="decline-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Decline
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
