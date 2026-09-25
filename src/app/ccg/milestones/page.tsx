'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, ListChecks, Loader2, Pencil, Plus, Trophy } from 'lucide-react'
import { ccgApi, fieldErrors } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { Field, NullableSelect } from '@/components/ccg/form-utils'
import { StickyHeader } from '@/components/ccg/synago'
import { EVENT_LABEL, type MilestoneDef } from '@/components/ccg/progress-types'

/**
 * Milestones settings: the CCG Manual's retention milestones, stored in the
 * database and edited here (as Seek's milestones page). Each is ticked by hand,
 * completes itself from attendance, or completes when its checklist is done.
 * Stage number, kind and attendance event are fixed once created, because
 * converts' progress is recorded against them; switch a milestone off instead
 * of deleting it.
 */

const KIND: Record<MilestoneDef['kind'], { label: string; icon: typeof Trophy; hint: string }> = {
  manual: { label: 'Ticked by hand', icon: Trophy, hint: 'A leader or Sheep Seeker ticks it in the milestones table.' },
  attendance: { label: 'From attendance', icon: CalendarCheck, hint: 'Completes itself once the convert has attended enough times.' },
  checklist: { label: 'Checklist', icon: ListChecks, hint: 'Completes itself when every item on its checklist is ticked.' },
}

type Editing = { mode: 'new'; next: number } | { mode: 'edit'; m: MilestoneDef }

