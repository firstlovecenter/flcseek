/** Shapes returned by /api/ccg/progress and /api/ccg/placements/[id]/progress. */

export type StageState = 'done' | 'overdue' | 'due_soon' | 'upcoming' | 'no_deadline'
export type AssessmentState = 'in_progress' | 'complete' | 'ended_incomplete'

export interface MilestoneDef {
  id: string
  stage_number: number
  name: string
  short_name: string
  kind: 'manual' | 'attendance' | 'checklist'
  attendance_event: 'sunday_service' | 'online_fellowship' | 'in_person_fellowship' | null
  attendance_target: number | null
  description: string | null
  guidance: string | null
  target_days: number | null
  is_active: boolean
  items: Array<{ id: string; key: string; label: string; help: string | null; sort_order: number; is_active: boolean }>
}

export interface Stage {
  stage_number: number
  kind: MilestoneDef['kind']
  state: StageState
  due_date: string | null
  is_completed: boolean
  date_completed: string | null
  notes: string | null
  progress: { done: number; total: number } | null
  items?: Array<{ id: string; key: string; label: string; help: string | null; done_on: string | null }>
}

export interface CheckIn {
  id: string
  convert_rating: number | null
  group_rating: number | null
  follow_up_required: boolean
  notes: string | null
  recorded_by: { id: string; name: string } | null
  recorded_at: string | null
}

export interface ProgressRow {
  placement_id: string
  person: { id: string; full_name: string; ref_code: string | null; phone: string | null; status: string }
  ccf: { id: string; code: string; name: string; ccg: { id: string; name: string } } | null
  placed_at: string | null
  days_since_placement: number
  was_remapped: boolean
  stages: Stage[]
  completed: number
  overdue: number
  assessment: { ends_on: string; days_left: number; state: AssessmentState }
  latest_check_in: CheckIn | null
}

export const STAGE_STATE: Record<StageState, { label: string; className: string }> = {
  done: { label: 'Done', className: 'bg-success/15 text-success border-success/30' },
  overdue: { label: 'Overdue', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  due_soon: { label: 'Due soon', className: 'bg-warning/15 text-warning border-warning/30' },
  upcoming: { label: 'Not yet due', className: 'bg-muted text-muted-foreground border-border' },
  no_deadline: { label: 'No deadline', className: 'bg-muted text-muted-foreground border-border' },
}

export const ASSESSMENT: Record<AssessmentState, { label: string; tone: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  in_progress: { label: 'In progress', tone: 'secondary' },
  complete: { label: 'All milestones reached', tone: 'success' },
  ended_incomplete: { label: 'Year ended, milestones missed', tone: 'destructive' },
}

export const EVENT_LABEL: Record<NonNullable<MilestoneDef['attendance_event']>, string> = {
  sunday_service: 'Sunday service',
  online_fellowship: 'Online fellowship',
  in_person_fellowship: 'In-person fellowship',
}

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s.length === 10 ? `${s}T00:00:00` : s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
