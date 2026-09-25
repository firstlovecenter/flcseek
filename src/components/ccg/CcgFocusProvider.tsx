'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ccgApi } from '@/lib/ccg/client'
import { SEEKING_ROLES } from '@/lib/ccg/scope'
import { useCcgMe } from './CcgMeProvider'

/**
 * Two portals over one system, one login:
 *
 *   Sheep Seeking       Sheep Seekers and Sheep Seeking Overseers: registering
 *                       converts, placing them, following their milestones.
 *   City Church Groups  CCF, CCG and council leaders: members, attendance,
 *                       and the converts placed with them.
 *
 * The portal switcher moves between the portals a person has roles in; inside
 * a portal, the role switcher ("church in focus", as in the admin portal)
 * moves between their roles there. The central team and Seek superadmins have
 * both portals, church-wide or for any stream. Choices are remembered on this
 * device, the last role per portal.
 */

export type FocusType = 'global' | 'campus' | 'stream' | 'council' | 'ccg' | 'ccf'
export type Portal = 'seeking' | 'ccg'

export const PORTAL_LABEL: Record<Portal, string> = { seeking: 'Sheep Seeking', ccg: 'City Church Groups' }

export interface FocusOption {
  key: string
  portal: Portal
  type: FocusType
  id: string | null
  name: string
  role: string
  /** The role held there (sheep_seeker, ccf_coordinator…; 'admin' for church-wide rights). */
  roleKey: string
}

export const LEVEL_LABEL: Record<FocusType, string> = {
  global: 'Church-wide',
  campus: 'Campus',
  stream: 'Stream',
  council: 'Council',
  ccg: 'CCG',
  ccf: 'CCF',
}

interface Ctx {
  /** Every role option, in both portals. */
  options: FocusOption[]
  /** The options of the portal in use (what the role switcher lists). */
  portalOptions: FocusOption[]
  /** Portals this person has roles in. */
  portals: Portal[]
  portal: Portal | null
  setPortal: (p: Portal) => void
  focus: FocusOption | null
  setFocus: (key: string) => void
  ready: boolean
}

const FocusContext = createContext<Ctx | null>(null)
const STORAGE_KEY = 'ccg.focus'
const portalKey = (p: Portal) => `${STORAGE_KEY}.${p}`

function read(k: string): string | null {
  try {
    return window.localStorage.getItem(k)
  } catch {
    return null // storage unavailable
  }
}
function write(k: string, v: string) {
  try {
    window.localStorage.setItem(k, v)
  } catch {
    // ignore
  }
}

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
      if (!r.unit) continue
      // A Campus Leader works in both portals, for the whole campus or one of its streams.
      if (r.unit.type === 'campus') {
        for (const portal of ['ccg', 'seeking'] as const) {
          const base = { portal, role: r.role.name, roleKey: r.role.key }
          out.push({ ...base, key: `${portal}:${r.role.key}@campus:${r.unit.id}`, type: 'campus', id: r.unit.id, name: r.unit.name })
          for (const s of r.unit.streams ?? []) out.push({ ...base, key: `${portal}:${r.role.key}@stream:${s.id}`, type: 'stream', id: s.id, name: s.name })
        }
        continue
      }
      const key = `${r.role.key}@${r.unit.type}:${r.unit.id}`
      if (out.some((o) => o.key === key)) continue
      out.push({
        key,
        portal: SEEKING_ROLES.includes(r.role.key) ? 'seeking' : 'ccg',
        type: r.unit.type as FocusType,
        id: r.unit.id,
        name: r.unit.name,
        role: r.role.name,
        roleKey: r.role.key,
      })
    }
    if (churchWide) {
      const role = me.is_superadmin ? 'Superadmin' : me.roles.find((r) => !r.unit)?.role.name ?? 'Admin'
      const roleKey = me.is_superadmin ? 'admin' : me.roles.find((r) => !r.unit)?.role.key ?? 'admin'
      for (const portal of ['ccg', 'seeking'] as const) {
        out.push({ key: `${portal}:${roleKey}@global`, portal, type: 'global', id: null, name: 'City Church Group', role, roleKey })
        for (const s of streams) out.push({ key: `${portal}:${roleKey}@stream:${s.id}`, portal, type: 'stream', id: s.id, name: s.name, role, roleKey })
      }
    }
    return out
  }, [me, churchWide, streams])

  const portals = useMemo(() => (['seeking', 'ccg'] as const).filter((p) => options.some((o) => o.portal === p)), [options])

  useEffect(() => {
    if (options.length === 0) return
    const saved = read(STORAGE_KEY)
    setKey((current) => {
      if (current && options.some((o) => o.key === current)) return current
      return saved && options.some((o) => o.key === saved) ? saved : options[0].key
    })
  }, [options])

  const setFocus = useCallback(
    (k: string) => {
      setKey(k)
      write(STORAGE_KEY, k)
      const o = options.find((x) => x.key === k)
      if (o) write(portalKey(o.portal), k)
    },
    [options]
  )

  /** Switch portal, back to the role last used there. */
  const setPortal = useCallback(
    (p: Portal) => {
      const last = read(portalKey(p))
      const next = options.find((o) => o.key === last && o.portal === p) ?? options.find((o) => o.portal === p)
      if (next) setFocus(next.key)
    },
    [options, setFocus]
  )

  const focus = options.find((o) => o.key === key) ?? null
  const portal = focus?.portal ?? null
  const portalOptions = useMemo(() => options.filter((o) => o.portal === portal), [options, portal])
  return (
    <FocusContext.Provider
      value={{ options, portalOptions, portals, portal, setPortal, focus, setFocus, ready: !loading && (!!focus || options.length === 0) }}
    >
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

/**
 * In the Sheep Seeking portal: 'seeker' (a Sheep Seeker, who sees the converts
 * in their groups) or 'overseer' (a Sheep Seeking Overseer or the central
 * team, who see the stream's or the whole church's). Null in City Church Groups.
 */
export function useSeekingRole(): 'seeker' | 'overseer' | null {
  const { focus } = useCcgFocus()
  if (focus?.portal !== 'seeking') return null
  return focus.roleKey === 'sheep_seeker' ? 'seeker' : 'overseer'
}

export function useSeekerMode(): boolean {
  return useSeekingRole() !== null
}
