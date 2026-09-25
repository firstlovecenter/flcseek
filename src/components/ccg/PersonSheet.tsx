'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRightLeft, Check, Loader2, Mail, Pencil, ShieldCheck, Sprout } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useCcgMe } from './CcgMeProvider'
import { useInviteNotice, type InviteResult } from './InviteNotice'
import { Field, NullableSelect } from './form-utils'
import { PERSON_STATUS, ccfLabel, useCcgOptions, type BankQuestion, type PersonDTO } from './people-types'

interface Detail {
  person: PersonDTO
  placements: Array<{
    id: string
    status: string
    final_ccf: { name: string } | null
    proposed_ccf: { name: string } | null
    decision: string | null
    outcome: string | null
    decided_at: string | null
    ended_at: string | null
    end_reason: string | null
    created_at: string | null
  }>
  transfers: Array<{ id: string; from_ccf: { name: string } | null; to_ccf: { name: string }; reason: string; created_at: string | null }>
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function answerText(q: BankQuestion, v: string | string[] | number | undefined) {
  if (v === undefined) return null
  if (typeof v === 'number') return `${v} of 5`
  const keys = Array.isArray(v) ? v : [v]
  if (q.type === 'text') return String(v)
  return keys.map((k) => q.options.find((o) => o.key === k)?.label ?? k).join(', ')
}

/** Side panel for one person: details, answers, placement history, and actions. */
export function PersonSheet({
  personId,
  onClose,
  onEdit,
  onChanged,
}: {
  personId: string | null
  onClose: () => void
  onEdit: (p: PersonDTO) => void
  onChanged: () => void
}) {
  const { has, hasGlobal } = useCcgMe()
  const opts = useCcgOptions()
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<'transfer' | 'role' | null>(null)
  const [roles, setRoles] = useState<Array<{ id: string; role: { name: string }; unit: { name: string } | null }>>([])
  const invites = useInviteNotice()

  const load = useCallback(async (id: string) => {
    setData(null)
    setError(null)
    const r = await ccgApi.get<Detail>(`/people/${id}`)
    if (!r.ok) return setError(r.error.message)
    setData(r.data)
    // Roles held (admins only): every role is held by a member.
    const login = r.data.person.login
    if (login && hasGlobal('roles.manage')) {
      const a = await ccgApi.get<{ assignments: typeof roles }>(`/assignments?user_id=${login.user_id}`)
      setRoles(a.ok ? a.data.assignments : [])
    } else setRoles([])
  }, [hasGlobal])

  useEffect(() => {
    if (personId) load(personId)
  }, [personId, load])

  const refresh = () => {
    if (personId) load(personId)
    onChanged()
  }

  const confirm = async () => {
    if (!data) return
    setBusy(true)
    const r = await ccgApi.post(`/people/${data.person.id}/confirm`)
    setBusy(false)
    if (!r.ok) return message.error(r.error.message)
    message.success('Member confirmed')
    refresh()
  }

  const resend = async () => {
    if (!data) return
    setBusy(true)
    const r = await ccgApi.post<{ invite: InviteResult }>(`/people/${data.person.id}/invite`)
    setBusy(false)
    if (!r.ok) return message.error(r.error.message)
    invites.show(data.person.full_name, r.data.invite)
  }

  const p = data?.person
  const status = p ? PERSON_STATUS[p.status] ?? { label: p.status, tone: 'secondary' as const } : null
  const canTransfer = !!p && has('people.manage') && ((p.kind === 'member' && ['active', 'pending'].includes(p.status)) || !!p.placement)
  const answered = (opts?.questions ?? []).filter((q) => p?.answers?.[q.key] !== undefined)

  return (
    <Sheet open={!!personId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {p?.full_name ?? 'Person'}
            {status && <Badge variant={status.tone}>{status.label}</Badge>}
          </SheetTitle>
          <SheetDescription>
            {p ? `${p.kind === 'member' ? 'Member' : 'Convert'}${p.age !== null ? ` · ${p.age}` : ''}${p.phone ? ` · ${p.phone}` : ''}` : 'Loading…'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!data && !error && (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-40" />
            </div>
          )}

          {p && data && (
            <>
              <div className="flex flex-wrap gap-2">
                {has('people.manage') && (
                  <Button size="sm" variant="outline" onClick={() => onEdit(p)}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                )}
                {canTransfer && (
                  <Button size="sm" variant="outline" onClick={() => setDialog('transfer')}>
                    <ArrowRightLeft className="size-4" />
                    Transfer
                  </Button>
                )}
                {p.kind === 'member' && p.status === 'pending' && has('members.confirm') && (
                  <Button size="sm" onClick={confirm} disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Confirm member
                  </Button>
                )}
                {p.kind === 'member' && p.status === 'active' && hasGlobal('roles.manage') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => (p.login || p.email ? setDialog('role') : message.warning(`Add ${p.full_name}'s email first: their invitation is sent there`))}
                  >
                    <ShieldCheck className="size-4" />
                    Give a role
                  </Button>
                )}
                {p.login && roles.length > 0 && hasGlobal('roles.manage') && (
                  <Button size="sm" variant="ghost" onClick={resend} disabled={busy}>
                    <Mail className="size-4" />
                    Send password link
                  </Button>
                )}
                {p.placement && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/ccg/converts?placement=${p.placement.id}`}>
                      <Sprout className="size-4" />
                      Milestones
                    </Link>
                  </Button>
                )}
              </div>

              {p.possible_duplicate_of && (
                <p className="rounded-md bg-warning/10 px-3 py-2 text-sm">
                  Same phone number as <strong>{p.possible_duplicate_of.full_name}</strong> ({p.possible_duplicate_of.kind}). Check they are not the same person.
                </p>
              )}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                {p.kind === 'member' ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">CCF</dt>
                    <dd className="font-medium">{p.ccf ? ccfLabel(p.ccf) : '—'}</dd>
                  </div>
                ) : (
                  <>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">{p.placement ? 'Placed in' : p.proposal ? 'Proposed for' : 'CCF'}</dt>
                      <dd className="font-medium">
                        {p.placement?.ccf ? ccfLabel(p.placement.ccf) : p.proposal?.ccf ? ccfLabel(p.proposal.ccf) : p.proposal ? 'On hold' : 'Not yet matched'}
                      </dd>
                      {p.proposal?.hold_reason && <p className="text-xs text-muted-foreground">{p.proposal.hold_reason}</p>}
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Stream</dt>
                      <dd className="font-medium">{p.stream?.name ?? 'Church-wide'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Converted</dt>
                      <dd className="font-medium">{fmtDate(p.conversion_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Sheep Seeker</dt>
                      <dd className="font-medium">{p.seeker?.full_name ?? 'Not recorded'}</dd>
                    </div>
                  </>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Registered</dt>
                  <dd className="font-medium">
                    {fmtDate(p.created_at)} {p.source === 'self' && <span className="text-xs font-normal text-muted-foreground">(themselves)</span>}
                  </dd>
                </div>
                {p.email && (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="font-medium break-all">{p.email}</dd>
                  </div>
                )}
                {roles.length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Roles</dt>
                    <dd className="font-medium">{roles.map((a) => (a.unit ? `${a.role.name}, ${a.unit.name}` : a.role.name)).join(' · ')}</dd>
                  </div>
                )}
                {(p.existing_connection_note || p.existing_connection) && (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Knows someone in church</dt>
                    {p.existing_connection && (
                      <dd className="font-medium">
                        {p.existing_connection.full_name}
                        {p.connection_by_ai && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(matched from their note)</span>}
                      </dd>
                    )}
                    {p.existing_connection_note && <dd className="text-muted-foreground">“{p.existing_connection_note}”</dd>}
                  </div>
                )}
              </dl>

              {answered.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium">Answers</h3>
                  <dl className="divide-y rounded-lg border text-sm">
                    {answered.map((q) => (
                      <div key={q.key} className="space-y-0.5 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">{q.prompt}</dt>
                        <dd>{answerText(q, p.answers?.[q.key])}</dd>
                        {p.answer_notes?.[q.key]?.other_text && (
                          <dd className="text-xs text-muted-foreground">
                            Other: “{p.answer_notes[q.key].other_text}”
                            {p.answer_notes[q.key].ai_keys.length > 0 &&
                              ` · added ${p.answer_notes[q.key].ai_keys.map((k) => q.options.find((o) => o.key === k)?.label ?? k).join(', ')}`}
                          </dd>
                        )}
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {(data.placements.length > 0 || data.transfers.length > 0) && (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium">History</h3>
                  <ol className="space-y-2 text-sm">
                    {data.transfers.map((t) => (
                      <li key={t.id} className="rounded-md border px-3 py-2">
                        <p>
                          Transferred {t.from_ccf ? `from ${t.from_ccf.name} ` : ''}to <strong>{t.to_ccf.name}</strong>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(t.created_at)} · {t.reason}
                        </p>
                      </li>
                    ))}
                    {data.placements
                      .filter((h) => h.status !== 'superseded')
                      .map((h) => (
                        <li key={h.id} className="rounded-md border px-3 py-2">
                          <p>
                            {h.status === 'active'
                              ? `Placed in ${h.final_ccf?.name}`
                              : h.status === 'ended'
                                ? h.outcome === 'graduated'
                                  ? `Completed the assessment in ${h.final_ccf?.name} and became a member`
                                  : `Placement in ${h.final_ccf?.name} ended`
                                : h.status === 'held'
                                  ? 'On hold'
                                  : `Proposed for ${h.proposed_ccf?.name}`}
                            {h.decision === 'remapped' && <span className="text-muted-foreground"> (placed elsewhere)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDate(h.decided_at ?? h.created_at)}
                            {h.ended_at && ` – ${fmtDate(h.ended_at)}`}
                            {h.end_reason && h.outcome !== 'graduated' && ` · ${h.end_reason}`}
                          </p>
                        </li>
                      ))}
                  </ol>
                </section>
              )}
            </>
          )}
        </div>

        {p && dialog === 'transfer' && <TransferDialog person={p} onClose={() => setDialog(null)} onDone={refresh} />}
        {p && dialog === 'role' && (
          <RoleDialog
            person={p}
            onClose={() => setDialog(null)}
            onDone={(invite) => {
              invites.show(p.full_name, invite)
              refresh()
            }}
          />
        )}
        {invites.notice}
      </SheetContent>
    </Sheet>
  )
}

function TransferDialog({ person, onClose, onDone }: { person: PersonDTO; onClose: () => void; onDone: () => void }) {
  const opts = useCcgOptions()
  const [ccfId, setCcfId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const current = person.kind === 'member' ? person.ccf?.id : person.placement?.ccf?.id
  const choices = (opts?.ccfs ?? []).filter((f) => f.id !== current && f.status === 'active' && f.ccg.status === 'active')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const r = await ccgApi.post(`/people/${person.id}/transfer`, { ccf_id: ccfId, reason: reason.trim() })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${person.full_name} transferred`)
    onClose()
    onDone()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Transfer {person.full_name}</DialogTitle>
            <DialogDescription>
              {person.kind === 'convert'
                ? 'They keep their milestones and assessment year. To move to another CCG, choose one of its CCFs.'
                : 'To move to another CCG, choose one of its CCFs.'}
            </DialogDescription>
          </DialogHeader>
          <Field label="New CCF" htmlFor="t-ccf">
            <NullableSelect
              id="t-ccf"
              value={ccfId}
              onChange={setCcfId}
              options={choices.map((f) => ({ value: f.id, label: ccfLabel(f) }))}
              placeholder="Choose a CCF"
              noneLabel="Choose a CCF"
            />
          </Field>
          <Field label="Why?" htmlFor="t-reason">
            <Textarea id="t-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Moved to a new area" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !ccfId || !reason.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Transfer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface RoleOption {
  key: string
  name: string
  scope_level: 'global' | 'stream' | 'council' | 'ccg' | 'ccf'
  active: boolean
}

const LEVEL_LABEL: Record<RoleOption['scope_level'], string> = {
  global: 'Everywhere',
  stream: 'Stream',
  council: 'Council',
  ccg: 'CCG',
  ccf: 'CCF',
}

function RoleDialog({
  person,
  onClose,
  onDone,
}: {
  person: PersonDTO
  onClose: () => void
  onDone: (invite: InviteResult | null) => void
}) {
  const opts = useCcgOptions()
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [councils, setCouncils] = useState<Array<{ id: string; name: string }>>([])
  const [ccgs, setCcgs] = useState<Array<{ id: string; name: string }>>([])
  const [roleKey, setRoleKey] = useState<string | null>(null)
  const [unitId, setUnitId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      ccgApi.get<{ roles: RoleOption[] }>('/roles'),
      ccgApi.get<{ councils: Array<{ id: string; name: string }> }>('/councils'),
      ccgApi.get<{ ccgs: Array<{ id: string; name: string }> }>('/ccgs'),
    ]).then(([r, c, g]) => {
      setRoles(r.ok ? r.data.roles.filter((x) => x.active) : [])
      setCouncils(c.ok ? c.data.councils : [])
      setCcgs(g.ok ? g.data.ccgs : [])
    })
  }, [])

  const role = roles.find((r) => r.key === roleKey)
  const level = role?.scope_level
  const units: Array<{ value: string; label: string }> =
    level === 'stream'
      ? (opts?.streams ?? []).map((s) => ({ value: s.id, label: s.name }))
      : level === 'council'
        ? councils.map((c) => ({ value: c.id, label: c.name }))
        : level === 'ccg'
          ? ccgs.map((g) => ({ value: g.id, label: g.name }))
          : level === 'ccf'
            ? (opts?.ccfs ?? []).map((f) => ({ value: f.id, label: ccfLabel(f) }))
            : []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!role) return
    setSaving(true)
    const r = await ccgApi.post<{ invite: InviteResult | null }>('/assignments', {
      person_id: person.id,
      role_key: role.key,
      ...(level && level !== 'global' ? { [`${level}_id`]: unitId } : {}),
    })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${person.full_name} is now ${role.name}`)
    onClose()
    onDone(r.data.invite)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Give {person.full_name} a role</DialogTitle>
            <DialogDescription>
              {person.login
                ? `They sign in with ${person.login.username}.`
                : `They have no login yet. One is created with ${person.email} as the sign-in name, and they are emailed a link to set their own password.`}
            </DialogDescription>
          </DialogHeader>
          <Field label="Role" htmlFor="r-role">
            <NullableSelect
              id="r-role"
              value={roleKey}
              onChange={(v) => {
                setRoleKey(v)
                setUnitId(null)
              }}
              options={roles.map((r) => ({ value: r.key, label: `${r.name} (${LEVEL_LABEL[r.scope_level]})` }))}
              noneLabel="Choose a role"
              placeholder="Choose a role"
            />
          </Field>
          {level && level !== 'global' && (
            <Field label={LEVEL_LABEL[level]} htmlFor="r-unit">
              <NullableSelect
                id="r-unit"
                value={unitId}
                onChange={setUnitId}
                options={units}
                noneLabel={`Choose a ${LEVEL_LABEL[level].toLowerCase()}`}
                placeholder={`Choose a ${LEVEL_LABEL[level].toLowerCase()}`}
              />
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !role || (level !== 'global' && !unitId)}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Give role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
