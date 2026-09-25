'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart3, Loader2, Plus, X } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useCcgMe } from './CcgMeProvider'
import { useInviteNotice, type InviteResult } from './InviteNotice'
import { MemberPicker, type PickedMember } from './MemberPicker'
import { Initials, SectionLabel } from './synago'

export interface SeekerHolder {
  assignment_id: string
  person_id: string | null
  name: string
  since: string | null
}

/**
 * A stream's Sheep Seekers, on the stream's page: appoint one from the members
 * (they are emailed an invitation if they have no login yet) or stand one down.
 */
export function StreamSeekers({
  streamId,
  streamName,
  seekers,
  onChanged,
}: {
  streamId: string
  streamName: string
  seekers: SeekerHolder[] | null
  onChanged: () => void
}) {
  const { hasGlobal, has } = useCcgMe()
  const canManage = hasGlobal('roles.manage')
  const { confirm, ConfirmDialog } = useConfirm()
  const { show, notice } = useInviteNotice()
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<PickedMember | null>(null)
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!picked) return
    setSaving(true)
    const r = await ccgApi.post<{ invite: InviteResult | null }>('/assignments', { person_id: picked.id, role_key: 'sheep_seeker', stream_id: streamId })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${picked.name} is now a Sheep Seeker for ${streamName}`)
    setAdding(false)
    const name = picked.name
    setPicked(null)
    show(name, r.data.invite, onChanged)
  }

  const remove = async (s: SeekerHolder) => {
    const ok = await confirm({
      title: `Stand ${s.name} down?`,
      description: `They stop being a Sheep Seeker for ${streamName}. The converts they brought stay recorded as theirs.`,
      confirmLabel: 'Stand down',
      destructive: true,
    })
    if (!ok) return
    const r = await ccgApi.del(`/assignments/${s.assignment_id}`)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${s.name} stood down`)
    onChanged()
  }

  return (
    <section>
      <SectionLabel
        action={
          <div className="flex items-center gap-1">
            {has('reports.view') && (
              <Button variant="ghost" size="sm" className="h-8 gap-1" asChild>
                <Link href={`/ccg/seekers?stream=${streamId}`}>
                  <BarChart3 className="size-4" /> Report
                </Link>
              </Button>
            )}
            {canManage && (
              <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Add
              </Button>
            )}
          </div>
        }
      >
        Sheep Seekers
      </SectionLabel>

      {seekers === null ? null : seekers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Sheep Seekers yet.{canManage ? ' Add members who will register converts and see them placed.' : ''}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {seekers.map((s) => (
            <li key={s.assignment_id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <Initials name={s.name} className="size-10 text-sm" />
              <div className="min-w-0 flex-1">
                {s.person_id ? (
                  <Link href={`/ccg/members?person=${s.person_id}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
                    {s.name}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {s.since ? `Since ${new Date(s.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Sheep Seeker'}
                </p>
              </div>
              {canManage && (
                <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => remove(s)} aria-label={`Stand ${s.name} down`}>
                  <X className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={(o) => !saving && setAdding(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a Sheep Seeker</DialogTitle>
            <DialogDescription>
              Sheep Seekers register {streamName}’s converts, see them matched to a CCF and approve the proposals. Choose a member; if they have no
              login yet, they are emailed a link to set their password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="seeker-pick">Member</Label>
            <MemberPicker id="seeker-pick" value={picked} onChange={setPicked} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={add} disabled={!picked || saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Add Sheep Seeker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
      {notice}
    </section>
  )
}
