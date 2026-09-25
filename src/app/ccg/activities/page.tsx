'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Check, HandHeart, Loader2, Plus, Trash2 } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/base/EmptyState'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { CcgPageHeader } from '@/components/ccg/PageHeader'
import { useCcgMe } from '@/components/ccg/CcgMeProvider'
import { Field, NullableSelect, SearchSelect } from '@/components/ccg/form-utils'
import { fmtDate, todayIso, type ProgressRow } from '@/components/ccg/progress-types'

interface ActivityType {
  key: string
  name: string
  cadence: 'weekly' | 'monthly' | 'quarterly'
  schedule: string | null
  lists_people: boolean
  guidance: string | null
}
interface Activity {
  id: string
  ccg: { id: string; code: string; name: string }
  type: { key: string; name: string }
  held_on: string
  attendee_count: number | null
  notes: string | null
  prayed_for: Array<{ id: string; full_name: string }>
  recorded_by: { name: string } | null
}
interface Summary {
  ccg: { id: string; code: string; name: string }
  types: Array<{ key: string; name: string; cadence: ActivityType['cadence']; last_held_on: string | null; held_this_period: boolean }>
}

const PERIOD = { weekly: 'this week', monthly: 'this month', quarterly: 'this quarter' } as const

export default function CcgActivitiesPage() {
  const { has, loading: meLoading } = useCcgMe()
  const [types, setTypes] = useState<ActivityType[]>([])
  const [data, setData] = useState<{ activities: Activity[]; summary: Summary[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logging, setLogging] = useState<{ ccgId: string | null; typeKey: string | null } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const canView = has('activities.record') || has('reports.view')

  const load = useCallback(async () => {
    const [t, a] = await Promise.all([
      ccgApi.get<{ activity_types: ActivityType[] }>('/activity-types'),
      ccgApi.get<{ activities: Activity[]; summary: Summary[] }>('/group-activities?limit=50'),
    ])
    if (!a.ok) return setError(a.error.message)
    setError(null)
    setTypes(t.ok ? t.data.activity_types : [])
    setData(a.data)
  }, [])

  useEffect(() => {
    if (canView) load()
  }, [load, canView])

  const remove = async (a: Activity) => {
    setDeleting(a.id)
    const r = await ccgApi.del(`/group-activities/${a.id}`)
    setDeleting(null)
    if (!r.ok) return message.error(r.error.message)
    message.success('Removed')
    load()
  }

  if (!meLoading && !canView) {
    return <EmptyState icon={HandHeart} title="CCG activities" description="You don’t have access to CCG activities." className="mt-12" />
  }
  if (error) return <ErrorScreen title="Couldn’t load activities" message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      <CcgPageHeader
        title="CCG activities"
        description="From the CCG Manual: every CCG meets on Wednesday, 5:00–5:30am, to pray for its converts by name, and holds an informal fellowship over food each quarter."
        actions={
          has('activities.record') && (
            <Button onClick={() => setLogging({ ccgId: null, typeKey: null })}>
              <Plus className="size-4" />
              Log activity
            </Button>
          )
        }
      />

      {data === null ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : data.summary.length === 0 ? (
        <EmptyState icon={HandHeart} title="No CCGs in your scope" description="CCG activities are logged per CCG." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.summary.map((g) => (
            <Card key={g.ccg.id} className="gap-3">
              <CardHeader>
                <CardTitle className="text-base">{g.ccg.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {g.types.map((t) => (
                  <div key={t.key} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.last_held_on ? `Last ${fmtDate(t.last_held_on)}` : 'Never logged'}</p>
                    </div>
                    {t.held_this_period ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                        <Check className="size-3.5" aria-hidden />
                        Held {PERIOD[t.cadence]}
                      </span>
                    ) : has('activities.record') ? (
                      <Button size="sm" variant="outline" onClick={() => setLogging({ ccgId: g.ccg.id, typeKey: t.key })}>
                        Log
                      </Button>
                    ) : (
                      <span className="shrink-0 text-xs text-warning">Not yet {PERIOD[t.cadence]}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.activities.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Recent</h2>
          <Card className="gap-0 overflow-hidden p-0">
            <ul className="divide-y">
              {data.activities.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {a.type.name} · {a.ccg.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(a.held_on)}
                      {a.attendee_count !== null && ` · ${a.attendee_count} attended`}
                      {a.prayed_for.length > 0 && ` · prayed for ${a.prayed_for.length}`}
                      {a.recorded_by && ` · by ${a.recorded_by.name}`}
                    </p>
                    {a.notes && <p className="mt-1 whitespace-pre-line">{a.notes}</p>}
                  </div>
                  {has('activities.record') && (
                    <Button size="icon" variant="ghost" onClick={() => remove(a)} disabled={deleting === a.id} aria-label="Remove this entry">
                      {deleting === a.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {logging && data && (
        <LogDialog
          initial={logging}
          types={types}
          ccgs={data.summary.map((g) => g.ccg)}
          onClose={() => setLogging(null)}
          onSaved={() => {
            setLogging(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function LogDialog({
  initial,
  types,
  ccgs,
  onClose,
  onSaved,
}: {
  initial: { ccgId: string | null; typeKey: string | null }
  types: ActivityType[]
  ccgs: Array<{ id: string; name: string }>
  onClose: () => void
  onSaved: () => void
}) {
  const [ccgId, setCcgId] = useState<string | null>(initial.ccgId ?? (ccgs.length === 1 ? ccgs[0].id : null))
  const [typeKey, setTypeKey] = useState<string | null>(initial.typeKey ?? types[0]?.key ?? null)
  const [heldOn, setHeldOn] = useState(todayIso())
  const [count, setCount] = useState('')
  const [notes, setNotes] = useState('')
  const [converts, setConverts] = useState<Array<{ id: string; full_name: string; ccf: string }> | null>(null)
  const [prayedFor, setPrayedFor] = useState<Set<string>>(new Set())
  const [showGuide, setShowGuide] = useState(false)
  const [saving, setSaving] = useState(false)
  const type = types.find((t) => t.key === typeKey)

  // Converts placed in the CCG, to tick who was prayed for by name.
  useEffect(() => {
    setConverts(null)
    setPrayedFor(new Set())
    if (!ccgId || !type?.lists_people) return
    ccgApi.get<{ rows: ProgressRow[] }>(`/progress?ccg_id=${ccgId}`).then((r) => {
      const list = r.ok ? r.data.rows.map((x) => ({ id: x.person.id, full_name: x.person.full_name, ccf: x.ccf?.name ?? '' })) : []
      setConverts(list)
      setPrayedFor(new Set(list.map((c) => c.id)))
    })
  }, [ccgId, type?.lists_people])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const r = await ccgApi.post('/group-activities', {
      ccg_id: ccgId,
      type_key: typeKey,
      held_on: heldOn,
      attendee_count: count ? Number(count) : null,
      notes: notes.trim() || null,
      person_ids: [...prayedFor],
    })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success(`${type?.name ?? 'Activity'} logged`)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Log a CCG activity</DialogTitle>
            <DialogDescription>Logging the same CCG, activity and day again updates that entry.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CCG" htmlFor="g-ccg">
              <SearchSelect id="g-ccg" value={ccgId} onChange={setCcgId} options={ccgs.map((g) => ({ value: g.id, label: g.name }))} placeholder="Choose a CCG" />
            </Field>
            <Field label="Activity" htmlFor="g-type" hint={type?.schedule ?? undefined}>
              <NullableSelect id="g-type" value={typeKey} onChange={setTypeKey} options={types.map((t) => ({ value: t.key, label: t.name }))} noneLabel="Choose" />
            </Field>
            <Field label="Date" htmlFor="g-date">
              <Input id="g-date" type="date" max={todayIso()} value={heldOn} onChange={(e) => setHeldOn(e.target.value)} />
            </Field>
            <Field label="How many attended?" htmlFor="g-count">
              <Input id="g-count" type="number" min={0} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
            </Field>
          </div>

          {type?.guidance && (
            <div>
              <button
                type="button"
                onClick={() => setShowGuide((s) => !s)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                aria-expanded={showGuide}
              >
                <BookOpen className="size-3.5" aria-hidden />
                {type.lists_people ? 'Prayer topics' : 'Guidance'} (CCG Manual)
              </button>
              {showGuide && <p className="mt-2 rounded-md bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-line">{type.guidance}</p>}
            </div>
          )}

          {type?.lists_people && ccgId && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Converts prayed for by name</legend>
              {converts === null ? (
                <Skeleton className="h-20" />
              ) : converts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No placed converts in this CCG.</p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                  {converts.map((c) => (
                    <li key={c.id}>
                      <label className={cn('flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent/40')}>
                        <Checkbox
                          checked={prayedFor.has(c.id)}
                          onCheckedChange={(v) =>
                            setPrayedFor((s) => {
                              const n = new Set(s)
                              if (v) n.add(c.id)
                              else n.delete(c.id)
                              return n
                            })
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{c.full_name}</span>
                        <span className="text-xs text-muted-foreground">{c.ccf}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}

          <Field label="Notes" htmlFor="g-notes">
            <Textarea id="g-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !ccgId || !typeKey || !heldOn}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
