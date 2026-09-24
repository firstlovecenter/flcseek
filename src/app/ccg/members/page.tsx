'use client'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { PeopleDirectory } from '@/components/ccg/PeopleDirectory'

export default function CcgMembersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <PeopleDirectory kind="member" />
    </Suspense>
  )
}
