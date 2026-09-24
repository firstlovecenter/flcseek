'use client'

import { useState } from 'react'
import { Check, Copy, MailWarning } from 'lucide-react'
import { message } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export interface InviteResult {
  sent: boolean
  sent_to: string
  link?: string
  reason?: string
}

/**
 * After a member is given a role: a toast when their invitation was emailed.
 * When it could not be sent (email not set up yet), a dialog with the link so
 * the admin can pass it on privately, e.g. by WhatsApp.
 */
export function useInviteNotice() {
  const [pending, setPending] = useState<{ name: string; invite: InviteResult; onDone?: () => void } | null>(null)

  /** `onDone` runs once the admin has seen the result (straight away when it was emailed). */
  const show = (name: string, invite: InviteResult | null | undefined, onDone?: () => void) => {
    if (!invite || invite.sent) {
      if (invite) message.success(`Invitation emailed to ${invite.sent_to}: ${name} will set their own password`)
      onDone?.()
      return
    }
    setPending({ name, invite, onDone })
  }

  const notice = pending ? (
    <NotSentDialog
      name={pending.name}
      invite={pending.invite}
      onClose={() => {
        pending.onDone?.()
        setPending(null)
      }}
    />
  ) : null
  return { show, notice }
}

function NotSentDialog({ name, invite, onClose }: { name: string; invite: InviteResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!invite.link) return
    try {
      await navigator.clipboard.writeText(invite.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      message.error('Could not copy. Select the link and copy it instead.')
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailWarning className="size-5 text-warning" aria-hidden />
            Invitation not emailed
          </DialogTitle>
          <DialogDescription>
            {invite.reason ?? 'The email could not be sent.'} Send {name} this link privately so they can set their password. It works once and expires
            in 7 days.
          </DialogDescription>
        </DialogHeader>
        {invite.link && (
          <div className="flex gap-2">
            <Input readOnly value={invite.link} onFocus={(e) => e.target.select()} aria-label="Invitation link" />
            <Button type="button" variant="outline" onClick={copy} aria-label="Copy link">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
