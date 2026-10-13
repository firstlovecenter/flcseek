'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { SEEKING_ROLES } from '@/lib/ccg/scope'
import { useCcgMe } from './CcgMeProvider'

/**
 * Two portals over one system, one login:
 *
 *   Sheep Seeking       Sheep Seekers and Sheep Seeking Overseers: registering
 *                       converts, placing them, following their milestones.
 *   City Church Groups  CCF Coordinators, CCG Overseers and Stream Leaders: members, attendance,
 *                       and the converts placed with them.
 *
 * The portal switcher moves between the portals a person has roles in; inside
 * a portal, the role switcher ("church in focus", as in the admin portal)
 * moves between their roles there: only the roles they are directly assigned,
 * at the unit they are assigned to, never the units below it. The central
 * team and Seek superadmins have both portals, church-wide. Choices are
 * remembered on this device, the last role per portal.
 *
 * Higher roles drill down from there (sidebar): campus → stream → council →
 * CCG → CCF in City Church Groups, campus → stream in Sheep Seeking. The role
 * stays the one in focus; `focus` carries the unit drilled into, so every page
 * follows it. `roleFocus` is the role's own unit.
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
  /** The role in focus, at the unit drilled into (what pages scope to). */
  focus: FocusOption | null
  /** The role in focus, at its own unit. */
  roleFocus: FocusOption | null
  setFocus: (key: string) => void
  /** The units drilled into below the role's unit, top first. */
  drillPath: DrillUnit[]
  /** Open a unit one level below the current one. */
  drillTo: (unit: DrillUnit) => void
  /** Back up to drillPath[index] (-1: the role's own unit). */
  drillBack: (index: number) => void
  ready: boolean
}

export interface DrillUnit {
  type: Exclude<FocusType, 'global'>
  id: string
  name: string
}

const FocusContext = createContext<Ctx | null>(null)
const STORAGE_KEY = 'ccg.focus'
const portalKey = (p: Portal) => `${STORAGE_KEY}.${p}`
const drillKey = (focusKey: string) => `${STORAGE_KEY}.drill.${focusKey}`

function readDrill(focusKey: string): DrillUnit[] {
  try {
    const v = JSON.parse(read(drillKey(focusKey)) ?? '[]')
    return Array.isArray(v) ? v.filter((u) => u && typeof u.id === 'string' && typeof u.name === 'string' && typeof u.type === 'string') : []
  } catch {
    return []
  }
}

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
  const [key, setKey] = useState<string | null>(null)
  // The drill-down below the role in focus; each role keeps its own on this device.
  const [drill, setDrill] = useState<{ key: string | null; path: DrillUnit[] }>({ key: null, path: [] })
  const drillPath = useMemo(() => (drill.key === key ? drill.path : key ? readDrill(key) : []), [drill, key])

  const churchWide = !!me && (me.is_superadmin || me.roles.some((r) => !r.unit))

  const options = useMemo<FocusOption[]>(() => {
    if (!me) return []
    const out: FocusOption[] = []
    for (const r of me.roles) {
      if (!r.unit) continue
      // A campus role is for the whole campus: a Campus Leader in both portals,
      // a campus Sheep Seeking role in Sheep Seeking only.
      if (r.unit.type === 'campus') {
        const portals = SEEKING_ROLES.includes(r.role.key) ? (['seeking'] as const) : (['ccg', 'seeking'] as const)
        for (const portal of portals) {
          out.push({ key: `${portal}:${r.role.key}@campus:${r.unit.id}`, portal, type: 'campus', id: r.unit.id, name: r.unit.name, role: r.role.name, roleKey: r.role.key })
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
      }
    }
    return out
  }, [me, churchWide])

  const portals = useMemo(() => (['seeking', 'ccg'] as const).filter((p) => options.some((o) => o.portal === p)), [options])

  useEffect(() => {
    if (options.length === 0) return
    const saved = read(STORAGE_KEY)
    setKey((current) => {
      if (current && options.some((o) => o.key === current)) return current
      return saved && options.some((o) => o.key === saved) ? saved : options[0].key
    })
  }, [options])

  const saveDrill = useCallback(
    (path: DrillUnit[]) => {
      setDrill({ key, path })
      if (key) write(drillKey(key), JSON.stringify(path))
    },
    [key]
  )
  const drillTo = useCallback((unit: DrillUnit) => saveDrill([...drillPath.filter((u) => u.id !== unit.id), unit]), [drillPath, saveDrill])
  const drillBack = useCallback((index: number) => saveDrill(drillPath.slice(0, index + 1)), [drillPath, saveDrill])

  const setFocus = useCallback(
    (k: string) => {
      // Choosing a role starts at its own unit.
      write(drillKey(k), '[]')
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

  const roleFocus = options.find((o) => o.key === key) ?? null
  const portal = roleFocus?.portal ?? null
  const portalOptions = useMemo(() => options.filter((o) => o.portal === portal), [options, portal])
  const here = drillPath[drillPath.length - 1]
  const focus = useMemo<FocusOption | null>(() => (roleFocus && here ? { ...roleFocus, type: here.type, id: here.id, name: here.name } : roleFocus), [roleFocus, here])
  return (
    <FocusContext.Provider
      value={{
        options,
        portalOptions,
        portals,
        portal,
        setPortal,
        focus,
        roleFocus,
        setFocus,
        drillPath,
        drillTo,
        drillBack,
        ready: !loading && (!!focus || options.length === 0),
      }}
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

const UNIT_FILTER: Record<Exclude<FocusType, 'global'>, string> = { campus: 'campus_id', stream: 'stream_id', council: 'council_id', ccg: 'ccg_id', ccf: 'ccf_id' }

/** List filter for the focused unit, e.g. `stream_id=…` (empty for church-wide): what list APIs take. */
export const focusFilter = (f: FocusOption | null) => (f && f.type !== 'global' && f.id ? `${UNIT_FILTER[f.type]}=${f.id}` : '')

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

/**
 * A Campus Leader or a Stream Leader in focus: they get
 * Seek's Lead Pastor screens — a month, then (a Campus Leader) a stream, then
 * its Milestones, Attendance and Reports, read only. Null for everyone else.
 */
export function useLeaderView(): { type: 'campus' | 'stream'; id: string; name: string } | null {
  const { focus, roleFocus } = useCcgFocus()
  if (!focus?.id || !roleFocus) return null
  const leader = (roleFocus.type === 'campus' && roleFocus.roleKey === 'campus_leader') || (roleFocus.type === 'stream' && roleFocus.roleKey === 'overseer')
  // Drilled below a stream, a leader gets the ordinary (view-only) screens for that unit.
  if (!leader || (focus.type !== 'campus' && focus.type !== 'stream')) return null
  return { type: focus.type, id: focus.id, name: focus.name }
}

export function useSeekerMode(): boolean {
  return useSeekingRole() !== null
}
