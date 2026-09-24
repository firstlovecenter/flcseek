'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorScreen } from '@/components/base/ErrorScreen'
import { isGroupType } from '@/components/ccg/GroupCard'
import { GroupForm } from '@/components/ccg/GroupForm'

/** /ccg/groups/new?type=ccf&parent=<ccg id> */
function NewGroup() {
  const params = useSearchParams()
  const type = params.get('type') ?? ''
  if (!isGroupType(type)) return <ErrorScreen title="Unknown group" message="Choose what kind of group to add." />
  return <GroupForm type={type} parentId={params.get('parent')} />
}

export default function NewGroupPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <NewGroup />
    </Suspense>
  )
}
