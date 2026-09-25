'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRightLeft,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronDown,
  Flag,
  HeartHandshake,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  Sparkles,
  Users,
} from 'lucide-react'
import { ccgApi } from '@/lib/ccg/client'
import { message } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { OrbBurst, OrbField } from '@/components/base/Orbs'
import { useCcgMe } from './CcgMeProvider'
import { PersonFormDialog } from './PersonFormDialog'
import { TransferDialog } from './PersonSheet'
import { TraitScale } from './TraitScale'
import { PERSON_STATUS, useCcgOptions, type BankQuestion, type PersonDTO } from './people-types'
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
  type StageState,
} from './progress-types'
import { Initials, Timeline } from './synago'

/**
 * One convert, in one place: who they are, how their assessment year is going
 * (a ring, attendance tiles, the last check-in), and tabs for their journey
 * through the milestones, check-ins, profile and history. Opens from the
 * milestones table and the converts directory (?placement=).
 *
 * Hand-ticked milestones keep their switch; attendance and checklist ones
 * complete themselves, so they show progress (with the dates attended) and
 * their checklist. Sheep seeking roles see the same, minus edit and transfer.
 */

type Detail = ProgressRow & { milestones: MilestoneDef[] }
interface Journey {
  attendance: Record<string, Array<{ date: string; by: string | null }>>
  timeline: Array<{ id: string; action: string; text: string; at: string | null; by: string | null }>
}

/** Dot colour for a milestone on the journey line. */
const NODE: Record<StageState, string> = {
  done: 'bg-success text-white border-success',
  overdue: 'bg-destructive text-white border-destructive',
  due_soon: 'bg-warning text-white border-warning',
  upcoming: 'bg-card text-muted-foreground border-border',
  no_deadline: 'bg-card text-muted-foreground border-border',
}

const phoneDigits = (p: string | null | undefined) => (p ?? '').replace(/\D/g, '')

/** The assessment year as a ring: milestones reached, with days left underneath. */
function Ring({ done, total, caption }: { done: number; total: number; caption: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  const pct = total ? done / total : 0
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className={cn('fill-none transition-[stroke-dashoffset] duration-700', pct === 1 ? 'stroke-success' : 'stroke-primary')}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div>
        <p className="text-2xl font-bold tabular-nums">
          {done}
          <span className="text-base font-medium text-muted-foreground"> of {total}</span>
        </p>
        <p className="text-xs text-muted-foreground">milestones reached</p>
        <p className="mt-1 text-xs font-medium">{caption}</p>
      </div>
    </div>
  )
}

