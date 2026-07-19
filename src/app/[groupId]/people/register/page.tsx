'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LoadingScreen } from '@/components/base/LoadingScreen'

/** Legacy register page — registration opens via the shared modal. */
export default function RegisterRedirectPage() {
  const router = useRouter()
  const groupId = useParams().groupId as string

  useEffect(() => {
    if (groupId) router.replace(`/${groupId}?register=1`)
  }, [groupId, router])

  return <LoadingScreen label="Redirecting…" />
}
