'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ccgApi, fieldErrors } from '@/lib/ccg/client'
import { MEETING_DAYS } from '@/lib/ccg/engine/meeting-slot'
import { message } from '@/lib/toast'
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
 * Add or edit a group (campus, stream, council, CCG or CCF) on its own page, like
 * Synago's church forms. The leader is chosen from members; one without a
 * login is emailed an invitation to set a password.
 */

export type GroupType = 'campus' | 'stream' | 'council' | 'ccg' | 'ccf'

const PARENT: Record<GroupType, { type: GroupType; field: string; label: string; path: string; key: string } | null> = {
  campus: null,
  stream: { type: 'campus', field: 'campus_id', label: 'Campus', path: '/campuses', key: 'campuses' },
  council: { type: 'stream', field: 'stream_id', label: 'Stream', path: '/streams', key: 'streams' },
  ccg: { type: 'council', field: 'council_id', label: 'Council', path: '/councils', key: 'councils' },
  ccf: { type: 'ccg', field: 'ccg_id', label: 'CCG', path: '/ccgs', key: 'ccgs' },
}
// (A stream's leader, its Sheep Seeking Overseer, is appointed on the stream's page.)
const LEADER_LABEL: Record<GroupType, string | null> = { campus: 'Campus Leader', stream: null, council: 'Overseer', ccg: 'City Church Governor', ccf: 'CCF Coordinator' }
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

  const [values, setValues] = useState<Values>({ status: 'active', ...(type === 'ccf' ? { capacity: '12' } : {}) })
  const [leader, setLeader] = useState<PickedMember | null>(null)
  const [initialLeader, setInitialLeader] = useState<string | null>(null)
  const [parents, setParents] = useState<Array<{ value: string; label: string }>>([])
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: string, v: string | null) => setValues((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    if (!parent) return
    ccgApi.get<Record<string, Array<{ id: string; name: string; status: string }>>>(parent.path).then((r) => {
      if (r.ok) setParents((r.data[parent.key] ?? []).filter((p) => p.status !== 'inactive').map((p) => ({ value: p.id, label: p.name })))
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
        capacity: str(g.capacity),
        meeting_day: str(g.meeting_day),
        meeting_time: str(g.meeting_time),
        meeting_location: str(g.meeting_location),
        campus_id: str(g.campus_id),
        stream_id: str(g.stream_id),
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
    if (type === 'ccf' && !(Number(values.capacity) > 0)) local.capacity = 'How many people it can hold'
    setErrors(local)
    if (Object.keys(local).length) return

    const txt = (k: string) => (values[k]?.trim() ? values[k]!.trim() : null)
    const body: Record<string, unknown> = { name: txt('name'), notes: txt('notes') }
    if (full) {
      body.status = values.status ?? 'active'
      if (parent) body[parent.field] = values[parent.field] ?? null
    }
    if (type === 'ccf') {
      body.capacity = Number(values.capacity)
      body.meeting_day = values.meeting_day
      body.meeting_time = txt('meeting_time')
      body.meeting_location = txt('meeting_location')
    }
    if (canLead && (leader?.id ?? null) !== initialLeader) body.leader = leader ? { person_id: leader.id } : null

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
    invites.show(leader?.name ?? 'The leader', r.data.leader_invite, () => router.push(target))
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
                  <Field label={`${parent.label}${type === 'ccf' ? ' *' : ''}`} htmlFor="g-parent" error={errors[parent.field]}>
                    <SearchSelect
                      id="g-parent"
                      value={values[parent.field] ?? null}
                      onChange={(v) => set(parent.field, v)}
                      options={parents}
                      noneLabel={type === 'ccf' ? `Choose a ${parent.label}` : `No ${parent.label.toLowerCase()} yet`}
                      placeholder={`Choose a ${parent.label}`}
                    />
                  </Field>
                )}
                <Field label="Name *" htmlFor="g-name" error={errors.name}>
                  <Input id="g-name" value={values.name ?? ''} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} />
                </Field>

                {canLead && (
                  <Field
                    label={LEADER_LABEL[type]!}
                    htmlFor="g-leader"
                    hint="Chosen from members. One without a login is emailed a link to set their own password."
                  >
                    <MemberPicker id="g-leader" value={leader} onChange={setLeader} />
                  </Field>
                )}


                {type === 'ccf' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Capacity *" htmlFor="g-cap" error={errors.capacity} hint="Members plus placed converts">
                      <Input id="g-cap" type="number" min={1} inputMode="numeric" value={values.capacity ?? ''} onChange={(e) => set('capacity', e.target.value)} />
                    </Field>
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
