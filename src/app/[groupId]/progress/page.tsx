'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LoadingScreen } from '@/components/base/LoadingScreen'

/** Legacy progress page — milestone editing lives on the group home. */
export default function ProgressRedirectPage() {
  const router = useRouter()
  const groupId = useParams().groupId as string

  useEffect(() => {
    if (groupId) router.replace(`/${groupId}`)
  }, [groupId, router])

  return <LoadingScreen label="Redirecting…" />
}
