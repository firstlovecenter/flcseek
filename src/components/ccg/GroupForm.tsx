'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ccgApi, fieldErrors } from '@/lib/ccg/client'
import { MEETING_DAYS } from '@/lib/ccg/engine/meeting-slot'
import { message } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useCcgMe } from './CcgMeProvider'
import { Field, NullableSelect, SearchSelect } from './form-utils'
import { useInviteNotice, type InviteResult } from './InviteNotice'
import { MemberPicker, type PickedMember } from './MemberPicker'
import { UNIT_PATH } from './structure-types'
import { StickyHeader, UNIT_LEVEL, groupHref } from './synago'

/**
 * Add or edit a group (campus, stream, council, CCG or CCF) on its own page,
 * like Synago's church forms. The leader (a council's Council Admin) is chosen
 * from members; one without a login is emailed an invitation to set a password.
 */

export type GroupType = 'campus' | 'stream' | 'council' | 'ccg' | 'ccf'

const PARENT: Record<GroupType, { type: GroupType; field: string; label: string; path: string; key: string } | null> = {
  campus: null,
  stream: { type: 'campus', field: 'campus_id', label: 'Campus', path: '/campuses', key: 'campuses' },
  council: { type: 'stream', field: 'stream_id', label: 'Stream', path: '/streams', key: 'streams' },
  ccg: { type: 'council', field: 'council_id', label: 'Council', path: '/councils', key: 'councils' },
  ccf: { type: 'ccg', field: 'ccg_id', label: 'CCG', path: '/ccgs', key: 'ccgs' },
}
// A stream's Sheep Seeking Overseer is appointed on the Sheep Seeking side; its Overseer here.
const LEADER_LABEL: Record<GroupType, string | null> = {
  campus: 'Campus Leader',
  stream: 'Overseer',
  council: 'Council Admin',
  ccg: 'City Church Governor',
  ccf: 'CCF Coordinator',
}
const STATUSES: Record<GroupType, Array<{ value: string; label: string }>> = {
  campus: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
  stream: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
  council: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
  ccg: [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'inactive', label: 'Inactive' },
  ],
  ccf: [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'inactive', label: 'Inactive' },
  ],
}

type Values = Record<string, string | null>