function Tile({ label, value, sub, tone, icon: Icon }: { label: string; value: React.ReactNode; sub?: string; tone?: 'success' | 'warning' | 'destructive'; icon?: React.ElementType }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </p>
      <p className={cn('mt-1 text-lg font-semibold tabular-nums', tone === 'success' && 'text-success', tone === 'warning' && 'text-warning', tone === 'destructive' && 'text-destructive')}>
        {value}
      </p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

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

export function ConvertModal({ placementId, onClose, onChanged }: { placementId: string | null; onClose: () => void; onChanged: () => void }) {
  const { has } = useCcgMe()
  const opts = useCcgOptions()
  const [data, setData] = useState<Detail | null>(null)
  const [person, setPerson] = useState<PersonDTO | null>(null)
  const [journey, setJourney] = useState<Journey | null>(null)
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dates, setDates] = useState<Record<number, string>>({})
  const [tab, setTab] = useState('journey')
  const [dialog, setDialog] = useState<'edit' | 'transfer' | null>(null)
  const [celebrate, setCelebrate] = useState(0)
  const canUpdate = has('milestones.update')

  const load = useCallback(async (id: string) => {
    setError(null)
    const [p, c, j] = await Promise.all([
      ccgApi.get<{ progress: Detail }>(`/placements/${id}/progress`),
      ccgApi.get<{ check_ins: CheckIn[] }>(`/placements/${id}/check-ins`),
      ccgApi.get<{ journey: Journey }>(`/placements/${id}/journey`),
    ])
    if (!p.ok) return setError(p.error.message)
    setData(p.data.progress)
    setCheckIns(c.ok ? c.data.check_ins : [])
    setJourney(j.ok ? j.data.journey : null)
    // The profile is extra: without people.view the modal still shows the journey.
    const who = await ccgApi.get<{ person: PersonDTO }>(`/people/${p.data.progress.person.id}`)
    setPerson(who.ok ? who.data.person : null)
  }, [])

  useEffect(() => {
    setData(null)
    setPerson(null)
    setJourney(null)
    setTab('journey')
    if (placementId) load(placementId)
  }, [placementId, load])

  const afterSave = (res: { graduated?: boolean }) => {
    onChanged()
    if (res.graduated && data) {
      setCelebrate((n) => n + 1)
      message.success(`${data.person.full_name} has reached every milestone and is now a member of ${data.ccf?.name}`)
      setTimeout(onClose, 1600)
      return
    }
    if (placementId) load(placementId)
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

  const defs = useMemo(() => new Map((data?.milestones ?? []).map((m) => [m.stage_number, m])), [data])
  const a = data ? ASSESSMENT[data.assessment.state] : null
  const status = person ? PERSON_STATUS[person.status] : data ? PERSON_STATUS[data.person.status] : null
  const phone = phoneDigits(person?.phone ?? data?.person.phone)
  const last = checkIns[0] ?? null
  const attendanceStages = (data?.stages ?? []).filter((s) => s.kind === 'attendance' && s.progress)

  return (
    <Dialog open={!!placementId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          'flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[88vh] sm:max-h-[56rem] sm:max-w-4xl sm:rounded-xl',
          '[&>button:last-child]:text-white [&>button:last-child]:opacity-90'
        )}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-members to-primary px-5 pt-6 pb-5 text-white sm:px-7">
          <OrbField colors={['churches', 'arrivals']} intensity={0.45} />
          <div className="relative flex flex-wrap items-center gap-4">
            {data ? (
              <Initials name={data.person.full_name} className="size-16 bg-white text-xl text-members shadow-md sm:size-20 sm:text-2xl" />
            ) : (
              <Skeleton className="size-16 rounded-full bg-white/30 sm:size-20" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <DialogTitle className="truncate pr-8 text-xl font-bold text-white sm:text-2xl">{data?.person.full_name ?? 'Loading…'}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap gap-1.5">
                  {status && <Badge className="border-0 bg-white/20 text-white hover:bg-white/25">{status.label}</Badge>}
                  {data?.ccf && (
                    <Badge className="gap-1 border-0 bg-white/15 text-white hover:bg-white/20">
                      <Users className="size-3" aria-hidden />
                      {data.ccf.name} · {data.ccf.ccg.name}
                    </Badge>
                  )}
                  {person?.seeking_group && (
                    <Badge className="gap-1 border-0 bg-white/15 text-white hover:bg-white/20">
                      <HeartHandshake className="size-3" aria-hidden />
                      {person.seeking_group.name}
                    </Badge>
                  )}
                  {last?.follow_up_required && (
                    <Badge className="gap-1 border-0 bg-warning text-white">
                      <Flag className="size-3" aria-hidden />
                      Needs follow-up
                    </Badge>
                  )}
                </div>
              </DialogDescription>
            </div>
          </div>
          {data && (
            <div className="relative mt-4 flex flex-wrap gap-2">
              {phone && (
                <>
                  <Button size="sm" variant="secondary" className="bg-white/15 text-white hover:bg-white/25" asChild>
                    <a href={`tel:+${phone}`}>
                      <Phone className="size-4" />
                      Call
                    </a>
                  </Button>
                  <Button size="sm" variant="secondary" className="bg-white/15 text-white hover:bg-white/25" asChild>
                    <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4" />
                      WhatsApp
                    </a>
                  </Button>
                </>
              )}
              {person && has('people.manage') && (
                <>
                  <Button size="sm" variant="secondary" className="bg-white/15 text-white hover:bg-white/25" onClick={() => setDialog('edit')}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" className="bg-white/15 text-white hover:bg-white/25" onClick={() => setDialog('transfer')}>
                    <ArrowRightLeft className="size-4" />
                    Transfer
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="p-6 text-sm text-destructive">{error}</p>}
          {!data && !error && (
            <div className="space-y-3 p-6">
              <Skeleton className="h-24" />
              <Skeleton className="h-64" />
            </div>
          )}

          {data && a && (
            <>
              {/* At a glance */}
              <div className="grid gap-3 border-b px-5 py-4 sm:px-7 md:grid-cols-[auto_1fr] md:items-center md:gap-6">
                <Ring
                  done={data.completed}
                  total={data.stages.length}
                  caption={data.assessment.state === 'in_progress' ? `${data.assessment.days_left} days left · ends ${fmtDate(data.assessment.ends_on)}` : a.label}
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {attendanceStages.map((s) => {
                    const m = defs.get(s.stage_number)!
                    const n = Math.min(s.progress!.done, s.progress!.total)
                    return (
                      <Tile
                        key={s.stage_number}
                        label={m.short_name}
                        value={`${n}/${s.progress!.total}`}
                        tone={s.state === 'done' ? 'success' : s.state === 'overdue' ? 'destructive' : undefined}
                        icon={CalendarCheck}
                      />
                    )
                  })}
                  <Tile
                    label="Last check-in"
                    value={last ? fmtDate(last.recorded_at) : 'None yet'}
                    sub={last?.recorded_by?.name}
                    tone={last?.follow_up_required ? 'warning' : undefined}
                    icon={HeartHandshake}
                  />
                </div>
              </div>

              <Tabs value={tab} onValueChange={setTab} className="gap-0">
                <div className="sticky top-0 z-20 border-b bg-card/95 px-5 py-2 backdrop-blur sm:px-7">
                  <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                    <TabsTrigger value="journey">Journey</TabsTrigger>
                    <TabsTrigger value="checkins">Check-ins{checkIns.length > 0 && ` (${checkIns.length})`}</TabsTrigger>
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="journey" className="px-5 py-5 sm:px-7">
                  <ol className="relative">
                    <span aria-hidden className="absolute top-4 bottom-4 left-[15px] w-[2px] bg-border" />
                    {data.stages.map((s) => {
                      const m = defs.get(s.stage_number)
                      if (!m) return null
                      return (
                        <JourneyStep
                          key={s.stage_number}
                          stage={s}
                          def={m}
                          attended={m.attendance_event ? journey?.attendance[m.attendance_event] ?? [] : []}
                          ccfId={data.ccf?.id ?? null}
                          canUpdate={canUpdate}
                          canMark={has('attendance.mark')}
                          busy={busy}
                          date={dates[s.stage_number] ?? todayIso()}
                          onDate={(d) => setDates((x) => ({ ...x, [s.stage_number]: d }))}
                          onTick={(done) => tick(s, done)}
                          onTickItem={tickItem}
                        />
                      )
                    })}
                  </ol>
                </TabsContent>

                <TabsContent value="checkins" className="px-5 py-5 sm:px-7">
                  <CheckIns placementId={data.placement_id} checkIns={checkIns} canRecord={has('checkins.record')} onSaved={() => afterSave({})} />
                </TabsContent>

                <TabsContent value="profile" className="px-5 py-5 sm:px-7">
                  <Profile row={data} person={person} questions={opts?.questions ?? []} />
                </TabsContent>

                <TabsContent value="history" className="px-5 py-5 sm:px-7">
                  {journey ? <Timeline entries={journey.timeline} /> : <Skeleton className="h-40" />}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        {person && dialog === 'transfer' && <TransferDialog person={person} onClose={() => setDialog(null)} onDone={() => afterSave({})} />}
        <PersonFormDialog
          mode={person && dialog === 'edit' ? { kind: 'convert', personId: person.id } : null}
          onClose={() => setDialog(null)}
          onSaved={() => afterSave({})}
        />
        <OrbBurst trigger={celebrate} />
      </DialogContent>
    </Dialog>
  )
}

function JourneyStep({
  stage: s,
  def: m,
  attended,
  ccfId,
  canUpdate,
  canMark,
  busy,
  date,
  onDate,
  onTick,
  onTickItem,
}: {
  stage: Stage
  def: MilestoneDef
  attended: Array<{ date: string; by: string | null }>
  ccfId: string | null
  canUpdate: boolean
  canMark: boolean
  busy: string | null
  date: string
  onDate: (d: string) => void
  onTick: (done: boolean) => void
  onTickItem: (itemId: string, done: boolean) => void
}) {
  const st = STAGE_STATE[s.state]
  const done = s.state === 'done'
  const [open, setOpen] = useState(!done && s.kind === 'checklist' && (s.progress?.done ?? 0) > 0)
  const count = s.progress ? Math.min(s.progress.done, s.progress.total) : 0

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      <span className={cn('relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold', NODE[s.state])}>
        {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : s.stage_number}
      </span>
      <div className={cn('min-w-0 flex-1 space-y-3 rounded-xl border p-4 transition-colors', done ? 'border-success/30 bg-success/5' : 'bg-card')}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{m.name}</p>
            {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
          </div>
          <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium', st.className)}>
            {done ? `Done ${fmtDate(s.date_completed)}` : s.due_date && s.state !== 'upcoming' ? `${st.label} · ${fmtDate(s.due_date)}` : st.label}
          </span>
        </div>

        {s.kind === 'manual' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={s.is_completed}
                disabled={!canUpdate || busy !== null}
                onCheckedChange={onTick}
                aria-label={`${m.name} done`}
                className="data-[state=checked]:bg-success data-[state=unchecked]:bg-destructive disabled:opacity-100"
              />
              {s.is_completed ? 'Done' : 'Not yet'}
            </label>
            {canUpdate && !s.is_completed && (
              <Input type="date" className="h-8 w-40" max={todayIso()} value={date} onChange={(e) => onDate(e.target.value)} aria-label={`Date ${m.name} was done`} />
            )}
            {busy === `s${s.stage_number}` && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
        )}

        {s.kind === 'attendance' && s.progress && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="tabular-nums">
                <strong>{count}</strong> of {s.progress.total}
                {m.attendance_event && <span className="text-muted-foreground"> · {EVENT_LABEL[m.attendance_event]}</span>}
              </span>
              {canMark && ccfId && m.attendance_event && (
                <Link href={`/ccg/attendance?ccf=${ccfId}&event=${m.attendance_event}`} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <CalendarCheck className="size-3.5" aria-hidden />
                  Mark attendance
                </Link>
              )}
            </div>
            <Progress value={(count / s.progress.total) * 100} className={cn('h-2', done && '[&>div]:bg-success')} aria-label={`${m.name} progress`} />
            {attended.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {attended.map((d) => (
                  <span key={d.date} title={d.by ? `Marked by ${d.by}` : undefined} className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums">
                    {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No attendance marked yet.</p>
            )}
          </div>
        )}

        {s.kind === 'checklist' && (
          <div className="space-y-2">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 text-left text-sm">
              <Progress value={s.progress ? (count / s.progress.total) * 100 : 0} className={cn('h-2 flex-1', done && '[&>div]:bg-success')} aria-hidden />
              <span className="shrink-0 tabular-nums">
                {count} of {s.progress?.total ?? 0}
              </span>
              <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
              <span className="sr-only">{open ? 'Hide' : 'Show'} checklist</span>
            </button>
            {open && (
              <ul className="space-y-1.5 pt-1">
                {(s.items ?? []).map((i) => (
                  <li key={i.id} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      checked={!!i.done_on}
                      disabled={!canUpdate || busy !== null}
                      onCheckedChange={(v) => onTickItem(i.id, !!v)}
                      aria-label={i.label}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn(i.done_on && 'text-muted-foreground line-through decoration-muted-foreground/40')}>{i.label}</span>
                      {i.help && <span className="block text-xs break-words text-muted-foreground">{i.help}</span>}
                    </span>
                    {i.done_on && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtDate(i.done_on)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {m.guidance && <Guidance text={m.guidance} />}
      </div>
    </li>
  )
}

function Rating({ label, value }: { label: string; value: number | null }) {
  if (!value) return null
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex gap-0.5" aria-label={`${value} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={cn('size-2 rounded-full', n <= value ? 'bg-primary' : 'bg-muted')} />
        ))}
      </span>
    </span>
  )
}

function CheckIns({ placementId, checkIns, canRecord, onSaved }: { placementId: string; checkIns: CheckIn[]; canRecord: boolean; onSaved: () => void }) {
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
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {canRecord && (
        <form onSubmit={save} className="h-fit space-y-4 rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden />
            New check-in
          </p>
          <TraitScale label="How is the convert settling in?" low="Struggling" high="Thriving" value={convertRating} onChange={setConvertRating} />
          <TraitScale label="How well is the CCF welcoming them?" low="Poorly" high="Very well" value={groupRating} onChange={setGroupRating} />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={followUp} onCheckedChange={setFollowUp} />
            Needs follow-up
          </label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes, prayer requests…" aria-label="Check-in notes" />
          <Button type="submit" size="sm" disabled={saving || (!convertRating && !groupRating && !followUp && !notes.trim())}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save check-in
          </Button>
        </form>
      )}
      <div className={cn(!canRecord && 'md:col-span-2')}>
        {checkIns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check-ins yet.</p>
        ) : (
          <ol className="space-y-3">
            {checkIns.map((c) => (
              <li key={c.id} className={cn('rounded-xl border p-3', c.follow_up_required && 'border-warning/40 bg-warning/5')}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {fmtDate(c.recorded_at)}
                    {c.recorded_by && ` · ${c.recorded_by.name}`}
                  </span>
                  {c.follow_up_required && (
                    <Badge variant="warning" className="gap-1">
                      <Flag className="size-3" aria-hidden />
                      Follow-up
                    </Badge>
                  )}
                </div>
                {(c.convert_rating || c.group_rating) && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <Rating label="Settling in" value={c.convert_rating} />
                    <Rating label="Welcome" value={c.group_rating} />
                  </div>
                )}
                {c.notes && <p className="mt-2 text-sm whitespace-pre-line">{c.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function answerChips(q: BankQuestion, v: string | string[] | number | undefined): string[] {
  if (v === undefined) return []
  if (typeof v === 'number') return [`${v} of 5`]
  if (q.type === 'text') return [String(v)]
  return (Array.isArray(v) ? v : [v]).map((k) => q.options.find((o) => o.key === k)?.label ?? k)
}

function Profile({ row, person: p, questions }: { row: Detail; person: PersonDTO | null; questions: BankQuestion[] }) {
  const facts: Array<[string, React.ReactNode]> = p
    ? [
        ['Phone', p.phone ? <a className="text-primary hover:underline" href={`tel:+${phoneDigits(p.phone)}`}>{p.phone}</a> : null],
        ['Email', p.email],
        ['Gender', p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : null],
        ['Age', p.age !== null ? `${p.age}${p.date_of_birth ? ` (born ${fmtDate(p.date_of_birth)})` : ''}` : null],
        ['Lives near', p.landmark],
        ['Converted', p.conversion_date ? fmtDate(p.conversion_date) : null],
        ['Stream', p.stream?.name ?? null],
        ['Sheep seeking group', p.seeking_group?.name ?? null],
        ['Registered by', p.seeker?.full_name ?? null],
        ['Registered', `${fmtDate(p.created_at)}${p.source === 'self' ? ' (themselves)' : ''}`],
        ['Placed', fmtDate(row.placed_at)],
      ]
    : [
        ['Phone', row.person.phone],
        ['Placed', fmtDate(row.placed_at)],
      ]
  const answered = p ? questions.filter((q) => p.answers?.[q.key] !== undefined) : []
  const sections = [...new Set(answered.map((q) => q.section ?? 'Other'))]

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
        {facts
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-medium break-words">{v}</dd>
            </div>
          ))}
      </dl>

      {p && (p.existing_connection || p.existing_connection_note) && (
        <div className="rounded-xl border bg-members/5 p-4 text-sm">
          <p className="text-xs text-muted-foreground">Knows someone in church</p>
          {p.existing_connection && (
            <p className="font-medium">
              {p.existing_connection.full_name}
              {p.connection_by_ai && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(matched from their note)</span>}
            </p>
          )}
          {p.existing_connection_note && <p className="text-muted-foreground">“{p.existing_connection_note}”</p>}
        </div>
      )}

      {sections.map((section) => (
        <section key={section} className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{section}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {answered
              .filter((q) => (q.section ?? 'Other') === section)
              .map((q) => (
                <div key={q.key} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{q.prompt}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {answerChips(q, p!.answers?.[q.key]).map((t) => (
                      <span key={t} className="rounded-full bg-members/10 px-2.5 py-0.5 text-xs font-medium text-members">
                        {t}
                      </span>
                    ))}
                  </div>
                  {p!.answer_notes?.[q.key]?.other_text && <p className="mt-1.5 text-xs text-muted-foreground">Other: “{p!.answer_notes[q.key].other_text}”</p>}
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
