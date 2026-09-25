'use client'

import { useEffect, useState } from 'react'
import { ccgApi } from '@/lib/ccg/client'
import type { FormQuestion } from './QuestionFields'

/** Shapes returned by /api/ccg/people and friends, and shared labels. */

export interface UnitRef {
  id: string
  code: string
  name: string
  ccg?: { id: string; code?: string; name: string }
}

export interface PersonDTO {
  id: string
  kind: 'member' | 'convert'
  ref_code: string | null
  /** Built from first, middle and last name. */
  full_name: string
  first_name: string
  middle_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  gender: string | null
  date_of_birth: string | null
  age: number | null
  landmark: string | null
  conversion_date: string | null
  ccf: UnitRef | null
  stream: { id: string; code: string; name: string } | null
  login: { user_id: string; username: string } | null
  existing_connection: { id: string; full_name: string } | null
  existing_connection_note: string | null
  /** The connection above was matched by the AI from the note. */
  connection_by_ai?: boolean
  /** Converts: the Sheep Seeker who brought or registered them. */
  seeker?: { id: string; full_name: string } | null
  possible_duplicate_of: { id: string; full_name: string; kind: string } | null
  status: string
  source: string
  notes: string | null
  placement: { id: string; status: string; ccf: UnitRef | null; decided_at: string | null } | null
  proposal: { id: string; status: string; ccf: UnitRef | null; score: number | null; hold_reason: string | null } | null
  answers?: Record<string, string | string[] | number>
  /** Per question: what was typed after "Other", and the options the AI added from it. */
  answer_notes?: Record<string, { other_text: string | null; ai_keys: string[] }>
  created_at: string | null
}

type Tone = 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'

export const PERSON_STATUS: Record<string, { label: string; tone: Tone }> = {
  // members
  pending: { label: 'Awaiting confirmation', tone: 'warning' },
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'secondary' },
  // converts
  new: { label: 'New', tone: 'outline' },
  proposed: { label: 'Awaiting approval', tone: 'warning' },
  needs_info: { label: 'On hold', tone: 'warning' },
  placed: { label: 'Placed', tone: 'success' },
  integrated: { label: 'Integrated', tone: 'success' },
}

export interface CcfOption {
  id: string
  code: string
  name: string
  status: string
  capacity: number
  ccg: { id: string; code: string; name: string; status: string }
}
export interface StreamOption {
  id: string
  code: string
  name: string
  status: string
}
export interface BankQuestion extends FormQuestion {
  audience: 'member' | 'convert' | 'both'
  active: boolean
}

export interface CcgOptions {
  ccfs: CcfOption[]
  streams: StreamOption[]
  questions: BankQuestion[]
}

/** Reference lists used by the people, links and follow-up screens (loaded once per mount). */
export function useCcgOptions(): CcgOptions | null {
  const [opts, setOpts] = useState<CcgOptions | null>(null)
  useEffect(() => {
    let live = true
    Promise.all([
      ccgApi.get<{ ccfs: CcfOption[] }>('/ccfs'),
      ccgApi.get<{ streams: StreamOption[] }>('/streams'),
      ccgApi.get<{ questions: BankQuestion[] }>('/questions'),
    ]).then(([f, s, q]) => {
      if (!live) return
      setOpts({
        ccfs: f.ok ? f.data.ccfs : [],
        streams: s.ok ? s.data.streams.filter((x) => x.status === 'active') : [],
        questions: q.ok ? q.data.questions : [],
      })
    })
    return () => {
      live = false
    }
  }, [])
  return opts
}

export const ccfLabel = (f: { name: string; ccg?: { name: string } }) => (f.ccg ? `${f.name} · ${f.ccg.name}` : f.name)

export interface SeekerOption {
  person_id: string
  name: string
  streams: Array<{ id: string; name: string }>
}

/** Sheep Seekers to choose from, optionally of one stream. */
export function useSeekerOptions(streamId: string | null | undefined): SeekerOption[] | null {
  const [list, setList] = useState<SeekerOption[] | null>(null)
  useEffect(() => {
    let live = true
    setList(null)
    ccgApi.get<{ seekers: SeekerOption[] }>(`/seekers/options${streamId ? `?stream_id=${streamId}` : ''}`).then((r) => live && setList(r.ok ? r.data.seekers : []))
    return () => {
      live = false
    }
  }, [streamId])
  return list
}