export function GroupForm({ type, id, parentId }: { type: GroupType; id?: string; parentId?: string | null }) {
  const { hasGlobal } = useCcgMe()
  const router = useRouter()
  const invites = useInviteNotice()
  const editing = !!id
  const parent = PARENT[type]
  const full = hasGlobal('structure.manage') // otherwise a CCG Governor editing a CCF's details
  const canLead = hasGlobal('roles.manage') && !!LEADER_LABEL[type]

  const [values, setValues] = useState<Values>({ status: 'active' })
  const [leader, setLeader] = useState<PickedMember | null>(null)
  const [initialLeader, setInitialLeader] = useState<string | null>(null)
  // A campus, stream or CCG leader need not be in any CCF: pick a member, or add someone new.
  const canAddNewLeader = type !== 'ccf'
  const [leaderMode, setLeaderMode] = useState<'member' | 'new'>('member')
  const [newLeader, setNewLeader] = useState({ first_name: '', middle_name: '', last_name: '', phone: '', email: '' })
  const newLeaderStarted = Object.values(newLeader).some((v) => v.trim())
  const [parents, setParents] = useState<Array<{ value: string; label: string }>>([])
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: string, v: string | null) => setValues((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    if (!parent) return
    ccgApi.get<Record<string, Array<{ id: string; name: string; status: string; stream?: { name: string } }>>>(parent.path).then((r) => {
      if (r.ok) {
        setParents(
          (r.data[parent.key] ?? [])
            .filter((p) => p.status !== 'inactive')
            // Councils are named per stream: show which.
            .map((p) => ({ value: p.id, label: p.stream ? `${p.name} (${p.stream.name})` : p.name }))
        )
      }
    })
    if (!editing && parentId) set(parent.field, parentId)
  }, [parent, editing, parentId])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const [detail, overview] = await Promise.all([
        type === 'stream'
          ? ccgApi.get<{ streams: Array<Record<string, unknown>> }>('/streams')
          : ccgApi.get<Record<string, Record<string, unknown>>>(`${UNIT_PATH[type]}/${id}`),
        ccgApi.get<{ leaders: Array<{ person_id: string | null; name: string }> }>(`/groups/${type}/${id}`),
      ])
      setLoading(false)
      if (!detail.ok) return message.error(detail.error.message)
      const g =
        type === 'stream'
          ? (detail.data as { streams: Array<Record<string, unknown>> }).streams.find((s) => s.id === id) ?? {}
          : (detail.data as Record<string, Record<string, unknown>>)[type] ?? {}
      const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
      setValues({
        name: str(g.name),
        status: str(g.status),
        notes: str(g.notes),
        meeting_day: str(g.meeting_day),
        meeting_time: str(g.meeting_time),
        meeting_location: str(g.meeting_location),
        campus_id: str(g.campus_id),
        stream_id: str(g.stream_id ?? (g.stream as { id?: string } | null)?.id),
        council_id: str((g.council as { id?: string } | null)?.id),
        ccg_id: str((g.ccg as { id?: string } | null)?.id),
      })
      const l = overview.ok ? overview.data.leaders[0] : null
      if (l?.person_id) {
        setLeader({ id: l.person_id, name: l.name })
        setInitialLeader(l.person_id)
      }
    }
    load()
  }, [id, type])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (!values.name?.trim()) local.name = 'Enter a name'
    if (full && type === 'ccf' && !values.ccg_id) local.ccg_id = 'Choose its CCG'
    if (full && type === 'council' && !values.stream_id) local.stream_id = 'Choose its stream'
    // A CCG goes in a council (older CCGs may still sit straight in their stream until moved).
    if (full && type === 'ccg' && !values.council_id && !(editing && values.stream_id)) local.council_id = 'Choose its council'
    const addingNew = canLead && canAddNewLeader && leaderMode === 'new' && newLeaderStarted
    if (addingNew) {
      if (!newLeader.first_name.trim()) local.leader_first_name = 'Enter their first name'
      if (!newLeader.last_name.trim()) local.leader_last_name = 'Enter their last name'
      if (newLeader.phone.trim().length < 7) local.leader_phone = 'Enter their phone number'
      if (!/^\S+@\S+\.\S+$/.test(newLeader.email.trim())) local.leader_email = 'Enter a valid email address'
    }
    setErrors(local)
    if (Object.keys(local).length) return

    const txt = (k: string) => (values[k]?.trim() ? values[k]!.trim() : null)
    const body: Record<string, unknown> = { name: txt('name'), notes: txt('notes') }
    if (full) {
      body.status = values.status ?? 'active'
      if (parent) body[parent.field] = values[parent.field] ?? null
      // A CCG not yet in a council stays in its stream.
      if (type === 'ccg' && !values.council_id) {
        delete body.council_id
        body.stream_id = values.stream_id
      }
    }
    if (type === 'ccf') {
      body.meeting_day = values.meeting_day
      body.meeting_time = txt('meeting_time')
      body.meeting_location = txt('meeting_location')
    }
    if (addingNew) {
      body.leader = {
        first_name: newLeader.first_name.trim(),
        middle_name: newLeader.middle_name.trim() || null,
        last_name: newLeader.last_name.trim(),
        phone: newLeader.phone.trim(),
        email: newLeader.email.trim(),
      }
    } else if (canLead && leaderMode === 'member' && (leader?.id ?? null) !== initialLeader) body.leader = leader ? { person_id: leader.id } : null

    setSaving(true)
    const r = editing
      ? await ccgApi.patch<{ id: string; leader_invite?: InviteResult | null }>(`${UNIT_PATH[type]}/${id}`, body)
      : await ccgApi.post<{ id: string; leader_invite?: InviteResult | null }>(UNIT_PATH[type], body)
    setSaving(false)
    if (!r.ok) {
      setErrors(fieldErrors(r.error))
      return message.error(r.error.message)
    }
    message.success(editing ? 'Saved' : `${values.name} ${UNIT_LEVEL[type]} created`)
    const target = groupHref(type, editing ? id! : r.data.id)
    const leaderName = addingNew ? `${newLeader.first_name.trim()} ${newLeader.last_name.trim()}` : leader?.name
    invites.show(leaderName ?? 'The leader', r.data.leader_invite, () => router.push(target))
  }

  // Added from a group's page: the parent is that group, fixed (only an edit moves a group).
  const fixedParent = !editing && parent && parentId ? { label: parent.label, name: parents.find((p) => p.value === parentId)?.label ?? null } : null
  const title = editing ? `Edit ${values.name ?? ''}` : `New ${UNIT_LEVEL[type]}`

  return (
    <div className="pb-10">
      <StickyHeader>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Groups</p>
        <h1 className="truncate text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
          {title} {editing && <span className="text-members">{UNIT_LEVEL[type]}</span>}
          {fixedParent?.name && (
            <span className="text-muted-foreground">
              {' '}
              in <span className="text-members">{fixedParent.name}</span>
            </span>
          )}
        </h1>
      </StickyHeader>

      <div className="mx-auto max-w-2xl py-6">
        {loading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={submit} className="space-y-5" noValidate>
                {fixedParent ? (
                  <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{fixedParent.label}: </span>
                    <span className="font-medium">{fixedParent.name ?? '…'}</span>
                  </p>
                ) : parent && full && (
                  <Field label={`${parent.label}${type === 'ccf' || type === 'ccg' || type === 'council' ? ' *' : ''}`} htmlFor="g-parent" error={errors[parent.field]}>
                    <SearchSelect
                      id="g-parent"
                      value={values[parent.field] ?? null}
                      onChange={(v) => set(parent.field, v)}
                      options={parents}
                      noneLabel={type === 'ccf' || type === 'ccg' || type === 'council' ? `Choose a ${parent.label}` : `No ${parent.label.toLowerCase()} yet`}
                      placeholder={`Choose a ${parent.label}`}
                    />
                  </Field>
                )}
                <Field label="Name *" htmlFor="g-name" error={errors.name}>
                  <Input id="g-name" value={values.name ?? ''} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} />
                </Field>

                {canLead && (
                  <div className="space-y-2">
                    <Field
                      label={LEADER_LABEL[type]!}
                      htmlFor="g-leader"
                      hint={
                        canAddNewLeader
                          ? 'A member, or someone new who need not be in any CCF. Anyone without a login is emailed a link to set their own password.'
                          : 'Chosen from members. One without a login is emailed a link to set their own password.'
                      }
                    >
                      {canAddNewLeader && (
                        <div className="mb-2 inline-flex w-full rounded-lg border border-border p-1" role="group" aria-label="Who">
                          {(
                            [
                              ['member', 'An existing member'],
                              ['new', 'Someone new'],
                            ] as const
                          ).map(([m, label]) => (
                            <button
                              key={m}
                              type="button"
                              aria-pressed={leaderMode === m}
                              onClick={() => setLeaderMode(m)}
                              className={cn(
                                'min-h-9 flex-1 rounded-md px-3 text-sm font-medium transition-colors',
                                leaderMode === m ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                      {leaderMode === 'member' || !canAddNewLeader ? (
                        <MemberPicker id="g-leader" value={leader} onChange={setLeader} />
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {(
                            [
                              ['first_name', 'First name *', 'text'],
                              ['last_name', 'Last name *', 'text'],
                              ['middle_name', 'Middle name', 'text'],
                              ['phone', 'Phone *', 'tel'],
                              ['email', 'Email *', 'email'],
                            ] as const
                          ).map(([k, label, inputType]) => (
                            <Field key={k} label={label} htmlFor={`g-leader-${k}`} error={errors[`leader_${k}`]} className={k === 'email' ? 'space-y-1.5 sm:col-span-2' : undefined}>
                              <Input
                                id={`g-leader-${k}`}
                                type={inputType}
                                value={newLeader[k]}
                                onChange={(e) => setNewLeader((w) => ({ ...w, [k]: e.target.value }))}
                                aria-invalid={!!errors[`leader_${k}`]}
                              />
                            </Field>
                          ))}
                          <p className="text-xs text-muted-foreground sm:col-span-2">
                            If this email already belongs to someone in the app, that person is appointed and keeps their one login.
                            {leader ? ` ${leader.name} stands down.` : ''}
                          </p>
                        </div>
                      )}
                    </Field>
                  </div>
                )}


                {type === 'ccf' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Meeting day" htmlFor="g-day">
                      <NullableSelect
                        id="g-day"
                        value={values.meeting_day ?? null}
                        onChange={(v) => set('meeting_day', v)}
                        options={MEETING_DAYS.map((d) => ({ value: d, label: d }))}
                      />
                    </Field>
                    <Field label="Meeting time" htmlFor="g-time" hint="Matched against converts’ availability">
                      <Input id="g-time" type="time" value={values.meeting_time ?? ''} onChange={(e) => set('meeting_time', e.target.value)} />
                    </Field>
                    <Field label="Meeting place" htmlFor="g-place">
                      <Input id="g-place" value={values.meeting_location ?? ''} onChange={(e) => set('meeting_location', e.target.value)} />
                    </Field>
                  </div>
                )}

                {full && (
                  <Field label="Status" htmlFor="g-status">
                    <NullableSelect
                      id="g-status"
                      value={values.status ?? 'active'}
                      onChange={(v) => set('status', v ?? 'active')}
                      options={STATUSES[type]}
                      noneLabel="Active"
                    />
                  </Field>
                )}
                <Field label="Notes" htmlFor="g-notes">
                  <Textarea id="g-notes" rows={3} value={values.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
                </Field>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {editing ? 'Save' : `Create ${UNIT_LEVEL[type]}`}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      {invites.notice}
    </div>
  )
}
