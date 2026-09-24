'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { CcgFocusProvider } from '@/components/ccg/CcgFocusProvider'
import { CcgShell } from '@/components/ccg/CcgShell'
import { CcgMeProvider } from '@/components/ccg/CcgMeProvider'
import { landingPathFor } from '@/lib/app-routing'

/** City Church Group area — requires CCG access. The API enforces this too. */
export default function CcgLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user?.ccg_access) router.replace(user ? landingPathFor(user) : '/auth')
  }, [user, loading, router])

  if (loading) return <LoadingScreen fullScreen label="Loading…" />
  if (!user?.ccg_access) return null
  return (
    <CcgMeProvider>
      <CcgFocusProvider>
        <CcgShell>
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </CcgShell>
      </CcgFocusProvider>
    </CcgMeProvider>
  )
}
