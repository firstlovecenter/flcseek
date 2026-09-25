'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart3, Loader2, Pencil, Plus, X } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { fieldErrors } from '@/lib/ccg/client'
import { Field } from './form-utils'
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
 * Sheep seeking in a stream, on the stream's page: its Sheep Seeking Overseer
 * (the stream's sheep seeking admin, appointed by a central admin) and its
 * Sheep Seekers (appointed by that Overseer). Either can be someone new, with
 * no CCF, or an existing member; anyone without a login is emailed a link to
 * set their password.
 */
export function StreamSeekers({
  streamId,
  streamName,
  overseer,
  seekers,
  onChanged,
  reportLink = true,
}: {
  streamId: string
  streamName: string
  overseer: SeekerHolder | null | undefined
  seekers: SeekerHolder[] | null
  onChanged: () => void
  /** Off on the Sheep Seekers page itself. */
  reportLink?: boolean
}) {
  const { me, hasGlobal, has } = useCcgMe()
  const isAdmin = hasGlobal('roles.manage')
  // The stream's own Sheep Seeking Overseer appoints its Sheep Seekers.
  const canManage =
    isAdmin ||
    !!me?.roles.some(
      (r) => (r.role.key === 'seeking_overseer' && r.unit?.id === streamId) || (r.unit?.type === 'campus' && r.unit.streams?.some((s) => s.id === streamId))
    )
  const { confirm, ConfirmDialog } = useConfirm()
  const { show, notice } = useInviteNotice()
  const [adding, setAdding] = useState<'seeker' | 'overseer' | null>(null)
  // A Sheep Seeker need not be in any CCF: add someone new, or choose an existing member.
  const [mode, setMode] = useState<'new' | 'member'>('new')
  const [picked, setPicked] = useState<PickedMember | null>(null)
  const [who, setWho] = useState({ first_name: '', middle_name: '', last_name: '', phone: '', email: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const close = () => {
    setAdding(null)
    setPicked(null)
    setWho({ first_name: '', middle_name: '', last_name: '', phone: '', email: '' })
    setErrors({})
  }

  const add = async () => {
    const name = mode === 'member' ? picked?.name ?? '' : `${who.first_name} ${who.last_name}`.trim()
    if (mode === 'member' && !picked) return
    setSaving(true)
    const payload = mode === 'member' ? { person_id: picked!.id } : { ...who, middle_name: who.middle_name || null }
    const r =
      adding === 'overseer'
        ? await ccgApi.put<{ invite: InviteResult | null; reused: boolean }>(`/streams/${streamId}/overseer`, payload)
        : await ccgApi.post<{ invite: InviteResult | null; reused: boolean }>(`/streams/${streamId}/seekers`, payload)
    setSaving(false)
    if (!r.ok) {
      setErrors(fieldErrors(r.error))
      return message.error(r.error.message)
    }
    const role = adding === 'overseer' ? 'the Sheep Seeking Overseer' : 'a Sheep Seeker'
    message.success(r.data.reused ? `${name} is already in the app: now ${role} for ${streamName}` : `${name} is now ${role} for ${streamName}`)
    close()
    show(name, r.data.invite, onChanged)
  }
  const ready = mode === 'member' ? !!picked : !!(who.first_name.trim() && who.last_name.trim() && who.phone.trim() && who.email.trim())
  const input = (k: keyof typeof who, label: string, type = 'text') => (
    <Field label={label} htmlFor={`sk-${k}`} error={errors[k]}>
      <Input id={`sk-${k}`} type={type} value={who[k]} onChange={(e) => setWho((w) => ({ ...w, [k]: e.target.value }))} aria-invalid={!!errors[k]} />
    </Field>
  )

  const remove = async (s: SeekerHolder) => {
    const ok = await confirm({
      title: `Stand ${s.name} down?`,
      description: `They stop being a Sheep Seeker for ${streamName}. Converts assigned to them stay with them until you reassign them.`,
      confirmLabel: 'Stand down',
      destructive: true,
    })
    if (!ok) return
    const r = await ccgApi.del(`/streams/${streamId}/seekers/${s.assignment_id}`)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${s.name} stood down`)
    onChanged()
  }

  const card = (h: SeekerHolder, action: React.ReactNode) => (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <Initials name={h.name} className="size-10 text-sm" />
      <div className="min-w-0 flex-1">
        {h.person_id ? (
          <Link href={`/ccg/members?person=${h.person_id}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
            {h.name}
          </Link>
        ) : (
          <p className="truncate text-sm font-semibold text-foreground">{h.name}</p>
        )}
        {h.since && (
          <p className="text-xs text-muted-foreground">
            Since {new Date(h.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
      {action}
    </div>
  )

  return (
    <section className="space-y-6">
      <div>
        <SectionLabel
          action={
            isAdmin && overseer !== undefined ? (
              <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setAdding('overseer')}>
                {overseer ? <Pencil className="size-4" /> : <Plus className="size-4" />} {overseer ? 'Change' : 'Appoint'}
              </Button>
            ) : null
          }
        >
          Sheep Seeking Overseer
        </SectionLabel>
        {overseer === undefined ? null : overseer ? (
          <div className="sm:max-w-sm">{card(overseer, null)}</div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not appointed yet. The Sheep Seeking Overseer is {streamName}’s sheep seeking admin: they appoint its Sheep Seekers and oversee
            registration, approvals and milestones.
          </p>
        )}
      </div>

      <div>
      <SectionLabel
        action={
          <div className="flex items-center gap-1">
            {reportLink && has('reports.view') && (
              <Button variant="ghost" size="sm" className="h-8 gap-1" asChild>
                <Link href={`/ccg/seekers?stream=${streamId}`}>
                  <BarChart3 className="size-4" /> Report
                </Link>
              </Button>
            )}
            {canManage && (
              <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setAdding('seeker')}>
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
          No Sheep Seekers yet.{canManage ? ' Add the people who will register converts and look after the ones assigned to them.' : ''}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {seekers.map((s) => (
            <li key={s.assignment_id}>
              {card(
                s,
                canManage && (
                  <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => remove(s)} aria-label={`Stand ${s.name} down`}>
                    <X className="size-4" />
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      </div>

      <Dialog open={!!adding} onOpenChange={(o) => !saving && !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{adding === 'overseer' ? `${overseer ? 'Change' : 'Appoint'} the Sheep Seeking Overseer` : 'Add a Sheep Seeker'}</DialogTitle>
            <DialogDescription>
              {adding === 'overseer'
                ? `The Sheep Seeking Overseer is ${streamName}’s sheep seeking admin: they appoint its Sheep Seekers, assign converts to them, and oversee registration, approvals and milestones.${overseer ? ` ${overseer.name} stands down.` : ''}`
                : `Sheep Seekers register ${streamName}’s converts and look after the ones assigned to them, ticking their milestones in whatever CCF they are placed.`}{' '}
              They don’t need to be in a CCF, and are emailed a link to set their own password.
            </DialogDescription>
          </DialogHeader>
          <div className="inline-flex w-full rounded-lg border border-border p-1" role="group" aria-label="Who">
            {(
              [
                ['new', 'Someone new'],
                ['member', 'An existing member'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'min-h-9 flex-1 rounded-md px-3 text-sm font-medium transition-colors',
                  mode === m ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'member' ? (
            <div className="space-y-1.5">
              <Label htmlFor="seeker-pick">Member</Label>
              <MemberPicker id="seeker-pick" value={picked} onChange={setPicked} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {input('first_name', 'First name *')}
              {input('last_name', 'Last name *')}
              {input('middle_name', 'Middle name')}
              {input('phone', 'Phone *', 'tel')}
              <div className="sm:col-span-2">{input('email', 'Email *', 'email')}</div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                If this email already belongs to someone in the app, that person is appointed and keeps their one login.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={add} disabled={!ready || saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {adding === 'overseer' ? 'Appoint' : 'Add Sheep Seeker'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
      {notice}
    </section>
  )
}
