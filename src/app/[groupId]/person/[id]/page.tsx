'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import AppBreadcrumb from '@/components/AppBreadcrumb'
import { message } from '@/lib/toast'
import { ConvertProfile } from '@/components/convert/ConvertProfile'
import { useGroupYears } from '@/hooks/use-group-years'
import { canAccessGroupClient } from '@/lib/group-access'
import { LoadingScreen } from '@/components/base/LoadingScreen'

export default function PersonDetailPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const personId = params.id as string

  const { groupName, loading: yearsLoading } = useGroupYears(
    groupId,
    !!(user && !authLoading)
  )

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
      return
    }
    if (authLoading || !user) return

    const orgRoles = ['superadmin', 'leadpastor', 'overseer']
    if (orgRoles.includes(user.role || '')) return
    if (user.group_id === groupId) return
    if (yearsLoading) return

    if (!canAccessGroupClient(user, groupId, groupName)) {
      message.error('Unauthorized access to this group')
      router.push('/')
    }
  }, [user, authLoading, groupId, router, groupName, yearsLoading])

  const orgRoles = ['superadmin', 'leadpastor', 'overseer']
  const allowed =
    user &&
    (orgRoles.includes(user.role || '') ||
      user.group_id === groupId ||
      canAccessGroupClient(user, groupId, groupName))

  if (authLoading || !user || yearsLoading || !allowed) {
    return <LoadingScreen label="Loading…" />
  }

  return (
    <>
      <AppBreadcrumb />
      <ConvertProfile
        personId={personId}
        groupId={groupId}
      />
    </>
  )
}
