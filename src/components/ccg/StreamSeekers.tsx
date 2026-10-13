'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Loader2, Pencil, Plus, Users, X } from 'lucide-react'
import { ccgApi, fieldErrors, type CcgResult } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { useConfirm } from '@/hooks/use-confirm'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
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
  /** Sheep Seekers: the CCGs they are liaison for. */
  ccgs?: Array<{ id: string; name: string }>
}

type Lead = 'admin' | 'overseer'
export type Appointed = { invite: InviteResult | null; reused: boolean }
type Payload = { person_id: string } | { first_name: string; middle_name: string | null; last_name: string; phone: string; email: string }

const LEAD_TITLE: Record<Lead, string> = { admin: 'Sheep Seeking Admin', overseer: 'Sheep Seeking Overseer' }
const LEAD_ABOUT: Record<Lead, (where: string, campus: boolean) => string> = {
  admin: (w, campus) =>
    campus
      ? `The Campus Sheep Seeking Admin runs sheep seeking across every stream in ${w}: registration, approvals and milestones, its Sheep Seekers, and each stream’s Sheep Seeking Admin and Overseer.`
      : `The Sheep Seeking Admin runs sheep seeking for ${w}: they appoint its Sheep Seekers and their liaison CCGs, and oversee registration, approvals and milestones.`,
  overseer: (w, campus) =>
    `The ${campus ? 'Campus ' : ''}Sheep Seeking Overseer sees sheep seeking ${campus ? 'across every stream in' : 'for'} ${w}: converts, placements, progress and reports. View only.`,
}

