'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ccgApi } from '@/lib/ccg/client'
import { useCcgMe } from './CcgMeProvider'

/**
 * "Church in focus" (as in the admin portal): the unit the dashboard and
 * shortcuts are about. Options are the units the user holds a role in; the
 * central team and Seek superadmins can also focus on the whole church or any
 * stream. The choice is remembered on this device.
 */

export type FocusType = 'global' | 'stream' | 'council' | 'ccg' | 'ccf'

export interface FocusOption {
  key: string
  type: FocusType
  id: string | null
  name: string
  role: string
}

export const LEVEL_LABEL: Record<FocusType, string> = {
  global: 'Church-wide',
  stream: 'Stream',
  council: 'Council',
  ccg: 'CCG',
  ccf: 'CCF',
}

interface Ctx {
  options: FocusOption[]
  focus: FocusOption | null
  setFocus: (key: string) => void
  ready: boolean
}

const FocusContext = createContext<Ctx | null>(null)
const STORAGE_KEY = 'ccg.focus'

export function CcgFocusProvider({ children }: { children: React.ReactNode }) {
  const { me, loading } = useCcgMe()
  const [streams, setStreams] = useState<Array<{ id: string; name: string }>>([])
  const [key, setKey] = useState<string | null>(null)

  const churchWide = !!me && (me.is_superadmin || me.roles.some((r) => !r.unit))

  useEffect(() => {
    if (!churchWide) return
    ccgApi.get<{ streams: Array<{ id: string; name: string; status: string }> }>('/streams').then((r) => {
      if (r.ok) setStreams(r.data.streams.filter((s) => s.status === 'active'))
    })
  }, [churchWide])

  const options = useMemo<FocusOption[]>(() => {
    if (!me) return []
    const out: FocusOption[] = []
    for (const r of me.roles) {
      if (r.unit) out.push({ key: `${r.unit.type}:${r.unit.id}`, type: r.unit.type as FocusType, id: r.unit.id, name: r.unit.name, role: r.role.name })
    }
    if (churchWide) {
      const role = me.is_superadmin ? 'Superadmin' : me.roles.find((r) => !r.unit)?.role.name ?? 'Admin'
      out.push({ key: 'global', type: 'global', id: null, name: 'City Church Group', role })
      for (const s of streams) if (!out.some((o) => o.key === `stream:${s.id}`)) out.push({ key: `stream:${s.id}`, type: 'stream', id: s.id, name: s.name, role })
    }
    return out
  }, [me, churchWide, streams])

  useEffect(() => {
    if (options.length === 0) return
    let saved: string | null = null
    try {
      saved = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      // storage unavailable: fall back to the first option
    }
    setKey((current) => {
      if (current && options.some((o) => o.key === current)) return current
      return saved && options.some((o) => o.key === saved) ? saved : options[0].key
    })
  }, [options])

  const setFocus = useCallback((k: string) => {
    setKey(k)
    try {
      window.localStorage.setItem(STORAGE_KEY, k)
    } catch {
      // ignore
    }
  }, [])

  const focus = options.find((o) => o.key === key) ?? null
  return (
    <FocusContext.Provider value={{ options, focus, setFocus, ready: !loading && (!!focus || options.length === 0) }}>
      {children}
    </FocusContext.Provider>
  )
}

export function useCcgFocus() {
  const ctx = useContext(FocusContext)
  if (!ctx) throw new Error('useCcgFocus must be used inside CcgFocusProvider')
  return ctx
}

/** Query string for the focused unit (empty for church-wide). */
export const focusQuery = (f: FocusOption | null) => (f && f.type !== 'global' && f.id ? `unit_type=${f.type}&unit_id=${f.id}` : '')
