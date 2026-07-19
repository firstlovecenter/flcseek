'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import AppBreadcrumb from '@/components/AppBreadcrumb'
import { message } from '@/lib/toast'
import { ConvertProfile } from '@/components/convert/ConvertProfile'

export default function PersonDetailPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const personId = params.id as string

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
      return
    }
    if (
      !authLoading &&
      user &&
      user.role !== 'superadmin' &&
      user.role !== 'leadpastor' &&
      user.role !== 'overseer' &&
      user.group_id !== groupId
    ) {
      message.error('Unauthorized access to this group')
      router.push('/')
    }
  }, [user, authLoading, groupId, router])

  if (
    authLoading ||
    !user ||
    (user.role !== 'superadmin' &&
      user.role !== 'leadpastor' &&
      user.role !== 'overseer' &&
      user.group_id !== groupId)
  ) {
    return null
  }

  return (
    <>
      <AppBreadcrumb />
      <ConvertProfile
        personId={personId}
        groupId={groupId}
        onDeleted={() => router.push(`/${groupId}`)}
      />
    </>
  )
}
