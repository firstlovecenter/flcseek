'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { LoadingScreen } from '@/components/base/LoadingScreen'
import { CcgFocusProvider, useSeekingRole } from '@/components/ccg/CcgFocusProvider'
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
          <Content>{children}</Content>
        </CcgShell>
      </CcgFocusProvider>
    </CcgMeProvider>
  )
}

/** Pages are capped for reading, except the milestones table (converts, and a sheep seeking role's home), which uses the full width. */
function Content({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const seeking = useSeekingRole() !== null
  const wide = pathname === '/ccg/converts' || (pathname === '/ccg' && seeking)
  return <div className={cn('mx-auto w-full', !wide && 'max-w-6xl')}>{children}</div>
}
