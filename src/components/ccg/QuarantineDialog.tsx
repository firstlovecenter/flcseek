'use client'

import { useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCcgMe } from './CcgMeProvider'

/** Convert statuses that can be quarantined: placed, or waiting to be. */
const QUARANTINABLE = ['new', 'proposed', 'needs_info', 'placed', 'integrated']

/** Whether to offer Quarantine for this convert (the server checks the unit). */
export function useCanQuarantine(p: { kind: string; status: string } | null | undefined) {
  const { has } = useCcgMe()
  return !!p && p.kind === 'convert' && QUARANTINABLE.includes(p.status) && has('people.manage')
}

/**
 * Quarantine a convert who already belongs to a Bacenta: a placed convert leaves
 * the CCF at once, and the stream's Sheep Seeking Admin decides what happens next.
 */
export function QuarantineButton({
  person,
  onDone,
  className,
}: {
  person: { id: string; full_name: string }
  onDone: () => void
  /** Overrides the button's look (e.g. on a coloured header). */
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const close = () => {
    if (saving) return
    setOpen(false)
    setReason('')
  }
  const submit = async () => {
    setSaving(true)
    const r = await ccgApi.post(`/people/${person.id}/quarantine`, { reason })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${person.full_name} is in quarantine`)
    setOpen(false)
    setReason('')
    onDone()
  }

  return (
    <>
      <Button
        size="sm"
        variant={className ? 'secondary' : 'outline'}
        className={className ?? 'text-destructive hover:text-destructive'}
        onClick={() => setOpen(true)}
      >
        <ShieldAlert className="size-4" />
        Quarantine
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quarantine {person.full_name}?</DialogTitle>
            <DialogDescription>
              For a convert who already belongs to a Bacenta. They leave their CCF straight away (their progress is kept), and the stream’s Sheep Seeking
              Admin decides: confirm they belong to a Bacenta, release them back, or place them elsewhere. No one is notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="q-reason">Why?</Label>
            <Textarea
              id="q-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Attends the Bacenta at Dansoman"
              rows={3}
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={saving || !reason.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Quarantine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