export function HolderCard({ h, action }: { h: SeekerHolder; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <Initials name={h.name} className="size-10 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{h.name}</p>
        {h.since && (
          <p className="text-xs text-muted-foreground">
            Since {new Date(h.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
        {!!h.ccgs?.length && (
          <p className="truncate text-xs text-members" title={h.ccgs.map((c) => c.name).join(', ')}>
            Liaison for {h.ccgs.map((c) => c.name).join(', ')}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

/** Choose who to appoint: someone new (no CCF needed) or an existing member. */
export function AppointDialog({
  open,
  title,
  description,
  submitLabel,
  onClose,
  submit,
}: {
  open: boolean
  title: string
  description: string
  submitLabel: string
  onClose: () => void
  /** Returns the API result; the dialog shows field errors itself. */
  submit: (payload: Payload, name: string) => Promise<CcgResult<Appointed>>
}) {
  const [mode, setMode] = useState<'new' | 'member'>('new')
  const [picked, setPicked] = useState<PickedMember | null>(null)
  const [who, setWho] = useState({ first_name: '', middle_name: '', last_name: '', phone: '', email: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const close = () => {
    setPicked(null)
    setWho({ first_name: '', middle_name: '', last_name: '', phone: '', email: '' })
    setErrors({})
    onClose()
  }
  const go = async () => {
    if (mode === 'member' && !picked) return
    const name = mode === 'member' ? picked!.name : `${who.first_name} ${who.last_name}`.trim()
    setSaving(true)
    const r = await submit(mode === 'member' ? { person_id: picked!.id } : { ...who, middle_name: who.middle_name || null }, name)
    setSaving(false)
    if (!r.ok) {
      setErrors(fieldErrors(r.error))
      return
    }
    close()
  }
  const ready = mode === 'member' ? !!picked : !!(who.first_name.trim() && who.last_name.trim() && who.phone.trim() && who.email.trim())
  const input = (k: keyof typeof who, label: string, type = 'text') => (
    <Field label={label} htmlFor={`ap-${k}`} error={errors[k]}>
      <Input id={`ap-${k}`} type={type} value={who[k]} onChange={(e) => setWho((w) => ({ ...w, [k]: e.target.value }))} aria-invalid={!!errors[k]} />
    </Field>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description} They don’t need to be in a CCF. They are emailed about it, with a link to set their password if they are new to the app.
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
            <Label htmlFor="appoint-pick">Member</Label>
            <MemberPicker id="appoint-pick" value={picked} onChange={setPicked} />
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
          <Button onClick={go} disabled={!ready || saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Make a Sheep Seeker liaison for some of the stream's CCGs: the converts placed in their CCFs become theirs to follow. */
function LiaisonDialog({
  streamId,
  streamName,
  seeker,
  onClose,
  onSaved,
}: {
  streamId: string
  streamName: string
  seeker: SeekerHolder | null
  onClose: () => void
  onSaved: () => void
}) {
  type Ccg = { id: string; name: string; council: { name: string } | null; status: string; ccf_count: number }
  const [ccgs, setCcgs] = useState<Ccg[] | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!seeker) return
    setChosen(seeker.ccgs?.map((c) => c.id) ?? [])
    ccgApi.get<{ ccgs: Ccg[] }>(`/ccgs?stream_id=${streamId}`).then((r) => {
      if (r.ok) setCcgs(r.data.ccgs.filter((g) => g.status !== 'inactive' || seeker.ccgs?.some((c) => c.id === g.id)))
      else message.error(r.error.message)
    })
  }, [seeker, streamId])

  // Grouped by council; CCGs not yet in a council last.
  const byCouncil = useMemo(() => {
    const out = new Map<string, Ccg[]>()
    for (const g of ccgs ?? []) {
      const key = g.council?.name ?? ''
      out.set(key, [...(out.get(key) ?? []), g])
    }
    return [...out.entries()].sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b)))
  }, [ccgs])

  const save = async () => {
    if (!seeker) return
    setSaving(true)
    const r = await ccgApi.put(`/streams/${streamId}/seekers/${seeker.assignment_id}/ccgs`, { ccg_ids: chosen })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success(chosen.length ? `${seeker.name} is liaison for ${chosen.length} CCG${chosen.length === 1 ? '' : 's'}` : `${seeker.name} is no longer a liaison`)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={!!seeker} onOpenChange={(o) => !saving && !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{seeker?.name}: liaison CCGs</DialogTitle>
          <DialogDescription>
            The converts placed in the CCFs of these CCGs of {streamName} become theirs to follow up, as they are the CCF Coordinator’s: milestones, check-ins and
            attendance.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {ccgs === null ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : byCouncil.length === 0 ? (
            <p className="text-sm text-muted-foreground">{streamName} has no CCGs yet.</p>
          ) : (
            byCouncil.map(([council, list]) => (
              <fieldset key={council} className="space-y-2">
                <legend className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{council || 'Not in a council'}</legend>
                {list.map((g) => (
                  <label key={g.id} className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-1 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={chosen.includes(g.id)}
                      onCheckedChange={(v) => setChosen((c) => (v ? [...c, g.id] : c.filter((x) => x !== g.id)))}
                    />
                    <span className="flex-1">{g.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {g.ccf_count} CCF{g.ccf_count === 1 ? '' : 's'}
                    </span>
                  </label>
                ))}
              </fieldset>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || ccgs === null}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LeadSlot({
  lead,
  holder,
  where,
  campus,
  canAppoint,
  path,
  onChanged,
}: {
  lead: Lead
  holder: SeekerHolder | null | undefined
  where: string
  campus: boolean
  canAppoint: boolean
  /** e.g. /streams/<id>/leads or /campuses/<id>/leads */
  path: string
  onChanged: () => void
}) {
  const { confirm, ConfirmDialog } = useConfirm()
  const { show, notice } = useInviteNotice()
  const [open, setOpen] = useState(false)
  const title = `${campus ? 'Campus ' : ''}${LEAD_TITLE[lead]}`

  const standDown = async () => {
    if (!holder) return
    const ok = await confirm({ title: `Stand ${holder.name} down?`, description: `They stop being the ${title} for ${where}.`, confirmLabel: 'Stand down', destructive: true })
    if (!ok) return
    const r = await ccgApi.del(`${path}/${lead}`)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${holder.name} stood down`)
    onChanged()
  }

  return (
    <div>
      <SectionLabel
        action={
          canAppoint && holder !== undefined ? (
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setOpen(true)}>
              {holder ? <Pencil className="size-4" /> : <Plus className="size-4" />} {holder ? 'Change' : 'Appoint'}
            </Button>
          ) : null
        }
      >
        {title}
      </SectionLabel>
      {holder === undefined ? null : holder ? (
        <div className="sm:max-w-sm">
          <HolderCard
            h={holder}
            action={
              canAppoint && (
                <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={standDown} aria-label={`Stand ${holder.name} down`}>
                  <X className="size-4" />
                </Button>
              )
            }
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not appointed yet. {LEAD_ABOUT[lead](where, campus)}</p>
      )}
      <AppointDialog
        open={open}
        title={`${holder ? 'Change' : 'Appoint'} the ${title}`}
        description={`${LEAD_ABOUT[lead](where, campus)}${holder ? ` ${holder.name} stands down.` : ''}`}
        submitLabel="Appoint"
        onClose={() => setOpen(false)}
        submit={async (payload, name) => {
          const r = await ccgApi.put<Appointed>(`${path}/${lead}`, payload)
          if (!r.ok) message.error(r.error.message)
          else {
            message.success(r.data.reused ? `${name} is already in the app: now the ${title} for ${where}` : `${name} is now the ${title} for ${where}`)
            show(name, r.data.invite, onChanged)
          }
          return r
        }}
      />
      {ConfirmDialog}
      {notice}
    </div>
  )
}

/**
 * A stream's sheep seeking team, in the Sheep Seeking portal: its Sheep
 * Seeking Admin and Overseer (appointed by the central team or the campus's
 * Sheep Seeking Admin) and its Sheep Seekers (appointed by the stream's Admin).
 */
export function StreamSeekers({
  streamId,
  streamName,
  admin,
  overseer,
  seekers,
  onChanged,
  reportLink = true,
}: {
  streamId: string
  streamName: string
  admin: SeekerHolder | null | undefined
  overseer: SeekerHolder | null | undefined
  seekers: SeekerHolder[] | null
  onChanged: () => void
  /** Off on the Sheep Seekers page itself. */
  reportLink?: boolean
}) {
  const { me, hasGlobal, has } = useCcgMe()
  const campusAdmin = !!me?.roles.some((r) => r.role.key === 'campus_seeking_admin' && r.unit?.streams?.some((s) => s.id === streamId))
  const canAppointLeads = hasGlobal('roles.manage') || campusAdmin
  // The stream's Sheep Seeking Admin (or the campus's) appoints its Sheep Seekers.
  const canManage = canAppointLeads || !!me?.roles.some((r) => r.role.key === 'seeking_admin' && r.unit?.id === streamId)
  const { confirm, ConfirmDialog } = useConfirm()
  const { show, notice } = useInviteNotice()
  const [adding, setAdding] = useState(false)
  const [liaison, setLiaison] = useState<SeekerHolder | null>(null)

  const remove = async (s: SeekerHolder) => {
    const ok = await confirm({
      title: `Stand ${s.name} down?`,
      description: `They stop being a Sheep Seeker for ${streamName}${s.ccgs?.length ? ', and liaison for its CCGs' : ''}.`,
      confirmLabel: 'Stand down',
      destructive: true,
    })
    if (!ok) return
    const r = await ccgApi.del(`/streams/${streamId}/seekers/${s.assignment_id}`)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${s.name} stood down`)
    onChanged()
  }

  const leads = `/streams/${streamId}/leads`
  return (
    <section className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <LeadSlot lead="admin" holder={admin} where={streamName} campus={false} canAppoint={canAppointLeads} path={leads} onChanged={onChanged} />
        <LeadSlot lead="overseer" holder={overseer} where={streamName} campus={false} canAppoint={canAppointLeads} path={leads} onChanged={onChanged} />
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
            No Sheep Seekers yet.{canManage ? ' Add the people who will register converts, then make some of them liaisons for CCGs.' : ''}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {seekers.map((s) => (
              <li key={s.assignment_id}>
                <HolderCard
                  h={s}
                  action={
                    canManage && (
                      <div className="flex shrink-0 items-center">
                        <Button variant="ghost" size="sm" className="h-9 gap-1 px-2" onClick={() => setLiaison(s)} aria-label={`${s.name}’s liaison CCGs`}>
                          <Users className="size-4" /> Liaison
                        </Button>
                        <Button variant="ghost" size="icon" className="size-9" onClick={() => remove(s)} aria-label={`Stand ${s.name} down`}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <AppointDialog
        open={adding}
        title="Add a Sheep Seeker"
        description={`Sheep Seekers register ${streamName}’s converts, who belong to the stream. Make one a liaison for some CCGs and the converts placed in their CCFs are theirs to follow up.`}
        submitLabel="Add Sheep Seeker"
        onClose={() => setAdding(false)}
        submit={async (payload, name) => {
          const r = await ccgApi.post<Appointed>(`/streams/${streamId}/seekers`, payload)
          if (!r.ok) message.error(r.error.message)
          else {
            message.success(r.data.reused ? `${name} is already in the app: now a Sheep Seeker for ${streamName}` : `${name} is now a Sheep Seeker for ${streamName}`)
            show(name, r.data.invite, onChanged)
          }
          return r
        }}
      />
      <LiaisonDialog streamId={streamId} streamName={streamName} seeker={liaison} onClose={() => setLiaison(null)} onSaved={onChanged} />
      {ConfirmDialog}
      {notice}
    </section>
  )
}

export interface CampusSeekingTeam {
  id: string
  name: string
  admin: SeekerHolder | null
  overseer: SeekerHolder | null
}

/** Each campus's Sheep Seeking Admin and Overseer (appointed by the central team). */
export function CampusSeekingTeams({ campuses, canAppoint, onChanged }: { campuses: CampusSeekingTeam[]; canAppoint: boolean; onChanged: () => void }) {
  if (campuses.length === 0) return null
  return (
    <div className="space-y-6">
      {campuses.map((c) => (
        <section key={c.id} className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">{c.name}</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <LeadSlot lead="admin" holder={c.admin} where={c.name} campus canAppoint={canAppoint} path={`/campuses/${c.id}/leads`} onChanged={onChanged} />
            <LeadSlot lead="overseer" holder={c.overseer} where={c.name} campus canAppoint={canAppoint} path={`/campuses/${c.id}/leads`} onChanged={onChanged} />
          </div>
        </section>
      ))}
    </div>
  )
}
