'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, CalendarCheck, ChevronDown, Flag, Loader2 } from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCcgMe } from './CcgMeProvider'
import { TraitScale } from './TraitScale'
import {
  ASSESSMENT,
  EVENT_LABEL,
  STAGE_STATE,
  fmtDate,
  todayIso,
  type CheckIn,
  type MilestoneDef,
  type ProgressRow,
  type Stage,
} from './progress-types'

type Detail = ProgressRow & { milestones: MilestoneDef[] }

function Guidance({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <BookOpen className="size-3.5" aria-hidden />
        How to (CCG Manual)
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <p className="mt-2 rounded-md bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-line">{text}</p>}
    </div>
  )
}

/** One convert's assessment year: milestones (with the manual's guidance), checklists and check-ins. */
export function FollowUpSheet({
  placementId,
  onClose,
  onChanged,
}: {
  placementId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const { has } = useCcgMe()
  const [data, setData] = useState<Detail | null>(null)
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dates, setDates] = useState<Record<number, string>>({})
  const canUpdate = has('milestones.update')

  const load = useCallback(async (id: string) => {
    setError(null)
    const [p, c] = await Promise.all([
      ccgApi.get<{ progress: Detail }>(`/placements/${id}/progress`),
      ccgApi.get<{ check_ins: CheckIn[] }>(`/placements/${id}/check-ins`),
    ])
    if (!p.ok) return setError(p.error.message)
    setData(p.data.progress)
    setCheckIns(c.ok ? c.data.check_ins : [])
  }, [])

  useEffect(() => {
    setData(null)
    if (placementId) load(placementId)
  }, [placementId, load])

  const afterSave = (res: { graduated?: boolean }) => {
    if (res.graduated && data) {
      message.success(`${data.person.full_name} has reached every milestone and is now a member of ${data.ccf?.name}`)
      onChanged()
      onClose()
      return
    }
    if (placementId) load(placementId)
    onChanged()
  }

  const tick = async (stage: Stage, done: boolean) => {
    if (!placementId) return
    setBusy(`s${stage.stage_number}`)
    const r = await ccgApi.put<{ graduated: boolean }>(`/placements/${placementId}/progress`, {
      stage_number: stage.stage_number,
      is_completed: done,
      date_completed: done ? dates[stage.stage_number] || todayIso() : null,
    })
    setBusy(null)
    if (!r.ok) return message.error(r.error.message)
    afterSave(r.data)
  }

  const tickItem = async (itemId: string, done: boolean) => {
    if (!placementId) return
    setBusy(`i${itemId}`)
    const r = await ccgApi.put<{ graduated: boolean }>(`/placements/${placementId}/checklist`, {
      item_id: itemId,
      done,
      date_completed: done ? todayIso() : null,
    })
    setBusy(null)
    if (!r.ok) return message.error(r.error.message)
    afterSave(r.data)
  }

  const a = data ? ASSESSMENT[data.assessment.state] : null
  const defs = new Map((data?.milestones ?? []).map((m) => [m.stage_number, m]))

  return (
    <Sheet open={!!placementId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{data?.person.full_name ?? 'Follow-up'}</SheetTitle>
          <SheetDescription>{data ? `${data.ccf?.name ?? ''} · ${data.ccf?.ccg.name ?? ''}` : 'Loading…'}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!data && !error && (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-64" />
            </div>
          )}

          {data && a && (
            <>
              <section className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">Assessment year</span>
                  <Badge variant={a.tone}>{a.label}</Badge>
                </div>
                <Progress value={(data.completed / Math.max(1, data.stages.length)) * 100} aria-label="Milestones reached" />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {data.completed} of {data.stages.length} milestones · placed {fmtDate(data.placed_at)} · ends {fmtDate(data.assessment.ends_on)}
                  {data.assessment.state === 'in_progress' && ` (${data.assessment.days_left} days left)`}
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-medium">Milestones</h3>
                {data.stages.map((s) => {
                  const m = defs.get(s.stage_number)
                  if (!m) return null
                  const st = STAGE_STATE[s.state]
                  return (
                    <div key={s.stage_number} className="space-y-3 rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {m.stage_number}. {m.name}
                          </p>
                          {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                        </div>
                        <span className={cn('shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium', st.className)}>
                          {s.state === 'done' ? `Done ${fmtDate(s.date_completed)}` : st.label}
                        </span>
                      </div>

                      {s.kind === 'manual' && canUpdate && (
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={s.is_completed}
                              disabled={busy !== null}
                              onCheckedChange={(v) => tick(s, !!v)}
                              aria-label={`${m.name} done`}
                            />
                            Done
                          </label>
                          {!s.is_completed && (
                            <Input
                              type="date"
                              className="h-8 w-40"
                              max={todayIso()}
                              value={dates[s.stage_number] ?? todayIso()}
                              onChange={(e) => setDates((d) => ({ ...d, [s.stage_number]: e.target.value }))}
                              aria-label={`Date ${m.name} was done`}
                            />
                          )}
                          {busy === `s${s.stage_number}` && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                        </div>
                      )}

                      {s.kind === 'attendance' && s.progress && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="tabular-nums">
                              {Math.min(s.progress.done, s.progress.total)} of {s.progress.total}
                              {m.attendance_event && ` · ${EVENT_LABEL[m.attendance_event]}`}
                            </span>
                            {has('attendance.mark') && data.ccf && m.attendance_event && (
                              <Link
                                href={`/ccg/attendance?ccf=${data.ccf.id}&event=${m.attendance_event}`}
                                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                <CalendarCheck className="size-3.5" aria-hidden />
                                Mark attendance
                              </Link>
                            )}
                          </div>
                          <Progress value={(Math.min(s.progress.done, s.progress.total) / s.progress.total) * 100} aria-label={`${m.name} progress`} />
                        </div>
                      )}

                      {s.kind === 'checklist' && (
                        <div className="space-y-1">
                          {s.progress && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {s.progress.done} of {s.progress.total} done
                            </p>
                          )}
                          <ul className="space-y-1">
                            {(s.items ?? []).map((i) => (
                              <li key={i.id} className="flex items-start gap-2 text-sm">
                                <Checkbox
                                  className="mt-0.5"
                                  checked={!!i.done_on}
                                  disabled={!canUpdate || busy !== null}
                                  onCheckedChange={(v) => tickItem(i.id, !!v)}
                                  aria-label={i.label}
                                />
                                <span className="min-w-0">
                                  <span className={cn(i.done_on && 'text-muted-foreground')}>{i.label}</span>
                                  {i.help && <span className="block text-xs break-words text-muted-foreground">{i.help}</span>}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {m.guidance && <Guidance text={m.guidance} />}
                    </div>
                  )
                })}
              </section>

              <CheckInSection placementId={data.placement_id} checkIns={checkIns} canRecord={has('checkins.record')} onSaved={() => afterSave({})} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CheckInSection({
  placementId,
  checkIns,
  canRecord,
  onSaved,
}: {
  placementId: string
  checkIns: CheckIn[]
  canRecord: boolean
  onSaved: () => void
}) {
  const [convertRating, setConvertRating] = useState<number | null>(null)
  const [groupRating, setGroupRating] = useState<number | null>(null)
  const [followUp, setFollowUp] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const r = await ccgApi.post(`/placements/${placementId}/check-ins`, {
      convert_rating: convertRating,
      group_rating: groupRating,
      follow_up_required: followUp,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (!r.ok) return message.error(r.error.message)
    message.success('Check-in saved')
    setConvertRating(null)
    setGroupRating(null)
    setFollowUp(false)
    setNotes('')
    onSaved()
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Check-ins</h3>
      {canRecord && (
        <form onSubmit={save} className="space-y-3 rounded-lg border p-3">
          <TraitScale label="How is the convert settling in?" low="Struggling" high="Thriving" value={convertRating} onChange={setConvertRating} />
          <TraitScale label="How well is the CCF welcoming them?" low="Poorly" high="Very well" value={groupRating} onChange={setGroupRating} />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={followUp} onCheckedChange={setFollowUp} />
            Needs follow-up
          </label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes, prayer requests…" aria-label="Check-in notes" />
          <Button type="submit" size="sm" disabled={saving || (!convertRating && !groupRating && !followUp && !notes.trim())}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save check-in
          </Button>
        </form>
      )}
      {checkIns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No check-ins yet.</p>
      ) : (
        <ul className="space-y-2">
          {checkIns.map((c) => (
            <li key={c.id} className="rounded-md border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {fmtDate(c.recorded_at)}
                {c.recorded_by && ` · ${c.recorded_by.name}`}
                {c.follow_up_required && (
                  <Badge variant="warning" className="gap-1">
                    <Flag className="size-3" aria-hidden />
                    Follow-up
                  </Badge>
                )}
              </div>
              {(c.convert_rating || c.group_rating) && (
                <p className="text-xs tabular-nums">
                  {c.convert_rating && `Settling in ${c.convert_rating}/5`}
                  {c.convert_rating && c.group_rating && ' · '}
                  {c.group_rating && `Welcome ${c.group_rating}/5`}
                </p>
              )}
              {c.notes && <p className="mt-1 whitespace-pre-line">{c.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
