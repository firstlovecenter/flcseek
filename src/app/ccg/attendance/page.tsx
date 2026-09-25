'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarCheck, Loader2, Save } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/base/EmptyState'
import { CcgPageHeader } from '@/components/ccg/PageHeader'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { Field, NullableSelect, SearchSelect } from '@/components/ccg/form-utils'
import { ccfLabel, useCcgOptions } from '@/components/ccg/people-types'
import { EVENT_LABEL, todayIso, type MilestoneDef } from '@/components/ccg/progress-types'

type Event = keyof typeof EVENT_LABEL
interface Register {
  ccf: { id: string; name: string; ccg: { name: string } }
  event_type: Event
  event_date: string
  rows: Array<{ placement_id: string; person: { id: string; full_name: string; phone: string | null }; present: boolean; total: number }>
}

/** Most recent Sunday (today if it is Sunday), as yyyy-mm-dd. */
function lastSunday() {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay())
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function AttendanceRegister() {
  const { has, loading: meLoading } = useCcgMe()
  const opts = useCcgOptions()
  const params = useSearchParams()
  const [ccfId, setCcfId] = useState<string | null>(params.get('ccf'))
  const [event, setEvent] = useState<Event>((params.get('event') as Event) in EVENT_LABEL ? (params.get('event') as Event) : 'sunday_service')
  const [date, setDate] = useState(event === 'sunday_service' ? lastSunday() : todayIso())
  const [register, setRegister] = useState<Register | null>(null)
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [targets, setTargets] = useState<Partial<Record<Event, number>>>({})

  useEffect(() => {
    ccgApi.get<{ milestones: MilestoneDef[] }>('/milestones').then((r) => {
      if (!r.ok) return
      const t: Partial<Record<Event, number>> = {}
      for (const m of r.data.milestones) if (m.kind === 'attendance' && m.attendance_event && m.attendance_target) t[m.attendance_event] = m.attendance_target
      setTargets(t)
    })
  }, [])

  const load = useCallback(async () => {
    if (!ccfId || !date) return setRegister(null)
    setLoading(true)
    const r = await ccgApi.get<{ register: Register }>(`/attendance?ccf_id=${ccfId}&event_type=${event}&date=${date}`)
    setLoading(false)
    if (!r.ok) {
      setRegister(null)
      return message.error(r.error.message)
    }
    setRegister(r.data.register)
    setPresent(new Set(r.data.register.rows.filter((x) => x.present).map((x) => x.person.id)))
  }, [ccfId, event, date])

  useEffect(() => {
    load()
  }, [load])

  const dirty = useMemo(
    () => !!register && register.rows.some((r) => r.present !== present.has(r.person.id)),
    [register, present]
  )

  const save = async () => {
    if (!register) return
    setSaving(true)
    const r = await ccgApi.put<{ present: number; absent: number; graduated: string[]; register: Register }>('/attendance', {
      ccf_id: register.ccf.id,
      event_type: event,
      event_date: date,
      entries: register.rows.map((x) => ({ person_id: x.person.id, present: present.has(x.person.id) })),
    })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success(`Saved: ${r.data.present} present`)
    if (r.data.graduated.length) {
      const names = register.rows.filter((x) => r.data.graduated.includes(x.person.id)).map((x) => x.person.full_name)
      message.success(`${names.join(', ')} reached every milestone and ${names.length === 1 ? 'is' : 'are'} now a member of ${register.ccf.name}`)
    }
    setRegister(r.data.register)
    setPresent(new Set(r.data.register.rows.filter((x) => x.present).map((x) => x.person.id)))
  }

  if (!meLoading && !has('attendance.mark')) {
    return <EmptyState icon={CalendarCheck} title="Attendance" description="You don’t have access to mark attendance." className="mt-12" />
  }

  const target = targets[event]
  const all = register ? register.rows.length > 0 && register.rows.every((r) => present.has(r.person.id)) : false

  return (
    <div className="space-y-6">
      <CcgPageHeader
        title="Attendance"
        description="Mark who came, for each Sunday service and fellowship meeting. The fellowship milestones complete themselves when a convert reaches the target."
      />

      <Card className="grid gap-4 p-4 sm:grid-cols-3">
        <Field label="CCF" htmlFor="a-ccf">
          <SearchSelect
            id="a-ccf"
            value={ccfId}
            onChange={setCcfId}
            options={(opts?.ccfs ?? []).filter((f) => f.status === 'active').map((f) => ({ value: f.id, label: f.name, hint: f.ccg.name }))}
            placeholder="Choose a CCF"
          />
        </Field>
        <Field label="Meeting" htmlFor="a-event">
          <NullableSelect
            id="a-event"
            value={event}
            onChange={(v) => {
              if (!v) return
              setEvent(v as Event)
              if (v === 'sunday_service') setDate(lastSunday())
            }}
            options={Object.entries(EVENT_LABEL).map(([value, label]) => ({ value, label }))}
            noneLabel="Choose"
          />
        </Field>
        <Field label="Date" htmlFor="a-date">
          <Input id="a-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Card>

      {!ccfId ? (
        <EmptyState icon={CalendarCheck} title="Choose a CCF" description="Its placed converts are listed so you can tick who came." />
      ) : loading || !register ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : register.rows.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No placed converts" description={`${register.ccf.name} has no converts in their assessment year.`} />
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={all}
                onCheckedChange={(v) => setPresent(v ? new Set(register.rows.map((r) => r.person.id)) : new Set())}
                aria-label="Mark everyone present"
              />
              Everyone present
            </label>
            <span className="text-sm text-muted-foreground tabular-nums">
              {present.size} of {register.rows.length} present
            </span>
          </div>
          <ul className="divide-y">
            {register.rows.map((r) => {
              const here = present.has(r.person.id)
              const total = r.total - (r.present ? 1 : 0) + (here ? 1 : 0)
              return (
                <li key={r.person.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-accent/40">
                    <Checkbox
                      checked={here}
                      onCheckedChange={(v) =>
                        setPresent((s) => {
                          const n = new Set(s)
                          if (v) n.add(r.person.id)
                          else n.delete(r.person.id)
                          return n
                        })
                      }
                      aria-label={`${r.person.full_name} present`}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.person.full_name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {target ? `${Math.min(total, target)} of ${target}` : `${total} so far`}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="flex justify-end border-t p-3">
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save register
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export default function CcgAttendancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
      <AttendanceRegister />
    </Suspense>
  )
}
