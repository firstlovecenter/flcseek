'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ccgApi } from '@/lib/ccg/client'
import type { Permission } from '@/lib/ccg/permissions'

export interface CcgMe {
  user: { id: string; username: string; name: string }
  is_superadmin: boolean
  roles: Array<{
    assignment_id: string
    role: { key: string; name: string; scope_level: string }
    /** A campus role also lists the campus's streams (a Campus Leader chooses one). */
    unit: { type: string; id: string; name: string; streams?: Array<{ id: string; name: string }> } | null
  }>
  permissions: Permission[]
  global_permissions: Permission[]
}

interface Ctx {
  me: CcgMe | null
  loading: boolean
  /** Held somewhere (enough to show a menu or page). */
  has: (perm: Permission) => boolean
  /** Held everywhere. */
  hasGlobal: (perm: Permission) => boolean
  reload: () => Promise<void>
}

const CcgMeContext = createContext<Ctx | null>(null)

export function CcgMeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<CcgMe | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const res = await ccgApi.get<CcgMe>('/me')
    setMe(res.ok ? res.data : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const has = useCallback((p: Permission) => !!me?.permissions.includes(p), [me])
  const hasGlobal = useCallback((p: Permission) => !!me?.global_permissions.includes(p), [me])

  return <CcgMeContext.Provider value={{ me, loading, has, hasGlobal, reload }}>{children}</CcgMeContext.Provider>
}

export function useCcgMe() {
  const ctx = useContext(CcgMeContext)
  if (!ctx) throw new Error('useCcgMe must be used inside CcgMeProvider')
  return ctx
}