export default function CcgMilestonesSettingsPage() {
  const { hasGlobal, loading: meLoading } = useCcgMe()
  const canManage = hasGlobal('settings.manage')
  const [rows, setRows] = useState<MilestoneDef[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await ccgApi.get<{ milestones: MilestoneDef[] }>('/milestones?include_inactive=1')
    if (!r.ok) return setError(r.error.message)
    setError(null)
    setRows(r.data.milestones)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleActive = async (m: MilestoneDef, active: boolean) => {
    setToggling(m.id)
    const r = await ccgApi.patch(`/milestones/${m.id}`, { is_active: active })
    setToggling(null)
    if (!r.ok) return message.error(r.error.message)
    message.success(active ? `${m.name} switched on` : `${m.name} switched off: it no longer counts toward graduating`)
    load()
  }

  if (!meLoading && !canManage) {
    return <EmptyState icon={Trophy} title="Milestones" description="Only the central team can change the milestones." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load milestones" message={error} onRetry={load} />

  const next = (rows ?? []).reduce((n, m) => Math.max(n, m.stage_number), 0) + 1

  return (
    <div className="pb-10">
      <StickyHeader className="space-y-1">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Settings</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Retention <span className="text-members">Milestones</span>
            </h1>
          </div>
          <Button className="h-10 gap-1.5" onClick={() => setEditing({ mode: 'new', next })} disabled={!rows}>
            <Plus className="size-4" />
            Add milestone
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          A convert graduates into their CCF once every active milestone is done. Changes apply to everyone in their assessment year.
        </p>
      </StickyHeader>

      {!rows ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState orb icon={Trophy} title="No milestones yet" description="Add the milestones converts work through in their assessment year." className="mt-12" />
      ) : (
        <ol className="mt-4 space-y-2">
          {rows.map((m) => {
            const k = KIND[m.kind]
            return (
              <li key={m.id}>
                <Card className={`flex flex-row items-center gap-4 p-4 ${m.is_active ? '' : 'opacity-60'}`}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold tabular-nums">
                    M{String(m.stage_number).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {m.name} <span className="text-sm font-normal text-muted-foreground">({m.short_name})</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant="secondary" className="gap-1">
                        <k.icon className="size-3" aria-hidden />
                        {k.label}
                      </Badge>
                      {m.kind === 'attendance' && m.attendance_event && (
                        <Badge variant="outline">
                          {m.attendance_target}× {EVENT_LABEL[m.attendance_event]}
                        </Badge>
                      )}
                      {m.kind === 'checklist' && <Badge variant="outline">{m.items.filter((i) => i.is_active).length} items</Badge>}
                      <Badge variant="outline">{m.target_days === null ? 'No deadline' : `Within ${m.target_days} days`}</Badge>
                    </div>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={m.is_active}
                      disabled={toggling === m.id}
                      onCheckedChange={(v) => toggleActive(m, v)}
                      aria-label={`${m.name} is ${m.is_active ? 'on' : 'off'}`}
                    />
                    <span className="hidden sm:inline">{m.is_active ? 'On' : 'Off'}</span>
                  </label>
                  <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => setEditing({ mode: 'edit', m })} aria-label={`Edit ${m.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                </Card>
              </li>
            )
          })}
        </ol>
      )}

      {editing && (
        <MilestoneDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function MilestoneDialog({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: () => void }) {
  const m = editing.mode === 'edit' ? editing.m : null
  const [v, setV] = useState({
    stage_number: String(m?.stage_number ?? (editing.mode === 'new' ? editing.next : 1)),
    name: m?.name ?? '',
    short_name: m?.short_name ?? '',
    kind: (m?.kind ?? 'manual') as MilestoneDef['kind'],
    attendance_event: m?.attendance_event ?? null,
    attendance_target: m?.attendance_target ? String(m.attendance_target) : '',
    target_days: m?.target_days === null || m?.target_days === undefined ? '' : String(m.target_days),
    description: m?.description ?? '',
    guidance: m?.guidance ?? '',
  })
  const [items, setItems] = useState(m?.items ?? [])
  const [newItem, setNewItem] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof v, val: string | null) => setV((x) => ({ ...x, [k]: val }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const common = {
      name: v.name.trim(),
      short_name: v.short_name.trim(),
      description: v.description.trim() || null,
      guidance: v.guidance.trim() || null,
      target_days: v.target_days === '' ? null : Number(v.target_days),
      ...(v.kind === 'attendance' ? { attendance_target: Number(v.attendance_target) || null } : {}),
    }
    setSaving(true)
    const r = m
      ? await ccgApi.patch(`/milestones/${m.id}`, common)
      : await ccgApi.post<{ id: string }>('/milestones', {
          ...common,
          stage_number: Number(v.stage_number),
          kind: v.kind,
          ...(v.kind === 'attendance' ? { attendance_event: v.attendance_event } : {}),
          is_active: true,
        })
    setSaving(false)
    if (!r.ok) {
      setErrors(fieldErrors(r.error))
      return message.error(r.error.message)
    }
    message.success(m ? 'Milestone saved' : 'Milestone added')
    onSaved()
  }

  const addItem = async () => {
    if (!m || !newItem.trim()) return
    const label = newItem.trim()
    const key =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 50) || `item_${items.length + 1}`
    const r = await ccgApi.post<{ id: string }>(`/milestones/${m.id}/items`, { key, label, sort_order: items.length + 1 })
    if (!r.ok) return message.error(r.error.message)
    setItems((xs) => [...xs, { id: r.data.id, key, label, help: null, sort_order: xs.length + 1, is_active: true }])
    setNewItem('')
  }
  const setItemActive = async (id: string, active: boolean) => {
    const r = await ccgApi.patch(`/milestones/${m!.id}/items/${id}`, { is_active: active })
    if (!r.ok) return message.error(r.error.message)
    setItems((xs) => xs.map((i) => (i.id === id ? { ...i, is_active: active } : i)))
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={save} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{m ? `Edit ${m.name}` : 'Add a milestone'}</DialogTitle>
            <DialogDescription>
              {m ? 'Its stage number and kind stay as they are: converts’ progress is recorded against them.' : KIND[v.kind].hint}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Stage *" htmlFor="m-stage" error={errors.stage_number}>
              <Input id="m-stage" type="number" min={1} value={v.stage_number} disabled={!!m} onChange={(e) => set('stage_number', e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Name *" htmlFor="m-name" error={errors.name}>
                <Input id="m-name" value={v.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
            </div>
            <Field label="Short name *" htmlFor="m-short" error={errors.short_name} hint="Shown in the table header">
              <Input id="m-short" maxLength={30} value={v.short_name} onChange={(e) => set('short_name', e.target.value)} />
            </Field>
            <Field label="Kind" htmlFor="m-kind">
              <NullableSelect
                id="m-kind"
                value={v.kind}
                disabled={!!m}
                onChange={(x) => x && set('kind', x)}
                options={Object.entries(KIND).map(([value, k]) => ({ value, label: k.label }))}
                noneLabel="Ticked by hand"
              />
            </Field>
            <Field label="Due within (days)" htmlFor="m-days" error={errors.target_days} hint="Empty = no deadline">
              <Input id="m-days" type="number" min={0} value={v.target_days} onChange={(e) => set('target_days', e.target.value)} />
            </Field>
            {v.kind === 'attendance' && (
              <>
                <div className="sm:col-span-2">
                  <Field label="Counts attendance at" htmlFor="m-event">
                    <NullableSelect
                      id="m-event"
                      value={v.attendance_event}
                      disabled={!!m}
                      onChange={(x) => set('attendance_event', x)}
                      options={Object.entries(EVENT_LABEL).map(([value, label]) => ({ value, label }))}
                      noneLabel="Choose"
                    />
                  </Field>
                </div>
                <Field label="Times needed *" htmlFor="m-target" error={errors.attendance_target}>
                  <Input id="m-target" type="number" min={1} value={v.attendance_target} onChange={(e) => set('attendance_target', e.target.value)} />
                </Field>
              </>
            )}
          </div>
          <Field label="Description" htmlFor="m-desc" error={errors.description}>
            <Textarea id="m-desc" rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Guidance for leaders" htmlFor="m-guide" error={errors.guidance} hint="Shown in the convert’s follow-up panel">
            <Textarea id="m-guide" rows={4} value={v.guidance} onChange={(e) => set('guidance', e.target.value)} />
          </Field>

          {m?.kind === 'checklist' && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Checklist</p>
              <ul className="space-y-1.5">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className={i.is_active ? '' : 'text-muted-foreground line-through'}>{i.label}</span>
                    <Switch checked={i.is_active} onCheckedChange={(x) => setItemActive(i.id, x)} aria-label={`${i.label} is ${i.is_active ? 'on' : 'off'}`} />
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input placeholder="New item" value={newItem} onChange={(e) => setNewItem(e.target.value)} aria-label="New checklist item" />
                <Button type="button" variant="outline" onClick={addItem} disabled={!newItem.trim()}>
                  Add
                </Button>
              </div>
            </div>
          )}
          {!m && v.kind === 'checklist' && <p className="text-xs text-muted-foreground">Add its checklist items after saving.</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !v.name.trim() || !v.short_name.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {m ? 'Save' : 'Add milestone'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
